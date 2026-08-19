import { DecisionTreeData, TreeNode } from "../models/types";
import { calculateExpectedValues } from "./ExpectedValueCalculator";

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
  // Modo Costo: cost suma (es un costo más). Modo Valor: cost resta (gasto que
  // se descuenta del payoff). Mismo criterio que ExpectedValueCalculator.
  const costSign = tree.metadata.mode === "minimize" ? +1 : -1;

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

    const nextCost = accCost + (node.cost ?? 0);

    const labelPart = parent && node.branchLabel ? `${node.branchLabel}: ${node.label}` : node.label;
    const nextLabels = [...accLabels, labelPart];
    const nextIds = [...accIds, node.id];

    if (node.type === "end" || node.childIds.length === 0) {
      const payoff = node.payoff ?? 0;
      rows.push({
        label: nextLabels.join(" → "),
        ids: nextIds,
        probability: nextProb,
        value: payoff + costSign * nextCost,
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

  const optimalNodeIds = new Set<string>();
  for (const node of Object.values(tree.nodes)) {
    if (node.isOptimal) optimalNodeIds.add(node.id);
  }

  for (const row of rows) {
    row.isOptimal = row.ids.every((id) => optimalNodeIds.has(id));
  }

  // Referencia para "Vs recomendado": NetEV del root (= valor/costo esperado
  // del árbol). Coincide con la fórmula en Excel (=valueFormula - $rootNetEv$),
  // así engine y Excel reportan el mismo delta. Antes usábamos el value del
  // primer path óptimo, lo que daba lecturas distintas según qué camino
  // específico salía primero.
  const evMap = calculateExpectedValues(tree);
  const reference = (tree.rootId ? evMap[tree.rootId] : 0) ?? 0;
  for (const row of rows) row.diff = row.value - reference;

  return rows.sort(
    (a, b) => (b.isOptimal ? 1 : 0) - (a.isOptimal ? 1 : 0) || b.probability - a.probability
  );
}
