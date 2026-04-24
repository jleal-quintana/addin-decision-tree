import React, { RefObject, useEffect, useId, useRef } from "react";
import { useTree } from "../context/TreeContext";
import { workoverExample } from "../../engine/Examples";

interface HelpPopoverProps {
  open: boolean;
  onClose: () => void;
  triggerRef?: RefObject<HTMLElement | null>;
}

export function HelpPopover({ open, onClose, triggerRef }: HelpPopoverProps) {
  const { dispatch } = useTree();
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    // Enfocar el diálogo al abrir para lectores de pantalla y foco de teclado.
    ref.current?.focus();

    function handleClick(ev: MouseEvent) {
      const target = ev.target as Node;
      if (ref.current?.contains(target)) return;
      if (triggerRef?.current?.contains(target)) return; // el trigger maneja su propio toggle
      onClose();
    }
    function handleKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose, triggerRef]);

  useEffect(() => {
    if (open) return;
    // Al cerrar, devolver el foco al elemento que lo tenía antes de abrir.
    const prev = previouslyFocused.current;
    if (prev && typeof prev.focus === "function") prev.focus();
  }, [open]);

  const handleExample = () => {
    dispatch({ type: "LOAD_EXAMPLE", data: workoverExample() });
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="help-popover"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      ref={ref}
    >
      <h4 id={titleId}>Cómo leer el árbol</h4>

      <div className="help-shape-row">
        <span className="help-shape decision" aria-hidden />
        <span><strong>Cuadrado</strong> — Decisión que tomás vos.</span>
      </div>
      <div className="help-shape-row">
        <span className="help-shape chance" aria-hidden />
        <span><strong>Círculo</strong> — Incertidumbre: el pozo, mercado o clima responde.</span>
      </div>
      <div className="help-shape-row">
        <span className="help-shape end" aria-hidden />
        <span><strong>Triángulo</strong> — Resultado final del camino.</span>
      </div>

      <button type="button" className="help-link" onClick={handleExample}>
        Ver ejemplo resuelto (Workover)
      </button>
    </div>
  );
}
