# Fase 4 — Cálculos inline en el árbol (eliminar hoja Calc)

## Contexto

Hoy cada nodo del árbol escribe su valor con una fórmula que referencia la hoja hidden `DT_Calculos`: por ejemplo `=DT_Calculos!$BN$5`. La hoja Calc tiene 12 columnas (NodeId, ParentId, Depth, Type, Label, Probability, Cost, TerminalValue, ChildrenEV, NetEV, OptimalChildId, IsOptimalPath) y reconstruye el EV con `SUM(p*childNetEV) - cost`, `MAX/MIN(children)`, etc.

El usuario (Bárbara Fernández, Quintana Energy) acaba de pedir:

> "no haces las cuentas ahi mismo, hace falta hacerlas en otra hoja? no podemos dejar las cuentas ahi y si queres abajo del arbol dejar la tabla pero referenciada al dibujo? Seguis dejando texto mezclado con numeros en el arbol cuando yo quiero ver los numeros conectados directamente en el arbol"

Traducido: quiere abrir una celda del árbol y ver la fórmula que suma los hijos, no un `=DT_Calculos!$BN$5` opaco. Debugeabilidad + confianza en el resultado.

## Objetivo de Fase 4

Todas las fórmulas que calculan el Expected Value de cada nodo viven **en la misma hoja donde se dibuja el árbol** (`Arbol_Decision`) y referencian directamente las celdas visibles de los nodos hijos.

Como efecto colateral:
- Se elimina la hoja `DT_Calculos` (o se reduce al mínimo) y toda la maquinaria `CalcSheetMetadata`.
- Editar una probabilidad o un costo inline recalcula todo el árbol automáticamente.

No estamos cambiando el motor de cálculo de TypeScript (`ExpectedValueCalculator.ts` / `RollbackAnalysis.ts`) — solo el cómo se deja escrito en Excel. El motor TS sigue siendo la fuente de verdad para la UI React del taskpane y para los tests.

## Diseño propuesto

### 1. Layout por nodo (DESIGN.md §4.1 sigue, solo cambia qué va adentro)

Cada nodo ocupa 4 filas × 4 columnas en la grilla (`GRID.nodeRows = 4`, `GRID.nodeCols = 4`):

```
row+0  [shape marker (forma geométrica flotante)]
row+1  [ label (merged, 4 cols) ]
row+2  [ valor esperado (merged, 4 cols) ]    ← HOY: =Calc!..., FUTURO: fórmula inline
row+3  [ detalle: prob · costo · tiempo (merged, 4 cols) ]
```

La propuesta **no** cambia el layout visual. Cambia solamente el contenido de la celda `row+2` (EV) y el detalle de `row+3` (prob y cost pasan a celdas editables propias).

### 2. Celdas editables para prob / cost

**Problema a resolver**: hoy la fila de detalle es UN solo merge con `"Prob. 65% · Costo: $500k · 30 dias"`. Si la fórmula del padre quiere referenciar la probabilidad del hijo necesita una celda con el número crudo, no un string.

**Propuesta A (preferida)** — descomponer la fila 3 en 3 celdas no-merged, una por campo:

```
row+3, col+0   prob (0.65, número, formato porcentaje)
row+3, col+1   cost (500000, número, formato moneda)
row+3, col+2   time ("30 días", texto)
row+3, col+3   — (vacío)
```

Ventajas:
- prob y cost quedan como celdas direccionables. El padre escribe `=C10*C12 + D10*D12 - C15` (p1*ev1 + p2*ev2 - costPadre).
- Bárbara edita una celda, Excel recalcula instantáneo.

Desventajas:
- Antes era una sola celda centrada con todo el detalle — visual un poco menos limpio. Mitigación: labels arriba (fila row+0 ya tiene el shape en un costado → sobra espacio) o cabecera propia.

**Propuesta B** — mantener el detalle como texto merged, pero guardar prob y cost en celdas ocultas en la misma fila, a la derecha del nodo dentro del colGap (columnas 4..8 del bloque). Menos editable para el usuario, pero visual intacto.

Voy con **A**, discutimos si prefiere B.

### 3. Fórmulas por tipo de nodo

Sea `EV(n)` la celda del valor esperado del nodo `n` (en la hoja del árbol, `row+2, col..col+3` merged; la fórmula va en el top-left de esa merge).

**End (triángulo)**:
```
EV(end) = <payoff literal> - <cost literal si hay>
```
Podemos escribirlo como número crudo (si no hay cost) o fórmula `=600000-200000`. Lo dejamos como fórmula cuando haya cost para que sea auditable.

**Chance (círculo)**:
```
EV(chance) = SUMPRODUCT(probs, childEVs) - cost(chance)
```
Implementación: `=prob_c1*EV(c1) + prob_c2*EV(c2) + ... - cost_chance`
Usar `SUMPRODUCT({prob1;prob2},{ev1;ev2})` es elegante pero no se adapta bien a celdas no contiguas. Mejor sumatoria explícita: `=B10*C15+D10*E15+... - F20`.
La probabilidad la tomamos de la **celda de detalle del hijo** (cada hijo de un chance ya tiene su prob en `row+3, col+0`).
Si el nodo chance tiene cost propio → lo restamos al final.

**Decision (cuadrado)**:
```
modo valor (maximize):   EV(decision) = MAX(EV(c1), EV(c2), ...) - cost(decision)
modo costo (minimize):   EV(decision) = MIN(EV(c1), EV(c2), ...) + cost(decision)
```
El cost de una decisión es un gasto que se suma al path (o resta al valor). Espejar lo que hoy hace `ExpectedValueCalculator.ts`.

### 4. Orden de escritura

Post-order:
1. `flattenTree()` ya lo tenemos — pero necesitamos post-order (hijos antes que padres).
2. Primero escribimos la celda EV y la celda de prob/cost de cada hoja terminal.
3. Subimos recursivamente: cuando todos los hijos de un nodo ya tienen su `evCellAddress` conocido, escribimos la fórmula del nodo.

En paralelo mantenemos un `Record<nodeId, { evAddress: string; probAddress: string; costAddress: string }>` apuntando a direcciones **en la misma hoja** (sin prefijo de sheetName, para que la fórmula quede legible: `=C10*D15+...`).

### 5. Qué pasa con DT_Calculos

Opciones:

**A. Borrar la hoja completa.** `CalculationSheet.ts` desaparece, `WorkbookConstants` pierde `CALC_*`, `types.ts` pierde `CalcSheetMetadata`, `CalcSheetNodeRef`. `renderToExcel` no la crea ni la escribe. `WorkbookState.ts` ya guarda el estado en `_DecisionTreeData` (otra hoja veryHidden), no cambia.

**B. Reducirla a tabla-espejo.** Mantener una hoja visible con una tabla plana (NodeId, Label, Prob, Cost, EV) para análisis tipo pivot/filter, pero generada a partir de las fórmulas inline (las celdas EV del árbol son la fuente). La tabla de Resumen de caminos de abajo del árbol ya está haciendo algo parecido.

Prefiero **A**: la tabla de caminos inferior (`renderPathsTable`) ya muestra la info agregada que un analista quiere. La hoja Calc de hoy es un duplicado oculto que solo confunde.

### 6. Tabla de caminos inferior

Hoy `renderPathsTable` escribe valores literales calculados con el motor TS (`enumeratePaths` → number). Para ser consistente con "todo referenciado al dibujo", la columna de valor esperado puede referenciar la celda EV del **nodo terminal** de cada camino:

```
Camino                             Prob.    Valor Esperado    Vs recomendado
Operar → Workover → Alta recup.    65%      =C42              —
Operar → Workover → Baja recup.    35%      =C50              =C50-C42
...
```

La probabilidad del camino sigue siendo literal (producto de probs de las chances), o también fórmula: `=C25*C38` para que editar afecte tabla también.

**Scope de Fase 4**: dejo la tabla con valores literales calculados en TS (como hoy) y sumo una nota "ver fórmulas en el árbol". Referenciarla inline es Fase 4.5 o post-feedback.

## Plan de implementación (pasos ejecutables)

### Paso 1 — Helper `TreeCellAddresses`
Archivo nuevo: `src/renderer/TreeCellAddresses.ts`

```ts
export interface NodeCellAddresses {
  evAddress: string;       // e.g. "$C$8" (same-sheet, $ anchors para evitar shift)
  probAddress: string;     // "$C$9" (en la fila de detalle, col+0)
  costAddress: string;     // "$D$9"
}

export function buildNodeCellAddresses(layout: LayoutResult): Record<string, NodeCellAddresses>
```

Deriva las direcciones desde `LayoutNode.row`/`col` + GRID. No toca Excel, es puro. Testeable.

### Paso 2 — Refactor `writeNodeCells` en `ExcelShapeRenderer.ts`

Firma nueva:
```ts
function writeNodeCells(
  sheet: Excel.Worksheet,
  layoutNode: LayoutNode,
  renderNode: RenderNodeContent,
  tree: DecisionTreeData,
  addresses: Record<string, NodeCellAddresses>,
)
```

Dentro:
- **Fila row+1 (label)** — igual que hoy, merge 4 cols, texto.
- **Fila row+2 (EV)** — ya no `=Calc!...`. Genera la fórmula inline según tipo:
  - End: `=<payoff>` o `=<payoff>-<cost>` si tiene cost
  - Chance: sumatoria explícita de `prob_i * EV_i` menos `cost_self` si existe
  - Decision: `MAX/MIN(EV_i)` ±`cost_self`
  - Si falta algún hijo o falta EV de hijo → celda vacía con mensaje (validación upstream)
- **Fila row+3 (detalle)** — descomponer: col+0 prob (%, `0.0%`), col+1 cost ($), col+2 time (texto). No merge.

Fila row+3 pierde el "text block" unificado. Para que visualmente se lea, usar labels superiores chicos "prob/costo/tiempo" o tooltip por celda (nombre de rango).

### Paso 3 — Eliminar `writeCalculationModel` call desde `renderToExcel`

`renderToExcel`:
- Ya no llama `getOrCreateSheet(context, CALC_SHEET_NAME, ...)`.
- Ya no llama `writeCalculationModel(...)`.
- Si la hoja `DT_Calculos` existe en el workbook (de runs anteriores) → borrarla para no dejar basura. Helper `removeSheetIfExists(context, CALC_SHEET_NAME)`.

### Paso 4 — Cleanup de tipos y archivos muertos

- `src/models/types.ts`: eliminar `CalcSheetNodeRef`, `CalcSheetMetadata`. `LayoutNode.calcRow`, `LayoutEdge.calcRow` → borrar si nadie los usa (grep).
- `src/excel/CalculationSheet.ts`: eliminar archivo.
- `src/excel/WorkbookConstants.ts`: eliminar `CALC_*` (dejar `TREE_SHEET_NAME`, `DATA_SHEET_NAME`, `DEBUG_SHEET_NAME`).
- `src/engine/ExpectedValueCalculator.ts` no se toca — la UI React lo sigue usando.
- `src/taskpane/hooks/useDrawTree.ts` (o donde invoque `renderToExcel`): si pasa `CalcSheetMetadata`, ya no hace falta generarlo.

### Paso 5 — Actualizar `clearRenderedSheets`

Remover o borrar la hoja `DT_Calculos` cuando se limpia.

### Paso 6 — Tests

Agregar en `test/` (vitest):
- `buildNodeCellAddresses` retorna addresses válidas para árbol de 5 nodos.
- Generador de fórmulas (`buildEvFormula(node, children, addresses, mode)`) produce strings correctos para cada tipo.

### Paso 7 — Verificación manual

Con el workover example:
1. Dibujar árbol.
2. Click en celda EV del root → barra de fórmulas muestra `=C10*C15+C11*C20-C5` (o similar).
3. Editar la celda de prob de un hijo → el EV del padre se actualiza sin volver a dibujar.
4. Editar la de cost → idem.
5. Hoja `DT_Calculos` no existe en el workbook.

## Riesgos / edge cases

1. **Shape.placement y formula refresh**: los shapes son flotantes (OneCell). Editar una celda no mueve los shapes, pero sí recalcula fórmulas. OK.
2. **Probabilidades que no suman 1** en un chance: la fórmula `p1*ev1+p2*ev2` da resultado "equivocado" si suman >1 o <1, pero es consistente con lo que haría un user que edita y se olvida de balancear. La UI React ya valida en `validate()` antes de dibujar. Dejamos que Excel muestre el EV "raro" si el user rompe la suma post-render → es feature (transparencia).
3. **Nodo con childIds vacío que no sea terminal**: es inválido en el modelo (`validate()` lo atrapa). Por si acaso, la fórmula de un chance/decision sin hijos → escribir "" en la celda, no `=SUM()` vacío que rompe.
4. **Cost o prob null**: tratarlos como 0 al generar la fórmula (`prob ?? 0`, `cost ?? 0`). La celda de detalle queda en blanco visual pero la fórmula padre sigue compilando.
5. **$ anchors**: usar `$C$8` para evitar que copy-paste del usuario desplace referencias inesperadamente.
6. **End node con payoff null**: rarísimo, pero dejar celda vacía.
7. **Edge labels**: los labels de edge (fila `edge.connectorCol`) siguen siendo texto, no se tocan.

## Criterio de éxito

- [ ] Abro celda EV del root del workover example → barra muestra fórmula con refs a celdas visibles, no a `DT_Calculos`.
- [ ] Hoja `DT_Calculos` no existe.
- [ ] Edito una prob o cost inline → EV root se recalcula sin botón.
- [ ] `npx tsc --noEmit` y `npm run build` limpios.
- [ ] Codex review post-implementación: 0 issues High, Medium aceptables si son cosmética.
- [ ] Tests de `buildEvFormula` pasan.

## Fuera de scope (para fase futura)

- Tabla de caminos con fórmulas inline (hoy valores literales TS).
- Etiquetas visuales ("p", "$") junto a las celdas prob/cost para que sean auto-explicativas sin documentación.
- Validación live si probs de un chance no suman 1 (condicional format rojo).
