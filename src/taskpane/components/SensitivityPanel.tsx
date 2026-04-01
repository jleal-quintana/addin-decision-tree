import React, { useCallback, useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { useTree } from "../context/TreeContext";
import {
  getSensitivityParameters, runSensitivityAnalysis,
  SensitivityConfig, SensitivityParameter,
} from "../../engine/SensitivityAnalysis";
import { SensitivityResult } from "../../models/types";
import { validate } from "../../models/DecisionTree";

const COLORS = ["#1B4B6C", "#AD977D", "#6B7B38", "#33492D", "#BADCFF", "#E2FF87"];

export function SensitivityPanel() {
  const { state } = useTree();
  const { tree } = state;

  const [selectedParam, setSelectedParam] = useState<SensitivityParameter | null>(null);
  const [min, setMin] = useState(0);
  const [max, setMax] = useState(1);
  const [steps, setSteps] = useState(50);
  const [result, setResult] = useState<SensitivityResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const params = useMemo(() => getSensitivityParameters(tree), [tree]);

  const handleRun = useCallback(() => {
    if (!selectedParam) { setError("Selecciona un parametro"); return; }
    const errors = validate(tree);
    if (errors.length > 0) { setError(errors[0].message); return; }
    try {
      const config: SensitivityConfig = { parameter: selectedParam, min, max, steps };
      setResult(runSensitivityAnalysis(tree, config));
      setError(null);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : String(err)); }
  }, [selectedParam, min, max, steps, tree]);

  const chartData = useMemo(() => {
    if (!result) return [];
    return result.parameterValues.map((val, i) => {
      const point: Record<string, number> = { x: val };
      for (const [childId, evs] of Object.entries(result.evByDecision)) {
        point[tree.nodes[childId]?.label ?? childId] = evs[i];
      }
      return point;
    });
  }, [result, tree]);

  const decisionLabels = useMemo(() => {
    if (!result) return [];
    return Object.keys(result.evByDecision).map((id) => tree.nodes[id]?.label ?? id);
  }, [result, tree]);

  const handleParamSelect = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const idx = parseInt(e.target.value);
    if (idx >= 0 && idx < params.length) {
      const p = params[idx].param;
      setSelectedParam(p);
      if (p.kind === "probability") { setMin(0); setMax(1); }
      else {
        const payoff = tree.nodes[p.nodeId]?.payoff ?? 0;
        setMin(payoff - Math.abs(payoff || 500000) * 2);
        setMax(payoff + Math.abs(payoff || 500000) * 2);
      }
    }
  }, [params, tree]);

  if (!tree.rootId) {
    return (
      <div className="empty-state">
        <h3>Sin datos</h3>
        <p>Construi un arbol primero.</p>
      </div>
    );
  }

  return (
    <div className="sensitivity-panel">
      <div className="config-card">
        <h4>Configuracion</h4>
        <div className="field">
          <label>Parametro a variar</label>
          <select onChange={handleParamSelect} defaultValue="">
            <option value="" disabled>Seleccionar...</option>
            {params.map((p, i) => <option key={i} value={i}>{p.label}</option>)}
          </select>
        </div>
        <div className="config-row">
          <div className="field">
            <label>Min</label>
            <input type="number" value={min} onChange={(e) => setMin(parseFloat(e.target.value) || 0)}
                   step={selectedParam?.kind === "probability" ? 0.05 : 10000} />
          </div>
          <div className="field">
            <label>Max</label>
            <input type="number" value={max} onChange={(e) => setMax(parseFloat(e.target.value) || 0)}
                   step={selectedParam?.kind === "probability" ? 0.05 : 10000} />
          </div>
          <div className="field">
            <label>Pasos</label>
            <input type="number" value={steps} onChange={(e) => setSteps(parseInt(e.target.value) || 20)}
                   min="10" max="200" />
          </div>
        </div>
        <button className="btn-create decision" style={{ marginTop: 10, width: "100%", justifyContent: "center" }}
                onClick={handleRun}>
          Ejecutar Analisis
        </button>
      </div>

      {error && <div className="validation-errors"><p>{error}</p></div>}

      {result && chartData.length > 0 && (
        <>
          <div className="config-card" style={{ padding: "8px 4px" }}>
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e5e9" />
                  <XAxis dataKey="x" type="number" domain={[min, max]} fontSize={10}
                         tickFormatter={(v: number) => selectedParam?.kind === "probability" ? `${(v * 100).toFixed(0)}%` : `$${(v / 1000).toFixed(0)}K`} />
                  <YAxis fontSize={10}
                         tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`} />
                  <Tooltip
                    formatter={(value: number) => `$${value.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`}
                    labelFormatter={(label: number) => selectedParam?.kind === "probability" ? `p = ${(label * 100).toFixed(1)}%` : `$${label.toLocaleString("es-AR")}`}
                  />
                  <Legend fontSize={10} />
                  {decisionLabels.map((label, i) => (
                    <Line key={label} type="monotone" dataKey={label}
                          stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
                  ))}
                  {result.switchPoints.map((sp, i) => (
                    <ReferenceLine key={i} x={sp.parameterValue} stroke="#c0392b" strokeDasharray="5 5" />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {result.switchPoints.length > 0 && (
            <div className="config-card">
              <h4>Puntos de Cambio</h4>
              <table className="data-table">
                <thead>
                  <tr><th>Valor</th><th>De</th><th>A</th><th style={{ textAlign: "right" }}>VE</th></tr>
                </thead>
                <tbody>
                  {result.switchPoints.map((sp, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>
                        {selectedParam?.kind === "probability" ? `${(sp.parameterValue * 100).toFixed(1)}%` : `$${sp.parameterValue.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`}
                      </td>
                      <td>{sp.fromDecision}</td>
                      <td>{sp.toDecision}</td>
                      <td style={{ textAlign: "right", fontFamily: "Montserrat", fontWeight: 600 }}>
                        ${sp.ev.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
