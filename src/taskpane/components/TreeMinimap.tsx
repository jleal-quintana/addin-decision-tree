import React, { useCallback, useMemo } from "react";
import { useTree } from "../context/TreeContext";
import { NodeType } from "../../models/types";
import { layoutTreeCompact } from "../utils/treeLayout";
import { focusNodeInTree } from "../utils/focusNode";

interface MinimapShapeProps {
  x: number;
  y: number;
  type: NodeType;
  isOptimal: boolean;
  selected: boolean;
}

function MinimapShape({ x, y, type, isOptimal, selected }: MinimapShapeProps) {
  const stroke = isOptimal ? "var(--qe-verde)" : selected ? "var(--qe-azul)" : "var(--text-secondary)";
  const fill = isOptimal ? "var(--qe-lima-soft)" : "var(--bg-card)";
  const strokeWidth = isOptimal ? 1.6 : selected ? 1.5 : 1.2;

  if (type === "decision") {
    return (
      <rect
        x={x - 5}
        y={y - 5}
        width={10}
        height={10}
        rx={1.5}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    );
  }
  if (type === "chance") {
    return (
      <circle
        cx={x}
        cy={y}
        r={5}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    );
  }
  return (
    <path
      d={`M${x},${y - 5} L${x + 5},${y + 4.5} L${x - 5},${y + 4.5} Z`}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
    />
  );
}

export function TreeMinimap() {
  const { state, dispatch } = useTree();
  const tree = state.tree;

  const width = 320;
  const height = 110;

  const layout = useMemo(() => layoutTreeCompact(tree, width, height, 14), [tree]);

  const handleSelect = useCallback(
    (nodeId: string) => {
      focusNodeInTree(dispatch, nodeId);
    },
    [dispatch]
  );

  if (!tree.rootId || layout.nodes.length === 0) return null;

  const selectedId = state.selectedNodeId;
  const positionsById = layout.positionsById;
  const totalNodes = Object.keys(tree.nodes).length;

  return (
    <section className="tree-minimap" aria-label="Mini-mapa del árbol">
      <header className="tree-minimap__header">
        <span className="tree-minimap__title">Estructura del árbol</span>
        <span className="tree-minimap__meta">
          {totalNodes} {totalNodes === 1 ? "nodo" : "nodos"}
        </span>
      </header>
      <div className="tree-minimap__viewport">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Vista compacta del árbol de decisión"
        >
          {layout.edges.map((edge) => {
            const from = positionsById.get(edge.fromId);
            const to = positionsById.get(edge.toId);
            if (!from || !to) return null;
            const midX = (from.x + to.x) / 2;
            const pruned = !edge.isOptimal;
            const markX = (midX + to.x) / 2;
            const markY = to.y;
            return (
              <g key={`${edge.fromId}-${edge.toId}`}>
                <path
                  d={`M${from.x},${from.y} L${midX},${from.y} L${midX},${to.y} L${to.x},${to.y}`}
                  fill="none"
                  stroke={edge.isOptimal ? "var(--qe-verde)" : "var(--border)"}
                  strokeWidth={edge.isOptimal ? 1.8 : 1.2}
                />
                {pruned && (
                  <g aria-hidden="true">
                    <line
                      x1={markX - 3}
                      y1={markY - 3}
                      x2={markX + 1}
                      y2={markY + 3}
                      stroke="var(--text-secondary)"
                      strokeWidth={1.1}
                    />
                    <line
                      x1={markX}
                      y1={markY - 3}
                      x2={markX + 4}
                      y2={markY + 3}
                      stroke="var(--text-secondary)"
                      strokeWidth={1.1}
                    />
                  </g>
                )}
              </g>
            );
          })}
          {selectedId && positionsById.has(selectedId) && (
            <circle
              cx={positionsById.get(selectedId)!.x}
              cy={positionsById.get(selectedId)!.y}
              r={9}
              fill="none"
              stroke="var(--qe-verde)"
              strokeWidth={1.5}
              strokeDasharray="2 2"
            />
          )}
          {layout.nodes.map((node) => (
            <g
              key={node.id}
              onClick={() => handleSelect(node.id)}
              style={{ cursor: "pointer" }}
              tabIndex={0}
              role="button"
              aria-label={`Seleccionar nodo ${node.id}`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleSelect(node.id);
                }
              }}
            >
              <circle cx={node.x} cy={node.y} r={8} fill="transparent" />
              <MinimapShape
                x={node.x}
                y={node.y}
                type={node.type}
                isOptimal={node.isOptimal}
                selected={node.id === selectedId}
              />
            </g>
          ))}
        </svg>
      </div>
      <p className="tree-minimap__hint">
        Tocá un nodo del mapa para abrirlo en la lista
      </p>
    </section>
  );
}
