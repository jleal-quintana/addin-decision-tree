import { DecisionTreeData } from "../models/types";

function isBetter(
  mode: "maximize" | "minimize",
  candidate: number,
  current: number
): boolean {
  return mode === "minimize" ? candidate < current : candidate > current;
}

export function getOptimalChildId(
  tree: DecisionTreeData,
  nodeId: string,
  evMap: Record<string, number | null>
): string | null {
  const node = tree.nodes[nodeId];
  if (!node || node.type !== "decision" || node.childIds.length === 0) return null;

  let bestChildId: string | null = null;
  let bestEV = tree.metadata.mode === "minimize" ? Infinity : -Infinity;

  for (const childId of node.childIds) {
    const childEV = evMap[childId];
    if (childEV !== null && isBetter(tree.metadata.mode, childEV, bestEV)) {
      bestEV = childEV;
      bestChildId = childId;
    }
  }

  return bestChildId;
}

/**
 * Starting from the root, follow the optimal path for decision nodes and keep
 * all branches under chance nodes.
 */
export function findOptimalPath(
  tree: DecisionTreeData,
  evMap: Record<string, number | null>
): string[] {
  const optimalPath: string[] = [];

  if (!tree.rootId) return optimalPath;

  function traverse(nodeId: string) {
    const node = tree.nodes[nodeId];
    if (!node) return;

    optimalPath.push(nodeId);

    if (node.type === "end" || node.childIds.length === 0) return;

    if (node.type === "decision") {
      const bestChildId = getOptimalChildId(tree, nodeId, evMap);
      if (bestChildId) traverse(bestChildId);
      return;
    }

    for (const childId of node.childIds) {
      traverse(childId);
    }
  }

  traverse(tree.rootId);
  return optimalPath;
}

export function describeOptimalStrategy(
  tree: DecisionTreeData,
  evMap: Record<string, number | null>
): string {
  const parts: string[] = [];

  if (!tree.rootId) return "Árbol vacío";

  function describe(nodeId: string, depth: number) {
    const node = tree.nodes[nodeId];
    if (!node) return;

    const indent = "  ".repeat(depth);
    const ev = evMap[nodeId];
    const metricLabel = tree.metadata.mode === "minimize" ? "Costo esperado" : "Valor esperado";
    const evStr =
      ev !== null
        ? ` (${metricLabel}: $${ev.toLocaleString("es-AR", { maximumFractionDigits: 0 })})`
        : "";

    if (node.type === "decision") {
      const bestChildId = getOptimalChildId(tree, nodeId, evMap);
      if (!bestChildId) return;
      const bestChild = tree.nodes[bestChildId];
      parts.push(`${indent}-> ${node.label}: elegir "${bestChild?.branchLabel || bestChild?.label}"${evStr}`);
      describe(bestChildId, depth + 1);
      return;
    }

    if (node.type === "chance") {
      parts.push(`${indent}o ${node.label}${evStr}`);
      for (const childId of node.childIds) {
        const child = tree.nodes[childId];
        if (!child) continue;
        const prob = child.probability ?? 0;
        parts.push(`${indent}  ${(child.branchLabel || child.label)} p=${(prob * 100).toFixed(1)}%`);
        if (child.type !== "end") {
          describe(childId, depth + 2);
        }
      }
      return;
    }

    parts.push(
      `${indent}- ${node.label}: $${(node.payoff ?? 0).toLocaleString("es-AR")}`
    );
  }

  describe(tree.rootId, 0);
  return parts.join("\n");
}
