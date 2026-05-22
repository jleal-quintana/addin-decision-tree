import type { Dispatch } from "react";

type TreeAction =
  | { type: "SELECT_NODE"; nodeId: string | null }
  | { type: "SET_TAB"; tab: "build" | "results" };

export function focusNodeInTree(dispatch: Dispatch<TreeAction>, nodeId: string) {
  dispatch({ type: "SET_TAB", tab: "build" });
  dispatch({ type: "SELECT_NODE", nodeId });

  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLElement>(`[data-node-id="${cssEscape(nodeId)}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/["\\]/g, "\\$&");
}
