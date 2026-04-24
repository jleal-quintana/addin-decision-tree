import { DecisionTreeData, TreeNode } from "../models/types";

export interface PathRow {
  label: string;
  ids: string[];
  probability: number;
  value: number;
  diff: number;
  isOptimal: boolean;
}

/**
 * Enumera los caminos terminales (root → end) con probabilidad acumulada,
 * valor y diferencia vs recomendado. El camino óptimo se identifica por IDs
 * (no por label) para evitar colisiones con labels repetidos ("Sí"/"No"/"Base").
 */
export function enumeratePaths(tree: DecisionTreeData): PathRow[] {
  if (!tree.rootId) return [];

  const rows: PathRow[] = [];
  const parentById = tree.nodes;

  function walk(
    nodeId: string,
    accLabels: string[],
    accIds: string[],
    accProb: number,
    accCost: number
  ): void {
    const node = parentById[nodeId];
    if (!node) return;
    const parent: TreeNode | null = node.parentId ? parentById[node.parentId] : null;

    const branchProb = parent?.type === "chance" ? node.probability ?? 0 : 1;
    const nextProb = accProb * branchProb;

    const branchCost = parent ? node.cost ?? 0 : 0;
    const nextCost = accCost + branchCost;

    const nextLabels = [...accLabels, node.label];
    const nextIds = [...accIds, node.id];

    if (node.type === "end" || node.childIds.length === 0) {
      const payoff = node.payoff ?? 0;
      rows.push({
        label: nextLabels.join(" → "),
        ids: nextIds,
        probability: nextProb,
        value: payoff - nextCost,
        diff: 0,
        isOptimal: false,
      });
      return;
    }

    for (const childId of node.childIds) {
      walk(childId, nextLabels, nextIds, nextProb, nextCost);
    }
  }

  walk(tree.rootId, [], [], 1, 0);

  const optimalNodeIds = new Set(
    Object.values(tree.nodes)
      .filter((n) => n.isOptimal)
      .map((n) => n.id)
  );

  for (const row of rows) {
    row.isOptimal = row.ids.every((id) => optimalNodeIds.has(id));
  }

  const reference = rows.find((r) => r.isOptimal)?.value ?? 0;
  for (const row of rows) row.diff = row.value - reference;

  return rows.sort(
    (a, b) => (b.isOptimal ? 1 : 0) - (a.isOptimal ? 1 : 0) || b.probability - a.probability
  );
}
