import {
  CalcSheetMetadata,
  DecisionTreeData,
  LayoutEdge,
  LayoutNode,
  LayoutResult,
} from "../models/types";
import { GridProfile, resolveGridProfile } from "./StyleConfig";

export interface LayoutOptions {
  grid?: Partial<GridProfile>;
}

/**
 * Grid-based left-to-right decision tree layout.
 * Outputs (row, col) positions for rendering nodes as Excel cell blocks.
 * Leaves get sequential row slots; parents center vertically on their children.
 */
export function computeLayout(
  tree: DecisionTreeData,
  calcSheet?: CalcSheetMetadata,
  options: LayoutOptions = {}
): LayoutResult {
  const grid = resolveGridProfile(options.grid);

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
      rowOf[nodeId] = grid.startRow + nextLeafSlot * (grid.nodeRows + grid.rowGap);
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
    const col = grid.startCol + depth * (grid.nodeCols + grid.colGap);
    const row = rowOf[nodeId] ?? 0;

    layoutNodes.push({
      id: node.id,
      row,
      col,
      midRow: row + Math.floor(grid.nodeRows / 2),
      calcRow: calcSheet?.nodeRefs[node.id]?.sheetRow ?? null,
      type: node.type,
      label: node.label,
      branchLabel: node.branchLabel ?? null,
      expectedValue: node.expectedValue,
      payoff: node.payoff,
      cost: node.cost,
      time: node.time,
      probability: node.probability,
      isOptimal: node.isOptimal,
      isLeaf: node.childIds.length === 0 || node.type === "end",
      customFields: node.customFields ?? {},
    });

    maxRow = Math.max(maxRow, row + grid.nodeRows);
    maxCol = Math.max(maxCol, col + grid.nodeCols);

    for (const cid of node.childIds) {
      const child = tree.nodes[cid];
      if (!child) continue;

      const childCol = grid.startCol + (depth + 1) * (grid.nodeCols + grid.colGap);
      const childRow = rowOf[cid] ?? 0;

      layoutEdges.push({
        fromId: node.id,
        toId: child.id,
        fromRow: row,
        fromCol: col,
        fromMidRow: row + Math.floor(grid.nodeRows / 2),
        toRow: childRow,
        toCol: childCol,
        toMidRow: childRow + Math.floor(grid.nodeRows / 2),
        connectorCol: Math.min(
          childCol - 1,
          col + grid.nodeCols + Math.max(0, Math.floor(grid.colGap / 2))
        ),
        calcRow: calcSheet?.nodeRefs[child.id]?.sheetRow ?? null,
        label: child.branchLabel || child.label,
        probability: child.probability,
        isOptimal: node.isOptimal && child.isOptimal,
      });

      build(cid);
    }
  }

  build(tree.rootId);

  return { nodes: layoutNodes, edges: layoutEdges, maxRow, maxCol };
}
