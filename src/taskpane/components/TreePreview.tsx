import React, { useMemo } from "react";
import { useTree } from "../context/TreeContext";
import { computeLayout } from "../../renderer/TreeLayoutEngine";
import { GRID } from "../../renderer/StyleConfig";

// SVG units per grid cell
const CW = 35;
const CH = 15;

export function TreePreview() {
  const { state } = useTree();
  const layout = useMemo(() => computeLayout(state.tree), [state.tree]);

  if (layout.nodes.length === 0) return null;

  const pad = 15;
  const vw = (layout.maxCol + GRID.colGap + 2) * CW + pad * 2;
  const vh = (layout.maxRow + GRID.rowGap + 2) * CH + pad * 2;

  const nodeW = GRID.nodeCols * CW;
  const nodeH = GRID.nodeRows * CH;

  return (
    <div className="mini-preview">
      <div className="mini-preview-header">Vista previa</div>
      <svg width="100%" height={Math.min(180, vh * 0.65)}
           viewBox={`0 0 ${vw} ${vh}`} preserveAspectRatio="xMidYMid meet"
           style={{ display: "block", padding: 4 }}>

        {/* Edges */}
        {layout.edges.map((e) => {
          const color = e.isOptimal ? "#6B7B38" : "#555";
          const w = e.isOptimal ? 1.5 : 0.7;
          const x1 = pad + (e.fromCol + GRID.nodeCols) * CW;
          const y1 = pad + (e.fromRow + GRID.nodeRows / 2) * CH;
          const x2 = pad + e.toCol * CW;
          const y2 = pad + (e.toRow + GRID.nodeRows / 2) * CH;
          return (
            <g key={`${e.fromId}-${e.toId}`}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={w} />
              {e.probability !== null && e.probability > 0 && (
                <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 3}
                      fontSize={4} fill="#1B4B6C" textAnchor="middle" fontStyle="italic" fontFamily="Inter, sans-serif">
                  {(e.probability * 100).toFixed(0)}%
                </text>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {layout.nodes.map((n) => {
          const x = pad + n.col * CW;
          const y = pad + n.row * CH;
          const cx = x + nodeW / 2;
          const isOpt = n.isOptimal;

          const colors: Record<string, { bg: string; fg: string }> = {
            decision: { bg: "#6B7B38", fg: "#fff" },
            chance: { bg: "#DAE0E5", fg: "#1a1a1a" },
            end: { bg: "#33492D", fg: "#fff" },
          };
          const c = colors[n.type] || colors.decision;

          return (
            <g key={n.id}>
              {/* Header */}
              <rect x={x} y={y} width={nodeW} height={nodeH / 2} rx={1}
                    fill={c.bg} stroke={isOpt ? "#6B7B38" : "#999"} strokeWidth={isOpt ? 1 : 0.4} />
              <text x={cx} y={y + nodeH / 4 + 1.5} textAnchor="middle"
                    fontSize={3.5} fill={c.fg} fontFamily="Montserrat, sans-serif" fontWeight="bold">
                {n.label.length > 16 ? n.label.slice(0, 16) + ".." : n.label}
              </text>

              {/* Value */}
              <rect x={x} y={y + nodeH / 2} width={nodeW} height={nodeH / 2} rx={1}
                    fill={isOpt ? "#E2FF87" : "#f8f8f8"} stroke={isOpt ? "#6B7B38" : "#999"} strokeWidth={isOpt ? 1 : 0.4} />
              {n.expectedValue !== null && (
                <text x={cx} y={y + nodeH * 3 / 4 + 1.5} textAnchor="middle"
                      fontSize={3.2} fill="#33492D" fontFamily="Inter, sans-serif" fontWeight="bold">
                  ${n.expectedValue.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
