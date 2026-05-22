import React, { useCallback, useEffect, useRef, useState } from "react";
import { workoverExample, oilDrillingExample, productLaunchExample } from "../../engine/Examples";
import { clearShapes } from "../../excel/ShapeManager";
import { loadFromWorkbook, saveToWorkbook } from "../../excel/WorkbookState";
import { useTree } from "../context/TreeContext";
import type { DrawTreeApi } from "../hooks/useDrawTree";
import { DrawPreviewOverlay } from "./DrawPreviewOverlay";
import { DrawLoadingOverlay } from "./DrawLoadingOverlay";

interface ToolbarProps {
  showToast: (title: string, body: string, intent?: "success" | "error" | "info") => void;
  drawApi: DrawTreeApi;
}

export function Toolbar({ showToast, drawApi }: ToolbarProps) {
  const { state, dispatch } = useTree();
  const [showExamples, setShowExamples] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const hasTree = !!state.tree.rootId;
  const { drawing, renderError, drawCurrent, loadAndDraw, clearRenderError } = drawApi;

  const openPreview = useCallback(() => setShowPreview(true), []);
  const cancelPreview = useCallback(() => setShowPreview(false), []);
  const confirmDraw = useCallback(async () => {
    setShowPreview(false);
    await drawCurrent();
  }, [drawCurrent]);

  useEffect(() => {
    if (drawing) setShowPreview(false);
  }, [drawing]);

  useEffect(() => {
    if (!showExamples) return;

    function handleClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowExamples(false);
      }
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowExamples(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [showExamples]);

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
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M8 5v3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="8" cy="11" r="0.7" fill="currentColor" />
          </svg>
          <span>Error al dibujar: {renderError}</span>
        </div>
      )}

      <div className="toolbar">
        <button
          type="button"
          className="btn btn-hero"
          onClick={openPreview}
          disabled={drawDisabled}
          title={hasTree ? "Previsualizar y dibujar el árbol en Excel" : "Primero elegí un caso o cargá uno existente"}
        >
          {drawing ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Dibujando…
            </>
          ) : (
            <>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M2 14l3-1 8-8-2-2-8 8z" />
                <path d="M10 4l2 2" />
              </svg>
              Dibujar en Excel
            </>
          )}
        </button>

        <div className="toolbar-row-secondary">
          <button type="button" className="btn btn-ghost" onClick={handleNew} disabled={drawing}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M3 2h7l3 3v9H3z" />
              <path d="M7 2v4h4" />
            </svg>
            Nuevo
          </button>
          <button type="button" className="btn btn-ghost" onClick={handleSave} disabled={drawing}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M3 2h8l2 2v10H3z" />
              <path d="M5 2v4h5V2" />
              <path d="M5 14v-4h6v4" />
            </svg>
            Guardar
          </button>
          <button type="button" className="btn btn-ghost" onClick={handleLoad} disabled={drawing}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M2 4h12v9H2z" />
              <path d="M5 1h6v3H5z" />
            </svg>
            Cargar
          </button>
          <button type="button" className="btn btn-ghost" onClick={handleClear} disabled={drawing}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
            Limpiar
          </button>
          {hasTree && (
            <div style={{ position: "relative" }} ref={menuRef}>
              <button
                ref={triggerRef}
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowExamples((value) => !value)}
                disabled={drawing}
                aria-expanded={showExamples}
                aria-haspopup="menu"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <path d="M2 3h12M2 8h12M2 13h8" />
                </svg>
                Ejemplos
              </button>
              {showExamples && (
                <div className="dropdown-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    className="dropdown-item"
                    onClick={() => handleExample(workoverExample, "Workover de pozo")}
                  >
                    Workover de pozo
                    <span className="desc">Intervención · Modo Costo</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="dropdown-item"
                    onClick={() => handleExample(oilDrillingExample, "Perforación de pozo")}
                  >
                    Perforación de pozo
                    <span className="desc">Inversión · Modo Valor</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
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

      {showPreview && hasTree && !drawing && (
        <DrawPreviewOverlay
          tree={state.tree}
          onConfirm={confirmDraw}
          onCancel={cancelPreview}
        />
      )}

      <DrawLoadingOverlay active={drawing} />
    </div>
  );
}
