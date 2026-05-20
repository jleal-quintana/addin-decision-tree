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
  startRow: 7,
  startCol: 1,
  // Branch-style renderer: each node block keeps one visual marker cell plus
  // enough label/value cells to avoid text colliding with the geometry.
  nodeRows: 3,
  nodeCols: 6,
  rowGap: 2,
  colGap: 2,
};

export function resolveGridProfile(overrides?: Partial<GridProfile>): GridProfile {
  return { ...GRID, ...overrides };
}

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
