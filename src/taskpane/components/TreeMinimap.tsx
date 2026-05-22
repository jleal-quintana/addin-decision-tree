import React, { useCallback, useMemo } from "react";
import { useTree } from "../context/TreeContext";
import { DecisionTreeData, NodeType } from "../../models/types";

interface LaidOutNode {
  id: string;
  type: NodeType;
  isOptimal: boolean;
  x: number;
  y: number;
}

interface LaidOutEdge {
  fromId: string;
  toId: string;
  isOptimal: boolean;
}

interface MinimapLayout {
  nodes: LaidOutNode[];
  edges: LaidOutEdge[];
}

function layoutMinimap(
  tree: DecisionTreeData,
  width: number,
  height: number,
  pad = 14
): MinimapLayout {
  if (!tree.rootId) return { nodes: [], edges: [] };
  const nodes = tree.nodes;
  const root = nodes[tree.rootId];
  if (!root) return { nodes: [], edges: [] };

  const depths: Record<string, number> = {};
  const leafOrder: string[] = [];
  const visited = new Set<string>();

  function dfs(id: string, depth: number) {
    if (visited.has(id)) return;
    visited.add(id);
    depths[id] = depth;
    const node = nodes[id];
    if (!node) return;
    if (node.childIds.length === 0) {
      leafOrder.push(id);
    } else {
      for (const childId of node.childIds) {
        dfs(childId, depth + 1);
      }
    }
  }
  dfs(tree.rootId, 0);

  const positions: Record<string, number> = {};
  const leafCount = leafOrder.length;
  leafOrder.forEach((id, i) => {
    positions[id] = leafCount > 1 ? i / (leafCount - 1) : 0.5;
  });

  function place(id: string): number {
    if (positions[id] !== undefined) return positions[id];
    const node = nodes[id];
    if (!node) return 0.5;
    const childYs = node.childIds.map((c) => place(c));
    if (childYs.length === 0) {
      positions[id] = 0.5;
      return 0.5;
    }
    const y = (Math.min(...childYs) + Math.max(...childYs)) / 2;
    positions[id] = y;
    return y;
  }
  place(tree.rootId);

  const depthValues = Object.values(depths);
  const maxDepth = depthValues.length > 0 ? Math.max(...depthValues) : 0;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const laidOut: LaidOutNode[] = Object.entries(positions).map(([id, y]) => {
    const node = nodes[id];
    return {
      id,
      type: node.type,
      isOptimal: node.isOptimal,
      x: pad + (maxDepth === 0 ? innerW / 2 : (depths[id] / maxDepth) * innerW),
      y: pad + y * innerH,
    };
  });

  const edges: LaidOutEdge[] = [];
  for (const node of Object.values(nodes)) {
    if (node.parentId && positions[node.id] !== undefined && positions[node.parentId] !== undefined) {
      edges.push({ fromId: node.parentId, toId: node.id, isOptimal: node.isOptimal });
    }
  }

  return { nodes: laidOut, edges };
}

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

  const layout = useMemo(() => layoutMinimap(tree, width, height), [tree]);

  const handleSelect = useCallback(
    (nodeId: string) => {
      dispatch({ type: "SELECT_NODE", nodeId });
    },
    [dispatch]
  );

  if (!tree.rootId || layout.nodes.length === 0) return null;

  const selectedId = state.selectedNodeId;
  const positionsById = new Map(layout.nodes.map((n) => [n.id, n]));
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
            return (
              <path
                key={`${edge.fromId}-${edge.toId}`}
                d={`M${from.x},${from.y} L${midX},${from.y} L${midX},${to.y} L${to.x},${to.y}`}
                fill="none"
                stroke={edge.isOptimal ? "var(--qe-verde)" : "var(--border)"}
                strokeWidth={edge.isOptimal ? 1.8 : 1.2}
              />
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
