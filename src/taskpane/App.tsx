import React, { Component, ReactNode, useCallback, useRef, useState } from "react";
import { isDebugEnabled } from "../debug/excelDiagnostics";
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
        <div style={{ padding: 24, textAlign: "center", fontFamily: "Montserrat, sans-serif" }}>
          <h2 style={{ color: "#c0392b" }}>Error inesperado</h2>
          <p style={{ fontSize: 13, color: "#555" }}>{this.state.error.message}</p>
          <button
            style={{ marginTop: 12, padding: "8px 16px", cursor: "pointer" }}
            onClick={() => this.setState({ error: null })}
          >
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
      toastTimer.current = setTimeout(() => setToast(null), 3000);
    },
    []
  );

  const drawApi = useDrawTree(showToast);

  const tabs = [
    { id: "build" as const, label: "Armar" },
    { id: "results" as const, label: "Resultado" },
  ];

  // Defensa: si hay estado persistido viejo con "sensitivity" (tab ya eliminada),
  // caemos a "build" en runtime. El union TS no protege datos hidratados de disco.
  const rawTab: string = state.activeTab;
  const activeTab: "build" | "results" = rawTab === "results" ? "results" : "build";

  return (
    <div className="app-container" style={{ position: "relative" }}>
      {toast && (
        <div className={`toast toast--${toast.type}`} role="status">
          {toast.msg}
        </div>
      )}

      <div className="app-header">
        <div>
          <h1>Análisis de decisión</h1>
          <div className="subtitle">Quintana Energy</div>
        </div>
        <button
          ref={helpBtnRef}
          type="button"
          className="help-btn"
          onClick={() => setHelpOpen((open) => !open)}
          aria-expanded={helpOpen}
          aria-label="Ayuda sobre las formas del árbol"
          title="¿Cómo leer el árbol?"
        >
          ?
        </button>
        <div className="brand-bar" />
      </div>

      <HelpPopover open={helpOpen} onClose={() => setHelpOpen(false)} triggerRef={helpBtnRef} />

      <Toolbar showToast={showToast} drawApi={drawApi} />

      <div className="tab-bar" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => dispatch({ type: "SET_TAB", tab: tab.id })}
            role="tab"
            aria-selected={activeTab === tab.id}
            id={`tab-${tab.id}`}
            aria-controls={`tabpanel-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="tab-content">
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
