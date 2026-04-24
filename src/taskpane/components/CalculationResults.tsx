import React, { useMemo } from "react";
import { describeOptimalStrategy } from "../../engine/RollbackAnalysis";
import { useTree } from "../context/TreeContext";

export function CalculationResults() {
  const { state } = useTree();
  const { tree } = state;

  const hasResults = useMemo(() => {
    if (!tree.rootId) return false;
    return tree.nodes[tree.rootId]?.expectedValue !== null;
  }, [tree]);

  const evMap = useMemo(() => {
    const map: Record<string, number | null> = {};
    for (const [id, node] of Object.entries(tree.nodes)) {
      map[id] = node.expectedValue;
    }
    return map;
  }, [tree]);

  const strategy = useMemo(() => {
    if (!hasResults) return "";
    return describeOptimalStrategy(tree, evMap);
  }, [evMap, hasResults, tree]);

  if (!hasResults) {
    return (
      <div className="empty-state">
        <div className="icon-big">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M7 7h4M7 12h10M7 17h6" />
          </svg>
        </div>
        <h3>Sin resultados</h3>
        <p>Construi un arbol en la pestana "Arbol". Los valores se calculan automaticamente.</p>
      </div>
    );
  }

  const rootEV = tree.rootId ? tree.nodes[tree.rootId]?.expectedValue : null;
  const isPositive = tree.metadata.mode === "maximize" ? (rootEV ?? 0) >= 0 : true;
  const rootLabel =
    tree.metadata.mode === "minimize"
      ? "Costo esperado (raiz)"
      : "Valor esperado neto (raiz)";
  const detailMetricLabel = tree.metadata.mode === "minimize" ? "Costo" : "VEN";

  const nodeRows = Object.values(tree.nodes)
    .filter((node) => node.expectedValue !== null)
    .sort((a, b) => {
      if (a.id === tree.rootId) return -1;
      if (b.id === tree.rootId) return 1;
      const typeOrder = { decision: 0, chance: 1, end: 2 };
      return typeOrder[a.type] - typeOrder[b.type];
    });

  return (
    <div>
      <div className="result-card">
        <div className="label">{rootLabel}</div>
        <div className={`value ${isPositive ? "" : "negative"}`}>
          ${rootEV?.toLocaleString("es-AR", { maximumFractionDigits: 0 }) ?? "N/A"}
        </div>
      </div>

      <div className="results-section">
        <h3>Estrategia Optima</h3>
        <div className="optimal-strategy">
          <pre>{strategy}</pre>
        </div>
      </div>

      <div className="results-section">
        <h3>Detalle por nodo</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Nodo</th>
              <th>Tipo</th>
              <th style={{ textAlign: "right" }}>{detailMetricLabel}</th>
            </tr>
          </thead>
          <tbody>
            {nodeRows.map((node) => (
              <tr key={node.id} className={node.isOptimal ? "optimal" : ""}>
                <td>
                  {node.isOptimal && (
                    <span style={{ color: "var(--qe-verde)", marginRight: 4 }}>●</span>
                  )}
                  {node.label}
                </td>
                <td style={{ color: "var(--text-muted)", fontSize: 11 }}>
                  {{ decision: "Decision", chance: "Chance", end: "Resultado" }[node.type]}
                </td>
                <td style={{ textAlign: "right", fontFamily: "Montserrat, sans-serif", fontWeight: 600 }}>
                  ${node.expectedValue?.toLocaleString("es-AR", { maximumFractionDigits: 0 }) ?? "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
