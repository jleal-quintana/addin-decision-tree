import { CalcSheetMetadata, DecisionTreeData } from "../models/types";
import { cellAddr, colLetter, quoteSheetName, rangeAddr } from "./ExcelAddress";
import {
  CALC_COLUMNS,
  CALC_COLUMN_INDEX,
  CALC_TABLE_NAME,
  CALC_TABLE_START_COL,
  CALC_TABLE_START_ROW,
  TREE_SHEET_NAME,
} from "./WorkbookConstants";

function flattenTree(tree: DecisionTreeData): string[] {
  const ordered: string[] = [];
  if (!tree.rootId) return ordered;

  function walk(nodeId: string) {
    const node = tree.nodes[nodeId];
    if (!node) return;
    ordered.push(nodeId);
    for (const childId of node.childIds) {
      walk(childId);
    }
  }

  walk(tree.rootId);
  return ordered;
}

function getDepth(tree: DecisionTreeData, nodeId: string): number {
  let depth = 0;
  let cursor = tree.nodes[nodeId];
  while (cursor?.parentId) {
    depth += 1;
    cursor = tree.nodes[cursor.parentId];
  }
  return depth;
}

function sameSheetRef(col: number, row: number): string {
  return `$${colLetter(col)}$${row + 1}`;
}

export function buildCalculationModel(tree: DecisionTreeData): CalcSheetMetadata {
  const orderedNodeIds = flattenTree(tree);
  const metadata: CalcSheetMetadata = {
    sheetName: TREE_SHEET_NAME,
    tableName: CALC_TABLE_NAME,
    nodeRefs: {},
  };

  for (let index = 0; index < orderedNodeIds.length; index++) {
    const nodeId = orderedNodeIds[index];
    const sheetRow = CALC_TABLE_START_ROW + 1 + index;
    metadata.nodeRefs[nodeId] = {
      rowIndex: index,
      sheetRow,
      probabilityAddress: `${quoteSheetName(TREE_SHEET_NAME)}!${cellAddr(CALC_TABLE_START_COL + CALC_COLUMN_INDEX.Probability, sheetRow)}`,
      costAddress: `${quoteSheetName(TREE_SHEET_NAME)}!${cellAddr(CALC_TABLE_START_COL + CALC_COLUMN_INDEX.Cost, sheetRow)}`,
      terminalValueAddress: `${quoteSheetName(TREE_SHEET_NAME)}!${cellAddr(CALC_TABLE_START_COL + CALC_COLUMN_INDEX.TerminalValue, sheetRow)}`,
      childrenEvAddress: `${quoteSheetName(TREE_SHEET_NAME)}!${cellAddr(CALC_TABLE_START_COL + CALC_COLUMN_INDEX.ChildrenEV, sheetRow)}`,
      netEvAddress: `${quoteSheetName(TREE_SHEET_NAME)}!${cellAddr(CALC_TABLE_START_COL + CALC_COLUMN_INDEX.NetEV, sheetRow)}`,
    };
  }

  return metadata;
}

export function writeCalculationModel(
  sheet: Excel.Worksheet,
  tree: DecisionTreeData,
  metadata: CalcSheetMetadata
): void {
  const orderedNodeIds = flattenTree(tree);
  const rowCount = orderedNodeIds.length + 1;
  const colCount = CALC_COLUMNS.length;
  const rowByNodeId: Record<string, number> = {};

  for (let index = 0; index < orderedNodeIds.length; index++) {
    rowByNodeId[orderedNodeIds[index]] = CALC_TABLE_START_ROW + 1 + index;
  }

  const tableAddress = rangeAddr(
    CALC_TABLE_START_COL,
    CALC_TABLE_START_ROW,
    colCount,
    rowCount
  );

  const baseValues: (string | number | boolean)[][] = [
    [...CALC_COLUMNS],
    ...orderedNodeIds.map((nodeId) => {
      const node = tree.nodes[nodeId];
      return [
        node.id,
        node.parentId ?? "",
        getDepth(tree, node.id),
        node.type,
        node.label,
        node.probability ?? "",
        node.cost ?? "",
        node.type === "end" ? node.payoff ?? 0 : "",
        "",
        "",
        "",
        node.isOptimal,
      ];
    }),
  ];

  sheet.getRange(tableAddress).values = baseValues;
  const tableRange = sheet.getRange(tableAddress);
  tableRange.format.font.name = "Inter";
  tableRange.format.font.size = 9;
  sheet.getRange(
    `${cellAddr(CALC_TABLE_START_COL, 0)}:${cellAddr(CALC_TABLE_START_COL + colCount - 1, 0)}`
  ).getEntireColumn().columnHidden = true;

  for (const nodeId of orderedNodeIds) {
    const node = tree.nodes[nodeId];
    const row = rowByNodeId[nodeId];
    const childrenEvCell = sheet.getRange(cellAddr(CALC_TABLE_START_COL + CALC_COLUMN_INDEX.ChildrenEV, row));
    const netEvCell = sheet.getRange(cellAddr(CALC_TABLE_START_COL + CALC_COLUMN_INDEX.NetEV, row));

    if (node.type === "end") {
      childrenEvCell.values = [[""]];
      netEvCell.formulas = [[
        `=N(${sameSheetRef(CALC_TABLE_START_COL + CALC_COLUMN_INDEX.TerminalValue, row)})-N(${sameSheetRef(CALC_TABLE_START_COL + CALC_COLUMN_INDEX.Cost, row)})`,
      ]];
    } else {
      const childNetRefs = node.childIds
        .filter((childId) => rowByNodeId[childId] !== undefined)
        .map((childId) => sameSheetRef(CALC_TABLE_START_COL + CALC_COLUMN_INDEX.NetEV, rowByNodeId[childId]));

      if (node.type === "chance") {
        const weightedTerms = node.childIds
          .filter((childId) => rowByNodeId[childId] !== undefined)
          .map((childId) => {
            const childRow = rowByNodeId[childId];
            return `${sameSheetRef(CALC_TABLE_START_COL + CALC_COLUMN_INDEX.Probability, childRow)}*${sameSheetRef(CALC_TABLE_START_COL + CALC_COLUMN_INDEX.NetEV, childRow)}`;
          });
        childrenEvCell.formulas = [[weightedTerms.length > 0 ? `=SUM(${weightedTerms.join(",")})` : "=0"]];
      } else {
        const fn = tree.metadata.mode === "minimize" ? "MIN" : "MAX";
        childrenEvCell.formulas = [[childNetRefs.length > 0 ? `=${fn}(${childNetRefs.join(",")})` : "=0"]];
      }

      netEvCell.formulas = [[
        `=${sameSheetRef(CALC_TABLE_START_COL + CALC_COLUMN_INDEX.ChildrenEV, row)}-N(${sameSheetRef(CALC_TABLE_START_COL + CALC_COLUMN_INDEX.Cost, row)})`,
      ]];
    }
  }

  for (let index = 0; index < orderedNodeIds.length; index++) {
    const nodeId = orderedNodeIds[index];
    const row = CALC_TABLE_START_ROW + 1 + index;
    const node = tree.nodes[nodeId];

    sheet.getRange(cellAddr(CALC_TABLE_START_COL + CALC_COLUMN_INDEX.OptimalChildId, row)).values = [[
      node.childIds.find((childId) => tree.nodes[childId]?.isOptimal) ?? "",
    ]];
    sheet.getRange(cellAddr(CALC_TABLE_START_COL + CALC_COLUMN_INDEX.IsOptimalPath, row)).values = [[
      node.isOptimal,
    ]];
  }

  sheet.getRange(
    rangeAddr(
      CALC_TABLE_START_COL + CALC_COLUMN_INDEX.Probability,
      CALC_TABLE_START_ROW + 1,
      1,
      orderedNodeIds.length
    )
  ).numberFormat = orderedNodeIds.map(() => ["0.0%"]);

  for (const moneyColumn of [
    CALC_COLUMN_INDEX.Cost,
    CALC_COLUMN_INDEX.TerminalValue,
    CALC_COLUMN_INDEX.ChildrenEV,
    CALC_COLUMN_INDEX.NetEV,
  ]) {
    sheet.getRange(
      rangeAddr(CALC_TABLE_START_COL + moneyColumn, CALC_TABLE_START_ROW + 1, 1, orderedNodeIds.length)
    ).numberFormat = orderedNodeIds.map(() => ["$#,##0"]);
  }
}
