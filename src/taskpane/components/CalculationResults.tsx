import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { enumeratePaths } from "../../engine/PathEnumeration";
import { useTree } from "../context/TreeContext";
import { focusNodeInTree } from "../utils/focusNode";

function formatPctInput(prob: number): string {
  const pct = prob * 100;
  return Number.isInteger(pct) ? `${pct}` : pct.toFixed(1).replace(".", ",");
}

interface AssumptionInputProps {
  nodeId: string;
  nodeLabel: string;
  probability: number;
  onCommit: (nodeId: string, raw: string) => void;
}

function AssumptionInput({ nodeId, nodeLabel, probability, onCommit }: AssumptionInputProps) {
  const [draft, setDraft] = useState<string>(() => formatPctInput(probability));
  const focusedRef = useRef(false);

  // Sincronizar cuando el valor cambia desde fuera (ej. otra asunción recalcula)
  // pero NO mientras el usuario está tipeando en este input.
  useEffect(() => {
    if (!focusedRef.current) setDraft(formatPctInput(probability));
  }, [probability]);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onBlur={() => {
        focusedRef.current = false;
        onCommit(nodeId, draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      aria-label={`Probabilidad de ${nodeLabel}`}
    />
  );
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

function formatPercent(value: number): string {
  const pct = value * 100;
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1).replace(".", ",")}%`;
}

export function CalculationResults() {
  const { state, dispatch } = useTree();
  const { tree } = state;

  const hasResults = useMemo(() => {
    if (!tree.rootId) return false;
    return tree.nodes[tree.rootId]?.expectedValue !== null;
  }, [tree]);

  const paths = useMemo(() => enumeratePaths(tree), [tree]);
  const [assumptionsOpen, setAssumptionsOpen] = useState(true);

  const isCost = tree.metadata.mode === "minimize";
  const rootLabel = isCost ? "Costo esperado" : "Valor esperado";

  const optimalPath = paths.find((p) => p.isOptimal);
  const alternatives = paths.filter((p) => !p.isOptimal);
  // Mejor alternativa: según modo, la de mayor valor (Valor) o menor costo (Costo).
  const bestAlternative = alternatives.reduce<typeof alternatives[number] | null>((best, row) => {
    if (!best) return row;
    if (isCost) return row.value < best.value ? row : best;
    return row.value > best.value ? row : best;
  }, null);

  const deltaVsAlt = optimalPath && bestAlternative
    ? (isCost ? bestAlternative.value - optimalPath.value : optimalPath.value - bestAlternative.value)
    : null;

  // Primera rama elegida: primer nodo del camino óptimo cuyo padre sea una decisión.
  const { recommendedAction, recommendedActionId } = useMemo(() => {
    if (!optimalPath) return { recommendedAction: "", recommendedActionId: null as string | null };
    for (const id of optimalPath.ids) {
      const node = tree.nodes[id];
      if (!node?.parentId) continue;
      const parent = tree.nodes[node.parentId];
      if (parent?.type === "decision") {
        return { recommendedAction: node.branchLabel || node.label, recommendedActionId: id };
      }
    }
    return { recommendedAction: "", recommendedActionId: null };
  }, [optimalPath, tree.nodes]);

  const handleFocusNode = useCallback(
    (nodeId: string) => {
      focusNodeInTree(dispatch, nodeId);
    },
    [dispatch]
  );

  // Nodos chance = "supuestos" (DESIGN.md §4.3): probabilidades editables.
  const assumptions = useMemo(() => {
    return Object.values(tree.nodes)
      .filter((node) => {
        if (!node.parentId) return false;
        const parent = tree.nodes[node.parentId];
        return parent?.type === "chance";
      })
      .sort((a, b) => a.label.localeCompare(b.label, "es"));
  }, [tree]);

  const handleProbabilityChange = useCallback(
    (nodeId: string, raw: string) => {
      const cleaned = raw.replace(/[^\d.,]/g, "").replace(",", ".");
      const parsedPct = parseFloat(cleaned);
      if (!Number.isFinite(parsedPct)) return;
      const prob = Math.min(Math.max(parsedPct / 100, 0), 1);
      dispatch({ type: "UPDATE_NODE", nodeId, updates: { probability: prob } });
    },
    [dispatch]
  );

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
        <p>Armá el árbol en la pestaña &quot;Armar&quot;. Los valores se calculan automáticamente.</p>
      </div>
    );
  }

  const rootEV = tree.rootId ? tree.nodes[tree.rootId]?.expectedValue ?? null : null;

  return (
    <div className="results-v2">
      {/* 1. Recomendación en caja lime (DESIGN.md §4.3 punto 1) */}
      <div className="reco-card" role="region" aria-label="Recomendación">
        <div className="reco-eyebrow">Recomendación</div>
        <div className="reco-headline">
          {optimalPath
            ? recommendedAction
              ? `Elegir: ${recommendedAction}`
              : "Camino recomendado resuelto"
            : "Todavía no hay una decisión clara"}
        </div>
        <div className="reco-detail">
          <span className="reco-kv"><span className="reco-k">{rootLabel}:</span> <strong>{formatCurrency(rootEV)}</strong></span>
          {deltaVsAlt !== null && bestAlternative && (
            <span className="reco-kv">
              <span className="reco-k">{isCost ? "Ahorra" : "Gana"} vs alternativa:</span>{" "}
              <strong>{formatCurrency(Math.abs(deltaVsAlt))}</strong>
            </span>
          )}
        </div>
        {recommendedActionId && (
          <button
            type="button"
            className="reco-jump"
            onClick={() => handleFocusNode(recommendedActionId)}
          >
            Ver en el árbol
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>

      {/* 2. Tabla de caminos (DESIGN.md §4.3 punto 2) */}
      {paths.length > 0 && (
        <div className="results-section">
          <h2>Resumen de caminos</h2>
          <div className="data-table-wrap">
            <table className="data-table paths-table">
              <thead>
                <tr>
                  <th>Camino</th>
                  <th style={{ textAlign: "right" }}>Prob.</th>
                  <th style={{ textAlign: "right" }}>{rootLabel}</th>
                  <th style={{ textAlign: "right" }}>Vs recomendado</th>
                  <th aria-label="Ir al nodo" />
                </tr>
              </thead>
              <tbody>
                {paths.map((path) => {
                  const leafId = path.ids[path.ids.length - 1];
                  return (
                    <tr key={path.ids.join("-")} className={path.isOptimal ? "optimal" : ""}>
                      <td>
                        {path.isOptimal && <span className="reco-dot" aria-label="Recomendado">●</span>}
                        {path.label}
                      </td>
                      <td style={{ textAlign: "right" }}>{formatPercent(path.probability)}</td>
                      <td style={{ textAlign: "right", fontFamily: "Montserrat, sans-serif", fontWeight: 600 }}>
                        {formatCurrency(path.value)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {path.isOptimal ? "—" : formatCurrency(path.diff)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {leafId && (
                          <button
                            type="button"
                            className="path-jump"
                            onClick={() => handleFocusNode(leafId)}
                            aria-label={`Ver "${path.label}" en el árbol`}
                            title="Ver en el árbol"
                          >
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                              <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Supuestos collapsible (DESIGN.md §4.3 punto 3) - sensibilidad inline */}
      {assumptions.length > 0 && (
        <div className="results-section">
          <button
            className="collapsible-header"
            onClick={() => setAssumptionsOpen((open) => !open)}
            aria-expanded={assumptionsOpen}
            type="button"
          >
            <span className={`collapsible-chevron ${assumptionsOpen ? "open" : ""}`} aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <h2 style={{ margin: 0 }}>Supuestos clave</h2>
            <span className="collapsible-hint">Ajustá las probabilidades para ver cómo cambia la recomendación</span>
          </button>

          {assumptionsOpen && (
            <div className="assumptions-list">
              {assumptions.map((node) => {
                const parent = node.parentId ? tree.nodes[node.parentId] : null;
                return (
                  <div key={node.id} className="assumption-row">
                    <div className="assumption-label">
                      <div className="assumption-node">{node.branchLabel || node.label}</div>
                      {parent && <div className="assumption-parent">en {parent.label}</div>}
                    </div>
                    <div className="assumption-input">
                      <AssumptionInput
                        nodeId={node.id}
                        nodeLabel={node.label}
                        probability={node.probability ?? 0}
                        onCommit={handleProbabilityChange}
                      />
                      <span className="assumption-unit">%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
