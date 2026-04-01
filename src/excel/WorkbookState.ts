import { DecisionTreeData } from "../models/types";
import { serialize, deserialize } from "../models/DecisionTree";
import { DATA_SHEET_NAME } from "./WorkbookConstants";

const CHUNK_SIZE = 32000;

/**
 * Save tree data to a veryHidden worksheet.
 */
export async function saveToWorkbook(tree: DecisionTreeData): Promise<void> {
  const json = serialize(tree);

  await Excel.run(async (context) => {
    const sheets = context.workbook.worksheets;
    sheets.load("items/name");
    await context.sync();

    // Find or create the hidden sheet
    let sheet: Excel.Worksheet;
    const existing = sheets.items.find((s) => s.name === DATA_SHEET_NAME);
    if (existing) {
      sheet = existing;
      // Clear existing data
      sheet.getUsedRange().clear();
      await context.sync();
    } else {
      sheet = sheets.add(DATA_SHEET_NAME);
      await context.sync();
      sheet.visibility = Excel.SheetVisibility.veryHidden;
    }

    // Chunk the JSON if needed
    const chunks: string[] = [];
    for (let i = 0; i < json.length; i += CHUNK_SIZE) {
      chunks.push(json.slice(i, i + CHUNK_SIZE));
    }

    // Write chunk count in A1, then chunks in A2, A3, ...
    sheet.getRange("A1").values = [[chunks.length]];
    for (let i = 0; i < chunks.length; i++) {
      sheet.getRange(`A${i + 2}`).values = [[chunks[i]]];
    }

    await context.sync();
  });
}

/**
 * Load tree data from the veryHidden worksheet.
 */
export async function loadFromWorkbook(): Promise<DecisionTreeData | null> {
  return await Excel.run(async (context) => {
    const sheets = context.workbook.worksheets;
    sheets.load("items/name");
    await context.sync();

    const existing = sheets.items.find((s) => s.name === DATA_SHEET_NAME);
    if (!existing) return null;

    const sheet = existing;

    // Read chunk count
    const countRange = sheet.getRange("A1");
    countRange.load("values");
    await context.sync();

    const chunkCount = Number(countRange.values[0][0]);
    if (!chunkCount || chunkCount <= 0) return null;

    // Read all chunks
    const dataRange = sheet.getRange(`A2:A${chunkCount + 1}`);
    dataRange.load("values");
    await context.sync();

    const json = dataRange.values.map((row) => String(row[0])).join("");
    try {
      return deserialize(json);
    } catch {
      throw new Error("Los datos guardados estan corruptos o tienen formato invalido");
    }
  });
}
