import { DecisionTreeData } from "../models/types";

/**
 * Bottom-up traversal that computes the net expected value for each node.
 * A node's own cost is discounted exactly once when entering that node.
 */
export function calculateExpectedValues(
  tree: DecisionTreeData
): Record<string, number | null> {
  const evMap: Record<string, number | null> = {};

  if (!tree.rootId) return evMap;

  function compute(nodeId: string): number | null {
    const node = tree.nodes[nodeId];
    if (!node) return null;

    const ownCost = node.cost ?? 0;

    if (node.type === "end" || node.childIds.length === 0) {
      const ev = (node.payoff ?? 0) - ownCost;
      evMap[nodeId] = ev;
      return ev;
    }

    const childEVs: { childId: string; ev: number }[] = [];
    for (const childId of node.childIds) {
      const childEV = compute(childId);
      if (childEV !== null) {
        childEVs.push({ childId, ev: childEV });
      }
    }

    if (childEVs.length === 0) {
      evMap[nodeId] = null;
      return null;
    }

    let childrenEv: number;

    if (node.type === "chance") {
      childrenEv = 0;
      for (const child of childEVs) {
        const prob = tree.nodes[child.childId]?.probability ?? 0;
        childrenEv += prob * child.ev;
      }
    } else {
      const pick = tree.metadata.mode === "minimize" ? Math.min : Math.max;
      childrenEv = pick(...childEVs.map((child) => child.ev));
    }

    const netEv = childrenEv - ownCost;
    evMap[nodeId] = netEv;
    return netEv;
  }

  compute(tree.rootId);
  return evMap;
}
