import React, { useCallback, useEffect, useRef, useState } from "react";
import { workoverExample, oilDrillingExample, productLaunchExample } from "../../engine/Examples";
import { clearShapes, renderTreeToExcel } from "../../excel/ShapeManager";
import { loadFromWorkbook, saveToWorkbook } from "../../excel/WorkbookState";
import { validate } from "../../models/DecisionTree";
import { useTree } from "../context/TreeContext";

interface ToolbarProps {
  showToast: (title: string, body: string, intent?: "success" | "error" | "info") => void;
}

export function Toolbar({ showToast }: ToolbarProps) {
  const { state, dispatch } = useTree();
  const [showExamples, setShowExamples] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowExamples(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleDraw = useCallback(async () => {
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
      setRenderError(null);
      showToast("Listo", "Arbol dibujado en Excel", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRenderError(message || "Error al dibujar");
      showToast("Error", message || "Error al dibujar", "error");
    } finally {
      setDrawing(false);
    }
  }, [showToast, state.tree]);

  const handleSave = useCallback(async () => {
    try {
      await saveToWorkbook(state.tree);
      showToast("Guardado", "Datos guardados en el libro", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast("Error", message || "Error al guardar", "error");
    }
  }, [showToast, state.tree]);

  const handleLoad = useCallback(async () => {
    try {
      const data = await loadFromWorkbook();
      if (data) {
        dispatch({ type: "SET_TREE", data });
        showToast("Cargado", "Arbol restaurado", "success");
      } else {
        showToast("Info", "No hay datos guardados", "info");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast("Error", message || "Error al cargar", "error");
    }
  }, [dispatch, showToast]);

  const handleClear = useCallback(async () => {
    try {
      await clearShapes();
      showToast("Limpio", "Se limpio la hoja del arbol", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast("Error", message || "Error al limpiar", "error");
    }
  }, [showToast]);

  const handleNew = useCallback(() => {
    dispatch({ type: "CLEAR_TREE" });
  }, [dispatch]);

  const loadAndDraw = useCallback(
    async (exampleFn: () => ReturnType<typeof oilDrillingExample>, name: string) => {
      if (drawing) return;

      const data = exampleFn();
      dispatch({ type: "LOAD_EXAMPLE", data });
      setShowExamples(false);
      setRenderError(null);
      setDrawing(true);

      try {
        await renderTreeToExcel(data);
        setRenderError(null);
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

  return (
    <div className="toolbar-stack">
      {renderError && (
        <div className="toolbar-message toolbar-message-error" role="alert">
          Error al dibujar: {renderError}
        </div>
      )}

      <div className="toolbar">
        <button className="btn" onClick={handleNew}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 2h7l3 3v9H3z" />
            <path d="M7 2v4h4" />
          </svg>
          Nuevo
        </button>
        <button className="btn primary" onClick={handleDraw} disabled={drawing}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 14l3-1 8-8-2-2-8 8z" />
            <path d="M10 4l2 2" />
          </svg>
          {drawing ? "Dibujando..." : "Dibujar en Excel"}
        </button>
        <div className="separator" />
        <button className="btn" onClick={handleSave}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 2h8l2 2v10H3z" />
            <path d="M5 2v4h5V2" />
            <path d="M5 14v-4h6v4" />
          </svg>
          Guardar
        </button>
        <button className="btn" onClick={handleLoad}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 4h12v9H2z" />
            <path d="M5 1h6v3H5z" />
          </svg>
          Cargar
        </button>
        <button className="btn" onClick={handleClear}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
          Limpiar
        </button>
        <div style={{ position: "relative" }} ref={menuRef}>
          <button className="btn" onClick={() => setShowExamples((value) => !value)}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 3h12M2 8h12M2 13h8" />
            </svg>
            Ejemplos
          </button>
          {showExamples && (
            <div className="dropdown-menu">
              <button
                className="dropdown-item"
                onClick={() => loadAndDraw(oilDrillingExample, "Perforacion de Pozo")}
              >
                Perforacion de Pozo
                <span className="desc">Carga, calcula y dibuja automaticamente</span>
              </button>
              <button
                className="dropdown-item"
                onClick={() => loadAndDraw(productLaunchExample, "Lanzamiento de Producto")}
              >
                Lanzamiento de Producto
                <span className="desc">Carga, calcula y dibuja automaticamente</span>
              </button>
              <button
                className="dropdown-item"
                onClick={() => loadAndDraw(workoverExample, "Workover de Pozo")}
              >
                Workover de Pozo
                <span className="desc">Minimizar costo · Oil &amp; Gas</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
