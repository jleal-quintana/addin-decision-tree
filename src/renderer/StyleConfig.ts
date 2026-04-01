import { NodeType } from "../models/types";

export const SHAPE_PREFIX = "DT_";

export const GRID = {
  startRow: 2,
  startCol: 1,
  nodeRows: 2,
  nodeCols: 3,
  rowGap: 4,
  colGap: 5,
};

export const COL_WIDTH = 8.5;
export const ROW_HEIGHT = 22;

export interface NodeCellStyle {
  headerBg: string;
  headerFont: string;
  valueBg: string;
  valueFont: string;
  borderColor: string;
}

export const NODE_CELL_STYLES: Record<NodeType, NodeCellStyle> = {
  decision: {
    headerBg: "#7ABF45",
    headerFont: "#111111",
    valueBg: "#D7F0B8",
    valueFont: "#111111",
    borderColor: "#111111",
  },
  chance: {
    headerBg: "#111111",
    headerFont: "#FFFFFF",
    valueBg: "#FFFFFF",
    valueFont: "#111111",
    borderColor: "#111111",
  },
  end: {
    headerBg: "#F3F3F3",
    headerFont: "#111111",
    valueBg: "#FFFFFF",
    valueFont: "#111111",
    borderColor: "#111111",
  },
};

export const EDGE_COLORS = {
  normal: "#111111",
  optimal: "#6B7B38",
  normalWeight: 3,
  optimalWeight: 3.5,
};

export const OPTIMAL_BORDER_COLOR = "#6B7B38";
