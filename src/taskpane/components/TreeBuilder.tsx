import React, { memo, useCallback } from "react";
import { useTree } from "../context/TreeContext";
import { NodeType, TreeNode } from "../../models/types";
import {
  workoverExample,
  oilDrillingExample,
  productLaunchExample,
  vacaMuertaDevelopmentExample,
} from "../../engine/Examples";
import type { DrawTreeApi } from "../hooks/useDrawTree";

interface TreeBuilderProps {
  drawApi?: DrawTreeApi;
}

const NodeBadge = memo(function NodeBadge({ type, isOptimal }: { type: NodeType; isOptimal?: boolean }) {
  const stroke = isOptimal ? "var(--qe-verde)" : "var(--qe-azul)";
  const fill = isOptimal ? "rgba(226, 255, 135, 0.55)" : "var(--bg-card)";
  const strokeWidth = isOptimal ? 1.8 : 1.4;

  return (
    <span className={`node-badge node-badge-${type}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        {type === "decision" && (
          <rect x="4" y="4" width="16" height="16" rx="2" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
        )}
        {type === "chance" && (
          <circle cx="12" cy="12" r="8" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
        )}
        {type === "end" && (
          <path
            d="M12 4l8 14H4z"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />
        )}
      </svg>
    </span>
  );
});

function NodeItem({ node, depth }: { node: TreeNode; depth: number }) {
  const { state, dispatch } = useTree();
  const tree = state.tree.nodes;
  const isSelected = state.selectedNodeId === node.id;
  const parentNode = node.parentId ? tree[node.parentId] : null;

  const handleSelect = useCallback(() => {
    dispatch({ type: "SELECT_NODE", nodeId: node.id });
  }, [dispatch, node.id]);

  const handleSelectKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleSelect();
      }
    },
    [handleSelect]
  );

  const handleAddChild = useCallback(
    (type: NodeType) => {
      const labels: Record<NodeType, string> = {
        decision: "Nueva decisión",
        chance: "Nueva incertidumbre",
        end: "Resultado final",
      };
      dispatch({ type: "ADD_NODE", parentId: node.id, nodeType: type, label: labels[type] });
    },
    [dispatch, node.id]
  );

  const handleDelete = useCallback(() => {
    dispatch({ type: "REMOVE_NODE", nodeId: node.id });
  }, [dispatch, node.id]);

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
  const metaText = parts.join(" · ");

  const evPrefix = state.tree.metadata.mode === "minimize" ? "Costo esp." : "Valor esp.";
  const evText =
    node.expectedValue !== null
      ? `${evPrefix}: $${node.expectedValue.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`
      : "";

  const branchLabel = node.parentId ? node.branchLabel || node.label : null;
  const typeName = { decision: "Decisión", chance: "Incertidumbre", end: "Resultado final" }[node.type];

  return (
    <>
      <div
        className={`node-item ${isSelected ? "selected" : ""} ${node.isOptimal ? "optimal" : ""}`}
        onClick={handleSelect}
        onKeyDown={handleSelectKeyDown}
        role="button"
        tabIndex={0}
        aria-pressed={isSelected}
        aria-label={`${typeName}: ${node.label}`}
        style={{ paddingLeft: 10 + depth * 18 }}
      >
        <NodeBadge type={node.type} isOptimal={node.isOptimal} />
        <span className="node-label">
          {branchLabel && <span className="branch-pill">{branchLabel}</span>}
          {node.label}
        </span>
        {metaText && <span className="node-meta">{metaText}</span>}
        {evText && <span className="node-meta ev">{evText}</span>}
        <div className="node-actions">
          {node.type !== "end" && (
            <>
              <button
                type="button"
                className="add-decision"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddChild("decision");
                }}
                aria-label="Agregar decisión"
                title="Agregar decisión"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  <rect x="2" y="2" width="10" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M7 5v4M5 7h4" stroke="currentColor" strokeWidth="1.3" />
                </svg>
              </button>
              <button
                type="button"
                className="add-chance"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddChild("chance");
                }}
                aria-label="Agregar incertidumbre"
                title="Agregar incertidumbre"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M7 5v4M5 7h4" stroke="currentColor" strokeWidth="1.3" />
                </svg>
              </button>
              <button
                type="button"
                className="add-end"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddChild("end");
                }}
                aria-label="Agregar resultado final"
                title="Agregar resultado final"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  <path d="M7 2l5 10H2z" fill="none" stroke="currentColor" strokeWidth="1.3" />
                </svg>
              </button>
            </>
          )}
          <button
            type="button"
            className="delete"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            aria-label="Eliminar nodo"
            title="Eliminar"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path
                d="M3 4h8M5 4V3h4v1M4 4v7.5a.5.5 0 00.5.5h5a.5.5 0 00.5-.5V4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
              />
            </svg>
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

export function TreeBuilder({ drawApi }: TreeBuilderProps = {}) {
  const { state, dispatch } = useTree();
  const { tree } = state;
  const loading = drawApi?.drawing ?? false;

  const handleCreateTree = useCallback(
    (mode: "maximize" | "minimize", rootLabel: string) => {
      dispatch({ type: "CLEAR_TREE", mode });
      dispatch({
        type: "ADD_NODE",
        parentId: null,
        nodeType: "decision",
        label: rootLabel,
      });
    },
    [dispatch]
  );

  const handleLoadExample = useCallback(
    async (exampleFn: () => ReturnType<typeof workoverExample>, name: string) => {
      if (!drawApi) return;
      await drawApi.loadAndDraw(exampleFn, name);
    },
    [drawApi]
  );

  const handleModeChange = useCallback(
    (mode: "maximize" | "minimize") => {
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

  if (!tree.rootId) {
    return (
      <div className="empty-state">
        <div className="icon-row" aria-hidden="true">
          <span className="shape">
            <svg viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="2" fill="var(--bg-card)" stroke="var(--qe-azul)" strokeWidth="1.5" />
            </svg>
          </span>
          <span className="shape">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" fill="var(--bg-card)" stroke="var(--qe-beige)" strokeWidth="1.5" />
            </svg>
          </span>
          <span className="shape">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 3l9 16H3z" fill="var(--bg-card)" stroke="var(--qe-verde)" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </span>
        </div>

        <h3>¿Qué estás evaluando?</h3>
        <p className="lead">
          Elegí un caso para empezar. El modo se configura solo; después podés ajustarlo.
        </p>

        <div className="actions">
          <button
            type="button"
            className="path-card primary"
            disabled={loading}
            onClick={() => handleCreateTree("minimize", "Intervención del pozo")}
          >
            <span className="title">Intervención en pozo</span>
            <span className="desc">Workover, recompletación, estimulación · Modo Costo</span>
          </button>
          <button
            type="button"
            className="path-card"
            disabled={loading}
            onClick={() => handleCreateTree("maximize", "Inversión")}
          >
            <span className="title">Inversión o perforación</span>
            <span className="desc">Nuevo pozo, adquisición, expansión · Modo Valor</span>
          </button>
          <button
            type="button"
            className="path-card"
            disabled={loading}
            onClick={() => handleCreateTree("maximize", "Decisión principal")}
          >
            <span className="title">Desde cero</span>
            <span className="desc">Empezás con un árbol vacío y elegís el modo</span>
          </button>
        </div>

        <div className="empty-divider">o un ejemplo resuelto</div>

        <div className="empty-examples">
          <button
            type="button"
            className="path-card example"
            disabled={loading}
            onClick={() => handleLoadExample(workoverExample, "Workover de pozo")}
          >
            <span className="title">Workover de pozo</span>
            <span className="desc">Intervención · Modo Costo</span>
          </button>
          <button
            type="button"
            className="path-card example"
            disabled={loading}
            onClick={() => handleLoadExample(vacaMuertaDevelopmentExample, "Desarrollo Vaca Muerta")}
          >
            <span className="title">Desarrollo Vaca Muerta</span>
            <span className="desc">Pilotos, áreas de desarrollo · Modo Valor</span>
          </button>
          <button
            type="button"
            className="path-card example"
            disabled={loading}
            onClick={() => handleLoadExample(oilDrillingExample, "Perforación de pozo")}
          >
            <span className="title">Perforación de pozo</span>
            <span className="desc">Inversión · Modo Valor</span>
          </button>
          <button
            type="button"
            className="path-card example"
            disabled={loading}
            onClick={() => handleLoadExample(productLaunchExample, "Lanzamiento de producto")}
          >
            <span className="title">Lanzamiento de producto</span>
            <span className="desc">Inversión · Modo Valor</span>
          </button>
        </div>
      </div>
    );
  }

  const rootNode = tree.nodes[tree.rootId];
  if (!rootNode) return null;
  const isCost = tree.metadata.mode === "minimize";

  return (
    <div className="node-list">
      <div className="node-list-mode">
        <span className="mode-chip">{isCost ? "Modo Costo" : "Modo Valor"}</span>
        <span>{isCost ? "Elegir menor costo esperado" : "Elegir mejor resultado esperado"}</span>
        <select
          aria-label="Cambiar modo del análisis"
          value={tree.metadata.mode}
          onChange={(e) => handleModeChange(e.target.value as "maximize" | "minimize")}
        >
          <option value="maximize">Modo Valor</option>
          <option value="minimize">Modo Costo</option>
        </select>
      </div>
      <NodeItem node={rootNode} depth={0} />
    </div>
  );
}
