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
} from "../models/types";
import { RENDER_TOKENS } from "../rendering/designTokens";
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
    geometricType: "RoundRectangle" as Excel.GeometricShapeType,
  },
};

function setShapePlacement(_shape: Excel.Shape): void {
  // DIAG 2026-04-24: placement comentado para aislar el RichApi.Error.
  // Si con esto renderiza, la causa era placement (ExcelApi 1.10 incompleto en el host).
  // _shape.placement = "OneCell";
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
  sheet.getRange("A3:A4").format.font.color = "#8B1E3F";
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

function renderTitle(sheet: Excel.Worksheet, tree: DecisionTreeData): void {
  const titleRange = setRowBandValue(sheet, GRID.startCol, 0, 12, tree.metadata.name);
  titleRange.format.font.name = "Montserrat";
  titleRange.format.font.size = 16;
  titleRange.format.font.bold = true;
  titleRange.format.font.color = RENDER_TOKENS.decision.fill;
}

function createNodeMarker(
  sheet: Excel.Worksheet,
  node: RenderNodeContent,
  rect: NodeRect
): Excel.Shape {
  const theme = NODE_THEMES[node.type];
  const marker = sheet.shapes.addGeometricShape(theme.geometricType);

  // Aspect ratio 1:1 real. Cabe dentro de la fila superior del bloque del nodo.
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
  // Orden crítico: visible -> color -> weight. Weight debe ser entero en Excel desktop.
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

  // Fila 0 reservada para el shape. Celdas vacías para no competir visualmente.
  const shapeRowRange = sheet.getRange(rangeAddr(startCol, layoutNode.row, width, 1));
  shapeRowRange.unmerge();
  shapeRowRange.values = Array.from({ length: 1 }, () => Array.from({ length: width }, () => ""));

  // Fila 1: título (label).
  const titleRange = setRowBandValue(sheet, startCol, layoutNode.row + 1, width, renderNode.title);
  titleRange.format.fill.color = renderNode.isOptimal ? "#E2FF87" : theme.fill;
  titleRange.format.font.name = "Calibri";
  titleRange.format.font.size = 11;
  titleRange.format.font.bold = true;
  titleRange.format.font.color = renderNode.isOptimal ? "#33492D" : theme.text;
  titleRange.format.horizontalAlignment = "Center";

  // Fila 2: valor como NUMBER con numberFormat. Si está disponible, como fórmula
  // que referencia el calc sheet (la fuente de verdad). Así Bárbara ve la celda
  // conectada y puede auditar la cadena de cálculos.
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
  valueRange.format.fill.color = "#FFFFFF";
  valueRange.format.font.name = "Calibri";
  valueRange.format.font.size = 11;
  valueRange.format.font.bold = true;
  valueRange.format.font.color = "#1A1A1A";
  valueRange.format.horizontalAlignment = "Center";

  // Fila 3: prob / costo / tiempo + notas en la misma banda (contexto, no dato duro).
  const detailText = [
    renderNode.secondaryLines.join(" · "),
    renderNode.noteLines.join(" · "),
  ]
    .filter((part) => part.length > 0)
    .join(" — ");
  const detailRange = setRowBandValue(sheet, startCol, layoutNode.row + 3, width, detailText);
  detailRange.format.fill.color = "#F7F8F9";
  detailRange.format.font.name = "Calibri";
  detailRange.format.font.size = 9;
  detailRange.format.font.color = RENDER_TOKENS.edge;
  detailRange.format.horizontalAlignment = "Center";
}

function createEdgeConnector(
  sheet: Excel.Worksheet,
  edge: LayoutResult["edges"][number],
  fromRect: NodeRect,
  toRect: NodeRect
): void {
  const line = sheet.shapes.addLine(
    fromRect.left + 20,
    fromRect.top + 24,
    toRect.left + 4,
    toRect.top + 24,
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
  line.lineFormat.visible = true;
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
}

function createSummaryShape(sheet: Excel.Worksheet, col: number, row: number): void {
  const shape = sheet.shapes.addGeometricShape("RoundRectangle" as Excel.GeometricShapeType);
  shape.name = `${SHAPE_PREFIX}SUMMARY`;
  shape.left = col * COL_WIDTH + 2;
  shape.top = row * ROW_HEIGHT + 4;
  shape.width = 16;
  shape.height = 16;
  setShapePlacement(shape);
  shape.fill.setSolidColor(RENDER_TOKENS.accent);
  shape.lineFormat.color = RENDER_TOKENS.accent;
  shape.lineFormat.visible = true;
}

function writeSummaryCells(
  sheet: Excel.Worksheet,
  renderModel: RenderModel,
  layout: LayoutResult
): void {
  if (!renderModel.summary) return;

  const startCol = Math.max(layout.maxCol + GRID.colGap + 2, 20);
  const title = setRowBandValue(sheet, startCol, 2, 8, renderModel.summary.title);
  const value = setRowBandValue(sheet, startCol, 3, 8, renderModel.summary.rootValue);
  const action = setRowBandValue(sheet, startCol, 4, 8, renderModel.summary.recommendedAction);

  title.format.font.name = "Calibri";
  title.format.font.size = 11;
  title.format.font.bold = true;
  title.format.font.color = RENDER_TOKENS.decision.fill;

  value.format.font.name = "Calibri";
  value.format.font.size = 10;
  value.format.font.bold = true;

  action.format.font.name = "Calibri";
  action.format.font.size = 9;
  action.format.font.color = RENDER_TOKENS.edge;

  createSummaryShape(sheet, startCol - 1, 2);
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

        const lastCol = Math.max(layout.maxCol + GRID.colGap + 24, 110);
        const lastRow = layout.maxRow + GRID.rowGap + 24;
        treeSheet.getRange(`A:${colLetter(lastCol)}`).format.columnWidth = COL_WIDTH;
        treeSheet.getRange(`1:${lastRow}`).format.rowHeight = ROW_HEIGHT;
        treeSheet.showGridlines = false;

        // La primera fila de cada bloque es reservada para el shape. Más alta
        // que el resto para que el círculo/cuadrado entre cómodo sin pisar texto.
        for (const node of layout.nodes) {
          const shapeRowAddr = rangeAddr(node.col, node.row, 1, 1);
          treeSheet.getRange(shapeRowAddr).format.rowHeight = SHAPE_ROW_HEIGHT;
        }

        renderTitle(treeSheet, tree);
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

        writeRenderDebug(treeSheet, "Resumen");
        writeSummaryCells(treeSheet, renderModel, layout);
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
