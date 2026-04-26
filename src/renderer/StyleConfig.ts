import { QUINTANA } from "../rendering/designTokens";

export interface GridProfile {
  startRow: number;
  startCol: number;
  nodeRows: number;
  nodeCols: number;
  rowGap: number;
  colGap: number;
}

export const SHAPE_PREFIX = "DT_";

/**
 * El documento empieza con 5 filas de header (logo/título/autor), así que el
 * árbol arranca en la fila 6 (startRow=6). Ver DESIGN.md §5.1.
 */
export const GRID: GridProfile = {
  startRow: 6,
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
  normal: QUINTANA.marine,
  optimal: QUINTANA.olive,
  // Excel ShapeLineFormat.weight rechaza floats con "argument invalid" en
  // Excel Win32 16.x — debe ser entero (puntos de espesor).
  normalWeight: 2,
  optimalWeight: 3,
};

export const OPTIMAL_BORDER_COLOR = QUINTANA.olive;
