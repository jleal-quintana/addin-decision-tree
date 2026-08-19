import { DecisionTreeData } from "../models/types";

/**
 * Ajusta una rama de incertidumbre y reparte el porcentaje restante entre sus
 * hermanas. Conserva sus proporciones relativas; si todas estaban en cero,
 * distribuye en partes iguales.
 */
export function rebalanceChanceProbability(
  tree: DecisionTreeData,
  nodeId: string,
  probability: number
): DecisionTreeData {
  const node = tree.nodes[nodeId];
  const parent = node?.parentId ? tree.nodes[node.parentId] : null;
  const nextProbability = Math.min(Math.max(probability, 0), 1);

  if (!node || !parent || parent.type !== "chance") return tree;

  const siblingIds = parent.childIds.filter((id) => id !== nodeId && Boolean(tree.nodes[id]));
  const nodes = { ...tree.nodes };
  nodes[nodeId] = { ...node, probability: siblingIds.length === 0 ? 1 : nextProbability };

  if (siblingIds.length > 0) {
    const remaining = 1 - nextProbability;
    const currentTotal = siblingIds.reduce(
      (sum, id) => sum + Math.max(nodes[id].probability ?? 0, 0),
      0
    );

    siblingIds.forEach((id, index) => {
      const sibling = nodes[id];
      const value =
        currentTotal > 0
          ? ((sibling.probability ?? 0) / currentTotal) * remaining
          : remaining / siblingIds.length;
      // La última rama absorbe cualquier residuo de punto flotante.
      const assigned =
        index === siblingIds.length - 1
          ? 1 - nextProbability - siblingIds.slice(0, -1).reduce(
              (sum, priorId) => sum + (nodes[priorId].probability ?? 0),
              0
            )
          : value;
      nodes[id] = { ...sibling, probability: Math.max(0, assigned) };
    });
  }

  return {
    ...tree,
    nodes,
    metadata: { ...tree.metadata, updatedAt: new Date().toISOString() },
  };
}
