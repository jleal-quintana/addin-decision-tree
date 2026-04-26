import { runTrackedOperation } from "../debug/excelDiagnostics";
import { calculateExpectedValues } from "../engine/ExpectedValueCalculator";
import { findOptimalPath } from "../engine/RollbackAnalysis";
import { DecisionTreeData } from "../models/types";
import { validate } from "../models/DecisionTree";
import { buildRenderModel } from "../rendering/renderModel";
import { renderToExcel, clearRenderedSheets } from "../renderer/ExcelShapeRenderer";
import { GRID } from "../renderer/StyleConfig";
import { computeLayout } from "../renderer/TreeLayoutEngine";
import { buildCalculationModel, CalcTablePlacement } from "./CalculationSheet";
import { TREE_SHEET_NAME } from "./WorkbookConstants";

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

export async function renderTreeToExcel(
  tree: DecisionTreeData,
  options: { debug?: boolean } = {}
): Promise<void> {
  const errors = validate(tree);
  if (errors.length > 0) {
    throw new Error(errors[0].message);
  }

  const treeToRender = prepareTreeForRender(tree);
  const layout = computeLayout(treeToRender);

  if (layout.nodes.length === 0) {
    throw new Error("El arbol esta vacio");
  }

  // Tabla de cálculos inline: arranca dos filas debajo del último row del
  // árbol, columna 0. Construimos el metadata DESPUÉS del layout para que
  // las direcciones de las celdas coincidan con su posición real.
  const calcPlacement: CalcTablePlacement = {
    sheetName: TREE_SHEET_NAME,
    startRow: layout.maxRow + GRID.rowGap + 1,
    startCol: 0,
  };
  const calcSheet = buildCalculationModel(treeToRender, calcPlacement);
  const renderModel = buildRenderModel(treeToRender, layout);

  await runTrackedOperation(
    "renderTreeToExcel",
    {
      nodes: layout.nodes.length,
      edges: layout.edges.length,
      debug: options.debug ?? false,
    },
    async () =>
      renderToExcel(layout, renderModel, calcSheet, calcPlacement, treeToRender, options)
  );
}

export async function clearShapes(): Promise<void> {
  await runTrackedOperation("clearRenderedSheets", {}, async () => clearRenderedSheets());
}
