import React, { RefObject, useEffect, useId, useRef, useState } from "react";
import { workoverExample } from "../../engine/Examples";
import { useTree } from "../context/TreeContext";
import { ConfirmDialog } from "./ConfirmDialog";

interface HelpPopoverProps {
  open: boolean;
  onClose: () => void;
  triggerRef?: RefObject<HTMLElement | null>;
}

export function HelpPopover({ open, onClose, triggerRef }: HelpPopoverProps) {
  const { state, dispatch } = useTree();
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    ref.current?.focus();

    function handleClick(ev: MouseEvent) {
      const target = ev.target as Node;
      if (ref.current?.contains(target)) return;
      if (triggerRef?.current?.contains(target)) return;
      onCloseRef.current();
    }

    function handleKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") onCloseRef.current();
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, triggerRef]);

  useEffect(() => {
    if (open) return;
    const prev = previouslyFocused.current;
    if (prev && typeof prev.focus === "function") prev.focus();
  }, [open]);

  const loadWorkover = () => {
    dispatch({ type: "LOAD_EXAMPLE", data: workoverExample() });
    onClose();
  };

  const handleExample = () => {
    if (state.tree.rootId) {
      setShowOverwriteConfirm(true);
    } else {
      loadWorkover();
    }
  };

  if (!open) return null;

  return (
    <div
      className="help-popover"
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      ref={ref}
    >
      <h2 id={titleId}>Cómo leer el árbol</h2>

      <div className="help-shape-row">
        <span className="help-shape" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="2" fill="var(--bg-card)" stroke="var(--qe-azul)" strokeWidth="1.8" />
          </svg>
        </span>
        <span>
          <strong>Cuadrado</strong>: decisión que tomás vos.
        </span>
      </div>
      <div className="help-shape-row">
        <span className="help-shape" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" fill="var(--bg-card)" stroke="var(--qe-beige)" strokeWidth="1.8" />
          </svg>
        </span>
        <span>
          <strong>Círculo</strong>: incertidumbre — el pozo, el mercado o el clima responden.
        </span>
      </div>
      <div className="help-shape-row">
        <span className="help-shape" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M12 3l9 16H3z" fill="var(--bg-card)" stroke="var(--qe-verde)" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
        </span>
        <span>
          <strong>Triángulo</strong>: resultado final del camino.
        </span>
      </div>

      <button type="button" className="help-link" onClick={handleExample}>
        Ver ejemplo resuelto (Workover)
      </button>

      <ConfirmDialog
        open={showOverwriteConfirm}
        title="¿Reemplazar el árbol actual?"
        body={
          <>
            <p>Cargar el ejemplo de Workover reemplaza el árbol que tenés ahora.</p>
            <p>Si querés conservarlo, primero tocá Guardar.</p>
          </>
        }
        confirmLabel="Reemplazar y cargar"
        destructive
        onConfirm={() => {
          setShowOverwriteConfirm(false);
          loadWorkover();
        }}
        onCancel={() => setShowOverwriteConfirm(false)}
      />
    </div>
  );
}
