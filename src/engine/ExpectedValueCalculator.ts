import { DecisionTreeData } from "../models/types";

/**
 * Bottom-up traversal that computes the net expected value for each node.
 * A node's own cost is applied exactly once when entering that node.
 *
 * Convención de signos:
 * - Modo Valor (maximize): payoff = ingreso (+), cost = gasto que resta del
 *   ingreso. net = payoff - cost. Se maximiza.
 * - Modo Costo (minimize): payoff = costo terminal (+), cost = costo adicional
 *   del nodo (+, ej. CAPEX). Ambos suman. net = payoff + cost. Se minimiza.
 *
 * En modo Costo, antes el código hacía net = payoff - cost igual que en Valor,
 * lo cual hacía que el CAPEX "abaratara" el árbol en vez de encarecerlo
 * (workover salía $15.5k cuando en realidad cuesta $315.5k esperados).
 */
export function calculateExpectedValues(
  tree: DecisionTreeData
): Record<string, number | null> {
  const evMap: Record<string, number | null> = {};

  if (!tree.rootId) return evMap;

  // En modo Costo, el cost suma; en modo Valor, resta.
  const costSign = tree.metadata.mode === "minimize" ? +1 : -1;

  function compute(nodeId: string): number | null {
    const node = tree.nodes[nodeId];
    if (!node) return null;

    const ownCost = node.cost ?? 0;
    const signedCost = costSign * ownCost;

    if (node.type === "end" || node.childIds.length === 0) {
      const ev = (node.payoff ?? 0) + signedCost;
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

    const netEv = childrenEv + signedCost;
    evMap[nodeId] = netEv;
    return netEv;
  }

  compute(tree.rootId);
  return evMap;
}
