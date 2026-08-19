import { oilDrillingExample, workoverExample } from "../src/engine/Examples";
import { buildCalculationModel, CalcTablePlacement } from "../src/excel/CalculationSheet";
import { clearShapes, renderTreeToExcel } from "../src/excel/ShapeManager";
import { TREE_SHEET_NAME } from "../src/excel/WorkbookConstants";
import { buildRenderModel } from "../src/rendering/renderModel";
import { renderToExcel } from "../src/renderer/ExcelShapeRenderer";
import { computeLayout } from "../src/renderer/TreeLayoutEngine";
import { getWorksheet, installFakeExcel } from "./support/fakeExcel";

function makePlacement(maxRow: number): CalcTablePlacement {
  return { sheetName: TREE_SHEET_NAME, startRow: maxRow + 4, startCol: 0 };
}

describe("Excel rendering", () => {
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
