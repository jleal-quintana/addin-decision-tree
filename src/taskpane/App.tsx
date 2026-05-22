import React, { Component, ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { isDebugEnabled } from "../debug/excelDiagnostics";
import { validate } from "../models/DecisionTree";
import { CalculationResults } from "./components/CalculationResults";
import { DebugPanel } from "./components/DebugPanel";
import { HelpPopover } from "./components/HelpPopover";
import { NodeEditor } from "./components/NodeEditor";
import { Toolbar } from "./components/Toolbar";
import { TreeBuilder } from "./components/TreeBuilder";
import { TreePreview } from "./components/TreePreview";
import { useTree } from "./context/TreeContext";
import { useDrawTree } from "./hooks/useDrawTree";

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

  const tabs = [
    { id: "build" as const, label: "Armar" },
    { id: "results" as const, label: "Resultado" },
  ];

  const rawTab: string = state.activeTab;
  const activeTab: "build" | "results" = rawTab === "results" ? "results" : "build";

  const validationErrors = useMemo(
    () => (state.tree.rootId ? validate(state.tree) : []),
    [state.tree]
  );

  const isCost = state.tree.metadata.mode === "minimize";
  const modeLabel = isCost ? "Modo Costo" : "Modo Valor";
  const caseName = state.tree.metadata.name ?? "";

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
          <div className="eyebrow">Quintana Energy · Análisis de decisión</div>
          {state.tree.rootId ? (
            <input
              className="case-input"
              type="text"
              value={caseName}
              onChange={(e) => handleCaseRename(e.target.value)}
              placeholder="Nombre del caso"
              aria-label="Nombre del caso"
            />
          ) : (
            <h1>Nuevo análisis</h1>
          )}
          {state.tree.rootId && <div className="case-meta">{modeLabel}</div>}
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

      {validationErrors.length > 0 && (
        <div className="validation-banner" role="alert">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M8 1.5L1 14h14L8 1.5z"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <path d="M8 6v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="8" cy="12" r="0.7" fill="currentColor" />
          </svg>
          <span>
            {validationErrors.length === 1
              ? validationErrors[0].message
              : `${validationErrors.length} validaciones pendientes: ${validationErrors[0].message}`}
          </span>
        </div>
      )}

      <Toolbar showToast={showToast} drawApi={drawApi} />

      <div className="tab-bar" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => dispatch({ type: "SET_TAB", tab: tab.id })}
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
            <TreeBuilder drawApi={drawApi} />
            {state.selectedNodeId && <NodeEditor />}
            <TreePreview />
          </>
        )}
        {activeTab === "results" && <CalculationResults />}
      </div>

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
