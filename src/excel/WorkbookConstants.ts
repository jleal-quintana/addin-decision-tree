export const TREE_SHEET_NAME = "Arbol_Decision";
export const DATA_SHEET_NAME = "DT_Data";
export const CALC_SHEET_NAME = "DT_Calculos";
export const DEBUG_SHEET_NAME = "DT_DebugLog";
export const CALC_TABLE_NAME = "DT_Nodes";

export const CALC_COLUMNS = [
  "NodeId",
  "ParentId",
  "Depth",
  "Type",
  "Label",
  "Probability",
  "Cost",
  "TerminalValue",
  "ChildrenEV",
  "NetEV",
  "OptimalChildId",
  "IsOptimalPath",
] as const;

export type CalcColumnName = (typeof CALC_COLUMNS)[number];

export const CALC_COLUMN_INDEX: Record<CalcColumnName, number> = {
  NodeId: 0,
  ParentId: 1,
  Depth: 2,
  Type: 3,
  Label: 4,
  Probability: 5,
  Cost: 6,
  TerminalValue: 7,
  ChildrenEV: 8,
  NetEV: 9,
  OptimalChildId: 10,
  IsOptimalPath: 11,
};

export const CALC_TABLE_START_ROW = 2;
export const CALC_TABLE_START_COL = 60;
