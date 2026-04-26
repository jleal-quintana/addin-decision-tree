import { oilDrillingExample } from "../src/engine/Examples";
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
