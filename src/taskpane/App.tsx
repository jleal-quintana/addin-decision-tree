import React, { Component, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isDebugEnabled } from "../debug/excelDiagnostics";
import { loadFromWorkbook, saveToWorkbook } from "../excel/WorkbookState";
import { CalculationResults } from "./components/CalculationResults";
import { DebugPanel } from "./components/DebugPanel";
import { HelpPopover } from "./components/HelpPopover";
import { NodeEditor } from "./components/NodeEditor";
import { StatusStrip } from "./components/StatusStrip";
import { Toolbar } from "./components/Toolbar";
import { TreeBuilder } from "./components/TreeBuilder";
import { TreeMinimap } from "./components/TreeMinimap";
import { TreePreview } from "./components/TreePreview";
import { ValidationPanel } from "./components/ValidationPanel";
import { useTree } from "./context/TreeContext";
import { useDrawTree } from "./hooks/useDrawTree";
import { buildValidationIssues, groupIssuesByNode } from "./utils/validationIssues";

function formatRelativeUpdate(iso: string): string {
  const updated = new Date(iso).getTime();
  if (!Number.isFinite(updated)) return "";
  const diff = Date.now() - updated;
  if (diff < 30_000) return "actualizado ahora";
  const minutes = Math.round(diff / 60_000);
  if (minutes < 60) return `actualizado hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `actualizado hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `actualizado hace ${days} d`;
  return `actualizado ${new Date(iso).toLocaleDateString("es-AR")}`;
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="bootstrap-error" role="alert">
          <h2>Error inesperado</h2>
          <p>{this.state.error.message}</p>
          <button type="button" onClick={() => this.setState({ error: null })}>
            Reintentar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

type ToastIntent = "success" | "error" | "info";

function AppInner() {
  const { state, dispatch } = useTree();
  const [toast, setToast] = useState<{ msg: string; type: ToastIntent } | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const helpBtnRef = useRef<HTMLButtonElement>(null);
  const debugEnabled = isDebugEnabled();

  const showToast = useCallback(
    (title: string, body: string, intent: ToastIntent = "info") => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast({ msg: `${title}: ${body}`, type: intent });
      toastTimer.current = setTimeout(() => setToast(null), 4500);
    },
    []
  );

  const pauseToastDismissal = useCallback(() => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
      toastTimer.current = null;
    }
  }, []);

  const resumeToastDismissal = useCallback(() => {
    if (toast && !toastTimer.current) {
      toastTimer.current = setTimeout(() => setToast(null), 3000);
    }
  }, [toast]);

  const drawApi = useDrawTree(showToast);
  const hasTree = Boolean(state.tree.rootId);

  const handleLoadWorkbook = useCallback(async () => {
    try {
      const data = await loadFromWorkbook();
      if (!data) {
        showToast("Info", "No hay un análisis guardado en este libro", "info");
        return;
      }
      dispatch({ type: "SET_TREE", data });
      drawApi.clearRenderError();
      showToast("Cargado", "Análisis restaurado", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast("Error", message || "No se pudo cargar el análisis", "error");
    }
  }, [dispatch, drawApi, showToast]);

  const tabs = [
    { id: "build" as const, label: "Armar" },
    { id: "results" as const, label: "Resultado" },
  ];

  const rawTab: string = state.activeTab;
  const activeTab: "build" | "results" = rawTab === "results" ? "results" : "build";

  const validationIssues = useMemo(
    () => (state.tree.rootId ? buildValidationIssues(state.tree) : []),
    [state.tree]
  );
  const issuesByNode = useMemo(() => groupIssuesByNode(validationIssues), [validationIssues]);

  const isCost = state.tree.metadata.mode === "minimize";
  const caseName = state.tree.metadata.name ?? "";
  const updatedAtLabel = state.tree.metadata.updatedAt
    ? formatRelativeUpdate(state.tree.metadata.updatedAt)
    : "";

  const handleCaseRename = useCallback(
    (value: string) => {
      dispatch({
        type: "SET_TREE",
        data: {
          ...state.tree,
          metadata: {
            ...state.tree.metadata,
            name: value,
            updatedAt: new Date().toISOString(),
          },
        },
      });
    },
    [dispatch, state.tree]
  );

  const handleModeChange = useCallback(
    (mode: "maximize" | "minimize") => {
      if (mode === state.tree.metadata.mode) return;
      dispatch({
        type: "SET_TREE",
        data: {
          ...state.tree,
          metadata: { ...state.tree.metadata, mode, updatedAt: new Date().toISOString() },
        },
      });
    },
    [dispatch, state.tree]
  );

  const handleModeKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const nextMode = event.key === "ArrowLeft" || event.key === "Home" ? "maximize" : "minimize";
      handleModeChange(nextMode);
      requestAnimationFrame(() => {
        document.querySelector<HTMLButtonElement>(`[data-mode="${nextMode}"]`)?.focus();
      });
    },
    [handleModeChange]
  );

  const handleTabKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      let nextIndex = index;
      if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = tabs.length - 1;
      else if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
      else nextIndex = (index - 1 + tabs.length) % tabs.length;
      const nextTab = tabs[nextIndex];
      dispatch({ type: "SET_TAB", tab: nextTab.id });
      requestAnimationFrame(() => document.getElementById(`tab-${nextTab.id}`)?.focus());
    },
    [dispatch]
  );

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key === "s" || event.key === "S") {
        event.preventDefault();
        if (!state.tree.rootId) {
          showToast("Info", "No hay árbol para guardar", "info");
          return;
        }
        saveToWorkbook(state.tree)
          .then(() => showToast("Guardado", "Datos guardados en el libro", "success"))
          .catch((error) => {
            const msg = error instanceof Error ? error.message : String(error);
            showToast("Error", msg || "Error al guardar", "error");
          });
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [showToast, state.tree]);

  return (
    <div className="app-container">
      {toast && (
        <div
          className={`toast toast--${toast.type}`}
          role="status"
          aria-live="polite"
          onMouseEnter={pauseToastDismissal}
          onMouseLeave={resumeToastDismissal}
          onFocus={pauseToastDismissal}
          onBlur={resumeToastDismissal}
        >
          {toast.msg}
        </div>
      )}

      <div className="app-header">
        <div className="header-text">
          <div className="eyebrow">Quintana · Análisis de decisión</div>
          {state.tree.rootId ? (
            <div className="case-input-wrap">
              <input
                className="case-input"
                type="text"
                value={caseName}
                onChange={(e) => handleCaseRename(e.target.value)}
                placeholder="Nombre del caso"
                aria-label="Nombre del caso"
              />
              <svg
                className="case-input__pencil"
                width="13"
                height="13"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path d="M2 14l3-1 8-8-2-2-8 8z" stroke="currentColor" strokeWidth="1.4" />
                <path d="M10 4l2 2" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </div>
          ) : (
            <h1>Nuevo análisis</h1>
          )}
          {state.tree.rootId && (
            <div className="case-meta">
              <div className="mode-toggle" role="radiogroup" aria-label="Modo del análisis">
                <button
                  type="button"
                  data-mode="maximize"
                  role="radio"
                  aria-checked={!isCost}
                  className={`mode-toggle__opt ${!isCost ? "active" : ""}`}
                  onClick={() => handleModeChange("maximize")}
                  onKeyDown={handleModeKeyDown}
                  title="Buscar el camino con mayor valor esperado (ingresos - costos)"
                >
                  Valor
                </button>
                <button
                  type="button"
                  data-mode="minimize"
                  role="radio"
                  aria-checked={isCost}
                  className={`mode-toggle__opt ${isCost ? "active" : ""}`}
                  onClick={() => handleModeChange("minimize")}
                  onKeyDown={handleModeKeyDown}
                  title="Buscar el camino con menor costo esperado"
                >
                  Costo
                </button>
              </div>
              <span className="mode-hint" aria-live="polite">
                {isCost
                  ? "Minimiza costo: el menor número gana."
                  : "Maximiza valor: el mayor número gana."}
              </span>
              {updatedAtLabel && <span className="case-meta__update">· {updatedAtLabel}</span>}
            </div>
          )}
        </div>
        <button
          ref={helpBtnRef}
          type="button"
          className="help-btn"
          onClick={() => setHelpOpen((open) => !open)}
          aria-expanded={helpOpen}
          aria-haspopup="dialog"
          aria-label="Ayuda sobre las formas del árbol"
          title="¿Cómo leer el árbol?"
        >
          ?
        </button>
      </div>

      <HelpPopover open={helpOpen} onClose={() => setHelpOpen(false)} triggerRef={helpBtnRef} />

      {hasTree ? (
        <>
          <StatusStrip issues={validationIssues} />
          <Toolbar showToast={showToast} drawApi={drawApi} />

          <div className="tab-bar" role="tablist">
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                type="button"
                className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => dispatch({ type: "SET_TAB", tab: tab.id })}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                role="tab"
                aria-selected={activeTab === tab.id}
                id={`tab-${tab.id}`}
                aria-controls={`tabpanel-${tab.id}`}
                tabIndex={activeTab === tab.id ? 0 : -1}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div
            className="tab-content"
            role="tabpanel"
            id={`tabpanel-${activeTab}`}
            aria-labelledby={`tab-${activeTab}`}
          >
            {activeTab === "build" && (
              <>
                {validationIssues.length > 0 && <ValidationPanel issues={validationIssues} />}
                <TreeMinimap />
                <TreeBuilder drawApi={drawApi} issuesByNode={issuesByNode} />
                {state.selectedNodeId && <NodeEditor key={state.selectedNodeId} />}
                <TreePreview />
              </>
            )}
            {activeTab === "results" && <CalculationResults />}
          </div>
        </>
      ) : (
        <main className="tab-content tab-content--onboarding">
          <TreeBuilder drawApi={drawApi} onLoadWorkbook={handleLoadWorkbook} />
        </main>
      )}

      {debugEnabled && <DebugPanel />}
    </div>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
