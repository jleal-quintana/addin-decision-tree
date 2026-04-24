import React, { useCallback, useEffect, useRef, useState } from "react";
import { workoverExample, oilDrillingExample, productLaunchExample } from "../../engine/Examples";
import { clearShapes } from "../../excel/ShapeManager";
import { loadFromWorkbook, saveToWorkbook } from "../../excel/WorkbookState";
import { useTree } from "../context/TreeContext";
import type { DrawTreeApi } from "../hooks/useDrawTree";

interface ToolbarProps {
  showToast: (title: string, body: string, intent?: "success" | "error" | "info") => void;
  drawApi: DrawTreeApi;
}

export function Toolbar({ showToast, drawApi }: ToolbarProps) {
  const { state, dispatch } = useTree();
  const [showExamples, setShowExamples] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const hasTree = !!state.tree.rootId;
  const { drawing, renderError, drawCurrent, loadAndDraw, clearRenderError } = drawApi;

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowExamples(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!hasTree) setShowExamples(false);
  }, [hasTree]);

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
        clearRenderError();
        showToast("Cargado", "Análisis restaurado", "success");
      } else {
        showToast("Info", "No hay datos guardados", "info");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast("Error", message || "Error al cargar", "error");
    }
  }, [clearRenderError, dispatch, showToast]);

  const handleClear = useCallback(async () => {
    try {
      await clearShapes();
      clearRenderError();
      showToast("Limpio", "Se limpió la hoja del árbol", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast("Error", message || "Error al limpiar", "error");
    }
  }, [clearRenderError, showToast]);

  const handleNew = useCallback(() => {
    dispatch({ type: "CLEAR_TREE" });
    clearRenderError();
  }, [clearRenderError, dispatch]);

  const handleExample = useCallback(
    async (exampleFn: () => ReturnType<typeof oilDrillingExample>, name: string) => {
      setShowExamples(false);
      await loadAndDraw(exampleFn, name);
    },
    [loadAndDraw]
  );

  const drawDisabled = drawing || !hasTree;

  return (
    <div className="toolbar-stack">
      {renderError && (
        <div className="toolbar-message toolbar-message-error" role="alert">
          Error al dibujar: {renderError}
        </div>
      )}

      <div className="toolbar">
        <button
          className="btn btn-hero"
          onClick={drawCurrent}
          disabled={drawDisabled}
          title={hasTree ? "Dibujar el árbol en Excel" : "Primero elegí un caso o cargá uno existente"}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 14l3-1 8-8-2-2-8 8z" />
            <path d="M10 4l2 2" />
          </svg>
          {drawing ? "Dibujando..." : "Dibujar en Excel"}
        </button>

        <div className="toolbar-row-secondary">
          <button className="btn btn-ghost" onClick={handleNew} disabled={drawing}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 2h7l3 3v9H3z" />
              <path d="M7 2v4h4" />
            </svg>
            Nuevo
          </button>
          <button className="btn btn-ghost" onClick={handleSave} disabled={drawing}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 2h8l2 2v10H3z" />
              <path d="M5 2v4h5V2" />
              <path d="M5 14v-4h6v4" />
            </svg>
            Guardar
          </button>
          <button className="btn btn-ghost" onClick={handleLoad} disabled={drawing}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 4h12v9H2z" />
              <path d="M5 1h6v3H5z" />
            </svg>
            Cargar
          </button>
          <button className="btn btn-ghost" onClick={handleClear} disabled={drawing}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
            Limpiar
          </button>
          {hasTree && (
            <div style={{ position: "relative" }} ref={menuRef}>
              <button
                className="btn btn-ghost"
                onClick={() => setShowExamples((value) => !value)}
                disabled={drawing}
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 3h12M2 8h12M2 13h8" />
                </svg>
                Ejemplos
              </button>
              {showExamples && (
                <div className="dropdown-menu">
                  <button
                    className="dropdown-item"
                    onClick={() => handleExample(workoverExample, "Workover de pozo")}
                  >
                    Workover de pozo
                    <span className="desc">Intervención · Modo Costo</span>
                  </button>
                  <button
                    className="dropdown-item"
                    onClick={() => handleExample(oilDrillingExample, "Perforación de pozo")}
                  >
                    Perforación de pozo
                    <span className="desc">Inversión · Modo Valor</span>
                  </button>
                  <button
                    className="dropdown-item"
                    onClick={() => handleExample(productLaunchExample, "Lanzamiento de producto")}
                  >
                    Lanzamiento de producto
                    <span className="desc">Inversión · Modo Valor</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
