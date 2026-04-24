import { DecisionTreeData } from "../models/types";
import { serialize, deserialize } from "../models/DecisionTree";
import { DATA_SHEET_NAME } from "./WorkbookConstants";
import { runTrackedOperation } from "../debug/excelDiagnostics";

const CHUNK_SIZE = 32000;

export function splitIntoChunks(value: string, chunkSize = CHUNK_SIZE): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += chunkSize) {
    chunks.push(value.slice(i, i + chunkSize));
  }
  return chunks;
}

export function joinChunks(rows: unknown[][]): string {
  return rows.map((row) => String(row[0] ?? "")).join("");
}

export async function saveToWorkbook(tree: DecisionTreeData): Promise<void> {
  const json = serialize(tree);

  await runTrackedOperation(
    "saveToWorkbook",
    { nodes: Object.keys(tree.nodes).length, jsonLength: json.length },
    async () => {
      await Excel.run(async (context) => {
        const sheets = context.workbook.worksheets;
        sheets.load("items/name");
        await context.sync();

        const existing = sheets.items.find((sheet) => sheet.name === DATA_SHEET_NAME);
        const sheet = existing ?? sheets.add(DATA_SHEET_NAME);
        sheet.visibility = Excel.SheetVisibility.veryHidden;

        const usedRange = sheet.getUsedRangeOrNullObject();
        usedRange.load("address");
        await context.sync();

        if (!usedRange.isNullObject) {
          usedRange.clear(Excel.ClearApplyTo.all);
        }

        const chunks = splitIntoChunks(json);
        sheet.getRange("A1").values = [[chunks.length]];
        for (let i = 0; i < chunks.length; i++) {
          sheet.getRange(`A${i + 2}`).values = [[chunks[i]]];
        }

        await context.sync();
      });
    }
  );
}

export async function loadFromWorkbook(): Promise<DecisionTreeData | null> {
  return runTrackedOperation("loadFromWorkbook", {}, async () =>
    Excel.run(async (context) => {
      const sheets = context.workbook.worksheets;
      sheets.load("items/name");
      await context.sync();

      const existing = sheets.items.find((sheet) => sheet.name === DATA_SHEET_NAME);
      if (!existing) return null;

      const countRange = existing.getRange("A1");
      countRange.load("values");
      await context.sync();

      const chunkCount = Number(countRange.values[0]?.[0]);
      if (!chunkCount || chunkCount <= 0) return null;

      const dataRange = existing.getRange(`A2:A${chunkCount + 1}`);
      dataRange.load("values");
      await context.sync();

      const json = joinChunks(dataRange.values);
      try {
        return deserialize(json);
      } catch {
        throw new Error("Los datos guardados estan corruptos o tienen formato invalido");
      }
    })
  );
}
