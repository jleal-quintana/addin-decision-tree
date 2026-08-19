import { oilDrillingExample, workoverExample } from "../src/engine/Examples";
import { buildCalculationModel, CalcTablePlacement } from "../src/excel/CalculationSheet";
import { cellAddr, rangeAddr } from "../src/excel/ExcelAddress";
import { clearShapes, renderTreeToExcel } from "../src/excel/ShapeManager";
import { TREE_SHEET_NAME } from "../src/excel/WorkbookConstants";
import { buildRenderModel } from "../src/rendering/renderModel";
import { renderToExcel } from "../src/renderer/ExcelShapeRenderer";
import { computeLayout } from "../src/renderer/TreeLayoutEngine";
import { GRID } from "../src/renderer/StyleConfig";
import { getWorksheet, installFakeExcel } from "./support/fakeExcel";

function makePlacement(maxRow: number): CalcTablePlacement {
  return { sheetName: TREE_SHEET_NAME, startRow: maxRow + 4, startCol: 0 };
}

describe("Excel rendering", () => {
  it("shows branch costs once and keeps terminal values on result nodes", () => {
    const tree = oilDrillingExample();
    const layout = computeLayout(tree);
    const renderModel = buildRenderModel(tree, layout);
    const drillNode = renderModel.nodes.find((node) => node.id === "drill")!;
    const oilNode = renderModel.nodes.find((node) => node.id === "oil")!;
    const drillEdge = renderModel.edges.find((edge) => edge.toId === "drill")!;

    expect(drillNode.secondaryLines).toEqual([]);
    expect(drillEdge.label).toContain("Costo $200.000");
    expect(oilNode.primaryValue).toBe("Valor final: $1,0MM");
  });

  it("renders shapes into the tree sheet", async () => {
    const { context } = installFakeExcel();
    const tree = oilDrillingExample();
    const layout = computeLayout(tree);
    const placement = makePlacement(layout.maxRow);
    const calc = buildCalculationModel(tree, placement);
    const renderModel = buildRenderModel(tree, layout);

    await renderToExcel(layout, renderModel, calc, placement, tree);

    const sheet = getWorksheet(context, TREE_SHEET_NAME)!;
    expect(sheet.shapes.items.some((shape) => shape.name.startsWith("DT_NODE_"))).toBe(true);
  });

  it("renders the complete printable document and applies A4 page setup", async () => {
    const { context } = installFakeExcel();
    const tree = oilDrillingExample();

    await renderTreeToExcel(tree);

    const sheet = getWorksheet(context, TREE_SHEET_NAME)!;
    const visibleValues = Array.from(sheet.cells.values()).map((cell) => cell.value);
    expect(visibleValues).toContain("RECOMENDACIÓN");
    expect(visibleValues).toContain("RESUMEN DE CAMINOS");
    expect(visibleValues.some((value) => String(value).startsWith("Leyenda:"))).toBe(true);
    expect(visibleValues.some((value) => String(value).includes("Documento confidencial"))).toBe(true);
    expect(sheet.pageLayout.orientation).toBe("Landscape");
    expect(sheet.pageLayout.paperSize).toBe("A4");
    expect(sheet.pageLayout.printArea).toMatch(/^A1:/);
    expect(sheet.showGridlines).toBe(false);
  });

  it("writes contingent decisions into the printable recommendation", async () => {
    const { context } = installFakeExcel();

    await renderTreeToExcel(workoverExample());

    const sheet = getWorksheet(context, TREE_SHEET_NAME)!;
    const visibleValues = Array.from(sheet.cells.values()).map((cell) => String(cell.value));
    expect(
      visibleValues.some((value) =>
        value.includes("Si Ante falla operativa: elegir Abandonar pozo")
      )
    ).toBe(true);
  });

  it("uses the branch-style visual language from the VM Plan reference", async () => {
    const { context } = installFakeExcel();
    const tree = oilDrillingExample();
    const layout = computeLayout(tree);
    const placement = makePlacement(layout.maxRow);
    const calc = buildCalculationModel(tree, placement);
    const renderModel = buildRenderModel(tree, layout);

    await renderToExcel(layout, renderModel, calc, placement, tree);

    const sheet = getWorksheet(context, TREE_SHEET_NAME)!;
    const nodeShape = sheet.shapes.items.find((shape) => shape.name.startsWith("DT_NODE_")) as any;
    expect(nodeShape).toBeTruthy();
    expect(nodeShape.fill.color).toBe("#FFFFFF");
    expect(nodeShape.width).toBeLessThanOrEqual(24);
    expect(nodeShape.lineFormat.weight).toBe(2);
    expect(sheet.shapes.items.some((shape) => shape.name.startsWith("DT_TERMINAL_"))).toBe(false);
  });

  it("renders branch labels and probabilities as text boxes over connectors", async () => {
    const { context } = installFakeExcel();
    const tree = oilDrillingExample();
    const rootChildId = tree.nodes[tree.rootId!].childIds[0];
    tree.nodes[rootChildId] = {
      ...tree.nodes[rootChildId],
      branchLabel: "Perforar",
    };
    const chanceChildId = tree.nodes[rootChildId].childIds[0];
    tree.nodes[chanceChildId] = {
      ...tree.nodes[chanceChildId],
      branchLabel: "Pozo productor",
      probability: 0.6,
    };
    const layout = computeLayout(tree);
    const placement = makePlacement(layout.maxRow);
    const calc = buildCalculationModel(tree, placement);
    const renderModel = buildRenderModel(tree, layout);

    await renderToExcel(layout, renderModel, calc, placement, tree);

    const sheet = getWorksheet(context, TREE_SHEET_NAME)!;
    const branchBoxes = sheet.shapes.items.filter((shape) => shape.name.startsWith("DT_BRANCH_")) as any[];
    expect(branchBoxes.length).toBeGreaterThan(0);
    expect(branchBoxes.some((shape) => shape.textFrame.textRange.text.includes("Perforar"))).toBe(true);
    expect(branchBoxes.some((shape) => shape.textFrame.textRange.text.includes("Pozo productor") && shape.textFrame.textRange.text.includes("60%"))).toBe(true);
  });

  it("reserves separate lanes for connectors, labels and numeric values", async () => {
    const { context } = installFakeExcel();
    const tree = oilDrillingExample();
    const layout = computeLayout(tree);
    const placement = makePlacement(layout.maxRow);
    const calc = buildCalculationModel(tree, placement);
    const renderModel = buildRenderModel(tree, layout);

    await renderToExcel(layout, renderModel, calc, placement, tree);

    const sheet = getWorksheet(context, TREE_SHEET_NAME)!;
    const rootLayout = layout.nodes.find((node) => node.id === tree.rootId)!;
    const metricLabelAddress = cellAddr(rootLayout.col + 4, rootLayout.row + GRID.nodeRows - 2);
    const metricValueAddress = cellAddr(rootLayout.col + 4, rootLayout.row + GRID.nodeRows - 1);

    expect(sheet.cells.get(metricLabelAddress)?.value).toBe("Valor esperado");
    expect(sheet.cells.get(metricValueAddress)?.numberFormat).toBe("$#,##0");
    expect(String(sheet.cells.get(metricValueAddress)?.numberFormat)).not.toContain("Valor");

    for (const edge of layout.edges) {
      const from = layout.nodes.find((node) => node.id === edge.fromId)!;
      const to = layout.nodes.find((node) => node.id === edge.toId)!;
      const fromRange = sheet.getRange(
        rangeAddr(from.col, from.row, GRID.nodeCols, GRID.nodeRows)
      ) as any;
      const toRange = sheet.getRange(
        rangeAddr(to.col, to.row, GRID.nodeCols, GRID.nodeRows)
      ) as any;
      const branch = sheet.shapes.items.find(
        (shape) => shape.name === `DT_BRANCH_${edge.fromId}_${edge.toId}`
      ) as any;
      const diagonal = sheet.shapes.items.find(
        (shape) => shape.name === `DT_EDGE_${edge.fromId}_${edge.toId}_DIAG`
      ) as any;

      expect(branch.left).toBeGreaterThan(fromRange.left + fromRange.width);
      expect(branch.left + branch.width).toBeLessThan(toRange.left);
      expect(diagonal.left).toBeGreaterThanOrEqual(fromRange.left + fromRange.width);
    }
  });

  it("separates terminal inputs from automatically calculated rollback values", async () => {
    const { context } = installFakeExcel();
    const tree = oilDrillingExample();
    const layout = computeLayout(tree);
    const placement = makePlacement(layout.maxRow);
    const calc = buildCalculationModel(tree, placement);
    const renderModel = buildRenderModel(tree, layout);

    await renderToExcel(layout, renderModel, calc, placement, tree);

    const sheet = getWorksheet(context, TREE_SHEET_NAME)!;
    const chanceLayout = layout.nodes.find((node) => node.id === "drill")!;
    const terminalLayout = layout.nodes.find((node) => node.id === "oil")!;
    const labelOffset = GRID.nodeRows - 2;
    const valueOffset = GRID.nodeRows - 1;

    expect(sheet.cells.get(cellAddr(chanceLayout.col + 3, chanceLayout.row + labelOffset))?.value).toBe("");
    expect(sheet.cells.get(cellAddr(chanceLayout.col + 4, chanceLayout.row + labelOffset))?.value).toBe("Valor esperado");
    expect(sheet.cells.get(cellAddr(chanceLayout.col + 4, chanceLayout.row + valueOffset))?.formula).toContain("=SUM(");

    expect(sheet.cells.get(cellAddr(terminalLayout.col + 3, terminalLayout.row + labelOffset))?.value).toBe("Resultado final");
    expect(sheet.cells.get(cellAddr(terminalLayout.col + 4, terminalLayout.row + labelOffset))?.value).toBe("Valor calculado");
  });

  it("renders via ShapeManager and clears previous artifacts", async () => {
    const { context } = installFakeExcel();
    const tree = oilDrillingExample();

    await renderTreeToExcel(tree);
    let sheet = getWorksheet(context, TREE_SHEET_NAME)!;
    expect(sheet.shapes.items.length).toBeGreaterThan(0);

    await clearShapes();
    sheet = getWorksheet(context, TREE_SHEET_NAME)!;
    expect(sheet.shapes.items.length).toBe(0);
  });
});
