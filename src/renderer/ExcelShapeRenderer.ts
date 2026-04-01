import { getOptimalChildId } from "../engine/RollbackAnalysis";
import { writeCalculationModel } from "../excel/CalculationSheet";
import { colLetter, rangeAddr } from "../excel/ExcelAddress";
import { TREE_SHEET_NAME } from "../excel/WorkbookConstants";
import { CalcSheetMetadata, DecisionTreeData, LayoutResult } from "../models/types";
import {
  SHAPE_PREFIX,
  GRID,
  COL_WIDTH,
  ROW_HEIGHT,
} from "./StyleConfig";

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
  accent: string;
  geometricType: Excel.GeometricShapeType | "Rectangle" | "Ellipse" | "RoundRectangle";
}

const NODE_THEMES: Record<ShapeType, NodeTheme> = {
  decision: {
    fill: "#33492D",
    border: "#1B4B6C",
    text: "#FFFFFF",
    accent: "#E2FF87",
    geometricType: "Rectangle",
  },
  chance: {
    fill: "#DAE0E5",
    border: "#1B4B6C",
    text: "#1a1a1a",
    accent: "#6B7B38",
    geometricType: "Ellipse",
  },
  end: {
    fill: "#FFEAC6",
    border: "#AD977D",
    text: "#1a1a1a",
    accent: "#6B7B38",
    geometricType: "RoundRectangle",
  },
};

function currency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "N/D";
  return `$${value.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

function amountLabel(tree: DecisionTreeData): string {
  return tree.metadata.mode === "minimize" ? "Costo esperado" : "VEN";
}

function getNodeText(tree: DecisionTreeData, node: LayoutResult["nodes"][number]): string {
  const lines = [node.label, `${amountLabel(tree)}: ${currency(node.expectedValue)}`];

  if (node.type === "end") {
    lines.push(
      `${tree.metadata.mode === "minimize" ? "Costo term." : "VAN term."}: ${currency(node.payoff)}`
    );
  }

  return lines.join("\n");
}

function getEdgeLabel(tree: DecisionTreeData, edge: LayoutResult["edges"][number]): string {
  const child = tree.nodes[edge.toId];
  if (!child) return "";

  const parts: string[] = [];
  if (edge.probability !== null && edge.probability > 0) {
    parts.push(`${(edge.probability * 100).toFixed(0)}%`);
  }
  if (child.cost !== null && child.cost !== 0) {
    parts.push(`Costo ${currency(child.cost)}`);
  }
  if (child.time) {
    parts.push(child.time);
  }

  return parts.join("\n");
}

function setTransparent(shape: Excel.Shape): void {
  shape.fill.setSolidColor("#FFFFFF");
  shape.fill.transparency = 1;
  shape.lineFormat.visible = false;
}

function styleShapeText(
  shape: Excel.Shape,
  color: string,
  fontName: string,
  fontSize: number,
  bold = false
): void {
  shape.textFrame.horizontalAlignment = "Center";
  shape.textFrame.verticalAlignment = "Middle";
  shape.textFrame.leftMargin = 8;
  shape.textFrame.rightMargin = 8;
  shape.textFrame.topMargin = 6;
  shape.textFrame.bottomMargin = 6;
  shape.textFrame.autoSizeSetting = "AutoSizeTextToFitShape";
  shape.textFrame.textRange.font.color = color;
  shape.textFrame.textRange.font.name = fontName;
  shape.textFrame.textRange.font.size = fontSize;
  shape.textFrame.textRange.font.bold = bold;
}

async function getTreeSheet(context: Excel.RequestContext): Promise<Excel.Worksheet> {
  const sheet = context.workbook.worksheets.getItemOrNullObject(TREE_SHEET_NAME);
  await context.sync();
  if (!sheet.isNullObject) {
    sheet.activate();
    return sheet;
  }

  const created = context.workbook.worksheets.add(TREE_SHEET_NAME);
  created.activate();
  return created;
}

async function clearSheet(sheet: Excel.Worksheet): Promise<void> {
  const shapes = sheet.shapes;
  shapes.load("items/name");
  const usedRange = sheet.getUsedRangeOrNullObject();
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

function createNodeShape(
  sheet: Excel.Worksheet,
  tree: DecisionTreeData,
  node: LayoutResult["nodes"][number],
  rect: NodeRect
): Excel.Shape {
  const theme = NODE_THEMES[node.type];
  const shape = sheet.shapes.addGeometricShape(theme.geometricType);

  shape.name = `${SHAPE_PREFIX}NODE_${node.id}`;
  shape.left = rect.left;
  shape.top = rect.top;
  shape.width = rect.width;
  shape.height = rect.height;
  shape.placement = "OneCell";
  shape.fill.setSolidColor(theme.fill);
  shape.lineFormat.color = node.isOptimal ? "#6B7B38" : theme.border;
  shape.lineFormat.weight = node.isOptimal ? 3 : 1.5;
  shape.lineFormat.visible = true;
  shape.textFrame.textRange.text = getNodeText(tree, node);
  styleShapeText(shape, theme.text, "Montserrat", node.type === "chance" ? 10 : 10.5, true);

  return shape;
}

function createNodeNote(
  sheet: Excel.Worksheet,
  node: LayoutResult["nodes"][number],
  rect: NodeRect
): void {
  const lines: string[] = [];
  if (node.time) lines.push(node.time);
  for (const [key, value] of Object.entries(node.customFields ?? {})) {
    if (value === null || value === undefined || value === "") continue;
    lines.push(`${key}: ${value}`);
  }

  if (lines.length === 0) return;

  const note = sheet.shapes.addTextBox(lines.slice(0, 3).join("\n"));
  note.name = `${SHAPE_PREFIX}NOTE_${node.id}`;
  note.left = rect.left;
  note.top = rect.top + rect.height + 4;
  note.width = rect.width;
  note.height = 34;
  note.placement = "OneCell";
  setTransparent(note);
  styleShapeText(note, "#555555", "Inter", 8, false);
}

function createEdgeConnector(
  sheet: Excel.Worksheet,
  tree: DecisionTreeData,
  edge: LayoutResult["edges"][number],
  fromRect: NodeRect,
  toRect: NodeRect
): void {
  const line = sheet.shapes.addLine(
    fromRect.left + fromRect.width,
    fromRect.top + fromRect.height / 2,
    toRect.left,
    toRect.top + toRect.height / 2,
    "Elbow"
  );

  line.name = `${SHAPE_PREFIX}EDGE_${edge.fromId}_${edge.toId}`;
  line.placement = "OneCell";
  line.line.endArrowheadStyle = "Triangle";
  line.line.endArrowheadLength = "Medium";
  line.line.endArrowheadWidth = "Medium";
  line.line.beginArrowheadStyle = "None";
  line.lineFormat.color = edge.isOptimal ? "#6B7B38" : "#1B4B6C";
  line.lineFormat.weight = edge.isOptimal ? 2.75 : 1.5;
  line.lineFormat.visible = true;

  const labelText = getEdgeLabel(tree, edge);
  if (!labelText) return;

  const label = sheet.shapes.addTextBox(labelText);
  label.name = `${SHAPE_PREFIX}EDGE_LABEL_${edge.fromId}_${edge.toId}`;
  label.left = (fromRect.left + fromRect.width + toRect.left) / 2 - 36;
  label.top = Math.min(fromRect.top + fromRect.height / 2, toRect.top + toRect.height / 2) - 18;
  label.width = 72;
  label.height = labelText.includes("\n") ? 34 : 18;
  label.placement = "OneCell";
  label.fill.setSolidColor("#FFFFFF");
  label.fill.transparency = 0.2;
  label.lineFormat.visible = false;
  styleShapeText(label, "#1B4B6C", "Inter", 8, true);
}

function renderTitle(sheet: Excel.Worksheet, tree: DecisionTreeData): void {
  const titleRange = sheet.getRange(rangeAddr(GRID.startCol, 0, 8, 1));
  titleRange.merge();
  sheet.getCell(0, GRID.startCol).values = [[tree.metadata.name]];
  titleRange.format.font.name = "Montserrat";
  titleRange.format.font.size = 15;
  titleRange.format.font.bold = true;
  titleRange.format.font.color = "#33492D";
}

function createSummaryBox(
  sheet: Excel.Worksheet,
  tree: DecisionTreeData,
  nodeRects: Record<string, NodeRect>
): void {
  const rootValue = tree.rootId ? tree.nodes[tree.rootId]?.expectedValue ?? null : null;
  const bestChildId =
    tree.rootId
      ? getOptimalChildId(
          tree,
          tree.rootId,
          Object.fromEntries(Object.entries(tree.nodes).map(([id, node]) => [id, node.expectedValue]))
        )
      : null;
  const rootRect = tree.rootId ? nodeRects[tree.rootId] : null;
  const baseLeft = rootRect ? rootRect.left + rootRect.width + 170 : 560;
  const baseTop = rootRect ? Math.max(50, rootRect.top - 10) : 70;

  const card = sheet.shapes.addGeometricShape("RoundRectangle");
  card.name = `${SHAPE_PREFIX}SUMMARY`;
  card.left = baseLeft;
  card.top = baseTop;
  card.width = 220;
  card.height = 112;
  card.placement = "OneCell";
  card.fill.setSolidColor("#FFFFFF");
  card.lineFormat.color = "#6B7B38";
  card.lineFormat.weight = 2;
  card.textFrame.textRange.text = [
    tree.metadata.mode === "minimize" ? "Resumen de costo" : "Resumen de valor",
    `${amountLabel(tree)} raiz: ${currency(rootValue)}`,
    `Elegir: ${bestChildId ? tree.nodes[bestChildId]?.label ?? "-" : "-"}`,
  ].join("\n");
  styleShapeText(card, "#33492D", "Montserrat", 10, true);
}

export async function renderToExcel(
  layout: LayoutResult,
  calcSheet: CalcSheetMetadata,
  tree: DecisionTreeData
): Promise<void> {
  await Excel.run(async (context) => {
    const sheet = await getTreeSheet(context);
    await clearSheet(sheet);

    const lastCol = Math.max(layout.maxCol + GRID.colGap + 18, 90);
    const lastRow = layout.maxRow + GRID.rowGap + 20;
    sheet.getRange(`A:${colLetter(lastCol)}`).format.columnWidth = COL_WIDTH;
    sheet.getRange(`1:${lastRow}`).format.rowHeight = ROW_HEIGHT;
    sheet.showGridlines = false;

    renderTitle(sheet, tree);
    writeCalculationModel(sheet, tree, calcSheet);

    const rangeByNodeId: Record<string, Excel.Range> = {};
    for (const node of layout.nodes) {
      const range = sheet.getRange(rangeAddr(node.col, node.row, GRID.nodeCols, GRID.nodeRows));
      range.load("left,top,width,height");
      rangeByNodeId[node.id] = range;
    }

    // Sync 1: commit formatting + calc model, load range positions
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

    // Phase 2: create node shapes
    for (const node of layout.nodes) {
      const rect = nodeRects[node.id];
      createNodeShape(sheet, tree, node, rect);
      createNodeNote(sheet, node, rect);
    }

    await context.sync();

    // Phase 3: create edge connectors (separate batch for robustness)
    for (const edge of layout.edges) {
      const fromRect = nodeRects[edge.fromId];
      const toRect = nodeRects[edge.toId];
      if (!fromRect || !toRect) continue;
      createEdgeConnector(sheet, tree, edge, fromRect, toRect);
    }

    createSummaryBox(sheet, tree, nodeRects);
    await context.sync();
  });
}

export async function clearRenderedSheets(): Promise<void> {
  await Excel.run(async (context) => {
    const sheet = context.workbook.worksheets.getItemOrNullObject(TREE_SHEET_NAME);
    await context.sync();
    if (sheet.isNullObject) return;

    await clearSheet(sheet);
  });
}
