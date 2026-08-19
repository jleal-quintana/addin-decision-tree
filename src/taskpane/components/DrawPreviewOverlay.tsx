import React, { useMemo, useRef } from "react";
import { DecisionTreeData } from "../../models/types";
import { layoutTreeCompact } from "../utils/treeLayout";
import { useDialogFocus } from "../hooks/useDialogFocus";
import { countNodesByType } from "../utils/validationIssues";

interface DrawPreviewOverlayProps {
  tree: DecisionTreeData;
  onConfirm: () => void;
  onCancel: () => void;
}

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "—";
  const abs = Math.abs(value);
  const formatted = new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 0,
  }).format(abs);
  const prefix = value < 0 ? "-" : "";
  return `${prefix}$${formatted}`;
}

export function DrawPreviewOverlay({ tree, onConfirm, onCancel }: DrawPreviewOverlayProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(true, dialogRef, confirmRef, onCancel);

  const W = 340;
  const H = 160;
  const layout = useMemo(
    () => layoutTreeCompact(tree, W, H, { top: 18, right: 22, bottom: 18, left: 22 }),
    [tree]
  );

  const counts = useMemo(() => countNodesByType(tree), [tree]);
  const root = tree.rootId ? tree.nodes[tree.rootId] : null;
  const rootEv = root?.expectedValue ?? null;
  const isCost = tree.metadata.mode === "minimize";
  const modeLabel = isCost ? "Costo" : "Valor";
  const evLabel = isCost ? "Costo esperado" : "Valor esperado";

  return (
    <div
      className="overlay-backdrop"
      onClick={onCancel}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="draw-preview"
        role="dialog"
        aria-modal="true"
        aria-labelledby="draw-preview-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="draw-preview__header">
          <div>
            <div className="draw-preview__eyebrow">Previsualización</div>
            <h2 id="draw-preview-title" className="draw-preview__title">
              Esto se va a dibujar
            </h2>
          </div>
          <button
            type="button"
            className="draw-preview__close"
            onClick={onCancel}
            aria-label="Cerrar previsualización"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M3 3l8 8M11 3l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="draw-preview__viewport">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-label="Vista previa del árbol">
            {layout.edges.map((edge) => {
              const from = layout.positionsById.get(edge.fromId);
              const to = layout.positionsById.get(edge.toId);
              if (!from || !to) return null;
              const midX = (from.x + to.x) / 2;
              return (
                <path
                  key={`${edge.fromId}-${edge.toId}`}
                  d={`M${from.x + 6},${from.y} L${midX},${from.y} L${midX},${to.y} L${to.x - 6},${to.y}`}
                  fill="none"
                  stroke={edge.isOptimal ? "var(--qe-verde)" : "var(--qe-azul)"}
                  strokeWidth={edge.isOptimal ? 2 : 1.3}
                />
              );
            })}
            {layout.nodes.map((node) => {
              const fill = node.isOptimal ? "var(--qe-lima-soft)" : "var(--bg-card)";
              const stroke = node.isOptimal ? "var(--qe-verde)" : "var(--qe-azul)";
              const sw = node.isOptimal ? 2 : 1.3;
              if (node.type === "decision") {
                return (
                  <rect
                    key={node.id}
                    x={node.x - 6}
                    y={node.y - 6}
                    width={12}
                    height={12}
                    rx={1.5}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={sw}
                  />
                );
              }
              if (node.type === "chance") {
                return (
                  <circle
                    key={node.id}
                    cx={node.x}
                    cy={node.y}
                    r={6}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={sw}
                  />
                );
              }
              return (
                <path
                  key={node.id}
                  d={`M${node.x},${node.y - 6} L${node.x + 6},${node.y + 5} L${node.x - 6},${node.y + 5} Z`}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={sw}
                  strokeLinejoin="round"
                />
              );
            })}
          </svg>
        </div>

        <dl className="draw-preview__details">
          <div className="draw-preview__row">
            <dt>Nodos</dt>
            <dd>
              {counts.total}{" "}
              <span className="draw-preview__row-aux">
                · {counts.decision} decisiones · {counts.chance} incertidumbres · {counts.end} resultados
              </span>
            </dd>
          </div>
          <div className="draw-preview__row">
            <dt>Modo</dt>
            <dd>{modeLabel}</dd>
          </div>
          <div className="draw-preview__row">
            <dt>{evLabel}</dt>
            <dd className="draw-preview__highlight">{formatCurrency(rootEv)}</dd>
          </div>
          <div className="draw-preview__row">
            <dt>Hoja destino</dt>
            <dd>Arbol_Decision</dd>
          </div>
        </dl>

        <div className="draw-preview__actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="btn btn-hero"
            onClick={onConfirm}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M2 14l3-1 8-8-2-2-8 8z" />
              <path d="M10 4l2 2" />
            </svg>
            Dibujar en Excel
          </button>
        </div>
      </div>
    </div>
  );
}
