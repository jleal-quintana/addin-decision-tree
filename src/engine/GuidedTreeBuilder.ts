import { DecisionTreeData, TreeNode } from "../models/types";

export type GuidedOutcomeKind = "certain" | "uncertain";

export interface GuidedOutcomeInput {
  id: string;
  label: string;
  probability: number;
  value: number;
}

export interface GuidedAlternativeInput {
  id: string;
  label: string;
  kind: GuidedOutcomeKind;
  certainValue: number;
  outcomes: GuidedOutcomeInput[];
}

export interface GuidedTreeInput {
  name: string;
  question: string;
  mode: "maximize" | "minimize";
  alternatives: GuidedAlternativeInput[];
}

function nodeBase(
  id: string,
  type: TreeNode["type"],
  label: string,
  branchLabel: string | null,
  parentId: string | null
): TreeNode {
  return {
    id,
    type,
    label,
    branchLabel,
    payoff: type === "end" ? 0 : null,
    cost: null,
    time: null,
    expectedValue: null,
    isOptimal: false,
    parentId,
    childIds: [],
    probability: null,
    collapsed: false,
    customFields: {},
  };
}

/** Convierte las respuestas simples del asistente en el modelo real del motor. */
export function buildGuidedTree(input: GuidedTreeInput): DecisionTreeData {
  const now = new Date().toISOString();
  const rootId = "guided_root";
  const nodes: DecisionTreeData["nodes"] = {};
  const root = nodeBase(rootId, "decision", input.question.trim(), null, null);
  nodes[rootId] = root;

  input.alternatives.forEach((alternative, alternativeIndex) => {
    const alternativeId = `guided_alt_${alternativeIndex + 1}`;
    const alternativeLabel = alternative.label.trim();
    root.childIds.push(alternativeId);

    if (alternative.kind === "certain") {
      const terminal = nodeBase(
        alternativeId,
        "end",
        `Resultado de ${alternativeLabel}`,
        alternativeLabel,
        rootId
      );
      terminal.payoff = alternative.certainValue;
      nodes[alternativeId] = terminal;
      return;
    }

    const chance = nodeBase(
      alternativeId,
      "chance",
      `Resultados de ${alternativeLabel}`,
      alternativeLabel,
      rootId
    );
    nodes[alternativeId] = chance;

    alternative.outcomes.forEach((outcome, outcomeIndex) => {
      const outcomeId = `${alternativeId}_outcome_${outcomeIndex + 1}`;
      const outcomeLabel = outcome.label.trim();
      const terminal = nodeBase(outcomeId, "end", outcomeLabel, outcomeLabel, alternativeId);
      terminal.payoff = outcome.value;
      terminal.probability = outcome.probability;
      nodes[outcomeId] = terminal;
      chance.childIds.push(outcomeId);
    });
  });

  return {
    rootId,
    nodes,
    metadata: {
      name: input.name.trim() || input.question.trim(),
      mode: input.mode,
      createdAt: now,
      updatedAt: now,
    },
  };
}
