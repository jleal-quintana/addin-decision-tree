import { calculateExpectedValues } from "../engine/ExpectedValueCalculator";
import { findOptimalPath } from "../engine/RollbackAnalysis";
import { DecisionTreeData } from "../models/types";
import { validate } from "../models/DecisionTree";
import {
  buildCalculationModel,
} from "./CalculationSheet";
import { clearRenderedSheets, renderToExcel } from "../renderer/ExcelShapeRenderer";
import { computeLayout } from "../renderer/TreeLayoutEngine";

function prepareTreeForRender(tree: DecisionTreeData): DecisionTreeData {
  if (!tree.rootId) return tree;

  const evMap = calculateExpectedValues(tree);
  const optimalPath = findOptimalPath(tree, evMap);
  const nodes = { ...tree.nodes };

  for (const id of Object.keys(nodes)) {
    nodes[id] = {
      ...nodes[id],
      expectedValue: evMap[id] ?? null,
      isOptimal: optimalPath.includes(id),
    };
  }

  return {
    ...tree,
    nodes,
  };
}

export async function renderTreeToExcel(tree: DecisionTreeData): Promise<void> {
  const errors = validate(tree);
  if (errors.length > 0) {
    throw new Error(errors[0].message);
  }

  const treeToRender = prepareTreeForRender(tree);
  const calcSheet = buildCalculationModel(treeToRender);
  const layout = computeLayout(treeToRender, calcSheet);

  if (layout.nodes.length === 0) {
    throw new Error("El arbol esta vacio");
  }

  await renderToExcel(layout, calcSheet, treeToRender);
}

export async function clearShapes(): Promise<void> {
  await clearRenderedSheets();
}
