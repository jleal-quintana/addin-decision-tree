import { DEBUG_SHEET_NAME } from "../excel/WorkbookConstants";

export interface DiagnosticEntry {
  id: number;
  timestamp: string;
  operation: string;
  status: "start" | "success" | "error";
  durationMs?: number;
  details: string;
}

type DiagnosticListener = (entries: DiagnosticEntry[]) => void;

let nextId = 1;
let entries: DiagnosticEntry[] = [];
let flushing = false;
const listeners = new Set<DiagnosticListener>();

function notify(): void {
  const snapshot = [...entries];
  for (const listener of listeners) {
    listener(snapshot);
  }
}

function toDetailString(details?: Record<string, unknown>): string {
  if (!details) return "";

  return Object.entries(details)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" | ");
}

function pushEntry(
  operation: string,
  status: DiagnosticEntry["status"],
  details?: Record<string, unknown>,
  durationMs?: number
): void {
  const entry: DiagnosticEntry = {
    id: nextId++,
    timestamp: new Date().toISOString(),
    operation,
    status,
    durationMs,
    details: toDetailString(details),
  };

  entries = [entry, ...entries].slice(0, 50);

  if (status === "error") {
    console.error(`[decision-tree] ${operation}`, entry);
  } else if (isDebugEnabled()) {
    console.info(`[decision-tree] ${operation}`, entry);
  }

  notify();
}

export function logDiagnostic(
  operation: string,
  status: DiagnosticEntry["status"],
  details?: Record<string, unknown>,
  durationMs?: number
): void {
  pushEntry(operation, status, details, durationMs);
}

export function isDebugEnabled(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("debug") === "0") return false;
    if (window.localStorage.getItem("dt-debug") === "0") return false;
  } catch {
    // ignore non-browser environments
  }

  if ((globalThis as { __DT_DEBUG__?: boolean }).__DT_DEBUG__ === false) return false;
  return true;
}

export function subscribeDiagnostics(listener: DiagnosticListener): () => void {
  listeners.add(listener);
  listener([...entries]);
  return () => listeners.delete(listener);
}

export function getDiagnostics(): DiagnosticEntry[] {
  return [...entries];
}

export async function runTrackedOperation<T>(
  operation: string,
  details: Record<string, unknown>,
  fn: () => Promise<T>
): Promise<T> {
  const startedAt = Date.now();
  pushEntry(operation, "start", details);

  try {
    const result = await fn();
    pushEntry(operation, "success", details, Date.now() - startedAt);
    await flushDiagnosticsToWorkbook();
    return result;
  } catch (error) {
    pushEntry(
      operation,
      "error",
      {
        ...details,
        error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      },
      Date.now() - startedAt
    );
    await flushDiagnosticsToWorkbook();
    throw error;
  }
}

export async function flushDiagnosticsToWorkbook(): Promise<void> {
  if (!isDebugEnabled() || flushing) return;
  if (typeof Excel === "undefined" || typeof Excel.run !== "function") return;

  flushing = true;
  try {
    await Excel.run(async (context) => {
      const existing = context.workbook.worksheets.getItemOrNullObject(DEBUG_SHEET_NAME);
      existing.load("name");
      await context.sync();

      const sheet = existing.isNullObject
        ? context.workbook.worksheets.add(DEBUG_SHEET_NAME)
        : existing;

      // Hoja de log oculta para usuarios finales (Bárbara no necesita ver
      // las 50 filas de "edge.add success"). Para troubleshooting:
      // click derecho en cualquier pestaña → Mostrar... → DT_DebugLog.
      // Si se quiere visible inline (dev), poner `?debug=visible` en la URL.
      const visibleOverride = (() => {
        try {
          return new URLSearchParams(window.location.search).get("debug") === "visible";
        } catch {
          return false;
        }
      })();
      sheet.visibility = visibleOverride
        ? Excel.SheetVisibility.visible
        : Excel.SheetVisibility.hidden;
      const usedRange = sheet.getUsedRangeOrNullObject();
      usedRange.load("address");
      await context.sync();

      if (!usedRange.isNullObject) {
        usedRange.clear(Excel.ClearApplyTo.all);
      }

      const rows = [
        ["Timestamp", "Operation", "Status", "DurationMs", "Details"],
        ...entries
          .slice()
          .reverse()
          .map((entry) => [
            entry.timestamp,
            entry.operation,
            entry.status,
            entry.durationMs ?? "",
            entry.details,
          ]),
      ];

      const range = sheet.getRange(`A1:E${rows.length}`);
      range.values = rows;
      sheet.getRange("A:E").format.autofitColumns();
      await context.sync();
    });
  } catch (error) {
    console.warn("[decision-tree] No se pudo sincronizar el debug log", error);
  } finally {
    flushing = false;
  }
}
