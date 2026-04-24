import { runTrackedOperation } from "../debug/excelDiagnostics";
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
import { COL_WIDTH, EDGE_COLORS, GRID, ROW_HEIGHT, SHAPE_PREFIX } from "./StyleConfig";

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
  geometricType: Excel.GeometricShapeType | "Rectangle" | "Ellipse" | "RoundRectangle";
}

const NODE_THEMES: Record<ShapeType, NodeTheme> = {
  decision: {
    fill: RENDER_TOKENS.decision.fill,
    border: RENDER_TOKENS.decision.border,
    text: RENDER_TOKENS.decision.text,
    geometricType: "Rectangle",
  },
  chance: {
    fill: RENDER_TOKENS.chance.fill,
    border: RENDER_TOKENS.chance.border,
    text: RENDER_TOKENS.chance.text,
    geometricType: "Ellipse",
  },
  end: {
    fill: RENDER_TOKENS.end.fill,
    border: RENDER_TOKENS.end.border,
    text: RENDER_TOKENS.end.text,
    geometricType: "RoundRectangle",
  },
};

function writeRenderDebug(sheet: Excel.Worksheet, title: string, detail = ""): void {
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
  band.merge();
  sheet.getCell(row, col).values = [[value]];
  return band;
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
  const markerWidth = Math.max(18, Math.min(28, rect.width * 0.18));
  const markerHeight = Math.max(18, Math.min(28, rect.height * 0.28));

  marker.name = `${SHAPE_PREFIX}NODE_${node.id}`;
  marker.left = rect.left + 4;
  marker.top = rect.top + 10;
  marker.width = markerWidth;
  marker.height = markerHeight;
  marker.placement = "OneCell";
  marker.fill.setSolidColor(theme.fill);
  marker.lineFormat.color = node.isOptimal ? RENDER_TOKENS.accent : theme.border;
  marker.lineFormat.weight = node.isOptimal ? EDGE_COLORS.optimalWeight : 1.25;
  marker.lineFormat.visible = true;
  return marker;
}

function writeNodeCells(
  sheet: Excel.Worksheet,
  layoutNode: LayoutNode,
  renderNode: RenderNodeContent
): void {
  const theme = NODE_THEMES[renderNode.type];
  const startCol = layoutNode.col + 1;
  const width = Math.max(GRID.nodeCols - 1, 3);
  const titleRange = setRowBandValue(sheet, startCol, layoutNode.row, width, renderNode.title);
  const valueRange = setRowBandValue(
    sheet,
    startCol,
    layoutNode.row + 1,
    width,
    renderNode.primaryValue
  );
  const detailRange = setRowBandValue(
    sheet,
    startCol,
    layoutNode.row + 2,
    width,
    renderNode.secondaryLines.join(" | ")
  );
  const noteRange = setRowBandValue(
    sheet,
    startCol,
    layoutNode.row + 3,
    width,
    renderNode.noteLines.join(" | ")
  );

  titleRange.format.fill.color = renderNode.isOptimal ? "#E2FF87" : theme.fill;
  valueRange.format.fill.color = "#FFFFFF";
  detailRange.format.fill.color = "#F7F8F9";
  noteRange.format.fill.color = "#FFFFFF";

  titleRange.format.font.name = "Calibri";
  titleRange.format.font.size = 11;
  titleRange.format.font.bold = true;
  titleRange.format.font.color = renderNode.isOptimal ? "#33492D" : theme.text;

  valueRange.format.font.name = "Calibri";
  valueRange.format.font.size = 10;
  valueRange.format.font.bold = true;
  valueRange.format.font.color = "#1A1A1A";

  detailRange.format.font.name = "Calibri";
  detailRange.format.font.size = 9;
  detailRange.format.font.color = RENDER_TOKENS.edge;

  noteRange.format.font.name = "Calibri";
  noteRange.format.font.size = 8;
  noteRange.format.font.color = RENDER_TOKENS.muted;
}

function createEdgeConnector(
  sheet: Excel.Worksheet,
  edge: LayoutResult["edges"][number],
  fromRect: NodeRect,
  toRect: NodeRect
): void {
  const line = (sheet.shapes as unknown as {
    addLine: (x1: number, y1: number, x2: number, y2: number, kind: string) => Excel.Shape;
  }).addLine(
    fromRect.left + 20,
    fromRect.top + 24,
    toRect.left + 4,
    toRect.top + 24,
    "Elbow"
  );

  line.name = `${SHAPE_PREFIX}EDGE_${edge.fromId}_${edge.toId}`;
  line.placement = "OneCell";
  line.line.endArrowheadStyle = "Triangle";
  line.line.endArrowheadLength = "Medium";
  line.line.endArrowheadWidth = "Medium";
  line.line.beginArrowheadStyle = "None";
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
  const shape = sheet.shapes.addGeometricShape("RoundRectangle");
  shape.name = `${SHAPE_PREFIX}SUMMARY`;
  shape.left = col * COL_WIDTH + 2;
  shape.top = row * ROW_HEIGHT + 4;
  shape.width = 16;
  shape.height = 16;
  shape.placement = "OneCell";
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
        treeSheet.showGridlines = true;

        renderTitle(treeSheet, tree);
        writeRenderDebug(treeSheet, "Render iniciado");
        await writeCalculationModel(calcSheet, tree, calcSheetMetadata);

        const rangeByNodeId: Record<string, Excel.Range> = {};
        for (const node of layout.nodes) {
          const range = treeSheet.getRange(rangeAddr(node.col, node.row, 1, GRID.nodeRows));
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
          const rect = nodeRects[node.id];
          const renderNode = renderNodeById[node.id];
          try {
            writeRenderDebug(treeSheet, `Nodo ${node.id}`, "Marker + celdas");
            createNodeMarker(treeSheet, renderNode, rect);
            writeNodeCells(treeSheet, node, renderNode);
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
          const fromRect = nodeRects[edge.fromId];
          const toRect = nodeRects[edge.toId];
          if (!fromRect || !toRect) continue;

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
