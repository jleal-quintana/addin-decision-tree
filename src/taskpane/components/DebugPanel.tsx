import React, { useEffect, useState } from "react";
import {
  DiagnosticEntry,
  getDiagnostics,
  subscribeDiagnostics,
} from "../../debug/excelDiagnostics";

export function DebugPanel() {
  const [entries, setEntries] = useState<DiagnosticEntry[]>(() => getDiagnostics());

  useEffect(() => subscribeDiagnostics(setEntries), []);

  return (
    <details className="debug-panel" open>
      <summary>Diagnostico</summary>
      <div className="debug-panel-body">
        {entries.length === 0 ? (
          <p>Sin eventos todavia.</p>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className={`debug-entry ${entry.status}`}>
              <div className="debug-title">
                <strong>{entry.operation}</strong>
                <span>{entry.status}</span>
              </div>
              <div className="debug-meta">
                {new Date(entry.timestamp).toLocaleTimeString("es-AR")}
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
