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
  nodeCols: 5,
  rowGap: 5,
  colGap: 7,
};

export function resolveGridProfile(overrides?: Partial<GridProfile>): GridProfile {
  return { ...GRID, ...overrides };
}

export const COL_WIDTH = 15;
export const ROW_HEIGHT = 24;

export const EDGE_COLORS = {
  normal: "#1B4B6C",
  optimal: "#6B7B38",
  normalWeight: 2,
  optimalWeight: 3,
};

export const OPTIMAL_BORDER_COLOR = "#6B7B38";
