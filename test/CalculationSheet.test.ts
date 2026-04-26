import { oilDrillingExample, workoverExample } from "../src/engine/Examples";
import {
  buildCalculationModel,
  CalcTablePlacement,
  flattenTree,
  writeCalculationTable,
} from "../src/excel/CalculationSheet";
import { cellAddr } from "../src/excel/ExcelAddress";
import { CALC_COLUMN_INDEX, TREE_SHEET_NAME } from "../src/excel/WorkbookConstants";
import { getRange, installFakeExcel } from "./support/fakeExcel";

const PLACEMENT: CalcTablePlacement = {
  sheetName: TREE_SHEET_NAME,
  startRow: 0,
  startCol: 0,
};

describe("CalculationSheet", () => {
  it("flattens the tree in preorder", () => {
    const order = flattenTree(oilDrillingExample());
    expect(order).toEqual(["root", "drill", "oil", "dry", "no_drill"]);
  });

  it("builds metadata anchored to the placement passed in", () => {
    const metadata = buildCalculationModel(oilDrillingExample(), PLACEMENT);
    expect(metadata.sheetName).toBe(TREE_SHEET_NAME);
    // Datos arrancan dos filas debajo del startRow (título + header).
    expect(metadata.nodeRefs.root.sheetRow).toBe(PLACEMENT.startRow + 2);
  });

  it("writes formulas for chance and decision nodes inline", async () => {
    const { context } = installFakeExcel();
    const worksheet = context.workbook.worksheets.add(TREE_SHEET_NAME) as unknown as Excel.Worksheet;
    const tree = workoverExample();

    await writeCalculationTable(worksheet, tree, PLACEMENT);

    // Primera fila de datos = startRow + 2 (título=0, header=1, datos=2..).
    // workoverExample arranca con un nodo decision en la raíz.
    const rootRow = PLACEMENT.startRow + 2;
    const rootChildrenEv = getRange(
      context,
      TREE_SHEET_NAME,
      cellAddr(PLACEMENT.startCol + CALC_COLUMN_INDEX.ChildrenEV, rootRow)
    );
    expect(rootChildrenEv?.formulas[0][0]).toMatch(/=(MIN|MAX)\(/);

    // Algún chance node debe tener fórmula =SUM(...).
    const orderedIds = flattenTree(tree);
    const chanceIdx = orderedIds.findIndex((id) => tree.nodes[id].type === "chance");
    expect(chanceIdx).toBeGreaterThanOrEqual(0);
    const chanceRow = PLACEMENT.startRow + 2 + chanceIdx;
    const chanceChildrenEv = getRange(
      context,
      TREE_SHEET_NAME,
      cellAddr(PLACEMENT.startCol + CALC_COLUMN_INDEX.ChildrenEV, chanceRow)
    );
    expect(chanceChildrenEv?.formulas[0][0]).toContain("=SUM(");
  });
});
