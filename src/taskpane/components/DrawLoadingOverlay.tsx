import React, { useEffect, useState } from "react";

interface DrawLoadingOverlayProps {
  active: boolean;
}

const STAGES = [
  { id: "calc", label: "Calculando valores esperados" },
  { id: "layout", label: "Resolviendo layout del árbol" },
  { id: "shapes", label: "Dibujando formas y conectores" },
  { id: "calc-sheet", label: "Memoria de cálculo en hoja oculta" },
  { id: "summary", label: "Tabla de resultados y recomendación" },
  { id: "page", label: "Ajustando hoja para impresión" },
];

const STAGE_INTERVAL_MS = 600;

export function DrawLoadingOverlay({ active }: DrawLoadingOverlayProps) {
  const [stageIdx, setStageIdx] = useState(0);

  useEffect(() => {
    if (!active) {
      setStageIdx(0);
      return;
    }
    let current = 0;
    const interval = window.setInterval(() => {
      current = Math.min(current + 1, STAGES.length - 1);
      setStageIdx(current);
    }, STAGE_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [active]);

  if (!active) return null;

  return (
    <div
      className="overlay-backdrop overlay-backdrop--passive"
      role="presentation"
    >
      <div
        className="draw-loading"
        role="dialog"
        aria-modal="true"
        aria-labelledby="draw-loading-title"
        aria-busy="true"
      >
        <div className="draw-loading__spinner" aria-hidden="true" />
        <h2 id="draw-loading-title" className="draw-loading__title">
          Dibujando en Excel
        </h2>
        <p className="draw-loading__sub">
          No cierres el panel mientras se renderiza el árbol.
        </p>
        <ul className="draw-loading__steps">
          {STAGES.map((stage, idx) => {
            const status =
              idx < stageIdx ? "done" : idx === stageIdx ? "active" : "pending";
            return (
              <li
                key={stage.id}
                className={`draw-loading__step draw-loading__step--${status}`}
              >
                <span className="draw-loading__dot" aria-hidden="true">
                  {status === "done" ? (
                    <svg width="10" height="10" viewBox="0 0 10 10">
                      <path
                        d="M2 5l2 2 4-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                </span>
                <span className="draw-loading__step-label">{stage.label}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
