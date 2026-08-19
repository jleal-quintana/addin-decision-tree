import { DecisionTreeData } from "../models/types";
import { calculateExpectedValues } from "./ExpectedValueCalculator";
import { getOptimalChildId } from "./RollbackAnalysis";

export interface DecisionStrategyStep {
  decisionId: string;
  decisionLabel: string;
  choiceId: string;
  choiceLabel: string;
  expectedValue: number;
  conditionLabel: string | null;
}

/**
 * Devuelve la politica optima completa, no solo la primera alternativa.
 * En una incertidumbre se recorren todos los resultados posibles; en cada
 * decision se conserva unicamente la alternativa que gana por rollback.
 */
export function buildDecisionStrategy(tree: DecisionTreeData): DecisionStrategyStep[] {
  if (!tree.rootId) return [];

  const evMap = calculateExpectedValues(tree);
  const steps: DecisionStrategyStep[] = [];

  function walk(nodeId: string, conditions: string[]): void {
    const node = tree.nodes[nodeId];
    if (!node) return;

    if (node.type === "decision") {
      const choiceId = getOptimalChildId(tree, node.id, evMap);
      const choice = choiceId ? tree.nodes[choiceId] : null;
      const expectedValue = choiceId ? evMap[choiceId] : null;
      if (!choiceId || !choice || expectedValue === null || expectedValue === undefined) return;

      steps.push({
        decisionId: node.id,
        decisionLabel: node.label,
        choiceId,
        choiceLabel: choice.branchLabel || choice.label,
        expectedValue,
        conditionLabel: conditions.length > 0 ? conditions.join(" > ") : null,
      });
      walk(choiceId, conditions);
      return;
    }

    if (node.type === "chance") {
      for (const childId of node.childIds) {
        const child = tree.nodes[childId];
        if (!child) continue;
        const outcome = child.branchLabel || child.label;
        walk(childId, [...conditions, outcome]);
      }
    }
  }

  walk(tree.rootId, []);
  return steps;
}
