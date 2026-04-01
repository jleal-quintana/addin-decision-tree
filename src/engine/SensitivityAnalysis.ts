import { DecisionTreeData, SensitivityResult, SwitchPoint } from "../models/types";
import { calculateExpectedValues } from "./ExpectedValueCalculator";
import { deserialize, serialize } from "../models/DecisionTree";

export type SensitivityParameter =
  | { kind: "probability"; nodeId: string }
  | { kind: "payoff"; nodeId: string };

export interface SensitivityConfig {
  parameter: SensitivityParameter;
  min: number;
  max: number;
  steps: number;
}

/**
 * Run sensitivity analysis by varying a single parameter across a range.
 * For each value, clone the tree, modify it, recalculate EVs,
 * and track the root-level EV for each decision branch.
 */
export function runSensitivityAnalysis(
  tree: DecisionTreeData,
  config: SensitivityConfig
): SensitivityResult {
  const { parameter, min, max, steps } = config;
  const stepSize = (max - min) / Math.max(steps - 1, 1);

  const parameterValues: number[] = [];
  const rootEVs: number[] = [];
  const evByDecision: Record<string, number[]> = {};

  // Identify root-level decisions for tracking
  const rootNode = tree.rootId ? tree.nodes[tree.rootId] : null;
  const isRootDecision = rootNode?.type === "decision";
  const decisionChildIds = isRootDecision ? rootNode!.childIds : [];

  for (const childId of decisionChildIds) {
    evByDecision[childId] = [];
  }

  for (let i = 0; i < steps; i++) {
    const value = min + i * stepSize;
    parameterValues.push(value);

    // Clone tree
    const cloned = deserialize(serialize(tree));

    // Apply parameter change
    if (parameter.kind === "probability") {
      applyProbabilityChange(cloned, parameter.nodeId, value);
    } else {
      applyPayoffChange(cloned, parameter.nodeId, value);
    }

    // Calculate
    const evMap = calculateExpectedValues(cloned);

    // Record root EV
    const rootEV = cloned.rootId ? (evMap[cloned.rootId] ?? 0) : 0;
    rootEVs.push(rootEV);

    // Record per-decision EVs
    for (const childId of decisionChildIds) {
      const childEV = evMap[childId] ?? 0;
      evByDecision[childId].push(childEV);
    }
  }

  // Detect switch points
  const switchPoints = detectSwitchPoints(
    tree,
    parameterValues,
    evByDecision,
    decisionChildIds
  );

  return { parameterValues, evByDecision, switchPoints, rootEVs };
}

function applyProbabilityChange(
  tree: DecisionTreeData,
  nodeId: string,
  newProb: number
): void {
  const node = tree.nodes[nodeId];
  if (!node || !node.parentId) return;

  const parent = tree.nodes[node.parentId];
  if (!parent || parent.type !== "chance") return;

  const siblings = parent.childIds.filter((id) => id !== nodeId);
  const clampedProb = Math.max(0, Math.min(1, newProb));
  const remaining = 1 - clampedProb;

  // Set new probability
  tree.nodes[nodeId] = { ...node, probability: clampedProb };

  // Adjust siblings proportionally
  const siblingSum = siblings.reduce(
    (sum, id) => sum + (tree.nodes[id]?.probability ?? 0),
    0
  );

  for (const sibId of siblings) {
    const sib = tree.nodes[sibId];
    if (!sib) continue;
    const proportion = siblingSum > 0 ? (sib.probability ?? 0) / siblingSum : 1 / siblings.length;
    tree.nodes[sibId] = {
      ...sib,
      probability: Math.max(0, remaining * proportion),
    };
  }
}

function applyPayoffChange(
  tree: DecisionTreeData,
  nodeId: string,
  newPayoff: number
): void {
  const node = tree.nodes[nodeId];
  if (!node) return;
  tree.nodes[nodeId] = { ...node, payoff: newPayoff };
}

function detectSwitchPoints(
  tree: DecisionTreeData,
  parameterValues: number[],
  evByDecision: Record<string, number[]>,
  decisionChildIds: string[]
): SwitchPoint[] {
  const switchPoints: SwitchPoint[] = [];

  if (decisionChildIds.length < 2) return switchPoints;

  const isBetterFn = tree.metadata.mode === "minimize"
    ? (a: number, b: number) => a < b
    : (a: number, b: number) => a > b;

  for (let i = 1; i < parameterValues.length; i++) {
    // Find best decision at i-1 and i
    let bestPrev = decisionChildIds[0];
    let bestCurr = decisionChildIds[0];

    for (const childId of decisionChildIds) {
      if (isBetterFn(evByDecision[childId][i - 1], evByDecision[bestPrev][i - 1])) {
        bestPrev = childId;
      }
      if (isBetterFn(evByDecision[childId][i], evByDecision[bestCurr][i])) {
        bestCurr = childId;
      }
    }

    if (bestPrev !== bestCurr) {
      // Linear interpolation for approximate switch point
      const evPrevA = evByDecision[bestPrev][i - 1];
      const evPrevB = evByDecision[bestCurr][i - 1];
      const evCurrA = evByDecision[bestPrev][i];
      const evCurrB = evByDecision[bestCurr][i];

      const denominator = (evPrevA - evPrevB) - (evCurrA - evCurrB);
      if (Math.abs(denominator) < 1e-10) continue; // parallel curves, skip

      const t = (evPrevA - evPrevB) / denominator;
      const switchValue =
        parameterValues[i - 1] + t * (parameterValues[i] - parameterValues[i - 1]);
      const switchEV = evPrevA + t * (evCurrA - evPrevA);

      switchPoints.push({
        parameterValue: switchValue,
        fromDecision: tree.nodes[bestPrev]?.label ?? bestPrev,
        toDecision: tree.nodes[bestCurr]?.label ?? bestCurr,
        ev: switchEV,
      });
    }
  }

  return switchPoints;
}

/**
 * Get all nodes that can be varied in sensitivity analysis.
 */
export function getSensitivityParameters(
  tree: DecisionTreeData
): { label: string; param: SensitivityParameter }[] {
  const params: { label: string; param: SensitivityParameter }[] = [];

  for (const [id, node] of Object.entries(tree.nodes)) {
    if (node.type === "end") {
      params.push({
        label: `Payoff: ${node.label}`,
        param: { kind: "payoff", nodeId: id },
      });
    }
    if (node.probability !== null && node.parentId) {
      const parent = tree.nodes[node.parentId];
      if (parent?.type === "chance") {
        params.push({
          label: `Prob: ${node.label}`,
          param: { kind: "probability", nodeId: id },
        });
      }
    }
  }

  return params;
}
