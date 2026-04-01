import React, { useCallback } from "react";
import { useTree } from "../context/TreeContext";
import { NodeType, TreeNode } from "../../models/types";

function NodeItem({ node, depth }: { node: TreeNode; depth: number }) {
  const { state, dispatch } = useTree();
  const tree = state.tree.nodes;
  const isSelected = state.selectedNodeId === node.id;
  const parentNode = node.parentId ? tree[node.parentId] : null;

  const handleSelect = useCallback(() => {
    dispatch({ type: "SELECT_NODE", nodeId: node.id });
  }, [dispatch, node.id]);

  const handleAddChild = useCallback((type: NodeType) => {
    const labels: Record<NodeType, string> = {
      decision: "Nueva Decision",
      chance: "Nuevo Chance",
      end: "Resultado",
    };
    dispatch({ type: "ADD_NODE", parentId: node.id, nodeType: type, label: labels[type] });
  }, [dispatch, node.id]);

  const handleDelete = useCallback(() => {
    dispatch({ type: "REMOVE_NODE", nodeId: node.id });
  }, [dispatch, node.id]);

  // Build meta text
  const parts: string[] = [];
  if (node.probability !== null && node.probability > 0 && parentNode?.type === "chance") {
    parts.push(`${(node.probability * 100).toFixed(0)}%`);
  }
  if (node.type === "end" && node.payoff !== null) {
    parts.push(`$${node.payoff.toLocaleString("es-AR")}`);
  }
  if (node.cost !== null && node.cost !== undefined && node.cost !== 0) {
    parts.push(`C: $${node.cost.toLocaleString("es-AR")}`);
  }
  const metaText = parts.join(" | ");

  const evText = node.expectedValue !== null
    ? `VE: $${node.expectedValue.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`
    : "";

  const typeInitial = { decision: "D", chance: "C", end: "R" }[node.type];

  return (
    <>
      <div
        className={`node-item ${isSelected ? "selected" : ""} ${node.isOptimal ? "optimal" : ""}`}
        onClick={handleSelect}
        style={{ paddingLeft: 10 + depth * 18 }}
      >
        <div className={`node-badge ${node.type}`}>{typeInitial}</div>
        <span className="node-label">{node.label}</span>
        {metaText && <span className="node-meta">{metaText}</span>}
        {evText && <span className="node-meta ev">{evText}</span>}
        <div className="node-actions" onClick={(e) => e.stopPropagation()}>
          {node.type !== "end" && (
            <>
              <button className="add-decision" onClick={() => handleAddChild("decision")} title="Agregar decision">
                <svg width="14" height="14" viewBox="0 0 14 14"><rect x="2" y="2" width="10" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3"/><path d="M7 5v4M5 7h4" stroke="currentColor" strokeWidth="1.3"/></svg>
              </button>
              <button className="add-chance" onClick={() => handleAddChild("chance")} title="Agregar chance">
                <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.3"/><path d="M7 5v4M5 7h4" stroke="currentColor" strokeWidth="1.3"/></svg>
              </button>
              <button className="add-end" onClick={() => handleAddChild("end")} title="Agregar resultado">
                <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 2l5 10H2z" fill="none" stroke="currentColor" strokeWidth="1.3"/></svg>
              </button>
            </>
          )}
          <button className="delete" onClick={handleDelete} title="Eliminar">
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 4h8M5 4V3h4v1M4 4v7.5a.5.5 0 00.5.5h5a.5.5 0 00.5-.5V4" fill="none" stroke="currentColor" strokeWidth="1.2"/></svg>
          </button>
        </div>
      </div>
      {node.childIds.map((childId) => {
        const child = tree[childId];
        return child ? <NodeItem key={childId} node={child} depth={depth + 1} /> : null;
      })}
    </>
  );
}

export function TreeBuilder() {
  const { state, dispatch } = useTree();
  const { tree } = state;

  const handleCreateTree = useCallback((mode: "maximize" | "minimize") => {
    dispatch({ type: "CLEAR_TREE", mode });
    dispatch({
      type: "ADD_NODE",
      parentId: null,
      nodeType: "decision",
      label: mode === "maximize" ? "Decision Principal" : "Decision de Costo",
    });
  }, [dispatch]);

  if (!tree.rootId) {
    return (
      <div className="empty-state">
        <div className="icon-big">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="6" width="8" height="5" rx="1"/>
            <line x1="10" y1="8.5" x2="14" y2="4.5"/>
            <line x1="10" y1="8.5" x2="14" y2="8.5"/>
            <line x1="10" y1="8.5" x2="14" y2="12.5"/>
            <circle cx="18" cy="4.5" r="3"/>
            <rect x="15" y="7" width="6" height="3" rx="0.5"/>
            <circle cx="18" cy="12.5" r="3"/>
          </svg>
        </div>
        <h3>Crea tu arbol de decision</h3>
        <p>
          Empeza con un nodo de decision (cuadrado) para evaluar
          opciones con probabilidades, costos y VAN terminal.
        </p>
        <div className="actions">
          <button className="btn-create decision" onClick={() => handleCreateTree("maximize")}>
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 2l3 5H4z" fill="none" stroke="currentColor" strokeWidth="1.3"/><path d="M4 9h6" stroke="currentColor" strokeWidth="1.3"/></svg>
            Maximizar Valor
          </button>
          <button className="btn-create chance" onClick={() => handleCreateTree("minimize")}>
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 12l-3-5h6z" fill="none" stroke="currentColor" strokeWidth="1.3"/><path d="M4 5h6" stroke="currentColor" strokeWidth="1.3"/></svg>
            Minimizar Costo
          </button>
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-secondary)" }}>
          Modo: {tree.metadata.mode === "minimize" ? "Minimizar costo" : "Maximizar valor"}
        </div>
      </div>
    );
  }

  const rootNode = tree.nodes[tree.rootId];
  if (!rootNode) return null;

  return (
    <div className="node-list">
      <div style={{ padding: "4px 10px", fontSize: 10, color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
        Modo: {tree.metadata.mode === "minimize" ? "Minimizar costo" : "Maximizar valor"}
      </div>
      <NodeItem node={rootNode} depth={0} />
    </div>
  );
}
