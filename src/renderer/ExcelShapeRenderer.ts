import { isDebugEnabled, logDiagnostic, runTrackedOperation } from "../debug/excelDiagnostics";
import { CalcTablePlacement } from "../excel/CalculationSheet";
import { cellAddr, colLetter, rangeAddr } from "../excel/ExcelAddress";
import { CALC_SHEET_NAME, TREE_SHEET_NAME } from "../excel/WorkbookConstants";
import {
  CalcSheetMetadata,
  DecisionTreeData,
  LayoutNode,
  LayoutResult,
  RenderModel,
  RenderNodeContent,
} from "../models/types";
import { QUINTANA, RENDER_TOKENS } from "../rendering/designTokens";
import { enumeratePaths, PathRow } from "../engine/PathEnumeration";
import { EDGE_COLORS, GRID, ROW_HEIGHT, SHAPE_PREFIX, SHAPE_ROW_HEIGHT } from "./StyleConfig";

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

// Excel acepta estos strings exactos en addGeometricShape. Nota: para triángulo
// isósceles la API toma "Triangle" (no "IsoscelesTriangle"), y fallaba con
// "argument invalid" cuando usábamos ese otro nombre.
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
    geometricType: "Triangle" as Excel.GeometricShapeType,
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

function sameSheetRef(col: number, row: number): string {
  return `$${colLetter(col)}$${row + 1}`;
}

function setRowBandValue(
  sheet: Excel.Worksheet,
  col: number,
  row: number,
  cols: number,
  value: string | number | boolean
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
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
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

  // Branch-style: el nodo es una junta visual chica, no una caja con texto.
  // La información se escribe en celdas alrededor de la rama, como en VM Plan.
  const shapeRowHeight = SHAPE_ROW_HEIGHT;
  const size = Math.min(24, shapeRowHeight - 10, rect.width * 0.45);
  const left = rect.left + 4;
  const top = rect.top + (shapeRowHeight - size) / 2;

  marker.name = `${SHAPE_PREFIX}NODE_${node.id}`;
  marker.left = left;
  marker.top = top;
  marker.width = size;
  marker.height = size;
  setShapePlacement(marker);
  marker.fill.setSolidColor(QUINTANA.paper);
  marker.lineFormat.visible = true;
  marker.lineFormat.color = node.isOptimal ? RENDER_TOKENS.accent : theme.border;
  // Excel Win32 rechaza floats en ShapeLineFormat.weight con
  // "The argument is invalid...". Usar enteros siempre.
  marker.lineFormat.weight = node.isOptimal ? 3 : 2;
  return marker;
}

function buildInlineCalculationMetadata(
  layout: LayoutResult,
  sheetName: string
): CalcSheetMetadata {
  const metadata: CalcSheetMetadata = {
    sheetName,
    tableName: "DT_InlineCalc",
    nodeRefs: {},
  };
  const sheetPrefix = `'${sheetName.replace(/'/g, "''")}'!`;

  for (let index = 0; index < layout.nodes.length; index++) {
    const node = layout.nodes[index];
    const helperCol = node.col;
    const valueCol = node.col + 1;
    metadata.nodeRefs[node.id] = {
      rowIndex: index,
      sheetRow: node.row,
      probabilityAddress: `${sheetPrefix}${cellAddr(helperCol, node.row)}`,
      costAddress: `${sheetPrefix}${cellAddr(helperCol, node.row + 1)}`,
      terminalValueAddress: `${sheetPrefix}${cellAddr(helperCol, node.row + 2)}`,
      childrenEvAddress: `${sheetPrefix}${cellAddr(valueCol, node.row + 2)}`,
      netEvAddress: `${sheetPrefix}${cellAddr(valueCol, node.row + 1)}`,
    };
  }

  return metadata;
}

function writeInlineCalculationCells(
  sheet: Excel.Worksheet,
  tree: DecisionTreeData,
  layout: LayoutResult,
  metadata: CalcSheetMetadata
): void {
  const costOp = tree.metadata.mode === "minimize" ? "+" : "-";

  for (const layoutNode of layout.nodes) {
    const node = tree.nodes[layoutNode.id];
    if (!node) continue;
    const helperCol = layoutNode.col;
    const valueCol = layoutNode.col + 1;

    const probCell = sheet.getCell(layoutNode.row, helperCol);
    probCell.values = [[node.probability ?? ""]];
    probCell.numberFormat = [["0%"]];
    probCell.format.font.color = QUINTANA.paper;

    const costCell = sheet.getCell(layoutNode.row + 1, helperCol);
    costCell.values = [[node.cost ?? ""]];
    costCell.numberFormat = [["$#,##0"]];
    costCell.format.font.color = QUINTANA.paper;

    const terminalCell = sheet.getCell(layoutNode.row + 2, helperCol);
    terminalCell.values = [[node.type === "end" ? node.payoff ?? 0 : ""]];
    terminalCell.numberFormat = [["$#,##0"]];
    terminalCell.format.font.color = QUINTANA.paper;
  }

  for (const layoutNode of [...layout.nodes].reverse()) {
    const node = tree.nodes[layoutNode.id];
    if (!node) continue;
    const ref = metadata.nodeRefs[node.id];
    const childrenEvCell = sheet.getRange(ref.childrenEvAddress.split("!").pop() ?? cellAddr(layoutNode.col + 1, layoutNode.row + 2));
    const netEvCell = sheet.getRange(ref.netEvAddress.split("!").pop() ?? cellAddr(layoutNode.col + 1, layoutNode.row + 1));

    if (node.type === "end" || node.childIds.length === 0) {
      childrenEvCell.values = [[""]];
      netEvCell.formulas = [[`=N(${sameSheetRef(layoutNode.col, layoutNode.row + 2)})${costOp}N(${sameSheetRef(layoutNode.col, layoutNode.row + 1)})`]];
      netEvCell.numberFormat = [["$#,##0"]];
      childrenEvCell.format.font.color = QUINTANA.paper;
      netEvCell.format.font.color = QUINTANA.paper;
      continue;
    }

    if (node.type === "chance") {
      const terms = node.childIds
        .map((childId) => {
          const childLayout = layout.nodes.find((item) => item.id === childId);
          const childRef = metadata.nodeRefs[childId];
          if (!childLayout || !childRef) return null;
          return `${sameSheetRef(childLayout.col, childLayout.row)}*${childRef.netEvAddress}`;
        })
        .filter((term): term is string => Boolean(term));
      childrenEvCell.formulas = [[terms.length > 0 ? `=SUM(${terms.join(",")})` : "=0"]];
    } else {
      const childRefs = node.childIds
        .map((childId) => metadata.nodeRefs[childId]?.netEvAddress)
        .filter((addr): addr is string => Boolean(addr));
      const fn = tree.metadata.mode === "minimize" ? "MIN" : "MAX";
      childrenEvCell.formulas = [[childRefs.length > 0 ? `=${fn}(${childRefs.join(",")})` : "=0"]];
    }

    childrenEvCell.numberFormat = [["$#,##0"]];
    netEvCell.formulas = [[`=${ref.childrenEvAddress}${costOp}N(${sameSheetRef(layoutNode.col, layoutNode.row + 1)})`]];
    netEvCell.numberFormat = [["$#,##0"]];
    childrenEvCell.format.font.color = QUINTANA.paper;
    netEvCell.format.font.color = QUINTANA.paper;
  }
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

  // Branch-style labels: el nodo queda limpio; título, valor y detalle viven
  // como celdas auditables cerca de la junta. Esto escala mejor para árboles
  // grandes y replica el lenguaje visual del Excel de referencia.
  const labelCol = startCol + 2;
  const labelWidth = Math.max(1, width - 2);
  const isTerminal = renderNode.type === "end";
  const titleRow = layoutNode.row;
  const valueRow = layoutNode.row + 1;
  const detailRow = layoutNode.row + 2;

  if (titleRow >= 0) {
    const titleRange = setRowBandValue(sheet, labelCol, titleRow, labelWidth, renderNode.title);
    titleRange.format.fill.color = renderNode.isOptimal ? QUINTANA.limeTenue : QUINTANA.paper;
    titleRange.format.font.name = "Calibri";
    titleRange.format.font.size = 10;
    titleRange.format.font.bold = true;
    titleRange.format.font.color = renderNode.isOptimal ? QUINTANA.forest : QUINTANA.ink;
    titleRange.format.horizontalAlignment = "Left";
  }

  const valueRange = sheet.getRange(rangeAddr(labelCol, valueRow, labelWidth, 1));
  valueRange.unmerge();
  if (labelWidth > 1) valueRange.merge();
  const valueCell = sheet.getCell(valueRow, labelCol);
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
  valueRange.numberFormat = [["$#,##0"]];
  valueRange.format.fill.color = QUINTANA.slateTenue;
  valueRange.format.font.name = "Calibri";
  valueRange.format.font.size = 9;
  valueRange.format.font.bold = true;
  valueRange.format.font.color = RENDER_TOKENS.edge;
  valueRange.format.horizontalAlignment = "Right";

  const detailText = [renderNode.secondaryLines.join(" · "), renderNode.noteLines.join(" · ")]
    .filter((part) => part.length > 0)
    .join(" — ");
  const detailRange = setRowBandValue(sheet, labelCol, detailRow, labelWidth, detailText);
  detailRange.format.fill.color = QUINTANA.paper;
  detailRange.format.font.name = "Calibri";
  detailRange.format.font.size = 8;
  detailRange.format.font.color = QUINTANA.inkMuted;
  detailRange.format.horizontalAlignment = "Left";
}

/**
 * Conector tipo VM Plan: una diagonal corta que abre/cierra la rama y luego un
 * tramo horizontal largo. No usamos `elbow` porque genera ángulos de 90°; el
 * workbook de referencia usa doglegs con diagonal + recta.
 */
function addEdgeLines(
  sheet: Excel.Worksheet,
  edge: LayoutResult["edges"][number],
  fromRect: NodeRect,
  toRect: NodeRect
): Excel.Shape[] {
  const markerSize = Math.min(24, SHAPE_ROW_HEIGHT - 10, fromRect.width * 0.45);
  const targetMarkerSize = Math.min(24, SHAPE_ROW_HEIGHT - 10, toRect.width * 0.45);
  const beginLeft = fromRect.left + 4 + markerSize;
  const beginTop = fromRect.top + SHAPE_ROW_HEIGHT / 2;
  const endLeft = toRect.left + 4 + targetMarkerSize / 2;
  const endTop = toRect.top + SHAPE_ROW_HEIGHT / 2;
  const horizontalStartLeft = Math.min(
    endLeft - 10,
    beginLeft + Math.max(18, Math.min(42, (endLeft - beginLeft) * 0.28))
  );

  const diagonal = sheet.shapes.addLine(
    beginLeft,
    beginTop,
    horizontalStartLeft,
    endTop,
    Excel.ConnectorType.straight
  );
  diagonal.name = `${SHAPE_PREFIX}EDGE_${edge.fromId}_${edge.toId}_DIAG`;

  const horizontal = sheet.shapes.addLine(
    horizontalStartLeft,
    endTop,
    endLeft,
    endTop,
    Excel.ConnectorType.straight
  );
  horizontal.name = `${SHAPE_PREFIX}EDGE_${edge.fromId}_${edge.toId}_H`;

  return [diagonal, horizontal];
}

function styleEdgeLine(line: Excel.Shape, edge: LayoutResult["edges"][number]): void {
  // OJO: Shape NO tiene `.line`. Arrowheads no son configurables vía Office.js
  // (ShapeLineFormat solo expone color/weight/visible/dashStyle/style/
  // transparency). Si necesitamos cambiar arrowhead, hay que tocar el XML del
  // shape (out of scope).
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
  const parts = edgeLabel.split("\n").filter(Boolean);
  const probability = parts.find((part) => part.includes("%")) ?? "";
  const details = parts.filter((part) => part !== probability).join(" · ");

  if (probability) {
    const probabilityRange = setRowBandValue(sheet, edge.connectorCol, row, 1, probability);
    probabilityRange.format.fill.color = edge.isOptimal ? QUINTANA.limeTenue : QUINTANA.cream;
    probabilityRange.format.font.name = "Calibri";
    probabilityRange.format.font.size = 9;
    probabilityRange.format.font.bold = true;
    probabilityRange.format.font.color = QUINTANA.ink;
    probabilityRange.format.horizontalAlignment = "Right";
  }

  const labelText = [edge.label, details].filter(Boolean).join(" · ");
  const labelRange = setRowBandValue(sheet, edge.connectorCol + 1, row, 2, labelText);
  labelRange.format.font.name = "Calibri";
  labelRange.format.font.size = 9;
  labelRange.format.font.color = edge.isOptimal ? EDGE_COLORS.optimal : EDGE_COLORS.normal;
  labelRange.format.horizontalAlignment = "Left";
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

// `enumeratePaths` + `PathRow` viven en src/engine/PathEnumeration.ts (shared con el taskpane).

/**
 * Tabla de resumen de caminos (header olive, filas alternas, fila óptima destacada).
 */
function buildPathValueFormula(
  path: PathRow,
  metadata: CalcSheetMetadata,
  isCost: boolean
): string | null {
  const terminalId = path.ids[path.ids.length - 1];
  const terminalRef = metadata.nodeRefs[terminalId];
  if (!terminalRef) return null;

  // root no aporta cost al path (parity con enumeratePaths). costs vienen de
  // los nodos siguientes hasta el end inclusive.
  const costAddrs: string[] = [];
  for (let idx = 1; idx < path.ids.length; idx++) {
    const nodeRef = metadata.nodeRefs[path.ids[idx]];
    if (nodeRef) costAddrs.push(`N(${nodeRef.costAddress})`);
  }

  const signOp = isCost ? "+" : "-";
  if (costAddrs.length === 0) {
    return `=N(${terminalRef.terminalValueAddress})`;
  }
  return `=N(${terminalRef.terminalValueAddress})${signOp}(${costAddrs.join("+")})`;
}

function renderPathsTable(
  sheet: Excel.Worksheet,
  row: number,
  totalCols: number,
  tree: DecisionTreeData,
  paths: PathRow[],
  metadata: CalcSheetMetadata
): number {
  const cols = totalCols;
  const isCost = tree.metadata.mode === "minimize";
  const rootRef = tree.rootId ? metadata.nodeRefs[tree.rootId] : undefined;

  const heading = setRowBandValue(sheet, 0, row, cols, "RESUMEN DE CAMINOS");
  heading.format.font.name = "Calibri";
  heading.format.font.size = 10;
  heading.format.font.bold = true;
  heading.format.font.color = QUINTANA.marine;
  heading.format.horizontalAlignment = "Left";
  sheet.getRange(rangeAddr(0, row, cols, 1)).format.rowHeight = 16;

  const headerRow = row + 1;
  const pathColSpan = Math.max(cols - 9, 6);
  // Headers AG/AJ: "total del camino" deja claro que es el costo/valor
  // ACUMULADO desde la raíz (suma terminal + costs intermedios), distinto
  // del NetEV por nodo de la memoria de cálculo (columna J). La nota explica
  // la diferencia abajo de la tabla.
  const totalColLabel = isCost ? "Costo total del camino" : "Valor total del camino";
  const diffColLabel = isCost ? "Vs costo esperado" : "Vs valor esperado";
  const colLayout = [
    { label: "Camino", col: 0, span: pathColSpan, align: "Left" as const },
    { label: "Probabilidad", col: pathColSpan, span: 3, align: "Center" as const },
    { label: totalColLabel, col: pathColSpan + 3, span: 3, align: "Right" as const },
    { label: diffColLabel, col: pathColSpan + 6, span: 3, align: "Right" as const },
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

    // Columnas numéricas se escriben como FÓRMULAS que referencian el calc
    // table (memoria de cálculo). Si el usuario edita un cost o terminalValue
    // en J/G/H, esta tabla se recalcula automáticamente. Antes eran valores
    // literales (snapshot del momento del render) y se desincronizaban.
    //
    // - "Costo/Valor esperado" = N(terminalValue) ± (sum N(cost) de cada nodo
    //   no-root del path). Sign: + en modo Costo, - en modo Valor.
    // - "Vs recomendado" = valueFormula - netEvAddress(root). Diferencia entre
    //   este camino y el costo/valor esperado del árbol. Para el path óptimo
    //   se muestra "—" (no aplica diferencia consigo mismo en sentido estricto).
    const valueFormula = buildPathValueFormula(p, metadata, isCost);
    const diffFormula =
      valueFormula && rootRef
        ? `=(${valueFormula.slice(1)})-${rootRef.netEvAddress}`
        : null;

    type CellSpec = {
      col: number;
      span: number;
      align: "Left" | "Center" | "Right";
      kind: "text" | "formula" | "number";
      text?: string;
      formula?: string;
      number?: number;
      numberFormat?: string;
    };
    // Convención: TODOS los paths muestran su delta vs rootNetEv (incluso 0
    // para los óptimos). El reviewer pedía consistencia — antes había guion
    // para óptimos y número para no-óptimos, mezcla difícil de auditar.
    const valuesByCol: CellSpec[] = [
      { col: colLayout[0].col, span: colLayout[0].span, kind: "text", text: p.label, align: "Left" },
      { col: colLayout[1].col, span: colLayout[1].span, kind: "text", text: `${(p.probability * 100).toFixed(1)}%`, align: "Center" },
      valueFormula
        ? { col: colLayout[2].col, span: colLayout[2].span, kind: "formula", formula: valueFormula, numberFormat: "$#,##0", align: "Right" }
        : { col: colLayout[2].col, span: colLayout[2].span, kind: "number", number: p.value, numberFormat: "$#,##0", align: "Right" },
      diffFormula
        ? { col: colLayout[3].col, span: colLayout[3].span, kind: "formula", formula: diffFormula, numberFormat: "$#,##0;[Red]-$#,##0", align: "Right" }
        : { col: colLayout[3].col, span: colLayout[3].span, kind: "number", number: p.diff, numberFormat: "$#,##0;[Red]-$#,##0", align: "Right" },
    ];

    for (const v of valuesByCol) {
      let r: Excel.Range;
      if (v.kind === "formula") {
        // setRowBandValue maneja merge + setea topLeft.values; acá hacemos
        // lo mismo pero seteando topLeft.formulas para que sea fórmula viva.
        const band = sheet.getRange(rangeAddr(v.col, curRow, v.span, 1));
        band.unmerge();
        if (v.span > 1) band.merge();
        r = sheet.getCell(curRow, v.col);
        r.formulas = [[v.formula ?? ""]];
      } else {
        r =
          v.kind === "number"
            ? setRowBandValue(sheet, v.col, curRow, v.span, v.number ?? 0)
            : setRowBandValue(sheet, v.col, curRow, v.span, v.text ?? "");
      }
      if (v.numberFormat && (v.kind === "number" || v.kind === "formula")) {
        r.numberFormat = [[v.numberFormat]];
      }
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

  // Nota explicativa: la columna AG suma costos del path desde raíz
  // (interpretación "qué te cuesta este camino completo"); la columna J de
  // la memoria de cálculo es NetEV por nodo (no acumula costos del padre).
  // Por eso ambos pueden diferir aunque el árbol esté bien.
  const explanationText = isCost
    ? "Nota: el costo total del camino acumula los costos desde la raíz (CAPEX + costos intermedios + costo terminal). Difiere del NetEV por nodo (columna J de la memoria de cálculo) — ese muestra el costo del nodo en sí, sin acumular el del padre."
    : "Nota: el valor total del camino acumula payoffs y costos desde la raíz. Difiere del NetEV por nodo (columna J de la memoria de cálculo) — ese muestra el valor del nodo en sí, sin acumular el del padre.";
  const explanation = setRowBandValue(sheet, 0, curRow, cols, explanationText);
  explanation.format.font.name = "Calibri";
  explanation.format.font.size = 8;
  explanation.format.font.italic = true;
  explanation.format.font.color = QUINTANA.inkMuted;
  explanation.format.horizontalAlignment = "Left";
  sheet.getRange(rangeAddr(0, curRow, cols, 1)).format.rowHeight = 14;
  curRow++;

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
  _calcSheetMetadata: CalcSheetMetadata,
  _calcPlacement: CalcTablePlacement,
  tree: DecisionTreeData,
  _options: { debug?: boolean } = {}
): Promise<void> {
  await runTrackedOperation(
    "renderToExcel",
    { nodes: layout.nodes.length, edges: layout.edges.length },
    async () => {
      await Excel.run(async (context) => {
        const treeSheet = await getOrCreateSheet(context, TREE_SHEET_NAME, null);
        treeSheet.activate();

        // Migración: si existe la vieja hoja oculta DT_Calculos de versiones
        // anteriores, borrarla. Ahora la tabla de cálculos vive inline en la
        // hoja del árbol.
        const legacyCalc = context.workbook.worksheets.getItemOrNullObject(CALC_SHEET_NAME);
        legacyCalc.load("name");
        await context.sync();
        if (!legacyCalc.isNullObject) {
          legacyCalc.delete();
          await context.sync();
        }

        await clearWorksheet(treeSheet);

        // totalCols = cantidad de columnas usadas. Termina 2 cols después de
        // la última columna del árbol (layout.maxCol es índice del nodo más
        // a la derecha; el nodo ocupa GRID.nodeCols). Mínimo 24 para que la
        // tabla de caminos y header tengan espacio razonable.
        const totalCols = Math.max(layout.maxCol + GRID.nodeCols + 2, 24);
        const lastColIdx = totalCols - 1;
        // No forzamos columnWidth de todas las columnas. Antes las ponía en 9 y
        // los valores con formato moneda se mostraban como "####". Dejamos el
        // ancho default de Excel (~8.43 ≈ 64px) y listo; las bandas del header,
        // recomendación y tabla de caminos siguen usando merge para ocupar el
        // ancho completo, y los nodos a 4 columnas tienen ~256px de sobra.
        treeSheet.showGridlines = false;

        // Fila del shape más alta para que el polígono entre cómodo.
        for (const node of layout.nodes) {
          const shapeRowAddr = rangeAddr(node.col, node.row, 1, 1);
          treeSheet.getRange(shapeRowAddr).format.rowHeight = SHAPE_ROW_HEIGHT;
        }

        renderTitle(treeSheet, tree, totalCols);
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

        const inlineCalcSheetMetadata = buildInlineCalculationMetadata(layout, TREE_SHEET_NAME);
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
            writeNodeCells(treeSheet, node, renderNode, inlineCalcSheetMetadata, tree);
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

        // Para cada edge: 3 pasos aislados con su propio sync. Si el anclaje
        // shape-a-shape falla en algún host, la línea libre (con coords abs)
        // ya quedó dibujada y el render sigue. Cada paso loggea su propio
        // success/error en DT_DebugLog así sabemos exactamente dónde rompe.
        for (const edge of layout.edges) {
          const fromRect = assertValidNodeRect(edge.fromId, nodeRects[edge.fromId], "edge.from");
          const toRect = assertValidNodeRect(edge.toId, nodeRects[edge.toId], "edge.to");
          const renderEdge = renderEdgeByKey[`${edge.fromId}-${edge.toId}`];
          const edgeKey = `${edge.fromId}->${edge.toId}`;

          // Paso 1a: addLine + name (sync solo). Cada edge son dos shapes:
          // diagonal + horizontal, para lograr la forma exacta del VM Plan.
          let lines: Excel.Shape[] = [];
          try {
            lines = addEdgeLines(treeSheet, edge, fromRect, toRect);
            await context.sync();
            logDiagnostic(`edge.add ${edgeKey}`, "success", { segments: lines.length });
          } catch (error) {
            const msg = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
            logDiagnostic(`edge.add ${edgeKey}`, "error", { error: msg });
            try {
              await context.sync();
            } catch {
              /* ignore */
            }
            continue;
          }

          const targetColor = edge.isOptimal ? EDGE_COLORS.optimal : EDGE_COLORS.normal;
          const targetWeight = edge.isOptimal ? EDGE_COLORS.optimalWeight : EDGE_COLORS.normalWeight;

          for (const line of lines) {
            try {
              line.lineFormat.visible = true;
              await context.sync();
              logDiagnostic(`edge.style.visible ${edgeKey}`, "success", { shape: line.name });
            } catch (error) {
              const msg = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
              logDiagnostic(`edge.style.visible ${edgeKey}`, "error", { shape: line.name, error: msg });
              try { await context.sync(); } catch { /* ignore */ }
            }

            try {
              line.lineFormat.color = targetColor;
              await context.sync();
              logDiagnostic(`edge.style.color ${edgeKey}`, "success", { shape: line.name, color: targetColor });
            } catch (error) {
              const msg = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
              logDiagnostic(`edge.style.color ${edgeKey}`, "error", { shape: line.name, color: targetColor, error: msg });
              try { await context.sync(); } catch { /* ignore */ }
            }

            try {
              line.lineFormat.weight = targetWeight;
              await context.sync();
              logDiagnostic(`edge.style.weight ${edgeKey}`, "success", { shape: line.name, weight: targetWeight });
            } catch (error) {
              const msg = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
              logDiagnostic(`edge.style.weight ${edgeKey}`, "error", { shape: line.name, weight: targetWeight, error: msg });
              try { await context.sync(); } catch { /* ignore */ }
            }

            // placement = oneCell. Falla en algunos hosts para Lines.
            try {
              setShapePlacement(line);
              await context.sync();
              logDiagnostic(`edge.placement ${edgeKey}`, "success", { shape: line.name });
            } catch (error) {
              const msg = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
              logDiagnostic(`edge.placement ${edgeKey}`, "error", { shape: line.name, error: msg });
              try {
                await context.sync();
              } catch {
                /* ignore */
              }
            }
          }

          // Paso 1d: label cells (puede fallar por overlap de merges).
          try {
            writeEdgeLabelCells(treeSheet, edge, renderEdge?.label ?? "");
            await context.sync();
            logDiagnostic(`edge.label ${edgeKey}`, "success");
          } catch (error) {
            const msg = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
            logDiagnostic(`edge.label ${edgeKey}`, "error", { error: msg });
            try {
              await context.sync();
            } catch {
              /* ignore */
            }
          }
        }

        await context.sync();
        writeInlineCalculationCells(treeSheet, tree, layout, inlineCalcSheetMetadata);
        await context.sync();

        // Secciones inferiores del documento. Cada una se ejecuta dentro de un
        // try/catch + sync: si una falla, la siguiente igual se intenta y el
        // documento queda parcialmente armado en lugar de morir entero.
        // Cuando algo explota, el motivo queda en A3:A4 (writeRenderDebug).
        let cursor = layout.maxRow + GRID.rowGap + 1;
        const safeSection = async (name: string, fn: () => number | Promise<number>): Promise<void> => {
          try {
            const next = await fn();
            cursor = next;
            await context.sync();
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            writeRenderDebug(treeSheet, `Falló sección ${name}`, msg);
            console.error(`[renderToExcel] sección "${name}" falló:`, error);
            try {
              await context.sync();
            } catch {
              // si el sync de debug también explota, seguimos
            }
          }
        };

        await safeSection("leyenda", async () => renderLegend(treeSheet, cursor + 1, totalCols));

        await safeSection("recomendación", async () => {
          const rootNode = tree.rootId ? tree.nodes[tree.rootId] : null;
          const isCost = tree.metadata.mode === "minimize";
          const rootLabel = isCost ? "Costo esperado del árbol" : "Valor esperado del árbol";
          const recommended = renderModel.summary?.recommendedAction.replace(/^Elegir:\s*/, "") ?? "";
          const headline = recommended
            ? `Recomendación: ${recommended}`
            : "Sin recomendación (el árbol todavía no tiene una decisión clara)";
          const summaryValue = renderModel.summary?.rootValue ?? "";
          const rootEv = rootNode?.expectedValue ?? null;
          const detail = summaryValue
            ? summaryValue
            : rootEv !== null
              ? `${rootLabel}: ${formatCurrencyAr(rootEv)}`
              : "Completá el árbol para ver el resultado esperado.";
          return renderRecommendationBox(treeSheet, cursor + 1, totalCols, headline, detail);
        });

        await safeSection("tabla de caminos", async () => {
          const paths = enumeratePaths(tree);
          return paths.length > 0
            ? renderPathsTable(treeSheet, cursor, totalCols, tree, paths, inlineCalcSheetMetadata)
            : cursor;
        });

        await safeSection("footer", async () => renderFooter(treeSheet, cursor + 1, totalCols));

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
    const legacyCalc = context.workbook.worksheets.getItemOrNullObject(CALC_SHEET_NAME);
    legacyCalc.load("name");
    await context.sync();

    if (!treeSheet.isNullObject) {
      await clearWorksheet(treeSheet);
    }
    // Limpieza one-shot de la hoja oculta DT_Calculos de versiones anteriores.
    // La memoria de cálculo ahora vive inline en la hoja del árbol.
    if (!legacyCalc.isNullObject) {
      legacyCalc.delete();
      await context.sync();
    }
  });
}
