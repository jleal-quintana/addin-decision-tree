import { CalcSheetMetadata, DecisionTreeData } from "../models/types";
import { QUINTANA } from "../rendering/designTokens";
import { cellAddr, colLetter, quoteSheetName, rangeAddr } from "./ExcelAddress";
import { CALC_COLUMNS, CALC_COLUMN_INDEX, CALC_TABLE_NAME } from "./WorkbookConstants";

// La tabla ocupa 2 filas de encabezado (título + columnas) antes de los datos.
const TITLE_ROW_OFFSET = 0;
const HEADER_ROW_OFFSET = 1;
const DATA_ROW_OFFSET = 2;

export interface CalcTablePlacement {
  sheetName: string;
  startRow: number;
  startCol: number;
}

export function flattenTree(tree: DecisionTreeData): string[] {
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

export function buildCalculationModel(
  tree: DecisionTreeData,
  placement: CalcTablePlacement
): CalcSheetMetadata {
  const orderedNodeIds = flattenTree(tree);
  const metadata: CalcSheetMetadata = {
    sheetName: placement.sheetName,
    tableName: CALC_TABLE_NAME,
    nodeRefs: {},
  };

  const sheetPrefix = `${quoteSheetName(placement.sheetName)}!`;

  for (let index = 0; index < orderedNodeIds.length; index++) {
    const nodeId = orderedNodeIds[index];
    const sheetRow = placement.startRow + DATA_ROW_OFFSET + index;
    metadata.nodeRefs[nodeId] = {
      rowIndex: index,
      sheetRow,
      probabilityAddress: `${sheetPrefix}${cellAddr(placement.startCol + CALC_COLUMN_INDEX.Probability, sheetRow)}`,
      costAddress: `${sheetPrefix}${cellAddr(placement.startCol + CALC_COLUMN_INDEX.Cost, sheetRow)}`,
      terminalValueAddress: `${sheetPrefix}${cellAddr(placement.startCol + CALC_COLUMN_INDEX.TerminalValue, sheetRow)}`,
      childrenEvAddress: `${sheetPrefix}${cellAddr(placement.startCol + CALC_COLUMN_INDEX.ChildrenEV, sheetRow)}`,
      netEvAddress: `${sheetPrefix}${cellAddr(placement.startCol + CALC_COLUMN_INDEX.NetEV, sheetRow)}`,
    };
  }

  return metadata;
}

function buildDataRows(tree: DecisionTreeData): (string | number | boolean)[][] {
  const orderedNodeIds = flattenTree(tree);
  return orderedNodeIds.map((nodeId) => {
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
  });
}

/**
 * Escribe la tabla "MEMORIA DE CÁLCULO" en la hoja dada, a partir de la fila/
 * columna indicadas. A diferencia de la versión anterior (que usaba una hoja
 * oculta dedicada), acá NO se toca la visibilidad ni se limpia used range:
 * la tabla convive con el árbol en la misma hoja imprimible.
 */
export async function writeCalculationTable(
  sheet: Excel.Worksheet,
  tree: DecisionTreeData,
  placement: CalcTablePlacement
): Promise<void> {
  const orderedNodeIds = flattenTree(tree);
  const dataRowCount = orderedNodeIds.length;
  const colCount = CALC_COLUMNS.length;
  if (dataRowCount === 0) return;

  const rowByNodeId: Record<string, number> = {};
  for (let index = 0; index < dataRowCount; index++) {
    rowByNodeId[orderedNodeIds[index]] = placement.startRow + DATA_ROW_OFFSET + index;
  }

  const titleRow = placement.startRow + TITLE_ROW_OFFSET;
  const headerRow = placement.startRow + HEADER_ROW_OFFSET;
  const firstDataRow = placement.startRow + DATA_ROW_OFFSET;

  // Título "MEMORIA DE CÁLCULO" (merge across todas las columnas de la tabla).
  const titleRange = sheet.getRange(rangeAddr(placement.startCol, titleRow, colCount, 1));
  titleRange.unmerge();
  if (colCount > 1) titleRange.merge();
  const titleCell = sheet.getCell(titleRow, placement.startCol);
  titleCell.values = [["MEMORIA DE CÁLCULO"]];
  titleRange.format.font.name = "Calibri";
  titleRange.format.font.size = 10;
  titleRange.format.font.bold = true;
  titleRange.format.font.color = QUINTANA.marine;
  titleRange.format.horizontalAlignment = "Left";
  sheet.getRange(rangeAddr(placement.startCol, titleRow, colCount, 1)).format.rowHeight = 16;

  // Header row (nombres de columna)
  const headerRange = sheet.getRange(rangeAddr(placement.startCol, headerRow, colCount, 1));
  headerRange.values = [[...CALC_COLUMNS]];
  headerRange.format.fill.color = QUINTANA.olive;
  headerRange.format.font.name = "Calibri";
  headerRange.format.font.size = 9;
  headerRange.format.font.bold = true;
  headerRange.format.font.color = QUINTANA.paper;
  headerRange.format.horizontalAlignment = "Center";
  sheet.getRange(rangeAddr(placement.startCol, headerRow, colCount, 1)).format.rowHeight = 16;

  // Data rows
  const dataRange = sheet.getRange(
    rangeAddr(placement.startCol, firstDataRow, colCount, dataRowCount)
  );
  dataRange.values = buildDataRows(tree);
  dataRange.format.font.name = "Calibri";
  dataRange.format.font.size = 9;
  dataRange.format.font.color = QUINTANA.ink;

  // Filas alternas (zebra) para legibilidad.
  for (let i = 0; i < dataRowCount; i++) {
    const rowRange = sheet.getRange(
      rangeAddr(placement.startCol, firstDataRow + i, colCount, 1)
    );
    rowRange.format.fill.color = i % 2 === 0 ? QUINTANA.paper : QUINTANA.slateTenue;
  }

  // Fórmulas: ChildrenEV y NetEV. Semántica idéntica al engine TS
  // (ExpectedValueCalculator):
  //   Modo Valor (max):  netEv = childrenEv - cost  (cost resta)
  //   Modo Costo (min):  netEv = childrenEv + cost  (cost suma)
  const costOp = tree.metadata.mode === "minimize" ? "+" : "-";
  for (const nodeId of orderedNodeIds) {
    const node = tree.nodes[nodeId];
    const row = rowByNodeId[nodeId];
    const childrenEvCell = sheet.getRange(
      cellAddr(placement.startCol + CALC_COLUMN_INDEX.ChildrenEV, row)
    );
    const netEvCell = sheet.getRange(
      cellAddr(placement.startCol + CALC_COLUMN_INDEX.NetEV, row)
    );

    if (node.type === "end") {
      childrenEvCell.values = [[""]];
      netEvCell.formulas = [[
        `=N(${sameSheetRef(placement.startCol + CALC_COLUMN_INDEX.TerminalValue, row)})${costOp}N(${sameSheetRef(placement.startCol + CALC_COLUMN_INDEX.Cost, row)})`,
      ]];
      continue;
    }

    if (node.type === "chance") {
      const weightedTerms = node.childIds
        .filter((childId) => rowByNodeId[childId] !== undefined)
        .map((childId) => {
          const childRow = rowByNodeId[childId];
          return `${sameSheetRef(placement.startCol + CALC_COLUMN_INDEX.Probability, childRow)}*${sameSheetRef(placement.startCol + CALC_COLUMN_INDEX.NetEV, childRow)}`;
        });
      childrenEvCell.formulas = [[
        weightedTerms.length > 0 ? `=SUM(${weightedTerms.join(",")})` : "=0",
      ]];
    } else {
      const childNetRefs = node.childIds
        .filter((childId) => rowByNodeId[childId] !== undefined)
        .map((childId) =>
          sameSheetRef(placement.startCol + CALC_COLUMN_INDEX.NetEV, rowByNodeId[childId])
        );
      const fn = tree.metadata.mode === "minimize" ? "MIN" : "MAX";
      childrenEvCell.formulas = [[
        childNetRefs.length > 0 ? `=${fn}(${childNetRefs.join(",")})` : "=0",
      ]];
    }

    netEvCell.formulas = [[
      `=${sameSheetRef(placement.startCol + CALC_COLUMN_INDEX.ChildrenEV, row)}${costOp}N(${sameSheetRef(placement.startCol + CALC_COLUMN_INDEX.Cost, row)})`,
    ]];
  }

  // Columnas de valores derivados (OptimalChildId, IsOptimalPath) — valores
  // literales. No son fórmulas porque el engine TS ya decidió la optimalidad
  // antes del render; recomputarla en Excel sería complejidad innecesaria.
  for (let index = 0; index < dataRowCount; index++) {
    const nodeId = orderedNodeIds[index];
    const row = firstDataRow + index;
    const node = tree.nodes[nodeId];

    // OptimalChildId solo aplica a nodos de decisión: en chance no se "elige"
    // un hijo, todos pueden ocurrir según probabilidad.
    const optimalChildIdValue = node.type === "decision"
      ? node.childIds.find((childId) => tree.nodes[childId]?.isOptimal) ?? ""
      : "";
    sheet.getRange(
      cellAddr(placement.startCol + CALC_COLUMN_INDEX.OptimalChildId, row)
    ).values = [[optimalChildIdValue]];
    sheet.getRange(
      cellAddr(placement.startCol + CALC_COLUMN_INDEX.IsOptimalPath, row)
    ).values = [[node.isOptimal]];
  }

  // Number formats por columna
  sheet.getRange(
    rangeAddr(
      placement.startCol + CALC_COLUMN_INDEX.Probability,
      firstDataRow,
      1,
      dataRowCount
    )
  ).numberFormat = orderedNodeIds.map(() => ["0.0%"]);

  for (const moneyColumn of [
    CALC_COLUMN_INDEX.Cost,
    CALC_COLUMN_INDEX.TerminalValue,
    CALC_COLUMN_INDEX.ChildrenEV,
    CALC_COLUMN_INDEX.NetEV,
  ]) {
    sheet.getRange(
      rangeAddr(
        placement.startCol + moneyColumn,
        firstDataRow,
        1,
        dataRowCount
      )
    ).numberFormat = orderedNodeIds.map(() => ["$#,##0"]);
  }

  // Resaltar filas del camino óptimo con lime tenue (pisa el zebra).
  for (let i = 0; i < dataRowCount; i++) {
    const nodeId = orderedNodeIds[i];
    if (tree.nodes[nodeId].isOptimal) {
      const rowRange = sheet.getRange(
        rangeAddr(placement.startCol, firstDataRow + i, colCount, 1)
      );
      rowRange.format.fill.color = QUINTANA.limeTenue;
      rowRange.format.font.bold = true;
    }
  }
}

/**
 * Devuelve cuántas filas ocupa la tabla (título + header + datos) para que el
 * renderer sepa dónde posicionar lo que viene después (footer, etc).
 */
export function calculationTableRowCount(tree: DecisionTreeData): number {
  const dataRowCount = flattenTree(tree).length;
  return DATA_ROW_OFFSET + dataRowCount;
}
