import { DecisionTreeData, TreeNode } from "../models/types";

export interface GuidedBranchInput {
  id: string;
  label: string;
  probability: number | null;
  target: GuidedNodeInput;
}

interface GuidedInternalNodeInput {
  id: string;
  label: string;
  branches: GuidedBranchInput[];
}

export interface GuidedDecisionNodeInput extends GuidedInternalNodeInput {
  type: "decision";
}

export interface GuidedChanceNodeInput extends GuidedInternalNodeInput {
  type: "chance";
}

export interface GuidedResultNodeInput {
  id: string;
  type: "result";
  label: string;
  value: number;
}

export type GuidedNodeInput =
  | GuidedDecisionNodeInput
  | GuidedChanceNodeInput
  | GuidedResultNodeInput;

export interface GuidedTreeInput {
  name: string;
  mode: "maximize" | "minimize";
  root: GuidedDecisionNodeInput;
}

function nodeBase(
  id: string,
  type: TreeNode["type"],
  label: string,
  branchLabel: string | null,
  parentId: string | null,
  probability: number | null
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
    probability,
    collapsed: false,
    customFields: {},
  };
}

/** Convierte una estructura guiada recursiva en el modelo real del motor. */
export function buildGuidedTree(input: GuidedTreeInput): DecisionTreeData {
  const now = new Date().toISOString();
  const nodes: DecisionTreeData["nodes"] = {};

  const visit = (
    draft: GuidedNodeInput,
    parentId: string | null,
    branchLabel: string | null,
    probability: number | null
  ): string => {
    if (nodes[draft.id]) {
      throw new Error(`El asistente generó un identificador duplicado: ${draft.id}`);
    }

    const type: TreeNode["type"] = draft.type === "result" ? "end" : draft.type;
    const fallbackLabel =
      draft.type === "decision"
        ? "Nueva decisión"
        : draft.type === "chance"
          ? "Nueva incertidumbre"
          : "Resultado final";
    const node = nodeBase(
      draft.id,
      type,
      draft.label.trim() || fallbackLabel,
      branchLabel,
      parentId,
      probability
    );
    nodes[node.id] = node;

    if (draft.type === "result") {
      node.payoff = draft.value;
      return node.id;
    }

    for (const branch of draft.branches) {
      const childId = visit(
        branch.target,
        node.id,
        branch.label.trim(),
        draft.type === "chance" ? branch.probability : null
      );
      node.childIds.push(childId);
    }

    return node.id;
  };

  const rootId = visit(input.root, null, null, null);
  return {
    rootId,
    nodes,
    metadata: {
      name: input.name.trim() || input.root.label.trim() || "Nuevo análisis",
      mode: input.mode,
      createdAt: now,
      updatedAt: now,
    },
  };
}
