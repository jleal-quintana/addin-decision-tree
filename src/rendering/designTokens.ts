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
  titleChars: 24,
  secondaryLineChars: 28,
  noteLineChars: 30,
  maxSecondaryLines: 2,
  maxNoteLines: 2,
};

export const RENDER_TOKENS = {
  decision: {
    fill: "#33492D",
    border: "#1B4B6C",
    text: "#FFFFFF",
  },
  chance: {
    fill: "#DAE0E5",
    border: "#1B4B6C",
    text: "#1A1A1A",
  },
  end: {
    fill: "#FFEAC6",
    border: "#AD977D",
    text: "#1A1A1A",
  },
  accent: "#6B7B38",
  edge: "#1B4B6C",
  muted: "#5A5A5A",
  previewBg: "#F7F8F9",
};
