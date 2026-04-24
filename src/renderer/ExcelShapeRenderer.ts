import { isDebugEnabled, runTrackedOperation } from "../debug/excelDiagnostics";
import { writeCalculationModel } from "../excel/CalculationSheet";
import { colLetter, rangeAddr } from "../excel/ExcelAddress";
import { CALC_SHEET_NAME, TREE_SHEET_NAME } from "../excel/WorkbookConstants";
import {
  CalcSheetMetadata,
  DecisionTreeData,
  LayoutNode,
  LayoutResult,
  RenderModel,
  RenderNodeContent,
  TreeNode,
} from "../models/types";
import { QUINTANA, RENDER_TOKENS } from "../rendering/designTokens";
import { COL_WIDTH, EDGE_COLORS, GRID, ROW_HEIGHT, SHAPE_PREFIX, SHAPE_ROW_HEIGHT } from "./StyleConfig";

type ShapeType = "decision" | "chance" | "end";

interface NodeRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface NodeTheme {
  fill: string;
  border: string;
  text: string;
  geometricType: Excel.GeometricShapeType;
}

const NODE_THEMES: Record<ShapeType, NodeTheme> = {
  decision: {
    fill: RENDER_TOKENS.decision.fill,
    border: RENDER_TOKENS.decision.border,
    text: RENDER_TOKENS.decision.text,
    geometricType: "Rectangle" as Excel.GeometricShapeType,
  },
  chance: {
    fill: RENDER_TOKENS.chance.fill,
    border: RENDER_TOKENS.chance.border,
    text: RENDER_TOKENS.chance.text,
    geometricType: "Ellipse" as Excel.GeometricShapeType,
  },
  end: {
    fill: RENDER_TOKENS.end.fill,
    border: RENDER_TOKENS.end.border,
    text: RENDER_TOKENS.end.text,
    geometricType: "IsoscelesTriangle" as Excel.GeometricShapeType,
  },
};

function setShapePlacement(shape: Excel.Shape): void {
  // Sin OneCell, las shapes flotan y se desalinean al reajustar columnas/pagina.
  // Gateamos con try para hosts que no soporten la property.
  try {
    shape.placement = Excel.Placement.oneCell;
  } catch {
    // no-op en hosts que todavía no exponen Shape.placement.
  }
}

function assertValidNodeRect(nodeId: string, rect: NodeRect | undefined, context: string): NodeRect {
  if (!rect) {
    throw new Error(`NodeRect ausente para ${context} ${nodeId} - bug de pipeline`);
  }
  if (
    !Number.isFinite(rect.left) ||
    !Number.isFinite(rect.top) ||
    !Number.isFinite(rect.width) ||
    !Number.isFinite(rect.height) ||
    rect.width <= 0 ||
    rect.height <= 0
  ) {
    throw new Error(`NodeRect invalido para ${context} ${nodeId}: ${JSON.stringify(rect)}`);
  }
  return rect;
}

function writeRenderDebug(sheet: Excel.Worksheet, title: string, detail = ""): void {
  if (!isDebugEnabled()) return;
  sheet.getRange("A3").values = [[title]];
  sheet.getRange("A4").values = [[detail]];
  sheet.getRange("A3:A4").format.font.name = "Calibri";
  sheet.getRange("A3:A4").format.font.size = 10;
  sheet.getRange("A3:A4").format.font.color = QUINTANA.beige;
}

function setRowBandValue(
  sheet: Excel.Worksheet,
  col: number,
  row: number,
  cols: number,
  value: string
): Excel.Range {
  const band = sheet.getRange(rangeAddr(col, row, cols, 1));
  band.unmerge();
  if (cols > 1) {
    band.merge();
  }
  const topLeft = sheet.getCell(row, col);
  topLeft.values = [[value]];
  return topLeft;
}

async function getOrCreateSheet(
  context: Excel.RequestContext,
  name: string,
  visibility: Excel.SheetVisibility | null
): Promise<Excel.Worksheet> {
  const existing = context.workbook.worksheets.getItemOrNullObject(name);
  existing.load("name");
  await context.sync();

  const sheet = existing.isNullObject ? context.workbook.worksheets.add(name) : existing;
  if (visibility !== null) {
    sheet.visibility = visibility;
  }
  return sheet;
}

async function clearWorksheet(sheet: Excel.Worksheet): Promise<void> {
  const shapes = sheet.shapes;
  shapes.load("items/name");
  const usedRange = sheet.getUsedRangeOrNullObject();
  usedRange.load("address");
  await sheet.context.sync();

  for (const shape of shapes.items) {
    if (shape.name.startsWith(SHAPE_PREFIX)) {
      shape.delete();
    }
  }

  if (!usedRange.isNullObject) {
    usedRange.unmerge();
    usedRange.clear(Excel.ClearApplyTo.all);
  }

  await sheet.context.sync();
}

function formatCurrencyAr(value: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "N/D";
  return `$${value.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

function formatDateAr(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Header del documento (filas 0-4, DESIGN.md §5.1).
 * Logo placeholder + título del análisis + autor/fecha/modo + barra olive.
 */
function renderDocumentHeader(
  sheet: Excel.Worksheet,
  tree: DecisionTreeData,
  totalCols: number
): void {
  const leftCol = 0;
  const cols = totalCols;

  // Fila 0: banda "QUINTANA ENERGY" + "CONFIDENCIAL"
  const bandRange = sheet.getRange(rangeAddr(leftCol, 0, cols, 1));
  bandRange.format.rowHeight = 18;
  const bandLeft = setRowBandValue(sheet, leftCol, 0, Math.max(cols - 6, 1), "QUINTANA ENERGY");
  bandLeft.format.font.name = "Calibri";
  bandLeft.format.font.size = 9;
  bandLeft.format.font.bold = true;
  bandLeft.format.font.color = QUINTANA.olive;
  bandLeft.format.horizontalAlignment = "Left";
  bandLeft.format.verticalAlignment = "Center";

  const bandRight = setRowBandValue(sheet, Math.max(cols - 6, 1), 0, 6, "CONFIDENCIAL");
  bandRight.format.font.name = "Calibri";
  bandRight.format.font.size = 8;
  bandRight.format.font.bold = true;
  bandRight.format.font.color = QUINTANA.beige;
  bandRight.format.horizontalAlignment = "Right";
  bandRight.format.verticalAlignment = "Center";

  // Fila 1: sobretítulo "ANÁLISIS DE DECISIÓN"
  const overline = setRowBandValue(sheet, leftCol, 1, cols, "ANÁLISIS DE DECISIÓN");
  overline.format.font.name = "Calibri";
  overline.format.font.size = 9;
  overline.format.font.bold = true;
  overline.format.font.color = QUINTANA.inkMuted;
  overline.format.horizontalAlignment = "Left";
  sheet.getRange(rangeAddr(leftCol, 1, cols, 1)).format.rowHeight = 14;

  // Fila 2: título del caso (nombre del análisis, grande)
  const title = setRowBandValue(sheet, leftCol, 2, cols, tree.metadata.name || "Análisis sin título");
  title.format.font.name = "Calibri";
  title.format.font.size = 18;
  title.format.font.bold = true;
  title.format.font.color = QUINTANA.olive;
  title.format.horizontalAlignment = "Left";
  sheet.getRange(rangeAddr(leftCol, 2, cols, 1)).format.rowHeight = 28;

  // Fila 3: barra olive (se hace con fill de celda)
  const bar = sheet.getRange(rangeAddr(leftCol, 3, cols, 1));
  bar.unmerge();
  if (cols > 1) bar.merge();
  bar.format.fill.color = QUINTANA.olive;
  sheet.getRange(rangeAddr(leftCol, 3, cols, 1)).format.rowHeight = 3;

  // Fila 4: autor · fecha · modo
  const modeLabel = tree.metadata.mode === "minimize" ? "Modo Costo" : "Modo Valor";
  const fecha = formatDateAr(tree.metadata.updatedAt || tree.metadata.createdAt || new Date().toISOString());
  const meta = `Preparado por Quintana Energy · ${fecha} · ${modeLabel}`;
  const metaRange = setRowBandValue(sheet, leftCol, 4, cols, meta);
  metaRange.format.font.name = "Calibri";
  metaRange.format.font.size = 9;
  metaRange.format.font.color = QUINTANA.beige;
  metaRange.format.horizontalAlignment = "Left";
  sheet.getRange(rangeAddr(leftCol, 4, cols, 1)).format.rowHeight = 16;
}

function renderTitle(sheet: Excel.Worksheet, tree: DecisionTreeData, totalCols: number): void {
  renderDocumentHeader(sheet, tree, totalCols);
}

function createNodeMarker(
  sheet: Excel.Worksheet,
  node: RenderNodeContent,
  rect: NodeRect
): Excel.Shape {
  const theme = NODE_THEMES[node.type];
  const marker = sheet.shapes.addGeometricShape(theme.geometricType);

  // Shape cuadrado/circular/triangular centrado en la fila superior del bloque.
  const shapeRowHeight = SHAPE_ROW_HEIGHT;
  const size = Math.min(shapeRowHeight - 6, rect.width * 0.5);
  const left = rect.left + (rect.width - size) / 2;
  const top = rect.top + (shapeRowHeight - size) / 2;

  marker.name = `${SHAPE_PREFIX}NODE_${node.id}`;
  marker.left = left;
  marker.top = top;
  marker.width = size;
  marker.height = size;
  setShapePlacement(marker);
  marker.fill.setSolidColor(theme.fill);
  marker.lineFormat.visible = true;
  marker.lineFormat.color = node.isOptimal ? RENDER_TOKENS.accent : theme.border;
  marker.lineFormat.weight = node.isOptimal ? 3 : 1;
  return marker;
}

function writeNodeCells(
  sheet: Excel.Worksheet,
  layoutNode: LayoutNode,
  renderNode: RenderNodeContent,
  calcSheetMetadata: CalcSheetMetadata,
  tree: DecisionTreeData
): void {
  const theme = NODE_THEMES[renderNode.type];
  const startCol = layoutNode.col;
  const width = GRID.nodeCols;

  const shapeRowRange = sheet.getRange(rangeAddr(startCol, layoutNode.row, width, 1));
  shapeRowRange.unmerge();
  shapeRowRange.values = Array.from({ length: 1 }, () => Array.from({ length: width }, () => ""));

  // Fila 1: título (label). Fondo olive-tenue para óptimo, sino fill del tipo.
  const titleRange = setRowBandValue(sheet, startCol, layoutNode.row + 1, width, renderNode.title);
  const titleFill = renderNode.isOptimal ? QUINTANA.limeTenue : theme.fill;
  const titleText = renderNode.isOptimal ? QUINTANA.forest : theme.text;
  titleRange.format.fill.color = titleFill;
  titleRange.format.font.name = "Calibri";
  titleRange.format.font.size = 11;
  titleRange.format.font.bold = true;
  titleRange.format.font.color = titleText;
  titleRange.format.horizontalAlignment = "Center";

  // Fila 2: valor. Fórmula al calc-sheet si existe; sino valor literal.
  const valueRange = sheet.getRange(rangeAddr(startCol, layoutNode.row + 2, width, 1));
  valueRange.unmerge();
  if (width > 1) valueRange.merge();
  const valueCell = sheet.getCell(layoutNode.row + 2, startCol);
  const nodeRef = calcSheetMetadata.nodeRefs[layoutNode.id];
  const node = tree.nodes[layoutNode.id];
  if (nodeRef && node) {
    const addr = node.type === "end" ? nodeRef.terminalValueAddress : nodeRef.netEvAddress;
    valueCell.formulas = [[`=${addr}`]];
    valueCell.numberFormat = [["$#,##0"]];
  } else if (layoutNode.expectedValue !== null) {
    valueCell.values = [[layoutNode.expectedValue]];
    valueCell.numberFormat = [["$#,##0"]];
  } else {
    valueCell.values = [[""]];
  }
  valueRange.format.fill.color = QUINTANA.paper;
  valueRange.format.font.name = "Calibri";
  valueRange.format.font.size = 11;
  valueRange.format.font.bold = true;
  valueRange.format.font.color = QUINTANA.ink;
  valueRange.format.horizontalAlignment = "Center";

  // Fila 3: detalle (prob / costo / tiempo / notas).
  const detailText = [
    renderNode.secondaryLines.join(" · "),
    renderNode.noteLines.join(" · "),
  ]
    .filter((part) => part.length > 0)
    .join(" — ");
  const detailRange = setRowBandValue(sheet, startCol, layoutNode.row + 3, width, detailText);
  detailRange.format.fill.color = QUINTANA.slateTenue;
  detailRange.format.font.name = "Calibri";
  detailRange.format.font.size = 9;
  detailRange.format.font.color = RENDER_TOKENS.edge;
  detailRange.format.horizontalAlignment = "Center";
}

/**
 * Conector con geometría desde el rect real del shape: centro-derecha del
 * origen → centro-izquierda del destino. Sin offsets hardcodeados.
 */
function createEdgeConnector(
  sheet: Excel.Worksheet,
  edge: LayoutResult["edges"][number],
  fromRect: NodeRect,
  toRect: NodeRect
): void {
  const beginLeft = fromRect.left + fromRect.width;
  const beginTop = fromRect.top + SHAPE_ROW_HEIGHT / 2;
  const endLeft = toRect.left;
  const endTop = toRect.top + SHAPE_ROW_HEIGHT / 2;

  const line = sheet.shapes.addLine(
    beginLeft,
    beginTop,
    endLeft,
    endTop,
    Excel.ConnectorType.elbow
  );

  line.name = `${SHAPE_PREFIX}EDGE_${edge.fromId}_${edge.toId}`;
  setShapePlacement(line);
  line.line.endArrowheadStyle = "Triangle";
  line.line.endArrowheadLength = "Medium";
  line.line.endArrowheadWidth = "Medium";
  line.line.beginArrowheadStyle = "None";
  line.lineFormat.visible = true;
  line.lineFormat.color = edge.isOptimal ? EDGE_COLORS.optimal : EDGE_COLORS.normal;
  line.lineFormat.weight = edge.isOptimal ? EDGE_COLORS.optimalWeight : EDGE_COLORS.normalWeight;
}

function writeEdgeLabelCells(
  sheet: Excel.Worksheet,
  edge: LayoutResult["edges"][number],
  edgeLabel: string
): void {
  if (!edgeLabel) return;

  const row = Math.min(edge.fromMidRow, edge.toMidRow);
  const labelRange = setRowBandValue(sheet, edge.connectorCol, row, 3, edgeLabel.replace(/\n/g, " | "));
  labelRange.format.font.name = "Calibri";
  labelRange.format.font.size = 8;
  labelRange.format.font.color = edge.isOptimal ? EDGE_COLORS.optimal : EDGE_COLORS.normal;
  labelRange.format.horizontalAlignment = "Center";
}

/**
 * Leyenda de formas abajo del árbol — hace al documento auto-explicativo.
 */
function renderLegend(sheet: Excel.Worksheet, row: number, totalCols: number): number {
  const cols = totalCols;
  const text = "Leyenda:   ■ Decisión (vos elegís)       ● Incertidumbre (el pozo responde)       ▲ Resultado final";
  const range = setRowBandValue(sheet, 0, row, cols, text);
  range.format.font.name = "Calibri";
  range.format.font.size = 9;
  range.format.font.color = QUINTANA.inkMuted;
  range.format.horizontalAlignment = "Center";
  sheet.getRange(rangeAddr(0, row, cols, 1)).format.rowHeight = 18;
  return row + 1;
}

/**
 * Caja de recomendación ancho completo, fondo lime tenue + borde olive.
 */
function renderRecommendationBox(
  sheet: Excel.Worksheet,
  row: number,
  totalCols: number,
  headline: string,
  detail: string
): number {
  const cols = totalCols;
  const heading = setRowBandValue(sheet, 0, row, cols, "RECOMENDACIÓN");
  heading.format.font.name = "Calibri";
  heading.format.font.size = 10;
  heading.format.font.bold = true;
  heading.format.font.color = QUINTANA.marine;
  heading.format.horizontalAlignment = "Left";
  sheet.getRange(rangeAddr(0, row, cols, 1)).format.rowHeight = 16;

  const titleRow = row + 1;
  const title = setRowBandValue(sheet, 0, titleRow, cols, headline);
  title.format.fill.color = QUINTANA.limeTenue;
  title.format.font.name = "Calibri";
  title.format.font.size = 14;
  title.format.font.bold = true;
  title.format.font.color = QUINTANA.forest;
  title.format.horizontalAlignment = "Left";
  sheet.getRange(rangeAddr(0, titleRow, cols, 1)).format.rowHeight = 22;

  const detailRow = row + 2;
  const detailRange = setRowBandValue(sheet, 0, detailRow, cols, detail);
  detailRange.format.fill.color = QUINTANA.limeTenue;
  detailRange.format.font.name = "Calibri";
  detailRange.format.font.size = 11;
  detailRange.format.font.color = QUINTANA.ink;
  detailRange.format.horizontalAlignment = "Left";
  sheet.getRange(rangeAddr(0, detailRow, cols, 1)).format.rowHeight = 20;

  // Borde olive alrededor (filas titleRow y detailRow)
  const boxRange = sheet.getRange(rangeAddr(0, titleRow, cols, 2));
  const borders = boxRange.format.borders;
  for (const side of ["EdgeTop", "EdgeBottom", "EdgeLeft", "EdgeRight"] as const) {
    const b = borders.getItem(side);
    b.style = "Continuous";
    b.color = QUINTANA.olive;
    b.weight = "Medium";
  }

  return detailRow + 2;
}

interface PathRow {
  label: string;
  probability: number;
  value: number;
  diff: number;
  isOptimal: boolean;
}

/**
 * Enumera los caminos terminales (root → end) con su probabilidad acumulada
 * y valor. El valor es payoff del leaf menos costos de los pasos decisivos
 * tomados. Para comparación vs recomendado, se usa el valor del camino con
 * todos los nodos `isOptimal=true`.
 */
function enumeratePaths(tree: DecisionTreeData): PathRow[] {
  if (!tree.rootId) return [];

  const rows: PathRow[] = [];
  const parentById = tree.nodes;

  type Collected = { labels: string[]; ids: string[]; prob: number; cost: number; payoff: number };

  function walk(
    nodeId: string,
    accLabels: string[],
    accIds: string[],
    accProb: number,
    accCost: number
  ): void {
    const node = parentById[nodeId];
    if (!node) return;
    const parent: TreeNode | null = node.parentId ? parentById[node.parentId] : null;

    // Probabilidad: si el padre es chance, esta rama aporta probabilidad.
    const branchProb = parent?.type === "chance" ? node.probability ?? 0 : 1;
    const nextProb = accProb * branchProb;

    // Costo: suma todos los costos del camino salvo el root.
    const branchCost = parent ? node.cost ?? 0 : 0;
    const nextCost = accCost + branchCost;

    const nextLabels = [...accLabels, node.label];
    const nextIds = [...accIds, node.id];

    if (node.type === "end" || node.childIds.length === 0) {
      const payoff = node.payoff ?? 0;
      const value = payoff - nextCost;
      collected.push({ labels: nextLabels, ids: nextIds, prob: nextProb, cost: nextCost, payoff });
      rows.push({
        label: nextLabels.join(" → "),
        probability: nextProb,
        value,
        diff: 0,
        isOptimal: false,
      });
      return;
    }

    for (const childId of node.childIds) {
      walk(childId, nextLabels, nextIds, nextProb, nextCost);
    }
  }

  const collected: Collected[] = [];
  walk(tree.rootId, [], [], 1, 0);

  // Marcar camino óptimo comparando IDs, no labels (evita colisiones con "Sí"/"No"/"Base").
  const optimalNodeIds = new Set(
    Object.values(tree.nodes)
      .filter((n) => n.isOptimal)
      .map((n) => n.id)
  );

  for (let i = 0; i < rows.length; i++) {
    rows[i].isOptimal = collected[i].ids.every((id) => optimalNodeIds.has(id));
  }

  // Diferencia vs recomendado (el camino óptimo con mayor prob; si hay varios, el primero).
  const optimalRow = rows.find((r) => r.isOptimal);
  const reference = optimalRow?.value ?? 0;
  for (const row of rows) row.diff = row.value - reference;

  return rows.sort((a, b) => (b.isOptimal ? 1 : 0) - (a.isOptimal ? 1 : 0) || b.probability - a.probability);
}

/**
 * Tabla de resumen de caminos (header olive, filas alternas, fila óptima destacada).
 */
function renderPathsTable(
  sheet: Excel.Worksheet,
  row: number,
  totalCols: number,
  tree: DecisionTreeData,
  paths: PathRow[]
): number {
  const cols = totalCols;
  const isCost = tree.metadata.mode === "minimize";

  const heading = setRowBandValue(sheet, 0, row, cols, "RESUMEN DE CAMINOS");
  heading.format.font.name = "Calibri";
  heading.format.font.size = 10;
  heading.format.font.bold = true;
  heading.format.font.color = QUINTANA.marine;
  heading.format.horizontalAlignment = "Left";
  sheet.getRange(rangeAddr(0, row, cols, 1)).format.rowHeight = 16;

  const headerRow = row + 1;
  const pathColSpan = Math.max(cols - 9, 6);
  const colLayout = [
    { label: "Camino", col: 0, span: pathColSpan, align: "Left" as const },
    { label: "Probabilidad", col: pathColSpan, span: 3, align: "Center" as const },
    { label: isCost ? "Costo esperado" : "Valor esperado", col: pathColSpan + 3, span: 3, align: "Right" as const },
    { label: "Vs recomendado", col: pathColSpan + 6, span: 3, align: "Right" as const },
  ];

  for (const c of colLayout) {
    const r = setRowBandValue(sheet, c.col, headerRow, c.span, c.label);
    r.format.fill.color = QUINTANA.olive;
    r.format.font.name = "Calibri";
    r.format.font.size = 9;
    r.format.font.bold = true;
    r.format.font.color = QUINTANA.paper;
    r.format.horizontalAlignment = c.align;
  }
  sheet.getRange(rangeAddr(0, headerRow, cols, 1)).format.rowHeight = 18;

  const limitedPaths = paths.slice(0, 20);
  let curRow = headerRow + 1;
  for (let i = 0; i < limitedPaths.length; i++) {
    const p = limitedPaths[i];
    const rowFill = p.isOptimal ? QUINTANA.limeTenue : i % 2 === 0 ? QUINTANA.paper : QUINTANA.slateTenue;
    const rowWeight: "Bold" | "Regular" = p.isOptimal ? "Bold" : "Regular";

    const valuesByCol: Array<{ col: number; span: number; text: string; align: "Left" | "Center" | "Right" }> = [
      { col: colLayout[0].col, span: colLayout[0].span, text: p.label, align: "Left" },
      { col: colLayout[1].col, span: colLayout[1].span, text: `${(p.probability * 100).toFixed(1)}%`, align: "Center" },
      { col: colLayout[2].col, span: colLayout[2].span, text: formatCurrencyAr(p.value), align: "Right" },
      { col: colLayout[3].col, span: colLayout[3].span, text: p.isOptimal ? "—" : formatCurrencyAr(p.diff), align: "Right" },
    ];

    for (const v of valuesByCol) {
      const r = setRowBandValue(sheet, v.col, curRow, v.span, v.text);
      r.format.fill.color = rowFill;
      r.format.font.name = "Calibri";
      r.format.font.size = 10;
      r.format.font.color = QUINTANA.ink;
      r.format.font.bold = rowWeight === "Bold";
      r.format.horizontalAlignment = v.align;
    }
    sheet.getRange(rangeAddr(0, curRow, cols, 1)).format.rowHeight = 16;
    curRow++;
  }

  if (paths.length > limitedPaths.length) {
    const note = setRowBandValue(sheet, 0, curRow, cols, `+ ${paths.length - limitedPaths.length} caminos adicionales no mostrados`);
    note.format.font.name = "Calibri";
    note.format.font.size = 8;
    note.format.font.italic = true;
    note.format.font.color = QUINTANA.inkMuted;
    curRow++;
  }

  return curRow + 1;
}

/**
 * Footer beige + página. No inyecta número de página real (Office PageLayout
 * lo hace al imprimir); acá va el texto visible en pantalla.
 */
function renderFooter(sheet: Excel.Worksheet, row: number, totalCols: number): number {
  const cols = totalCols;
  const range = setRowBandValue(
    sheet,
    0,
    row,
    cols,
    "Quintana Energy · Documento confidencial · Generado por Análisis de decisión"
  );
  range.format.font.name = "Calibri";
  range.format.font.size = 8;
  range.format.font.color = QUINTANA.beige;
  range.format.horizontalAlignment = "Center";
  sheet.getRange(rangeAddr(0, row, cols, 1)).format.rowHeight = 14;
  return row + 1;
}

/**
 * Page setup imprimible: A4 landscape, fit all columns to 1 page, márgenes
 * chicos, print area explícito, headers/footers repetidos.
 */
function applyPageSetup(sheet: Excel.Worksheet, totalCols: number, lastRowIdx: number): void {
  // Host puede no soportar pageLayout completo; aislamos cada property para no
  // abortar el render y dejamos rastro en consola para debug.
  const pl = sheet.pageLayout;
  const tryApply = (fn: () => void, label: string) => {
    try {
      fn();
    } catch (err) {
      console.warn(`[applyPageSetup] ${label} no aplicado:`, err);
    }
  };

  tryApply(() => (pl.orientation = Excel.PageOrientation.landscape), "orientation");
  tryApply(() => (pl.paperSize = Excel.PaperType.a4), "paperSize");
  tryApply(() => (pl.zoom = { horizontalFitToPages: 1, verticalFitToPages: 0 }), "zoom");
  tryApply(() => pl.setPrintArea(rangeAddr(0, 0, totalCols, lastRowIdx + 1)), "printArea");
  tryApply(() => (pl.leftMargin = 28), "leftMargin");
  tryApply(() => (pl.rightMargin = 28), "rightMargin");
  tryApply(() => (pl.topMargin = 28), "topMargin");
  tryApply(() => (pl.bottomMargin = 28), "bottomMargin");
  tryApply(() => (pl.headerMargin = 14), "headerMargin");
  tryApply(() => (pl.footerMargin = 14), "footerMargin");
}

export async function renderToExcel(
  layout: LayoutResult,
  renderModel: RenderModel,
  calcSheetMetadata: CalcSheetMetadata,
  tree: DecisionTreeData,
  _options: { debug?: boolean } = {}
): Promise<void> {
  await runTrackedOperation(
    "renderToExcel",
    { nodes: layout.nodes.length, edges: layout.edges.length },
    async () => {
      await Excel.run(async (context) => {
        const treeSheet = await getOrCreateSheet(context, TREE_SHEET_NAME, null);
        const calcSheet = await getOrCreateSheet(context, CALC_SHEET_NAME, Excel.SheetVisibility.hidden);
        treeSheet.activate();

        await clearWorksheet(treeSheet);
        await clearWorksheet(calcSheet);

        // totalCols es cantidad; lastColIdx es índice 0-based de la última columna.
        const totalCols = Math.max(layout.maxCol + GRID.colGap + 24, 40);
        const lastColIdx = totalCols - 1;
        treeSheet.getRange(`A:${colLetter(lastColIdx)}`).format.columnWidth = COL_WIDTH;
        treeSheet.showGridlines = false;

        // Fila del shape más alta para que el polígono entre cómodo.
        for (const node of layout.nodes) {
          const shapeRowAddr = rangeAddr(node.col, node.row, 1, 1);
          treeSheet.getRange(shapeRowAddr).format.rowHeight = SHAPE_ROW_HEIGHT;
        }

        renderTitle(treeSheet, tree, totalCols);
        await writeCalculationModel(calcSheet, tree, calcSheetMetadata);
        await context.sync();

        const rangeByNodeId: Record<string, Excel.Range> = {};
        for (const node of layout.nodes) {
          const range = treeSheet.getRange(rangeAddr(node.col, node.row, GRID.nodeCols, GRID.nodeRows));
          range.load("left,top,width,height");
          rangeByNodeId[node.id] = range;
        }

        await context.sync();

        const nodeRects: Record<string, NodeRect> = {};
        for (const node of layout.nodes) {
          const range = rangeByNodeId[node.id];
          nodeRects[node.id] = {
            left: range.left,
            top: range.top,
            width: range.width,
            height: range.height,
          };
        }

        const renderNodeById = Object.fromEntries(renderModel.nodes.map((node) => [node.id, node]));
        const renderEdgeByKey = Object.fromEntries(
          renderModel.edges.map((edge) => [`${edge.fromId}-${edge.toId}`, edge])
        );

        for (const node of layout.nodes) {
          const rect = assertValidNodeRect(node.id, nodeRects[node.id], "nodo");
          const renderNode = renderNodeById[node.id];
          if (!renderNode) {
            throw new Error(`RenderNodeContent ausente para nodo ${node.id} - modelo desalineado`);
          }
          try {
            createNodeMarker(treeSheet, renderNode, rect);
            writeNodeCells(treeSheet, node, renderNode, calcSheetMetadata, tree);
            await context.sync();
          } catch (error) {
            writeRenderDebug(
              treeSheet,
              `Error en nodo ${node.id}`,
              error instanceof Error ? error.message : String(error)
            );
            await context.sync();
            throw error;
          }
        }

        for (const edge of layout.edges) {
          const fromRect = assertValidNodeRect(edge.fromId, nodeRects[edge.fromId], "edge.from");
          const toRect = assertValidNodeRect(edge.toId, nodeRects[edge.toId], "edge.to");

          const renderEdge = renderEdgeByKey[`${edge.fromId}-${edge.toId}`];
          try {
            writeRenderDebug(treeSheet, `Conector ${edge.fromId}->${edge.toId}`);
            createEdgeConnector(treeSheet, edge, fromRect, toRect);
            writeEdgeLabelCells(treeSheet, edge, renderEdge?.label ?? "");
            await context.sync();
          } catch (error) {
            writeRenderDebug(
              treeSheet,
              `Error en conector ${edge.fromId}->${edge.toId}`,
              error instanceof Error ? error.message : String(error)
            );
            await context.sync();
            throw error;
          }
        }

        // Secciones inferiores del documento (DESIGN.md §5.1):
        // leyenda → recomendación → tabla de caminos → footer.
        const treeEndRow = layout.maxRow + GRID.rowGap;
        let cursor = treeEndRow;
        cursor = renderLegend(treeSheet, cursor + 1, totalCols);

        const rootNode = tree.rootId ? tree.nodes[tree.rootId] : null;
        const isCost = tree.metadata.mode === "minimize";
        const rootLabel = isCost ? "Costo esperado" : "Valor esperado";
        const recommended = renderModel.summary?.recommendedAction.replace(/^Elegir:\s*/, "") ?? "";
        const headline = recommended
          ? `Recomendación: ${recommended}`
          : "Sin recomendación (el árbol todavía no tiene una decisión clara)";
        // Preferimos el valor ya renderizado por el pipeline (fuente de verdad visual);
        // caemos al expectedValue crudo si el summary no está disponible.
        const summaryValue = renderModel.summary?.rootValue ?? "";
        const rootEv = rootNode?.expectedValue ?? null;
        const detail = summaryValue
          ? `${rootLabel}: ${summaryValue}`
          : rootEv !== null
            ? `${rootLabel}: ${formatCurrencyAr(rootEv)}`
            : "Completá el árbol para ver el resultado esperado.";
        cursor = renderRecommendationBox(treeSheet, cursor + 1, totalCols, headline, detail);

        const paths = enumeratePaths(tree);
        if (paths.length > 0) {
          cursor = renderPathsTable(treeSheet, cursor, totalCols, tree, paths);
        }

        cursor = renderFooter(treeSheet, cursor + 1, totalCols);

        applyPageSetup(treeSheet, totalCols, cursor);

        writeRenderDebug(treeSheet, "Render completo");
        await context.sync();
      });
    }
  );
}

export async function clearRenderedSheets(): Promise<void> {
  await Excel.run(async (context) => {
    const treeSheet = context.workbook.worksheets.getItemOrNullObject(TREE_SHEET_NAME);
    treeSheet.load("name");
    const calcSheet = context.workbook.worksheets.getItemOrNullObject(CALC_SHEET_NAME);
    calcSheet.load("name");
    await context.sync();

    if (!treeSheet.isNullObject) {
      await clearWorksheet(treeSheet);
    }
    if (!calcSheet.isNullObject) {
      await clearWorksheet(calcSheet);
      calcSheet.visibility = Excel.SheetVisibility.hidden;
      await context.sync();
    }
  });
}
