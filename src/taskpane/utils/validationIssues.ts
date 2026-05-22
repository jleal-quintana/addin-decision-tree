import { DecisionTreeData, TreeNode } from "../../models/types";

export type IssueSeverity = "error" | "warn";

export type IssueFix =
  | { kind: "setProbability"; nodeId: string; value: number }
  | { kind: "clearProbability"; nodeId: string }
  | { kind: "distributeProbabilities"; chanceId: string }
  | { kind: "setPayoff"; nodeId: string; value: number };

export interface RichIssue {
  key: string;
  severity: IssueSeverity;
  message: string;
  nodeId: string;
  fixLabel?: string;
  fix?: IssueFix;
}

function fmtPct(p: number): string {
  const v = p * 100;
  if (Number.isInteger(v)) return `${v}%`;
  return `${v.toFixed(1)}%`;
}

function pushUnique(issues: RichIssue[], seen: Set<string>, issue: RichIssue) {
  if (seen.has(issue.key)) return;
  seen.add(issue.key);
  issues.push(issue);
}

export function buildValidationIssues(tree: DecisionTreeData): RichIssue[] {
  const issues: RichIssue[] = [];
  const seen = new Set<string>();

  if (!tree.rootId) return issues;

  const root = tree.nodes[tree.rootId];
  if (!root) {
    pushUnique(issues, seen, {
      key: "missing-root",
      severity: "error",
      nodeId: "",
      message: "La raíz del árbol no existe en la estructura actual",
    });
    return issues;
  }

  if (root.type !== "decision") {
    pushUnique(issues, seen, {
      key: `root-type-${root.id}`,
      severity: "error",
      nodeId: root.id,
      message: "La raíz debe ser un nodo de decisión",
    });
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  function walk(nodeId: string) {
    if (visiting.has(nodeId)) {
      pushUnique(issues, seen, {
        key: `cycle-${nodeId}`,
        severity: "error",
        nodeId,
        message: "El árbol contiene un ciclo y no puede calcularse",
      });
      return;
    }
    if (visited.has(nodeId)) return;
    const node = tree.nodes[nodeId];
    if (!node) return;

    visiting.add(nodeId);
    visited.add(nodeId);

    if (node.type === "end") {
      if (node.childIds.length > 0) {
        pushUnique(issues, seen, {
          key: `end-has-children-${node.id}`,
          severity: "error",
          nodeId: node.id,
          message: `"${node.label}" es un resultado final y no puede tener hijos`,
        });
      }
      if (node.payoff === null || node.payoff === undefined) {
        pushUnique(issues, seen, {
          key: `end-missing-payoff-${node.id}`,
          severity: "error",
          nodeId: node.id,
          message: `"${node.label}" necesita un VAN terminal`,
          fixLabel: "Poner en 0",
          fix: { kind: "setPayoff", nodeId: node.id, value: 0 },
        });
      }
    } else if (node.childIds.length === 0) {
      pushUnique(issues, seen, {
        key: `no-children-${node.id}`,
        severity: "error",
        nodeId: node.id,
        message: `"${node.label}" necesita al menos un hijo`,
      });
    }

    if (node.type === "chance" && node.childIds.length > 0) {
      let sumDefined = 0;
      const missing: TreeNode[] = [];
      for (const childId of node.childIds) {
        const child = tree.nodes[childId];
        if (!child) continue;
        if (child.probability === null || child.probability === undefined) {
          missing.push(child);
        } else {
          sumDefined += child.probability;
        }
      }
      const remaining = Math.max(0, 1 - sumDefined);

      for (const child of missing) {
        const branchName = child.branchLabel || child.label;
        const share = missing.length > 0 ? remaining / missing.length : 0;
        pushUnique(issues, seen, {
          key: `missing-prob-${child.id}`,
          severity: "error",
          nodeId: child.id,
          message: `Falta probabilidad en la rama "${branchName}"`,
          fixLabel: share > 0 ? `Completar ${fmtPct(share)}` : "Asignar 0%",
          fix: { kind: "setProbability", nodeId: child.id, value: share },
        });
      }

      if (missing.length === 0) {
        const total = sumDefined;
        if (Math.abs(total - 1) > 0.001) {
          pushUnique(issues, seen, {
            key: `sum-mismatch-${node.id}`,
            severity: "error",
            nodeId: node.id,
            message: `Las probabilidades que salen de "${node.label}" suman ${fmtPct(total)} (deben ser 100%)`,
            fixLabel: total > 0 ? "Normalizar a 100%" : "Distribuir igual",
            fix: { kind: "distributeProbabilities", chanceId: node.id },
          });
        }
      }
    }

    if (node.type === "decision") {
      for (const childId of node.childIds) {
        const child = tree.nodes[childId];
        if (child && child.probability !== null && Math.abs(child.probability) > 0.000001) {
          const branchName = child.branchLabel || child.label;
          pushUnique(issues, seen, {
            key: `decision-child-prob-${child.id}`,
            severity: "error",
            nodeId: child.id,
            message: `La rama "${branchName}" sale de una decisión y no debe tener probabilidad`,
            fixLabel: "Quitar probabilidad",
            fix: { kind: "clearProbability", nodeId: child.id },
          });
        }
      }
    }

    for (const childId of node.childIds) {
      walk(childId);
    }

    visiting.delete(nodeId);
  }

  walk(tree.rootId);

  for (const [id, node] of Object.entries(tree.nodes)) {
    if (!visited.has(id) && id !== tree.rootId) {
      pushUnique(issues, seen, {
        key: `orphan-${id}`,
        severity: "error",
        nodeId: id,
        message: `"${node.label}" quedó fuera de la raíz y debe eliminarse o reconectarse`,
      });
    }
  }

  return issues;
}

export function countNodesByType(tree: DecisionTreeData): { decision: number; chance: number; end: number; total: number } {
  let decision = 0;
  let chance = 0;
  let end = 0;
  for (const node of Object.values(tree.nodes)) {
    if (node.type === "decision") decision += 1;
    else if (node.type === "chance") chance += 1;
    else if (node.type === "end") end += 1;
  }
  return { decision, chance, end, total: decision + chance + end };
}
