import { RenderProfile } from "../models/types";

export const EXCEL_RENDER_PROFILE: RenderProfile = {
  nodeWidthPx: 170,
  nodeHeightPx: 96,
  noteHeightPx: 34,
  horizontalGapPx: 90,
  verticalGapPx: 70,
  edgeLabelWidthPx: 112,
};

export const PREVIEW_CELL = {
  width: 34,
  height: 18,
};

export const RENDER_LIMITS = {
  titleChars: 36,
  secondaryLineChars: 28,
  noteLineChars: 30,
  maxSecondaryLines: 2,
  maxNoteLines: 2,
};

/**
 * Paleta oficial Quintana (DESIGN.md §3.1). Todos los colores del add-in salen
 * de acá para no perder consistencia con el manual de marca.
 */
export const QUINTANA = {
  olive: "#6B7B38",
  forest: "#33492D",
  marine: "#1B4B6C",
  lime: "#E2FF87",
  limeTenue: "#F3FFE0",
  cream: "#FFEAC6",
  slate: "#DAE0E5",
  slateTenue: "#EEF1F3",
  beige: "#AD977D",
  paper: "#FFFFFF",
  ink: "#1A1A1A",
  inkMuted: "#5B6470",
};

export const RENDER_TOKENS = {
  decision: {
    fill: QUINTANA.olive,
    border: QUINTANA.forest,
    text: QUINTANA.paper,
  },
  chance: {
    fill: QUINTANA.paper,
    border: QUINTANA.marine,
    text: QUINTANA.ink,
  },
  end: {
    fill: QUINTANA.cream,
    border: QUINTANA.beige,
    text: QUINTANA.ink,
  },
  accent: QUINTANA.olive,
  edge: QUINTANA.marine,
  muted: QUINTANA.inkMuted,
  previewBg: QUINTANA.slateTenue,
};
