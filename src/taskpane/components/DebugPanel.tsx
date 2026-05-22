import React, { useEffect, useMemo, useState } from "react";
import {
  DiagnosticEntry,
  getDiagnostics,
  subscribeDiagnostics,
} from "../../debug/excelDiagnostics";

export function DebugPanel() {
  const [entries, setEntries] = useState<DiagnosticEntry[]>(() => getDiagnostics());

  useEffect(() => subscribeDiagnostics(setEntries), []);

  const visibleEntries = useMemo(
    () =>
      entries.map((entry) => ({
        ...entry,
        timeLabel: new Date(entry.timestamp).toLocaleTimeString("es-AR"),
      })),
    [entries]
  );

  return (
    <details className="debug-panel" open>
      <summary>Diagnostico</summary>
      <div className="debug-panel-body">
        {entries.length === 0 ? (
          <p>Sin eventos todavia.</p>
        ) : (
          visibleEntries.map((entry) => (
            <div key={entry.id} className={`debug-entry ${entry.status}`}>
              <div className="debug-title">
                <strong>{entry.operation}</strong>
                <span>{entry.status}</span>
              </div>
              <div className="debug-meta">
                {entry.timeLabel}
                {entry.durationMs !== undefined ? ` · ${entry.durationMs}ms` : ""}
              </div>
              {entry.details && <div className="debug-details">{entry.details}</div>}
            </div>
          ))
        )}
      </div>
    </details>
  );
}
