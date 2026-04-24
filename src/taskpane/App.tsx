import React, { Component, ReactNode, useCallback, useRef, useState } from "react";
import { isDebugEnabled } from "../debug/excelDiagnostics";
import { CalculationResults } from "./components/CalculationResults";
import { DebugPanel } from "./components/DebugPanel";
import { NodeEditor } from "./components/NodeEditor";
import { SensitivityPanel } from "./components/SensitivityPanel";
import { Toolbar } from "./components/Toolbar";
import { TreeBuilder } from "./components/TreeBuilder";
import { TreePreview } from "./components/TreePreview";
import { useTree } from "./context/TreeContext";

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

function AppInner() {
  const { state, dispatch } = useTree();
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debugEnabled = isDebugEnabled();

  const showToast = useCallback(
    (title: string, body: string, intent: "success" | "error" | "info" = "info") => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast({ msg: `${title}: ${body}`, type: intent });
      toastTimer.current = setTimeout(() => setToast(null), 3000);
    },
    []
  );

  const tabs = [
    { id: "build" as const, label: "Arbol" },
    { id: "results" as const, label: "Resultados" },
    { id: "sensitivity" as const, label: "Sensibilidad" },
  ];

  return (
    <div className="app-container">
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 8,
            left: 8,
            right: 8,
            zIndex: 999,
            padding: "8px 12px",
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 500,
            background:
              toast.type === "error"
                ? "#fef2f2"
                : toast.type === "success"
                  ? "rgba(107,123,56,0.1)"
                  : "#f0f4ff",
            color:
              toast.type === "error"
                ? "#c0392b"
                : toast.type === "success"
                  ? "#33492D"
                  : "#1B4B6C",
            border: `1px solid ${
              toast.type === "error"
                ? "#fca5a5"
                : toast.type === "success"
                  ? "#6B7B38"
                  : "#BADCFF"
            }`,
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          }}
        >
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

      <Toolbar showToast={showToast} />

      <div className="tab-bar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn ${state.activeTab === tab.id ? "active" : ""}`}
            onClick={() => dispatch({ type: "SET_TAB", tab: tab.id })}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {state.activeTab === "build" && (
          <>
            <TreeBuilder />
            {state.selectedNodeId && <NodeEditor />}
            <TreePreview />
          </>
        )}
        {state.activeTab === "results" && <CalculationResults />}
        {state.activeTab === "sensitivity" && <SensitivityPanel />}
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
