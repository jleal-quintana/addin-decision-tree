import React, { useCallback, useEffect, useId, useMemo, useReducer, useRef, useState } from "react";
import { useTree } from "../context/TreeContext";
import { NodeType, TreeNode } from "../../models/types";

function formatProbabilityDraft(prob: number): string {
  const pct = prob * 100;
  if (!Number.isFinite(pct)) return "0";
  return Number.isInteger(pct) ? `${pct}` : pct.toFixed(1).replace(".", ",");
}

function parseProbabilityDraft(raw: string): number | null {
  const cleaned = raw.trim().replace(/[^\d.,-]/g, "").replace(",", ".");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const parsed = parseFloat(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(Math.max(parsed / 100, 0), 1);
}

interface ProbabilityInputProps {
  id?: string;
  className?: string;
  ariaLabel?: string;
  probability: number;
  onCommit: (probability: number) => void;
}

function ProbabilityInput({ id, className, ariaLabel, probability, onCommit }: ProbabilityInputProps) {
  const [draft, setDraft] = useState<string>(() => formatProbabilityDraft(probability));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setDraft(formatProbabilityDraft(probability));
  }, [probability]);

  const commit = () => {
    const parsed = parseProbabilityDraft(draft);
    if (parsed === null) {
      setDraft(formatProbabilityDraft(probability));
      return;
    }
    onCommit(parsed);
    setDraft(formatProbabilityDraft(parsed));
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      className={className}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => {
        focusedRef.current = true;
        e.target.select();
      }}
      onBlur={() => {
        focusedRef.current = false;
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      aria-label={ariaLabel}
    />
  );
}

const CUSTOM_FIELD_SUGGESTIONS = ["TIR", "Cash", "Precio petróleo", "OPEX", "CAPEX"];

type NodeUpdates = Partial<
  Pick<TreeNode, "label" | "branchLabel" | "type" | "payoff" | "probability" | "cost" | "time" | "customFields">
>;

type VanState = {
  inversion: number;
  flujo: number;
  anios: number;
  tasa: number;
};

type VanAction =
  | { type: "SET_INVERSION"; value: number }
  | { type: "SET_FLUJO"; value: number }
  | { type: "SET_ANIOS"; value: number }
  | { type: "SET_TASA"; value: number };

const initialVanState: VanState = {
  inversion: 0,
  flujo: 0,
  anios: 10,
  tasa: 10,
};

function vanReducer(state: VanState, action: VanAction): VanState {
  switch (action.type) {
    case "SET_INVERSION":
      return { ...state, inversion: action.value };
    case "SET_FLUJO":
      return { ...state, flujo: action.value };
    case "SET_ANIOS":
      return { ...state, anios: action.value };
    case "SET_TASA":
      return { ...state, tasa: action.value };
    default:
      return state;
  }
}

function calculateVan({ inversion, flujo, anios, tasa }: VanState): number {
  let van = -inversion;
  const r = tasa / 100;
  for (let t = 1; t <= anios; t++) {
    van += flujo / Math.pow(1 + r, t);
  }
  return Math.round(van);
}

function parseNumber(value: string, fallback = 0): number {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function Field({
  id,
  label,
  children,
}: {
  id?: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

function EditorBreadcrumb({
  node,
  tree,
  onNavigate,
}: {
  node: TreeNode;
  tree: Record<string, TreeNode>;
  onNavigate: (nodeId: string) => void;
}) {
  const chain: TreeNode[] = [];
  let current: TreeNode | null = node.parentId ? tree[node.parentId] : null;
  while (current) {
    chain.unshift(current);
    current = current.parentId ? tree[current.parentId] : null;
  }
  if (chain.length === 0) return null;

  return (
    <nav className="editor-breadcrumb" aria-label="Ruta del nodo">
      {chain.map((parent, idx) => {
        const label =
          parent.label.length > 16 ? parent.label.slice(0, 15) + "…" : parent.label;
        return (
          <React.Fragment key={parent.id}>
            <button
              type="button"
              className="editor-breadcrumb__item editor-breadcrumb__item--link"
              onClick={() => onNavigate(parent.id)}
              title={`Ir a ${parent.label}`}
            >
              {label}
            </button>
            <span className="editor-breadcrumb__sep" aria-hidden="true">
              ›
            </span>
            {idx === chain.length - 1 && <span className="sr-only">Nodo actual:</span>}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

function EditorHeader({
  node,
  tree,
  onNavigate,
}: {
  node: TreeNode;
  tree: Record<string, TreeNode>;
  onNavigate: (nodeId: string) => void;
}) {
  const title = {
    decision: "Editar decisión",
    chance: "Editar incertidumbre",
    end: "Editar resultado",
  }[node.type];

  return (
    <div className="editor-header">
      <span className={`node-badge node-badge-compact node-badge-${node.type}`} aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          {node.type === "decision" && (
            <rect x="4" y="4" width="16" height="16" rx="2" fill="var(--bg-card)" stroke="var(--qe-azul)" strokeWidth="1.5" />
          )}
          {node.type === "chance" && (
            <circle cx="12" cy="12" r="8" fill="var(--bg-card)" stroke="var(--qe-beige)" strokeWidth="1.5" />
          )}
          {node.type === "end" && (
            <path d="M12 4l8 14H4z" fill="var(--bg-card)" stroke="var(--qe-verde)" strokeWidth="1.5" strokeLinejoin="round" />
          )}
        </svg>
      </span>
      <div className="editor-header__text">
        <EditorBreadcrumb node={node} tree={tree} onNavigate={onNavigate} />
        <h2>{title}</h2>
      </div>
    </div>
  );
}

function TypeSelector({
  nodeType,
  onChange,
}: {
  nodeType: NodeType;
  onChange: (type: NodeType) => void;
}) {
  const options: Array<{ type: NodeType; label: string; title: string }> = [
    { type: "decision", label: "Decisión", title: "Vos elegís entre alternativas" },
    { type: "chance", label: "Incertidumbre", title: "El pozo, el mercado o la naturaleza responden" },
    { type: "end", label: "Resultado final", title: "Resultado final de una rama" },
  ];

  return (
    <div className="type-selector" role="radiogroup" aria-label="Tipo de nodo">
      {options.map((option) => (
        <button
          key={option.type}
          type="button"
          className={`type-option ${nodeType === option.type ? `active ${option.type}` : ""}`}
          onClick={() => onChange(option.type)}
          role="radio"
          aria-checked={nodeType === option.type}
          title={option.title}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ProbabilityBar({ sum, ok }: { sum: number; ok: boolean }) {
  const pct = Math.min(Math.max(sum, 0), 1) * 100;
  return (
    <div className="prob-bar" role="presentation">
      <div
        className={`prob-bar__fill ${ok ? "ok" : "warn"}`}
        style={{ width: `${pct}%` }}
      />
      <div className="prob-bar__marker" aria-hidden="true" />
    </div>
  );
}

function ProbabilityField({
  node,
  parentNode,
  siblingProbSum,
  onCommit,
}: {
  node: TreeNode;
  parentNode: TreeNode | null;
  siblingProbSum: number | null;
  onCommit: (nodeId: string, probability: number) => void;
}) {
  const id = useId();
  if (parentNode?.type !== "chance") return null;

  const sumOk = siblingProbSum !== null && Math.abs(siblingProbSum - 1) <= 0.001;

  return (
    <Field id={id} label="Probabilidad de esta rama">
      <div className="field-row field-row-compact">
        <ProbabilityInput
          id={id}
          probability={node.probability ?? 0}
          onCommit={(probability) => onCommit(node.id, probability)}
          ariaLabel={`Probabilidad de ${node.branchLabel || node.label}`}
        />
        <div className="field-unit">%</div>
      </div>
      {siblingProbSum !== null && (
        <>
          <ProbabilityBar sum={siblingProbSum} ok={sumOk} />
          <div className={`hint ${sumOk ? "ok" : "error"}`}>
            Suma del grupo: {(siblingProbSum * 100).toFixed(1)}%
            {sumOk ? " · OK" : " · las ramas deben sumar 100%"}
          </div>
        </>
      )}
    </Field>
  );
}

function ChildProbabilities({
  node,
  nodes,
  onCommit,
}: {
  node: TreeNode;
  nodes: Record<string, TreeNode>;
  onCommit: (nodeId: string, probability: number) => void;
}) {
  const headingId = useId();
  if (node.type !== "chance" || node.childIds.length === 0) return null;

  const sum = node.childIds.reduce((total, childId) => total + (nodes[childId]?.probability ?? 0), 0);
  const sumOk = Math.abs(sum - 1) <= 0.001;

  return (
    <div className="field" role="group" aria-labelledby={headingId}>
      <div id={headingId} className="field-label">
        Ramas de esta incertidumbre
      </div>
      <div className="hint">El texto y el porcentaje viven sobre la rama, no dentro del círculo.</div>
      {node.childIds.map((childId) => {
        const child = nodes[childId];
        if (!child) return null;
        const inputId = `${headingId}-${childId}`;

        return (
          <div key={childId} className="field-row probability-child-row">
            <label htmlFor={inputId} className="inline-field-label">
              {child.branchLabel || child.label}
            </label>
            <ProbabilityInput
              id={inputId}
              className="probability-input"
              probability={child.probability ?? 0}
              onCommit={(probability) => onCommit(childId, probability)}
              ariaLabel={`Probabilidad de ${child.branchLabel || child.label}`}
            />
            <span className="field-unit">%</span>
          </div>
        );
      })}
      <ProbabilityBar sum={sum} ok={sumOk} />
      <div className={`hint ${sumOk ? "ok" : "error"}`} style={{ marginTop: 4 }}>
        Total: {(sum * 100).toFixed(1)}%
        {sumOk ? " · OK" : " · las ramas deben sumar 100%"}
      </div>
    </div>
  );
}

function IncomingBranchFields({
  node,
  parentNode,
  siblingProbSum,
  onUpdate,
}: {
  node: TreeNode;
  parentNode: TreeNode | null;
  siblingProbSum: number | null;
  onUpdate: (updates: NodeUpdates) => void;
}) {
  if (!parentNode || parentNode.type !== "chance") return null;
  const missing =
    siblingProbSum === null ? 0 : Math.max(0, 1 - (siblingProbSum - (node.probability ?? 0)));

  return (
    <div className="branch-editor">
      <ProbabilityField
        node={node}
        parentNode={parentNode}
        siblingProbSum={siblingProbSum}
        onCommit={(nodeId, probability) => {
          if (nodeId === node.id) onUpdate({ probability });
        }}
      />
      {Math.abs(missing - (node.probability ?? 0)) > 0.001 && (
        <button
          type="button"
          className="field-completer"
          onClick={() => onUpdate({ probability: missing })}
        >
          Completar restante: {(missing * 100).toFixed(1)}%
        </button>
      )}
    </div>
  );
}

function VanCalculator({
  state,
  dispatchVan,
  onUse,
  onClose,
}: {
  state: VanState;
  dispatchVan: React.Dispatch<VanAction>;
  onUse: () => void;
  onClose: () => void;
}) {
  const inversionId = useId();
  const flujoId = useId();
  const aniosId = useId();
  const tasaId = useId();

  return (
    <div className="van-calculator" role="region" aria-label="Calculadora rápida de VAN">
      <h3>Calculadora VAN rápida</h3>
      <div className="field-row">
        <Field id={inversionId} label="Inversión">
          <input
            id={inversionId}
            type="number"
            value={state.inversion}
            onChange={(e) => dispatchVan({ type: "SET_INVERSION", value: parseNumber(e.target.value) })}
            step="100000"
          />
        </Field>
        <Field id={flujoId} label="Flujo anual">
          <input
            id={flujoId}
            type="number"
            value={state.flujo}
            onChange={(e) => dispatchVan({ type: "SET_FLUJO", value: parseNumber(e.target.value) })}
            step="50000"
          />
        </Field>
      </div>
      <div className="field-row">
        <Field id={aniosId} label="Años">
          <input
            id={aniosId}
            type="number"
            value={state.anios}
            onChange={(e) => dispatchVan({ type: "SET_ANIOS", value: parseNumber(e.target.value, 1) })}
            min="1"
            max="50"
          />
        </Field>
        <Field id={tasaId} label="Tasa (%)">
          <input
            id={tasaId}
            type="number"
            value={state.tasa}
            onChange={(e) => dispatchVan({ type: "SET_TASA", value: parseNumber(e.target.value) })}
            step="1"
          />
        </Field>
      </div>
      <div className="van-result">VAN: ${calculateVan(state).toLocaleString("es-AR")}</div>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <button type="button" className="path-card primary btn-compact" onClick={onUse} style={{ minHeight: 32, padding: "6px 12px" }}>
          <span className="title" style={{ fontSize: 12 }}>Usar este VAN</span>
        </button>
        <button type="button" className="inline-link-button" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}

function CustomFields({
  node,
  onUpdate,
}: {
  node: TreeNode;
  onUpdate: (customFields: TreeNode["customFields"]) => void;
}) {
  const headingId = useId();
  const newFieldId = useId();
  const [newName, setNewName] = useState("");
  const [showNew, setShowNew] = useState(false);

  const suggestions: string[] = [];
  for (const suggestion of CUSTOM_FIELD_SUGGESTIONS) {
    if (!(node.customFields ?? {})[suggestion]) suggestions.push(suggestion);
    if (suggestions.length === 3) break;
  }

  const commitNew = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    onUpdate({ ...(node.customFields ?? {}), [trimmed]: "" });
    setNewName("");
    setShowNew(false);
  };

  return (
    <div className="field custom-fields" role="group" aria-labelledby={headingId}>
      <div id={headingId} className="field-label">
        Campos adicionales
      </div>
      {Object.entries(node.customFields ?? {}).map(([key, value]) => {
        const inputId = `${headingId}-${key}`;
        return (
          <div key={key} className="field-row custom-field-row">
            <label htmlFor={inputId} className="inline-field-label custom-field-key">
              {key}
            </label>
            <input
              id={inputId}
              type="text"
              value={value ?? ""}
              onChange={(e) => onUpdate({ ...node.customFields, [key]: e.target.value })}
              className="custom-field-input"
            />
            <button
              type="button"
              className="custom-field-delete"
              onClick={() => {
                const nextFields = { ...node.customFields };
                delete nextFields[key];
                onUpdate(nextFields);
              }}
              title="Eliminar campo"
              aria-label={`Eliminar campo ${key}`}
            >
              <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true">
                <path d="M4 4l6 6M10 4l-6 6" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          </div>
        );
      })}
      <div className="custom-field-actions">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            className="inline-link-button"
            onClick={() => onUpdate({ ...(node.customFields ?? {}), [suggestion]: "" })}
          >
            + {suggestion}
          </button>
        ))}
        {!showNew && (
          <button type="button" className="inline-link-button" onClick={() => setShowNew(true)}>
            + Otro
          </button>
        )}
      </div>
      {showNew && (
        <div className="custom-field-new">
          <label htmlFor={newFieldId} className="sr-only" style={{ position: "absolute", left: -9999 }}>
            Nombre del campo nuevo
          </label>
          <input
            id={newFieldId}
            type="text"
            value={newName}
            placeholder="Nombre del campo"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitNew();
              } else if (e.key === "Escape") {
                setNewName("");
                setShowNew(false);
              }
            }}
            autoFocus
          />
          <button type="button" className="inline-link-button" onClick={commitNew}>
            Agregar
          </button>
          <button
            type="button"
            className="inline-link-button"
            onClick={() => {
              setNewName("");
              setShowNew(false);
            }}
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}

function EditorSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="editor-section">
      <h3 className="editor-section__title">{title}</h3>
      <div className="editor-section__body">{children}</div>
    </section>
  );
}

export function NodeEditor() {
  const { state, dispatch } = useTree();
  const node = state.selectedNodeId ? state.tree.nodes[state.selectedNodeId] : null;
  const [showVan, setShowVan] = useState(false);
  const [vanState, dispatchVan] = useReducer(vanReducer, initialVanState);
  const labelId = useId();
  const costId = useId();
  const timeId = useId();
  const payoffId = useId();

  const updateNode = useCallback(
    (nodeId: string, updates: NodeUpdates) => {
      dispatch({ type: "UPDATE_NODE", nodeId, updates });
    },
    [dispatch]
  );

  const navigateToNode = useCallback(
    (nodeId: string) => {
      dispatch({ type: "SELECT_NODE", nodeId });
    },
    [dispatch]
  );

  const parentNode = useMemo(() => {
    if (!node) return null;
    return node.parentId ? state.tree.nodes[node.parentId] : null;
  }, [node, state.tree.nodes]);

  const siblingProbSum = useMemo(() => {
    if (!node || !parentNode || parentNode.type !== "chance") return null;
    return parentNode.childIds.reduce(
      (sum, id) => sum + (state.tree.nodes[id]?.probability ?? 0),
      0
    );
  }, [node, parentNode, state.tree.nodes]);

  if (!node) return null;

  const hasProbabilitySection = parentNode?.type === "chance";
  const isCost = state.tree.metadata.mode === "minimize";
  const evLabel = isCost ? "Costo esperado" : "Valor esperado";
  const payoffLabel = isCost ? "Costo terminal ($)" : "Resultado ($)";
  const payoffHint = isCost
    ? "Costo total acumulado al llegar a este resultado. Se suma con los costos del camino."
    : "Ingresá el VAN terminal o el ingreso final de esta rama.";
  const costLabel = isCost ? "Costo adicional del nodo ($)" : "Costo de la rama ($)";
  const costHint = isCost
    ? "Costo de pasar por este nodo. Se suma al costo terminal."
    : "Gasto asociado a la rama. Se resta del resultado.";

  return (
    <div className="node-editor">
      <EditorHeader node={node} tree={state.tree.nodes} onNavigate={navigateToNode} />

      <EditorSection title="Identidad">
        <Field id={labelId} label="Nombre">
          <input
            id={labelId}
            type="text"
            value={node.label}
            onChange={(e) => updateNode(node.id, { label: e.target.value })}
            placeholder="Ej: Prueba de hermeticidad"
          />
          <div className="hint">
            Nombre del paso o estado. Aparece en el dibujo de Excel.
          </div>
        </Field>

        <div className="field">
          <div className="field-label">Tipo</div>
          <TypeSelector nodeType={node.type} onChange={(type) => updateNode(node.id, { type })} />
        </div>
      </EditorSection>

      {hasProbabilitySection && parentNode && (
        <EditorSection title="Probabilidad de esta rama">
          <IncomingBranchFields
            node={node}
            parentNode={parentNode}
            siblingProbSum={siblingProbSum}
            onUpdate={(updates) => updateNode(node.id, updates)}
          />
        </EditorSection>
      )}

      <EditorSection title="Valores">
        {node.type === "end" && (
          <>
            <Field id={payoffId} label={payoffLabel}>
              <input
                id={payoffId}
                type="number"
                className="money"
                value={node.payoff ?? 0}
                onChange={(e) => updateNode(node.id, { payoff: parseNumber(e.target.value) })}
                step="10000"
              />
              <div className="hint">
                {payoffHint}
                {!isCost && (
                  <>
                    {" "}
                    <button type="button" className="inline-link-button" onClick={() => setShowVan((open) => !open)}>
                      {showVan ? "Cerrar calculadora" : "Calcular VAN"}
                    </button>
                  </>
                )}
              </div>
            </Field>

            {showVan && (
              <VanCalculator
                state={vanState}
                dispatchVan={dispatchVan}
                onUse={() => {
                  updateNode(node.id, { payoff: calculateVan(vanState) });
                  setShowVan(false);
                }}
                onClose={() => setShowVan(false)}
              />
            )}
          </>
        )}

        <Field id={costId} label={costLabel}>
          <input
            id={costId}
            type="number"
            value={node.cost ?? ""}
            onChange={(e) =>
              updateNode(node.id, {
                cost: Number.isNaN(parseFloat(e.target.value)) ? null : parseFloat(e.target.value),
              })
            }
            placeholder="Opcional"
            step="10000"
          />
          <div className="hint">{costHint}</div>
        </Field>

        <Field id={timeId} label="Tiempo">
          <input
            id={timeId}
            type="text"
            value={node.time ?? ""}
            onChange={(e) => updateNode(node.id, { time: e.target.value || null })}
            placeholder="Ej: 3 meses, 2 semanas"
          />
        </Field>

        <ChildProbabilities
          node={node}
          nodes={state.tree.nodes}
          onCommit={(nodeId, probability) => updateNode(nodeId, { probability })}
        />

        {node.expectedValue !== null && (
          <div className="field expected-value-field">
            <div className="field-label">{evLabel}</div>
            <div className={`ev-badge ${node.expectedValue >= 0 ? "positive" : "negative"}`}>
              ${node.expectedValue.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
            </div>
          </div>
        )}

        <CustomFields node={node} onUpdate={(customFields) => updateNode(node.id, { customFields })} />
      </EditorSection>
    </div>
  );
}
