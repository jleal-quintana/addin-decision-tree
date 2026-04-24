# Design System — Decision Tree Add-in (Quintana Energy)

Source of truth for todo lo visual y de lenguaje en el add-in. Antes de tocar UI, color, tipografía, wording o layout, leer este documento. Toda desviación requiere aprobación explícita y decision-log abajo.

## 1. Contexto

**Producto.** Add-in de Excel para construir y presentar análisis de decisión en la industria petrolera. Workovers, perforación, recompletación, inversión, abandono de pozos. El árbol es una herramienta del análisis, no el producto.

**Usuaria primaria.** Bárbara Fernández (ingeniería Quintana Energy) y su equipo. Ingeniera de producción, no teórica de decisión. Lenguaje esperado: español rioplatense técnico, sin jerga académica.

**Working context.** La analista arma un caso, lo dibuja en Excel, lo **imprime o exporta a PDF** y se lo muestra a gerencia. El entregable final es un documento visual, no una feature de la app.

**Memorable thing.** *"Esto es Excel, pero pensado."* Cuando alguien ve la hoja dibujada por el add-in, siente que está mirando un análisis de ingeniería de Quintana. No un demo genérico, no una slide de consultora, no un tutorial de teoría de decisión.

## 2. Lenguaje de dominio (traducción obligatoria)

La jerga de teoría de decisión se traduce al lenguaje de Bárbara en toda la UI y en todo el output.

| Jerga (prohibida en UI) | Términos del add-in |
|---|---|
| Maximize / Minimize mode | **Modo Valor** / **Modo Costo** (selector con descripción: "elegir mejor resultado esperado" / "elegir menor costo esperado") |
| Decision node | **Decisión** (vos elegís) · ícono cuadrado |
| Chance node | **Incertidumbre** (la naturaleza o el pozo responde) · ícono círculo |
| End / Terminal node | **Resultado final** · ícono triángulo |
| Expected Value | **Valor esperado** o **Costo esperado** según modo |
| Payoff | **Resultado** ($) |
| Optimal path | **Camino recomendado** |
| Probability | **Probabilidad** (siempre como `XX%`, no decimal) |
| Decision Tree | **Análisis de decisión** (el output completo), **Árbol** (el dibujo dentro) |
| Sensitivity analysis | **Análisis de sensibilidad** (OK, es jerga del dominio) |

El campo `mode` en el código puede quedarse como `"maximize" | "minimize"` por conveniencia técnica, pero **todo lo que el usuario ve** usa la tabla de arriba.

## 3. Brand tokens

### 3.1 Paleta (oficial Quintana, Feb 2026)

| Token | Hex | Uso |
|---|---|---|
| `olive` / principal | `#6B7B38` | Color primario. Headers de documento, barra de marca, botones CTA, bordes de sección |
| `forest` / oscuro | `#33492D` | Portada PDF, backgrounds oscuros, texto sobre highlight verde lima |
| `marine` / contraste | `#1B4B6C` | Headers secundarios, líneas de contorno del árbol, conectores normales |
| `lime` / acento | `#E2FF87` | Highlight del **camino recomendado**, cajas de resumen. Uso escaso y significativo |
| `cream` | `#FFEAC6` | Backgrounds cálidos, acentos suaves |
| `slate` / gris azulado | `#DAE0E5` | Bordes finos, filas alternas, separadores |
| `beige` | `#AD977D` | Texto de metadatos (fecha, autor), footers |
| `paper` | `#FFFFFF` | Background base |
| `ink` | `#1A1A1A` | Texto principal |
| `ink-muted` | `#5B6470` | Texto secundario |
| `success` | `#2E7D32` | OK / valor positivo |
| `warning` | `#B35C00` | Atención |
| `error` | `#9C1F1F` | Error / validación |

**Reglas de uso.**
- `olive` es el color de marca. Todo encabezado de nivel 1 en documento y en UI.
- `lime` **solo** para destacar el camino recomendado y el número clave del resumen. Abusar de lime lo mata.
- Sin gradientes morados, sin tonos pastel random, sin emojis, sin iconografía 3D, sin sombras marcadas.
- Dark mode no aplica: Excel y Office Taskpane se usan en light-first. No inventamos dark.

### 3.2 Tipografía

- **Display / titulares:** Montserrat 700/800. Usos: H1 de documento, título de secciones, nombre del análisis en portada.
- **UI / labels:** Montserrat 500/600. Usos: headers de columna, labels de campos, metadatos destacados.
- **Cuerpo / datos:** Inter 400/700. Usos: texto corrido, celdas de datos, tablas, números en Excel.
- **Mono:** no se usa (no hay código visible al usuario).

**Fallbacks** (Excel/Office desktop). Montserrat y Inter no están garantizadas en todas las máquinas de Quintana. El render Excel usa **Calibri** como fallback seguro (está en todas las máquinas) pero mantiene la jerarquía de pesos. HTML/React del taskpane sí carga Montserrat + Inter via Google Fonts (hay red).

**Escala** (pt en Excel, px en taskpane):

| Nivel | Excel (pt) | Taskpane (px) |
|---|---|---|
| Título de documento (H1) | 18 | — |
| Sección (H2) | 14 | 15 / 600 |
| Subsección (H3) | 12 | 13 / 600 |
| Label / header tabla | 10 | 12 / 500 |
| Cuerpo | 11 | 13 / 400 |
| Metadatos | 9 | 11 / 400 |
| Footnote | 8 | 10 / 400 |

### 3.3 Spacing

- Base: **4px** en taskpane, **Excel row-height 16pt + shape-row 36pt** en spreadsheet.
- Escala: `xs 4 · sm 8 · md 12 · lg 16 · xl 24 · 2xl 32`.
- Densidad: **compacta** pero no apretada. Bárbara está en un taskpane angosto (350px) y en Excel con mucha info en pantalla; no hay espacio para diseño "spacious".

### 3.4 Iconografía

- Trazo **outlined**, stroke 1.5px, sin relleno en íconos de acción (Fluent-like).
- Shapes del árbol: cuadrado (decisión), círculo (incertidumbre), triángulo (resultado). **No** reemplazar por emoji ni iconos ornamentales.
- Esquinas ligeramente redondeadas en botones y cajas (`border-radius` 4px). El isotipo Quintana ya tiene esa geometría; la UI la refleja.

### 3.5 Logos (en `assets/branding/`)

| Archivo | Uso |
|---|---|
| `logo_principal.png` | Horizontal "Quintana Energy" verde claro sobre fondo claro. Portada PDF, header del documento Excel cuando hay espacio. |
| `logo_isotipo.png` | "Q" solo, verde oscuro. Header chico del taskpane, header de Excel en modo compacto, favicon, icono del add-in. |
| `logo_blanco.png` | Versión blanca del logo para fondos oscuros (portada verde bosque). |

**Reglas** (del manual):
- No rotar, deformar, cambiar transparencia, ponerle sombra ni recrearlo con otra tipografía.
- Safety zone: espacio libre de `½ altura del isotipo` alrededor del logo.
- En Excel, el logo va como imagen embebida en fila de header, no como shape editable.

## 4. Layout del Taskpane (React + Fluent UI v9)

**Columna única**, ancho típico 320–400px. Tres zonas verticales:

```
┌──────────────────────────────┐
│  [Q] Análisis de decisión  ?│  ← header sticky (40px): isotipo + título + help
│  Pozo LJ-47 · Modo Costo    │  ← subtítulo editable con nombre del caso
├──────────────────────────────┤
│                              │
│  Zona activa (tabs)          │  ← scroll interno: Armar · Resultado
│                              │
│                              │
├──────────────────────────────┤
│  [ Dibujar en Excel ]       │  ← CTA hero sticky abajo (olive, 44px)
│  Guardar · Cargar · Nuevo    │  ← acciones secundarias (ghost, text-only)
└──────────────────────────────┘
```

### 4.1 Empty state (primera experiencia)

No dos botones genéricos "Maximizar / Minimizar". En su lugar: una pregunta y tres caminos nombrados según el caso.

> **¿Qué estás evaluando?**
>
> - **Intervención en pozo** (workover, recompletación, estimulación) · *Modo Costo*
> - **Inversión o perforación** (nuevo pozo, adquisición) · *Modo Valor*
> - **Desde cero** — elegir modo manualmente

Cada opción es una card con título, subtítulo explicando en una línea qué caso cubre, y chip de modo. Debajo: *"¿Querés ver un ejemplo resuelto primero?"* con los 3 ejemplos actuales (workover, perforación, lanzamiento).

### 4.2 Armar (edición de nodos)

Se mantiene el árbol plano vertical actual, pero:
- Badge de tipo muestra ícono correcto (□ ○ △) + label traducida.
- Acciones inline con tooltip traducido: *"+ Decisión"*, *"+ Incertidumbre"*, *"+ Resultado"*, *"Eliminar"*.
- Campos del nodo seleccionado en un panel expandible abajo (no modal): probabilidad siempre como percent, montos como currency `$1.234.567`.

### 4.3 Resultado (post-cálculo)

Tab que muestra, en orden:
1. **Recomendación** en una caja lime — *"Ejecutar workover A. Costo esperado: $450.000. Ahorra $120.000 vs alternativa."*
2. **Tabla de caminos** con columnas: camino, probabilidad acumulada, costo/valor esperado, diferencia vs recomendado. La fila recomendada en bold con fondo lime tenue.
3. **Supuestos clave** (collapsible): lista de los nodos de incertidumbre con sus probabilidades editables inline, para que Bárbara ajuste y vea cómo cambia la recomendación sin ir a una tab de sensibilidad separada.

Eliminar la tab de Sensibilidad separada. El ajuste de probabilidades vive en "Resultado" como parte del flujo natural.

### 4.4 Help contextual (botón `?`)

Popover con:
- Una imagen chica del árbol con las tres formas anotadas.
- Tres bullets: *"Cuadrado = elegís vos. Círculo = el pozo/mercado/clima responde. Triángulo = el resultado final."*
- Link al ejemplo resuelto de workover.

Sin overlay tutorial, sin tour forzado.

## 5. Layout del Documento Excel (lo que se imprime / exporta a PDF)

Este es el entregable. Tiene que **imprimirse bien en A4 landscape** sin ajustes manuales. Page setup aplicado por el add-in:

```
Format: A4 landscape · Scaling: Fit all columns to 1 page · Margins: 1cm
Print area: definido por el add-in abarcando header+body+footer
Gridlines: off · Headings: off
```

### 5.1 Estructura vertical del documento

```
┌───────────────────────────────────────────────────────────────────┐
│  [LOGO]                                        CONFIDENCIAL        │  fila 1 (altura 50)
│                                                                     │
│  ANÁLISIS DE DECISIÓN                                               │  fila 2-3
│  Workover Pozo LJ-47                                                │  (Montserrat 18 bold olive)
│  ─────────────────────────────────────────────                      │  barra olive 2pt
│  Preparado por: B. Fernández · 24 abr 2026 · Modo Costo             │  fila 4 (beige 9pt)
├───────────────────────────────────────────────────────────────────┤
│                                                                     │
│  CONTEXTO                                                           │  fila 6 (H2 marine)
│  [descripción del caso, supuestos clave, 2-3 líneas]                │
│                                                                     │
│  ÁRBOL DE DECISIÓN                                                  │  fila 10 (H2 marine)
│                                                                     │
│     ┌─ ○ [chance] ──┬── △ [resultado1]                              │
│     │               └── △ [resultado2]                              │   ← zona árbol
│  □ ─┤                                                                │     (ancho completo)
│     │                                                                │
│     └─ ○ [chance] ──┬── △ [resultado3]                              │
│                                                                     │
│  Leyenda:  □ Decisión   ○ Incertidumbre   △ Resultado final         │  leyenda explícita
│                                                                     │
├───────────────────────────────────────────────────────────────────┤
│  RECOMENDACIÓN                                                      │  caja lime con borde olive
│  Ejecutar workover A.                                               │  Montserrat 14 bold
│  Costo esperado: $450.000 · Ahorra $120.000 vs alternativa          │  Inter 11
│                                                                     │
│  RESUMEN DE CAMINOS                                                 │  H2 marine
│  [tabla: camino, probabilidad, costo esperado, dif vs recomendado]  │  header olive/white, rows Inter 10
│                                                                     │
│  SUPUESTOS                                                          │  H3
│  [lista numerada de los supuestos críticos del análisis]            │
├───────────────────────────────────────────────────────────────────┤
│  [iso Q]  Quintana Energy · Confidencial            Página 1 de 1  │  footer beige 8pt
└───────────────────────────────────────────────────────────────────┘
```

### 5.2 Decisiones de render Excel

- **Ancho de columna base**: 14 (≈95px). Tres columnas por nodo merge-eadas = ~285px por bloque de nodo — texto razonable sin truncar.
- **Columnas-canal** de ancho 3 entre grupos de nodos, para que los conectores tengan lugar sin encimarse con texto.
- **Alto de fila shape**: 36pt para que el círculo/cuadrado entre con padding visual.
- **Conectores**: calculados del rect real del shape (centro-derecha del shape origen → centro-izquierda del shape destino). No hardcoded offsets. Grosor 1.5pt normal, 2.5pt optimal. Color `marine` normal, `olive` optimal.
- **Label de probabilidad** sobre el conector, en celda dedicada 1-row-tall encima del segmento horizontal, no sobre el nodo.
- **Caja de recomendación**: 3-4 filas mergeadas ancho completo, fondo `lime` tenue (aplicar como color celda al 30% con `#F3FFE0` sintetizado), borde 2pt `olive`, número en `Montserrat 14 bold forest`.
- **Tabla de resumen de caminos**: header `olive` fondo con texto blanco, filas alternas `paper` / `slate` tenue. Fila del camino recomendado en bold + fondo `lime` tenue.
- **Header y footer del documento**: bands fijas en filas 1-4 y últimas 2. Usan `sheet.pageLayout.setHeadersFooters()` también para que aparezcan al imprimir si exceden la página.
- **Print area**: el add-in setea `sheet.pageLayout.printArea` después de dibujar, usando `lastCol`/`lastRow` calculados.

### 5.3 Zonas fijas (lo que NO es opcional)

Aunque el análisis sea chico, el documento **siempre** tiene: header con logo, título, autor/fecha, árbol, leyenda, caja de recomendación, tabla de resumen, footer. Sin esas piezas no es un documento presentable, es un diagrama suelto.

"Supuestos" es opcional — si el árbol no tiene nodos de incertidumbre explícitos (caso raro), la sección se omite.

### 5.4 Segunda hoja: `DT_Calculos`

Existe hoy (hidden). **Se mantiene hidden**. Contiene las fórmulas que respaldan los valores del árbol. Bárbara puede des-ocultarla si quiere auditar, pero por default no compite con la hoja presentable.

## 6. Generación de PDF (v2, no MVP)

Está el patrón probado en `quintana-branding/skill.md`: Playwright + HTML → portada verde bosque full-bleed + content con header/footer Quintana, merged con pypdf. Más adelante, botón *"Generar PDF"* en el taskpane que:
1. Llama a un endpoint o bundlea un generator local.
2. Renderiza el mismo layout de sección 5.1 pero en HTML con fidelidad exacta (sin depender de Excel print).
3. Devuelve un PDF con portada Quintana.

Por ahora (MVP) el flujo es: Excel → File > Export as PDF. El layout de sección 5 está pensado para que ese PDF quede decente sin pasos extra.

## 7. Tono de voz

Del manual Quintana: **formal, profesional, reservado, serio, accesible, factual, tradicional, realista**. Traducido al add-in:

- Textos de UI en **infinitivo o imperativo neutro**: *"Dibujar en Excel"*, *"Guardar"*, *"Agregar decisión"*. No *"¡Dibujá tu árbol!"* ni *"Vamos a empezar"*.
- Mensajes de error **específicos y técnicos**: *"Falta probabilidad en el nodo 'Éxito operativo'"*. No *"Ups, algo salió mal 😔"*.
- Toasts **factuales**: *"Árbol dibujado"*, *"Datos guardados en el libro"*. Sin emojis, sin exclamaciones.
- Labels de valores: siempre con símbolo `$` y separador de miles argentino (`$1.234.567`). Probabilidades en percent entero o 1 decimal (`65%`, `12,5%`).

## 8. Anti-patterns (prohibidos)

- Emojis en UI o en output.
- Gradientes decorativos (excepto el gradient de marca en portada PDF).
- Sombras pronunciadas en botones o cajas (sutiles `0 1px 2px` OK en hover).
- `system-ui` o `Arial` como display en taskpane (usar Montserrat).
- `Lorem ipsum` o placeholder text en cualquier UI publicada.
- Palabras prohibidas en copy: *"ups"*, *"genial"*, *"simple"*, *"crucial"*, *"robusto"*, *"integral"*, *"comprehensivo"*.
- Llamar "Expected Value" o "EV" en ninguna superficie visible.
- "Modo maximizar/minimizar" en ninguna superficie visible.

## 9. Decisions Log

| Fecha | Decisión | Razón |
|---|---|---|
| 2026-04-24 | Adoptar paleta oficial Quintana (Verde Oliva principal, no azul) como base del design system | Manual de marca Feb 2026 + skill quintana-branding disponible |
| 2026-04-24 | Renombrar conceptos de teoría de decisión al lenguaje de Bárbara en toda UI visible | Bárbara es ingeniera de producción, no teórica; "expected value" es jerga que bloquea adopción |
| 2026-04-24 | Output Excel pensado como documento imprimible con header/footer/recomendación/tabla, no como diagrama suelto | Usuario explícito: "debe poder ser impreso y distribuido en PDF" |
| 2026-04-24 | Eliminar tab de Sensibilidad, integrar ajuste de probabilidades en "Resultado" | Reducir superficies; el análisis de sensibilidad en papers es un capítulo, en la práctica del ingeniero es "cambiar el número y ver qué pasa" |
| 2026-04-24 | Conservar 3 ejemplos actuales (workover, perforación, lanzamiento) pero cambiar el empty state a pregunta por caso, no por modo | Usuario explícito: el producto no es 100% workover; es decisión oil & gas |
