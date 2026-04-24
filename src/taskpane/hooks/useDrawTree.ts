import { useCallback, useState } from "react";
import { renderTreeToExcel } from "../../excel/ShapeManager";
import { validate } from "../../models/DecisionTree";
import { DecisionTreeData } from "../../models/types";
import { useTree } from "../context/TreeContext";

type ToastFn = (title: string, body: string, intent?: "success" | "error" | "info") => void;

export interface DrawTreeApi {
  drawing: boolean;
  renderError: string | null;
  drawCurrent: () => Promise<void>;
  loadAndDraw: (exampleFn: () => DecisionTreeData, name: string) => Promise<void>;
  clearRenderError: () => void;
}

export function useDrawTree(showToast: ToastFn): DrawTreeApi {
  const { state, dispatch } = useTree();
  const [drawing, setDrawing] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  const drawCurrent = useCallback(async () => {
    if (drawing) return;
    const errors = validate(state.tree);
    if (errors.length > 0) {
      setRenderError(errors[0].message);
      showToast("Error", errors[0].message, "error");
      return;
    }

    setRenderError(null);
    setDrawing(true);
    try {
      await renderTreeToExcel(state.tree);
      showToast("Listo", "Arbol dibujado en Excel", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRenderError(message || "Error al dibujar");
      showToast("Error", message || "Error al dibujar", "error");
    } finally {
      setDrawing(false);
    }
  }, [drawing, showToast, state.tree]);

  const loadAndDraw = useCallback(
    async (exampleFn: () => DecisionTreeData, name: string) => {
      if (drawing) return;
      const data = exampleFn();
      dispatch({ type: "LOAD_EXAMPLE", data });
      setRenderError(null);
      setDrawing(true);
      try {
        await renderTreeToExcel(data);
        showToast("Listo", `${name} dibujado`, "success");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setRenderError(message || "Error al dibujar ejemplo");
        showToast("Error", message || "Error al dibujar ejemplo", "error");
      } finally {
        setDrawing(false);
      }
    },
    [dispatch, drawing, showToast]
  );

  const clearRenderError = useCallback(() => setRenderError(null), []);

  return { drawing, renderError, drawCurrent, loadAndDraw, clearRenderError };
}
