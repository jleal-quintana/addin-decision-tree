import React, { Component, ReactNode, useCallback, useRef, useState } from "react";
import { isDebugEnabled } from "../debug/excelDiagnostics";
import { CalculationResults } from "./components/CalculationResults";
import { DebugPanel } from "./components/DebugPanel";
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
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    { id: "build" as const, label: "Arbol" },
    { id: "results" as const, label: "Resultados" },
  ];

  const activeTab = state.activeTab === "sensitivity" ? "build" : state.activeTab;

  return (
    <div className="app-container">
      {toast && (
        <div className={`toast toast--${toast.type}`} role="status">
          {toast.msg}
        </div>
      )}

      <div className="app-header">
        <div>
          <h1>Arbol de Decision</h1>
          <div className="subtitle">Quintana Energy</div>
        </div>
        <div className="brand-bar" />
      </div>

      <Toolbar showToast={showToast} drawApi={drawApi} />

      <div className="tab-bar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => dispatch({ type: "SET_TAB", tab: tab.id })}
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
