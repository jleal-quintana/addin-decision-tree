import { getOptimalChildId } from "../engine/RollbackAnalysis";
import { DecisionTreeData, LayoutResult, RenderModel } from "../models/types";
import { EXCEL_RENDER_PROFILE } from "./designTokens";
import {
  buildEdgeLabel,
  buildNodeNoteLines,
  buildNodePrimaryValue,
  buildNodeSecondaryLines,
  buildNodeTitle,
  formatCurrency,
  formatPrimaryMetricLabel,
} from "./labelFormatter";

export function buildRenderModel(tree: DecisionTreeData, layout: LayoutResult): RenderModel {
  const layoutNodeById = Object.fromEntries(layout.nodes.map((node) => [node.id, node]));
  const rootNode = tree.rootId ? tree.nodes[tree.rootId] : null;
  const summaryValue = rootNode?.expectedValue ?? null;

  const nodes = layout.nodes.map((node) => ({
    id: node.id,
    title: buildNodeTitle(node),
    primaryValue: buildNodePrimaryValue(tree, node),
    secondaryLines: buildNodeSecondaryLines(tree, node),
    noteLines: buildNodeNoteLines(node),
    type: node.type,
    isOptimal: node.isOptimal,
    isLeaf: node.isLeaf,
  }));

  const edges = layout.edges.map((edge) => ({
    fromId: edge.fromId,
    toId: edge.toId,
    label: buildEdgeLabel(edge, layoutNodeById[edge.toId]),
    isOptimal: edge.isOptimal,
  }));

  const evMap = Object.fromEntries(
    Object.entries(tree.nodes).map(([id, node]) => [id, node.expectedValue])
  );
  const recommendedChildId =
    tree.rootId !== null ? getOptimalChildId(tree, tree.rootId, evMap) : null;

  return {
    nodes,
    edges,
    profile: EXCEL_RENDER_PROFILE,
    summary: rootNode
      ? {
          title: tree.metadata.mode === "minimize" ? "Resumen de costo" : "Resumen de valor",
          rootValue: `${formatPrimaryMetricLabel(tree)} del árbol: ${formatCurrency(summaryValue)}`,
          recommendedAction: `Elegir: ${recommendedChildId ? tree.nodes[recommendedChildId]?.label ?? "-" : "-"}`,
        }
      : null,
  };
}
