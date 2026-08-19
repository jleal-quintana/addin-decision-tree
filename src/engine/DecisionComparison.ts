import { DecisionTreeData } from "../models/types";
import { calculateExpectedValues } from "./ExpectedValueCalculator";
import { getOptimalChildId } from "./RollbackAnalysis";

export interface RootDecisionComparison {
  recommendedId: string;
  recommendedLabel: string;
  recommendedValue: number;
  alternativeId: string | null;
  alternativeLabel: string | null;
  alternativeValue: number | null;
  delta: number | null;
  relativeDelta: number | null;
  isTie: boolean;
}

/**
 * Compara alternativas directas de la decisión raíz usando sus valores
 * esperados. No compara resultados terminales individuales, porque eso mezcla
 * escenarios realizados con alternativas de decisión y produce deltas falsos.
 */
export function compareRootDecision(tree: DecisionTreeData): RootDecisionComparison | null {
  if (!tree.rootId) return null;

  const root = tree.nodes[tree.rootId];
  if (!root || root.type !== "decision" || root.childIds.length === 0) return null;

  const evMap = calculateExpectedValues(tree);
  const recommendedId = getOptimalChildId(tree, root.id, evMap);
  if (!recommendedId) return null;

  const recommendedNode = tree.nodes[recommendedId];
  const recommendedValue = evMap[recommendedId];
  if (!recommendedNode || recommendedValue === null || recommendedValue === undefined) return null;

  const alternatives = root.childIds
    .filter((id) => id !== recommendedId)
    .map((id) => ({ id, node: tree.nodes[id], value: evMap[id] }))
    .filter(
      (item): item is { id: string; node: NonNullable<typeof item.node>; value: number } =>
        Boolean(item.node) && item.value !== null && item.value !== undefined
    );

  const bestAlternative = alternatives.reduce<(typeof alternatives)[number] | null>((best, item) => {
    if (!best) return item;
    return tree.metadata.mode === "minimize"
      ? item.value < best.value
        ? item
        : best
      : item.value > best.value
        ? item
        : best;
  }, null);

  const delta = bestAlternative ? Math.abs(recommendedValue - bestAlternative.value) : null;
  const relativeDelta =
    delta !== null && bestAlternative
      ? delta / Math.max(Math.abs(recommendedValue), Math.abs(bestAlternative.value), 1)
      : null;

  return {
    recommendedId,
    recommendedLabel: recommendedNode.branchLabel || recommendedNode.label,
    recommendedValue,
    alternativeId: bestAlternative?.id ?? null,
    alternativeLabel: bestAlternative
      ? bestAlternative.node.branchLabel || bestAlternative.node.label
      : null,
    alternativeValue: bestAlternative?.value ?? null,
    delta,
    relativeDelta,
    isTie: delta !== null && delta <= 0.005,
  };
}
