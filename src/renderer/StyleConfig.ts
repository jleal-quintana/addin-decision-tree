export interface GridProfile {
  startRow: number;
  startCol: number;
  nodeRows: number;
  nodeCols: number;
  rowGap: number;
  colGap: number;
}

export const SHAPE_PREFIX = "DT_";

export const GRID: GridProfile = {
  startRow: 3,
  startCol: 1,
  nodeRows: 4,
  nodeCols: 4,
  rowGap: 3,
  colGap: 5,
};

export function resolveGridProfile(overrides?: Partial<GridProfile>): GridProfile {
  return { ...GRID, ...overrides };
}

export const COL_WIDTH = 9;
export const ROW_HEIGHT = 20;

export const SHAPE_ROW_HEIGHT = 36;

export const EDGE_COLORS = {
  normal: "#1B4B6C",
  optimal: "#6B7B38",
  normalWeight: 2,
  optimalWeight: 3,
};

export const OPTIMAL_BORDER_COLOR = "#6B7B38";
