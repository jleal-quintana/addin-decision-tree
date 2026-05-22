import React, { useCallback, useEffect, useState } from "react";
import { clearShapes } from "../../excel/ShapeManager";
import { loadFromWorkbook, saveToWorkbook } from "../../excel/WorkbookState";
import { useTree } from "../context/TreeContext";
import type { DrawTreeApi } from "../hooks/useDrawTree";
import { DrawPreviewOverlay } from "./DrawPreviewOverlay";
import { DrawLoadingOverlay } from "./DrawLoadingOverlay";
import { ConfirmDialog } from "./ConfirmDialog";

interface ToolbarProps {
  showToast: (title: string, body: string, intent?: "success" | "error" | "info") => void;
  drawApi: DrawTreeApi;
}

export function Toolbar({ showToast, drawApi }: ToolbarProps) {
  const { state, dispatch } = useTree();
  const [showPreview, setShowPreview] = useState(false);
  const [showNewConfirm, setShowNewConfirm] = useState(false);

  const hasTree = !!state.tree.rootId;
  const { drawing, renderError, drawCurrent, clearRenderError } = drawApi;

  const openPreview = useCallback(() => setShowPreview(true), []);
  const cancelPreview = useCallback(() => setShowPreview(false), []);
  const confirmDraw = useCallback(async () => {
    setShowPreview(false);
    await drawCurrent();
  }, [drawCurrent]);

  useEffect(() => {
    if (drawing) setShowPreview(false);
  }, [drawing]);

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

  const requestNew = useCallback(() => {
    if (hasTree) {
      setShowNewConfirm(true);
    } else {
      dispatch({ type: "CLEAR_TREE" });
      clearRenderError();
    }
  }, [clearRenderError, dispatch, hasTree]);

  const confirmNew = useCallback(() => {
    dispatch({ type: "CLEAR_TREE" });
    clearRenderError();
    setShowNewConfirm(false);
  }, [clearRenderError, dispatch]);

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
          <button type="button" className="btn btn-ghost" onClick={requestNew} disabled={drawing}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M3 2h7l3 3v9H3z" />
              <path d="M7 2v4h4" />
            </svg>
            Nuevo
          </button>
          <button type="button" className="btn btn-ghost" onClick={handleSave} disabled={drawing} title="Guardar en el libro (Ctrl+S)">
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
              <path d="M3 5h10M5 5v8a1 1 0 001 1h4a1 1 0 001-1V5" />
              <path d="M6 5V3h4v2" />
            </svg>
            Limpiar Excel
          </button>
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

      <ConfirmDialog
        open={showNewConfirm}
        title="¿Empezar de cero?"
        body={
          <>
            <p>Esto borra el árbol actual del taskpane.</p>
            <p>El dibujo en Excel queda intacto hasta que toques Limpiar Excel.</p>
          </>
        }
        confirmLabel="Empezar de cero"
        cancelLabel="Cancelar"
        destructive
        onConfirm={confirmNew}
        onCancel={() => setShowNewConfirm(false)}
      />
    </div>
  );
}
