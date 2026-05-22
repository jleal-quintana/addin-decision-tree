import { DecisionTreeData, NodeType } from "../../models/types";

export interface LaidOutNode {
  id: string;
  type: NodeType;
  isOptimal: boolean;
  x: number;
  y: number;
}

export interface LaidOutEdge {
  fromId: string;
  toId: string;
  isOptimal: boolean;
}

export interface CompactLayout {
  nodes: LaidOutNode[];
  edges: LaidOutEdge[];
  positionsById: Map<string, LaidOutNode>;
}

interface PadOptions {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export function layoutTreeCompact(
  tree: DecisionTreeData,
  width: number,
  height: number,
  pad: number | PadOptions = 14
): CompactLayout {
  const empty: CompactLayout = { nodes: [], edges: [], positionsById: new Map() };
  if (!tree.rootId) return empty;
  const nodes = tree.nodes;
  const root = nodes[tree.rootId];
  if (!root) return empty;

  const padTop = typeof pad === "number" ? pad : pad.top ?? 14;
  const padRight = typeof pad === "number" ? pad : pad.right ?? 14;
  const padBottom = typeof pad === "number" ? pad : pad.bottom ?? 14;
  const padLeft = typeof pad === "number" ? pad : pad.left ?? 14;

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
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const laidOut: LaidOutNode[] = Object.entries(positions).map(([id, y]) => {
    const node = nodes[id];
    return {
      id,
      type: node.type,
      isOptimal: node.isOptimal,
      x: padLeft + (maxDepth === 0 ? innerW / 2 : (depths[id] / maxDepth) * innerW),
      y: padTop + y * innerH,
    };
  });

  const positionsById = new Map(laidOut.map((n) => [n.id, n]));

  const edges: LaidOutEdge[] = [];
  for (const node of Object.values(nodes)) {
    if (node.parentId && positionsById.has(node.parentId) && positionsById.has(node.id)) {
      edges.push({ fromId: node.parentId, toId: node.id, isOptimal: node.isOptimal });
    }
  }

  return { nodes: laidOut, edges, positionsById };
}
