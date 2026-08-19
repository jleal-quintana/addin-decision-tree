# Árbol de Decisión — Add-in de Excel

Add-in de Excel para construir, evaluar y renderizar árboles de decisión aplicados a industria petrolera (workovers, perforación, recompletación, abandono). Pensado para Quintana Energy.

**Stack.** React 19 + TypeScript + Fluent UI v9 + Office.js (ExcelApi 1.10+) + recharts.

**Branding.** Verde Oliva Quintana `#6B7B38` + Inter/Montserrat. Ver [`DESIGN.md`](./DESIGN.md) antes de tocar UI/copy/layout.

---

## Cómo usar

### Para usuarios finales (Bárbara y equipo de ingeniería)

Ver [`tutorial/instalacion.md`](./tutorial/instalacion.md) — incluye instructivo paso a paso para sideloadear el manifest en Excel.

Versión deployada: https://jleal-quintana.github.io/addin-decision-tree/

### Para desarrolladores

```bash
npm install
npm run dev          # webpack dev server en https://localhost:3000
npm run start:desktop # arranca Excel con el add-in sideloadeado
npm run test          # vitest
npm run validate      # valida manifest.xml
npm run build         # build prod a dist/
```

Para parar Excel/dev-server: `npm run stop:desktop`.

---

## Distribución

- **`manifest.xml`** — apunta a `https://localhost:3000` (dev).
- **`manifest.prod.xml`** — apunta a `https://jleal-quintana.github.io/addin-decision-tree/` (prod). Es el que reciben los usuarios.
- **GitHub Actions** (`.github/workflows/deploy.yml`) — cada push a `main` corre `npm run build` y publica `dist/` a GitHub Pages. El usuario no tiene que reinstalar para recibir updates.

Tienen distinto `<Id>` así que podés tener ambos sideloadeados en simultáneo (dev + prod) sin que se pisen.

---

## Arquitectura (resumen)

| Capa | Archivos clave |
|---|---|
| **Modelos** | `src/models/types.ts`, `src/models/DecisionTree.ts` (CRUD, serialize/deserialize) |
| **Engine** | `ExpectedValueCalculator.ts` (rollback de valor/costo esperado), `DecisionStrategy.ts` (política contingente), `DecisionComparison.ts` (margen vs alternativa), `SensitivityAnalysis.ts`, `PathEnumeration.ts` |
| **Layout** | `src/renderer/TreeLayoutEngine.ts` (Reingold-Tilford L→R) |
| **Render Excel** | `src/renderer/ExcelShapeRenderer.ts` (orquestador), `src/excel/CalculationSheet.ts` (memoria de cálculo), `src/excel/ShapeManager.ts` |
| **Persistencia** | `src/excel/WorkbookState.ts` — JSON chunked en hoja `veryHidden` `_DecisionTreeData` |
| **UI** | `src/taskpane/App.tsx`, components (Toolbar, TreeBuilder, NodeEditor, CalculationResults, …) |
| **Estado** | `useReducer` + Context en `src/taskpane/TreeContext.tsx` |

### Hojas que crea el add-in en el libro

| Hoja | Visibilidad | Contenido |
|---|---|---|
| `Arbol_Decision` | visible | Árbol dibujado + memoria de cálculo + recomendación + tabla de caminos. Es el entregable imprimible. |
| `_DecisionTreeData` | very hidden | JSON serializado del árbol (persistencia). |
| `DT_DebugLog` | hidden (modo debug) | Log de operaciones de render. **Default: no se crea.** Solo aparece si activás debug. |

---

## Modo debug (apagado por defecto)

El sistema de diagnóstico queda **off** por defecto para no molestar a usuarios finales. Cuando algo raro pasa, podés activarlo:

- **Opción 1** — query param: agregá `?debug=1` a la URL del taskpane (en dev) o `?debug=visible` para que la hoja `DT_DebugLog` se muestre directamente sin tener que ir a "Mostrar".
- **Opción 2** — desde la consola del taskpane (DevTools en Edge sobre el iframe del taskpane):

  ```js
  localStorage.setItem("dt-debug", "1");
  location.reload();
  ```

Cuando está activo:

- Aparece el panel **"Diagnóstico"** dentro del taskpane.
- Cada operación de render se loguea en consola.
- Se crea la hoja oculta `DT_DebugLog` con un timeline de operaciones (timestamp, status, duración, detalles).

Para apagarlo: `localStorage.setItem("dt-debug", "0")` (o cualquier valor que no sea `"1"`) y reload.

---

## Deploy

Push a `main` → GitHub Actions corre build + deploy a Pages → ~1 minuto y la nueva versión está en vivo. El manifest sideloadeado por el usuario carga la URL pública, así que no hay que reinstalar nada.

```bash
# Después de cualquier cambio:
git push origin main
# Esperar ~1 min — listo
```

Para verificar el deploy: `gh run list --limit 1`.
