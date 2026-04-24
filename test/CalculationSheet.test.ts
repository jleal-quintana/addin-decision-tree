import { oilDrillingExample, workoverExample } from "../src/engine/Examples";
import {
  buildCalculationBaseValues,
  buildCalculationModel,
  flattenTree,
  writeCalculationModel,
} from "../src/excel/CalculationSheet";
import { cellAddr } from "../src/excel/ExcelAddress";
import { CALC_COLUMN_INDEX, CALC_TABLE_START_COL } from "../src/excel/WorkbookConstants";
import { CALC_SHEET_NAME } from "../src/excel/WorkbookConstants";
import { getRange, installFakeExcel } from "./support/fakeExcel";

describe("CalculationSheet", () => {
  it("flattens the tree in preorder", () => {
    const order = flattenTree(oilDrillingExample());
    expect(order).toEqual(["root", "drill", "oil", "dry", "no_drill"]);
  });

  it("builds metadata on the hidden calc sheet", () => {
    const metadata = buildCalculationModel(oilDrillingExample());
    expect(metadata.sheetName).toBe(CALC_SHEET_NAME);
    expect(metadata.nodeRefs.root.sheetRow).toBeGreaterThan(0);
  });

  it("writes formulas for chance and decision nodes", async () => {
    const { context } = installFakeExcel();
    const worksheet = context.workbook.worksheets.add(CALC_SHEET_NAME) as unknown as Excel.Worksheet;
    const tree = workoverExample();

    await writeCalculationModel(worksheet, tree, buildCalculationModel(tree));

    const baseValues = buildCalculationBaseValues(tree);
    expect(baseValues[1][0]).toBe("wo_root");

    const rootChildrenEv = getRange(
      context,
      CALC_SHEET_NAME,
      cellAddr(CALC_TABLE_START_COL + CALC_COLUMN_INDEX.ChildrenEV, 3)
    );
    const chanceChildrenEv = getRange(
      context,
      CALC_SHEET_NAME,
      cellAddr(CALC_TABLE_START_COL + CALC_COLUMN_INDEX.ChildrenEV, 4)
    );
    expect(rootChildrenEv?.formulas[0][0]).toContain("=MIN(");
    expect(chanceChildrenEv?.formulas[0][0]).toContain("=SUM(");
  });
});
