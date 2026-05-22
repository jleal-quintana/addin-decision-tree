import React from "react";
import { useTree } from "../context/TreeContext";
import { NodeType } from "../../models/types";
import { RichIssue, countNodesByType } from "../utils/validationIssues";

interface StatusStripProps {
  issues: RichIssue[];
}

function ShapeGlyph({ type }: { type: NodeType }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="status-strip__glyph"
    >
      {type === "decision" && (
        <rect
          x="4"
          y="4"
          width="16"
          height="16"
          rx="2"
          fill="var(--bg-card)"
          stroke="var(--qe-azul)"
          strokeWidth="1.6"
        />
      )}
      {type === "chance" && (
        <circle
          cx="12"
          cy="12"
          r="8"
          fill="var(--bg-card)"
          stroke="var(--qe-azul)"
          strokeWidth="1.6"
        />
      )}
      {type === "end" && (
        <path
          d="M12 4l8 14H4z"
          fill="var(--bg-card)"
          stroke="var(--qe-azul)"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

function formatCurrency(value: number, isCost: boolean): string {
  const abs = Math.abs(value);
  const formatted = new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 0,
  }).format(abs);
  const prefix = value < 0 ? "-" : "";
  const suffix = isCost ? " costo" : "";
  return `${prefix}$${formatted}${suffix}`;
}

export function StatusStrip({ issues }: StatusStripProps) {
  const { state } = useTree();
  const tree = state.tree;

  if (!tree.rootId) return null;

  const counts = countNodesByType(tree);
  const root = tree.rootId ? tree.nodes[tree.rootId] : null;
  const rootEv = root?.expectedValue ?? null;
  const isCost = tree.metadata.mode === "minimize";

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warnCount = issues.length - errorCount;

  let dotClass = "";
  let statusText: React.ReactNode;

  if (errorCount > 0) {
    dotClass = "error";
    statusText =
      errorCount === 1
        ? "1 cosa por resolver · no se puede dibujar"
        : `${errorCount} cosas por resolver · no se puede dibujar`;
  } else if (warnCount > 0) {
    dotClass = "warn";
    statusText = "Revisar antes de dibujar";
  } else if (rootEv !== null) {
    statusText = (
      <>
        Cálculo sano ·{" "}
        <strong className="status-strip__value">
          {formatCurrency(rootEv, isCost)}
        </strong>
      </>
    );
  } else {
    dotClass = "warn";
    statusText = "Falta completar el árbol";
  }

  return (
    <div className="status-strip" role="status" aria-live="polite">
      <span className={`status-strip__dot ${dotClass}`} aria-hidden="true" />
      <span className="status-strip__text">{statusText}</span>
      <span className="status-strip__spacer" />
      <div className="status-strip__counts" aria-label="Conteo de nodos">
        <span className="status-strip__count" title="Decisiones">
          <ShapeGlyph type="decision" />
          <strong>{counts.decision}</strong>
        </span>
        <span className="status-strip__count" title="Incertidumbres">
          <ShapeGlyph type="chance" />
          <strong>{counts.chance}</strong>
        </span>
        <span className="status-strip__count" title="Resultados finales">
          <ShapeGlyph type="end" />
          <strong>{counts.end}</strong>
        </span>
      </div>
    </div>
  );
}
