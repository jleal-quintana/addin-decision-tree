import React, { useCallback, useState } from "react";
import { useTree } from "../context/TreeContext";
import { NodeType } from "../../models/types";

const CUSTOM_FIELD_SUGGESTIONS = ["TIR", "Cash", "Precio petroleo", "OPEX", "CAPEX"];

export function NodeEditor() {
  const { state, dispatch } = useTree();
  const node = state.selectedNodeId ? state.tree.nodes[state.selectedNodeId] : null;

  // VAN calculator state
  const [showVan, setShowVan] = useState(false);
  const [vanInversion, setVanInversion] = useState(0);
  const [vanFlujo, setVanFlujo] = useState(0);
  const [vanAnios, setVanAnios] = useState(10);
  const [vanTasa, setVanTasa] = useState(10);

  const handleLabelChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!node) return;
    dispatch({ type: "UPDATE_NODE", nodeId: node.id, updates: { label: e.target.value } });
  }, [dispatch, node]);

  const handleTypeChange = useCallback((newType: NodeType) => {
    if (!node) return;
    dispatch({ type: "UPDATE_NODE", nodeId: node.id, updates: { type: newType } });
  }, [dispatch, node]);

  const handlePayoffChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!node) return;
    const val = parseFloat(e.target.value);
    dispatch({ type: "UPDATE_NODE", nodeId: node.id, updates: { payoff: isNaN(val) ? 0 : val } });
  }, [dispatch, node]);

  const handleProbPercent = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!node) return;
    const pct = parseFloat(e.target.value);
    dispatch({ type: "UPDATE_NODE", nodeId: node.id, updates: { probability: isNaN(pct) ? 0 : pct / 100 } });
  }, [dispatch, node]);

  const handleCostChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!node) return;
    const val = parseFloat(e.target.value);
    dispatch({ type: "UPDATE_NODE", nodeId: node.id, updates: { cost: isNaN(val) ? null : val } });
  }, [dispatch, node]);

  const handleTimeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!node) return;
    dispatch({ type: "UPDATE_NODE", nodeId: node.id, updates: { time: e.target.value || null } });
  }, [dispatch, node]);

  // Calculate VAN
  const calcVan = useCallback(() => {
    if (!node) return;
    let van = -vanInversion;
    const r = vanTasa / 100;
    for (let t = 1; t <= vanAnios; t++) {
      van += vanFlujo / Math.pow(1 + r, t);
    }
    dispatch({ type: "UPDATE_NODE", nodeId: node.id, updates: { payoff: Math.round(van) } });
    setShowVan(false);
  }, [node, dispatch, vanInversion, vanFlujo, vanAnios, vanTasa]);

  // Preview VAN
  const vanPreview = (() => {
    let van = -vanInversion;
    const r = vanTasa / 100;
    for (let t = 1; t <= vanAnios; t++) {
      van += vanFlujo / Math.pow(1 + r, t);
    }
    return Math.round(van);
  })();

  if (!node) return null;

  const parentNode = node.parentId ? state.tree.nodes[node.parentId] : null;
  const showProbability = parentNode?.type === "chance";

  // Calculate sibling prob sum for helper text
  const siblingProbSum = parentNode?.type === "chance"
    ? parentNode.childIds.reduce((sum, id) => sum + (state.tree.nodes[id]?.probability ?? 0), 0)
    : null;

  return (
    <div className="node-editor">
      <div className="editor-header">
        <div className={`node-badge ${node.type}`} style={{ width: 18, height: 18, fontSize: 9 }}>
          {{ decision: "D", chance: "C", end: "R" }[node.type]}
        </div>
        <h4>Editar nodo</h4>
      </div>

      {/* Name */}
      <div className="field">
        <label>Nombre</label>
        <input type="text" value={node.label} onChange={handleLabelChange} />
      </div>

      {/* Type */}
      <div className="field">
        <label>Tipo</label>
        <div className="type-selector" role="radiogroup" aria-label="Tipo de nodo">
          <div className={`type-option ${node.type === "decision" ? "active decision" : ""}`}
               onClick={() => handleTypeChange("decision")}
               onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleTypeChange("decision"); } }}
               role="radio"
               aria-checked={node.type === "decision"}
               tabIndex={0}
               title="Vos elegís entre alternativas">
            Decisión
          </div>
          <div className={`type-option ${node.type === "chance" ? "active chance" : ""}`}
               onClick={() => handleTypeChange("chance")}
               onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleTypeChange("chance"); } }}
               role="radio"
               aria-checked={node.type === "chance"}
               tabIndex={0}
               title="El pozo, el mercado o la naturaleza responden">
            Incertidumbre
          </div>
          <div className={`type-option ${node.type === "end" ? "active end" : ""}`}
               onClick={() => handleTypeChange("end")}
               onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleTypeChange("end"); } }}
               role="radio"
               aria-checked={node.type === "end"}
               tabIndex={0}
               title="Resultado final de una rama">
            Resultado final
          </div>
        </div>
      </div>

      {/* Probability — shown when this node is a child of a chance node */}
      {showProbability && (
        <div className="field">
          <label>Probabilidad</label>
          <div className="field-row">
            <div className="field" style={{ flex: 2 }}>
              <input
                type="number"
                value={((node.probability ?? 0) * 100).toFixed(1)}
                onChange={handleProbPercent}
                min="0"
                max="100"
                step="5"
                style={{ textAlign: "right" }}
              />
            </div>
            <div style={{ alignSelf: "center", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>%</div>
          </div>
          {siblingProbSum !== null && (
            <div className="hint" style={{ color: Math.abs(siblingProbSum - 1) > 0.001 ? "#c0392b" : "var(--qe-verde)" }}>
              Suma del grupo: {(siblingProbSum * 100).toFixed(1)}%
              {Math.abs(siblingProbSum - 1) > 0.001 ? " (debe ser 100%)" : " OK"}
            </div>
          )}
        </div>
      )}

      {/* Child probabilities — shown when THIS node is a chance node with children */}
      {node.type === "chance" && node.childIds.length > 0 && (
        <div className="field">
          <label>Probabilidades de hijos</label>
          {node.childIds.map((childId) => {
            const child = state.tree.nodes[childId];
            if (!child) return null;
            return (
              <div key={childId} className="field-row" style={{ marginBottom: 4, alignItems: "center" }}>
                <span style={{ flex: 2, fontSize: 12, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {child.label}
                </span>
                <input
                  type="number"
                  value={((child.probability ?? 0) * 100).toFixed(1)}
                  onChange={(e) => {
                    const pct = parseFloat(e.target.value);
                    dispatch({ type: "UPDATE_NODE", nodeId: childId, updates: { probability: isNaN(pct) ? 0 : pct / 100 } });
                  }}
                  min="0" max="100" step="5"
                  style={{ width: 60, textAlign: "right", flex: "none" }}
                />
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", flex: "none" }}>%</span>
              </div>
            );
          })}
          {(() => {
            const sum = node.childIds.reduce((s, cid) => s + (state.tree.nodes[cid]?.probability ?? 0), 0);
            return (
              <div className="hint" style={{ color: Math.abs(sum - 1) > 0.001 ? "#c0392b" : "var(--qe-verde)", marginTop: 4 }}>
                Total: {(sum * 100).toFixed(1)}%
                {Math.abs(sum - 1) > 0.001 ? " (debe ser 100%)" : " OK"}
              </div>
            );
          })()}
        </div>
      )}

      {/* Cost */}
      <div className="field">
        <label>Costo de rama ($)</label>
        <input
          type="number"
          value={node.cost ?? ""}
          onChange={handleCostChange}
          placeholder="Opcional"
          step="10000"
        />
      </div>

      {/* Time */}
      <div className="field">
        <label>Tiempo</label>
        <input
          type="text"
          value={node.time ?? ""}
          onChange={handleTimeChange}
          placeholder="Ej: 3 meses, 2 semanas"
        />
      </div>

      {/* Payoff / VAN */}
      {node.type === "end" && (
        <>
          <div className="field">
            <label>Resultado ($)</label>
            <input
              type="number"
              className="money"
              value={node.payoff ?? 0}
              onChange={handlePayoffChange}
              step="10000"
            />
            <div className="hint">
              Ingresá el VAN terminal o el resultado directo. El árbol recalcula solo y al dibujarlo en Excel queda reflejado en el diagrama.{" "}
              <a href="#" onClick={(e) => { e.preventDefault(); setShowVan(!showVan); }}
                 style={{ color: "var(--qe-azul)", textDecoration: "underline" }}>
                {showVan ? "Cerrar" : "Calcular VAN"}
              </a>
            </div>
          </div>

          {showVan && (
            <div className="van-calculator">
              <h5>Calculadora VAN rapida</h5>
              <div className="field-row">
                <div className="field">
                  <label>Inversion</label>
                  <input type="number" value={vanInversion} onChange={(e) => setVanInversion(parseFloat(e.target.value) || 0)} step="100000" />
                </div>
                <div className="field">
                  <label>Flujo anual</label>
                  <input type="number" value={vanFlujo} onChange={(e) => setVanFlujo(parseFloat(e.target.value) || 0)} step="50000" />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Anios</label>
                  <input type="number" value={vanAnios} onChange={(e) => setVanAnios(parseInt(e.target.value) || 1)} min="1" max="50" />
                </div>
                <div className="field">
                  <label>Tasa (%)</label>
                  <input type="number" value={vanTasa} onChange={(e) => setVanTasa(parseFloat(e.target.value) || 0)} step="1" />
                </div>
              </div>
              <div className="van-result">
                VAN: ${vanPreview.toLocaleString("es-AR")}
              </div>
              <button className="btn-create decision" style={{ marginTop: 8, fontSize: 11, padding: "5px 12px" }}
                      onClick={calcVan}>
                Usar este VAN
              </button>
            </div>
          )}
        </>
      )}

      {/* Expected Value display */}
      {node.expectedValue !== null && (
        <div className="field" style={{ marginTop: 4 }}>
          <label>{state.tree.metadata.mode === "minimize" ? "Costo esperado" : "Valor esperado"}</label>
          <div className={`ev-badge ${node.expectedValue >= 0 ? "positive" : "negative"}`}>
            ${node.expectedValue.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
          </div>
        </div>
      )}

      {/* Custom Fields */}
      <div className="field" style={{ marginTop: 8 }}>
        <label>Campos adicionales</label>
        {Object.entries(node.customFields ?? {}).map(([key, value]) => (
          <div key={key} className="field-row" style={{ marginBottom: 4, alignItems: "center" }}>
            <span style={{ flex: 1, fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {key}
            </span>
            <input
              type="text"
              value={value ?? ""}
              onChange={(e) => {
                const newFields = { ...node.customFields, [key]: e.target.value };
                dispatch({ type: "UPDATE_NODE", nodeId: node.id, updates: { customFields: newFields } });
              }}
              style={{ width: 90, flex: "none", fontSize: 11 }}
            />
            <button
              className="delete"
              style={{ flex: "none", marginLeft: 4, padding: 2 }}
              onClick={() => {
                const newFields = { ...node.customFields };
                delete newFields[key];
                dispatch({ type: "UPDATE_NODE", nodeId: node.id, updates: { customFields: newFields } });
              }}
              title="Eliminar campo"
            >
              <svg width="12" height="12" viewBox="0 0 14 14"><path d="M4 4l6 6M10 4l-6 6" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>
            </button>
          </div>
        ))}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
          {CUSTOM_FIELD_SUGGESTIONS
            .filter((s) => !(node.customFields ?? {})[s])
            .slice(0, 3)
            .map((suggestion) => (
            <button
              key={suggestion}
              className="btn-create example"
              style={{ fontSize: 10, padding: "2px 8px" }}
              onClick={() => {
                const newFields = { ...(node.customFields ?? {}), [suggestion]: "" };
                dispatch({ type: "UPDATE_NODE", nodeId: node.id, updates: { customFields: newFields } });
              }}
            >
              + {suggestion}
            </button>
          ))}
          <button
            className="btn-create example"
            style={{ fontSize: 10, padding: "2px 8px" }}
            onClick={() => {
              const name = prompt("Nombre del campo:");
              if (name && name.trim()) {
                const newFields = { ...(node.customFields ?? {}), [name.trim()]: "" };
                dispatch({ type: "UPDATE_NODE", nodeId: node.id, updates: { customFields: newFields } });
              }
            }}
          >
            + Otro
          </button>
        </div>
      </div>
    </div>
  );
}
