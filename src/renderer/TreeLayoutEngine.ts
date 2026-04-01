import {
  CalcSheetMetadata,
  DecisionTreeData,
  LayoutEdge,
  LayoutNode,
  LayoutResult,
} from "../models/types";
import { GRID } from "./StyleConfig";

/**
 * Grid-based left-to-right decision tree layout.
 * Outputs (row, col) positions for rendering nodes as Excel cell blocks.
 * Leaves get sequential row slots; parents center vertically on their children.
 */
export function computeLayout(
  tree: DecisionTreeData,
  calcSheet?: CalcSheetMetadata
): LayoutResult {
  if (!tree.rootId || !tree.nodes[tree.rootId]) {
    return { nodes: [], edges: [], maxRow: 0, maxCol: 0 };
  }

  const layoutNodes: LayoutNode[] = [];
  const layoutEdges: LayoutEdge[] = [];
  let nextLeafSlot = 0;
  const rowOf: Record<string, number> = {};

  function getDepth(id: string): number {
    let d = 0, cur = tree.nodes[id];
    while (cur?.parentId) { d++; cur = tree.nodes[cur.parentId]; }
    return d;
  }

  // Post-order: assign row positions (leaves first, then parents centered)
  function assignRows(nodeId: string): void {
    const node = tree.nodes[nodeId];
    if (!node) return;

    if (node.childIds.length === 0 || node.type === "end") {
      rowOf[nodeId] = GRID.startRow + nextLeafSlot * (GRID.nodeRows + GRID.rowGap);
      nextLeafSlot++;
      return;
    }

    for (const cid of node.childIds) assignRows(cid);

    const firstRow = rowOf[node.childIds[0]] ?? 0;
    const lastRow = rowOf[node.childIds[node.childIds.length - 1]] ?? 0;
    rowOf[nodeId] = Math.round((firstRow + lastRow) / 2);
  }

  assignRows(tree.rootId);

  let maxRow = 0;
  let maxCol = 0;

  function build(nodeId: string): void {
    const node = tree.nodes[nodeId];
    if (!node) return;

    const depth = getDepth(nodeId);
    const col = GRID.startCol + depth * (GRID.nodeCols + GRID.colGap);
    const row = rowOf[nodeId] ?? 0;

    layoutNodes.push({
      id: node.id,
      row,
      col,
      midRow: row + Math.floor(GRID.nodeRows / 2),
      calcRow: calcSheet?.nodeRefs[node.id]?.sheetRow ?? null,
      type: node.type,
      label: node.label,
      expectedValue: node.expectedValue,
      payoff: node.payoff,
      cost: node.cost,
      time: node.time,
      probability: node.probability,
      isOptimal: node.isOptimal,
      isLeaf: node.childIds.length === 0 || node.type === "end",
      customFields: node.customFields ?? {},
    });

    maxRow = Math.max(maxRow, row + GRID.nodeRows);
    maxCol = Math.max(maxCol, col + GRID.nodeCols);

    for (const cid of node.childIds) {
      const child = tree.nodes[cid];
      if (!child) continue;

      const childCol = GRID.startCol + (depth + 1) * (GRID.nodeCols + GRID.colGap);
      const childRow = rowOf[cid] ?? 0;

      layoutEdges.push({
        fromId: node.id,
        toId: child.id,
        fromRow: row,
        fromCol: col,
        fromMidRow: row + Math.floor(GRID.nodeRows / 2),
        toRow: childRow,
        toCol: childCol,
        toMidRow: childRow + Math.floor(GRID.nodeRows / 2),
        connectorCol: col + GRID.nodeCols + Math.max(1, Math.floor(GRID.colGap / 2)),
        calcRow: calcSheet?.nodeRefs[child.id]?.sheetRow ?? null,
        label: child.label,
        probability: child.probability,
        isOptimal: node.isOptimal && child.isOptimal,
      });

      build(cid);
    }
  }

  build(tree.rootId);

  return { nodes: layoutNodes, edges: layoutEdges, maxRow, maxCol };
}
