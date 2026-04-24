import { oilDrillingExample } from "../src/engine/Examples";
import { DATA_SHEET_NAME } from "../src/excel/WorkbookConstants";
import {
  joinChunks,
  loadFromWorkbook,
  saveToWorkbook,
  splitIntoChunks,
} from "../src/excel/WorkbookState";
import { getRange, getWorksheet, installFakeExcel } from "./support/fakeExcel";

describe("WorkbookState", () => {
  it("splits and joins chunked data", () => {
    const chunks = splitIntoChunks("abcdef", 2);
    expect(chunks).toEqual(["ab", "cd", "ef"]);
    expect(joinChunks(chunks.map((chunk) => [chunk]))).toBe("abcdef");
  });

  it("saves and loads tree data from a hidden sheet", async () => {
    const { context } = installFakeExcel();
    const tree = oilDrillingExample();

    await saveToWorkbook(tree);

    const sheet = getWorksheet(context, DATA_SHEET_NAME);
    expect(sheet?.visibility).toBe("VeryHidden");
    expect(getRange(context, DATA_SHEET_NAME, "A1")?.values).toEqual([[1]]);

    const loaded = await loadFromWorkbook();
    expect(loaded?.metadata.name).toBe(tree.metadata.name);
    expect(loaded?.rootId).toBe("root");
  });

  it("throws on corrupt workbook data", async () => {
    const { context } = installFakeExcel();
    const worksheet = context.workbook.worksheets.add(DATA_SHEET_NAME) as unknown as {
      visibility: string;
      getRange: (address: string) => { values: unknown[][] };
    };
    worksheet.visibility = "VeryHidden";
    worksheet.getRange("A1").values = [[1]];
    worksheet.getRange("A2").values = [["{not-json"]];

    await expect(loadFromWorkbook()).rejects.toThrow("corruptos");
  });
});
