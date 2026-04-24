import { buildCalculationModel } from "../src/excel/CalculationSheet";
import { clearShapes } from "../src/excel/ShapeManager";
import { rangeAddr } from "../src/excel/ExcelAddress";
import { CALC_SHEET_NAME, TREE_SHEET_NAME } from "../src/excel/WorkbookConstants";
import { DecisionTreeData } from "../src/models/types";
import { buildRenderModel } from "../src/rendering/renderModel";
import { renderToExcel } from "../src/renderer/ExcelShapeRenderer";
import { GRID } from "../src/renderer/StyleConfig";
import { computeLayout } from "../src/renderer/TreeLayoutEngine";
import {
  getUnmergeCallCount,
  getWorksheet,
  installFakeExcel,
} from "./support/fakeExcel";

function createRootOnlyTree(id = "root", label = "Nodo root"): DecisionTreeData {
  return {
    rootId: id,
    metadata: {
      name: "Arbol de prueba",
      createdAt: "2026-04-24T00:00:00.000Z",
      updatedAt: "2026-04-24T00:00:00.000Z",
      mode: "maximize",
    },
    nodes: {
      [id]: {
        id,
        type: "end",
        label,
        payoff: 100,
        cost: null,
        time: null,
        expectedValue: 100,
        isOptimal: true,
        parentId: null,
        childIds: [],
        probability: null,
        collapsed: false,
        customFields: {},
      },
    },
  };
}

describe("Excel rendering edge cases", () => {
  it("throws a clear error when the render model is missing a layout node", async () => {
    installFakeExcel();
    const tree = createRootOnlyTree();
    const calc = buildCalculationModel(tree);
    const layout = computeLayout(tree, calc);
    const renderModel = {
      ...buildRenderModel(tree, layout),
      nodes: [],
    };

    await expect(renderToExcel(layout, renderModel, calc, tree)).rejects.toThrow(
      "RenderNodeContent ausente para nodo root"
    );
  });

  it("throws a clear error when a node rect becomes invalid", async () => {
    const { context } = installFakeExcel();
    const tree = createRootOnlyTree();
    const calc = buildCalculationModel(tree);
    const layout = computeLayout(tree, calc);
    const renderModel = buildRenderModel(tree, layout);
    const node = layout.nodes[0];
    const nodeAddress = rangeAddr(node.col, node.row, 1, GRID.nodeRows);
    const originalSync = context.sync.bind(context);
    let invalidated = false;

    context.sync = async () => {
      const treeSheet = getWorksheet(context, TREE_SHEET_NAME);
      const range = treeSheet?.ranges.get(nodeAddress);
      if (range && !invalidated) {
        range.width = 0;
        invalidated = true;
      }
      return originalSync();
    };

    await expect(renderToExcel(layout, renderModel, calc, tree)).rejects.toThrow(
      "NodeRect invalido para nodo root"
    );
  });

  it("does not crash when asked to render an empty tree", async () => {
    const { context } = installFakeExcel();
    const tree: DecisionTreeData = {
      rootId: null,
      metadata: {
        name: "Arbol vacio",
        createdAt: "2026-04-24T00:00:00.000Z",
        updatedAt: "2026-04-24T00:00:00.000Z",
        mode: "maximize",
      },
      nodes: {},
    };
    const calc = buildCalculationModel(tree);
    const layout = computeLayout(tree, calc);
    const renderModel = buildRenderModel(tree, layout);

    await expect(renderToExcel(layout, renderModel, calc, tree)).resolves.toBeUndefined();

    const treeSheet = getWorksheet(context, TREE_SHEET_NAME)!;
    expect(treeSheet.shapes.items).toHaveLength(0);
  });

  it("renders a root-only tree with one marker and no edges", async () => {
    const { context } = installFakeExcel();
    const tree = createRootOnlyTree();
    const calc = buildCalculationModel(tree);
    const layout = computeLayout(tree, calc);
    const renderModel = buildRenderModel(tree, layout);

    await renderToExcel(layout, renderModel, calc, tree);

    const treeSheet = getWorksheet(context, TREE_SHEET_NAME)!;
    expect(treeSheet.shapes.items.filter((shape) => shape.name.startsWith("DT_NODE_"))).toHaveLength(1);
    expect(treeSheet.shapes.items.filter((shape) => shape.name.startsWith("DT_EDGE_"))).toHaveLength(0);
  });

  it("unmerges the calc sheet used range before clearing", async () => {
    const { context } = installFakeExcel();
    const tree = createRootOnlyTree();
    const calc = buildCalculationModel(tree);
    const layout = computeLayout(tree, calc);
    const renderModel = buildRenderModel(tree, layout);

    await renderToExcel(layout, renderModel, calc, tree);

    const calcSheet = getWorksheet(context, CALC_SHEET_NAME)!;
    const mergedRange = calcSheet.getRange("A1:B1") as unknown as { values: unknown[][]; merge: () => void };
    mergedRange.values = [[1, 2]];
    mergedRange.merge();

    await clearShapes();

    expect(getUnmergeCallCount(context, CALC_SHEET_NAME)).toBeGreaterThan(0);
  });

  it("renders shape names for ids with spaces and tildes", async () => {
    const { context } = installFakeExcel();
    const tree = createRootOnlyTree("raiz con tilde á", "Nodo unico");
    const calc = buildCalculationModel(tree);
    const layout = computeLayout(tree, calc);
    const renderModel = buildRenderModel(tree, layout);

    await renderToExcel(layout, renderModel, calc, tree);

    const treeSheet = getWorksheet(context, TREE_SHEET_NAME)!;
    expect(treeSheet.shapes.items.some((shape) => shape.name === "DT_NODE_raiz con tilde á")).toBe(true);
  });
});
