import React, { useCallback, useId, useReducer, useState } from "react";
import { useTree } from "../context/TreeContext";
import { NodeType, TreeNode } from "../../models/types";

const CUSTOM_FIELD_SUGGESTIONS = ["TIR", "Cash", "Precio petroleo", "OPEX", "CAPEX"];

type NodeUpdates = Partial<Pick<TreeNode, "label" | "branchLabel" | "type" | "payoff" | "probability" | "cost" | "time" | "customFields">>;

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

function EditorHeader({ type }: { type: NodeType }) {
  const title = {
    decision: "Editar decision",
    chance: "Editar incertidumbre",
    end: "Editar resultado",
  }[type];

  return (
    <div className="editor-header">
      <div className={`node-badge node-badge-compact ${type}`}>
        {{ decision: "D", chance: "C", end: "R" }[type]}
      </div>
      <h4>{title}</h4>
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
    { type: "decision", label: "Decision", title: "Vos elegis entre alternativas" },
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

  return (
    <Field id={id} label="Probabilidad de esta rama">
      <div className="field-row field-row-compact">
        <input
          id={id}
          type="number"
          value={((node.probability ?? 0) * 100).toFixed(1)}
          onChange={(e) => onCommit(node.id, parseNumber(e.target.value) / 100)}
          min="0"
          max="100"
          step="5"
        />
        <div className="field-unit">%</div>
      </div>
      {siblingProbSum !== null && (
        <div className="hint" style={{ color: Math.abs(siblingProbSum - 1) > 0.001 ? "#c0392b" : "var(--qe-verde)" }}>
          Suma del grupo: {(siblingProbSum * 100).toFixed(1)}%
          {Math.abs(siblingProbSum - 1) > 0.001 ? " (las ramas deben sumar 100%)" : " OK"}
        </div>
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

  return (
    <div className="field" role="group" aria-labelledby={headingId}>
      <div id={headingId} className="field-label">Ramas de esta incertidumbre</div>
      <div className="hint">El texto y el porcentaje viven sobre la rama, no dentro de la bolita.</div>
      {node.childIds.map((childId) => {
        const child = nodes[childId];
        if (!child) return null;
        const inputId = `${headingId}-${childId}`;

        return (
          <div key={childId} className="field-row probability-child-row">
            <label htmlFor={inputId} className="inline-field-label">
              {child.branchLabel || child.label}
            </label>
            <input
              id={inputId}
              type="number"
              value={((child.probability ?? 0) * 100).toFixed(1)}
              onChange={(e) => onCommit(childId, parseNumber(e.target.value) / 100)}
              min="0"
              max="100"
              step="5"
              className="probability-input"
            />
            <span className="field-unit">%</span>
          </div>
        );
      })}
      <div className="hint" style={{ color: Math.abs(sum - 1) > 0.001 ? "#c0392b" : "var(--qe-verde)", marginTop: 4 }}>
        Total: {(sum * 100).toFixed(1)}%
        {Math.abs(sum - 1) > 0.001 ? " (las ramas deben sumar 100%)" : " OK"}
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
  const branchId = useId();
  if (!parentNode) return null;
  const missing = siblingProbSum === null ? 0 : Math.max(0, 1 - (siblingProbSum - (node.probability ?? 0)));

  return (
    <div className="branch-editor">
      <div className="field-label">Rama que llega a este nodo</div>
      <div className="hint branch-help">La rama dice que paso; el nodo dice que viene despues.</div>
      <Field id={branchId} label="Texto de rama">
        <input
          id={branchId}
          type="text"
          value={node.branchLabel ?? ""}
          onChange={(e) => onUpdate({ branchLabel: e.target.value || null })}
          placeholder="Ej: No desplaza, Positiva, Continuar"
        />
      </Field>
      <ProbabilityField
        node={node}
        parentNode={parentNode}
        siblingProbSum={siblingProbSum}
        onCommit={(nodeId, probability) => {
          if (nodeId === node.id) onUpdate({ probability });
        }}
      />
      {parentNode.type === "chance" && parentNode.childIds.length === 2 && Math.abs(missing - (node.probability ?? 0)) > 0.001 && (
        <button
          type="button"
          className="inline-link-button"
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
}: {
  state: VanState;
  dispatchVan: React.Dispatch<VanAction>;
  onUse: () => void;
}) {
  const inversionId = useId();
  const flujoId = useId();
  const aniosId = useId();
  const tasaId = useId();

  return (
    <div className="van-calculator">
      <h5>Calculadora VAN rapida</h5>
      <div className="field-row">
        <Field id={inversionId} label="Inversion">
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
        <Field id={aniosId} label="Anios">
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
      <button className="btn-create decision btn-compact" type="button" onClick={onUse}>
        Usar este VAN
      </button>
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

  const suggestions: string[] = [];
  for (const suggestion of CUSTOM_FIELD_SUGGESTIONS) {
    if (!(node.customFields ?? {})[suggestion]) suggestions.push(suggestion);
    if (suggestions.length === 3) break;
  }

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
              className="delete custom-field-delete"
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
            className="btn-create example btn-compact"
            onClick={() => onUpdate({ ...(node.customFields ?? {}), [suggestion]: "" })}
          >
            + {suggestion}
          </button>
        ))}
        <button
          type="button"
          className="btn-create example btn-compact"
          onClick={() => {
            const name = prompt("Nombre del campo:");
            if (name?.trim()) onUpdate({ ...(node.customFields ?? {}), [name.trim()]: "" });
          }}
        >
          + Otro
        </button>
      </div>
    </div>
  );
}

export function NodeEditor() {
  const { state, dispatch } = useTree();
  const node = state.selectedNodeId ? state.tree.nodes[state.selectedNodeId] : null;
  const [showVan, setShowVan] = useState(false);
  const [vanState, dispatchVan] = useReducer(vanReducer, initialVanState);
  const labelId = useId();
  const typeId = useId();
  const costId = useId();
  const timeId = useId();
  const payoffId = useId();

  const updateNode = useCallback(
    (nodeId: string, updates: NodeUpdates) => {
      dispatch({ type: "UPDATE_NODE", nodeId, updates });
    },
    [dispatch]
  );

  if (!node) return null;

  const parentNode = node.parentId ? state.tree.nodes[node.parentId] : null;
  const siblingProbSum = parentNode?.type === "chance"
    ? parentNode.childIds.reduce((sum, id) => sum + (state.tree.nodes[id]?.probability ?? 0), 0)
    : null;

  return (
    <div className="node-editor">
      <EditorHeader type={node.type} />

      <Field id={labelId} label="Nombre">
        <input
          id={labelId}
          type="text"
          value={node.label}
          onChange={(e) => updateNode(node.id, { label: e.target.value })}
          placeholder="Ej: Prueba de hermeticidad"
        />
        <div className="hint">Nombre del paso o estado. No uses este campo para Si/No; eso va en la rama.</div>
      </Field>

      <IncomingBranchFields
        node={node}
        parentNode={parentNode}
        siblingProbSum={siblingProbSum}
        onUpdate={(updates) => updateNode(node.id, updates)}
      />

      <div className="field" id={typeId}>
        <div className="field-label">Tipo</div>
        <TypeSelector nodeType={node.type} onChange={(type) => updateNode(node.id, { type })} />
      </div>

      <ChildProbabilities
        node={node}
        nodes={state.tree.nodes}
        onCommit={(nodeId, probability) => updateNode(nodeId, { probability })}
      />

      {parentNode && (
        <div className="field insert-step">
          <div className="field-label">Insertar paso entre medio</div>
          <div className="hint">Usalo cuando una rama no termina aca y necesitás agregar otra decision o incertidumbre antes de este nodo.</div>
          <div className="insert-step-actions">
            <button
              type="button"
              className="btn-create example btn-compact"
              onClick={() => dispatch({ type: "INSERT_INTERMEDIATE_NODE", nodeId: node.id, nodeType: "chance", label: "Nueva incertidumbre" })}
            >
              + Incertidumbre
            </button>
            <button
              type="button"
              className="btn-create example btn-compact"
              onClick={() => dispatch({ type: "INSERT_INTERMEDIATE_NODE", nodeId: node.id, nodeType: "decision", label: "Nueva decision" })}
            >
              + Decision
            </button>
          </div>
        </div>
      )}

      <Field id={costId} label="Costo de rama ($)">
        <input
          id={costId}
          type="number"
          value={node.cost ?? ""}
          onChange={(e) => updateNode(node.id, { cost: Number.isNaN(parseFloat(e.target.value)) ? null : parseFloat(e.target.value) })}
          placeholder="Opcional"
          step="10000"
        />
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

      {node.type === "end" && (
        <>
          <Field id={payoffId} label="Resultado ($)">
            <input
              id={payoffId}
              type="number"
              className="money"
              value={node.payoff ?? 0}
              onChange={(e) => updateNode(node.id, { payoff: parseNumber(e.target.value) })}
              step="10000"
            />
            <div className="hint">
              Ingresa el VAN terminal o el resultado directo. El arbol recalcula solo y al dibujarlo en Excel queda reflejado en el diagrama.{" "}
              <button type="button" className="inline-link-button" onClick={() => setShowVan((open) => !open)}>
                {showVan ? "Cerrar" : "Calcular VAN"}
              </button>
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
            />
          )}
        </>
      )}

      {node.expectedValue !== null && (
        <div className="field expected-value-field">
          <div className="field-label">{state.tree.metadata.mode === "minimize" ? "Costo esperado" : "Valor esperado"}</div>
          <div className={`ev-badge ${node.expectedValue >= 0 ? "positive" : "negative"}`}>
            ${node.expectedValue.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
          </div>
        </div>
      )}

      <CustomFields
        node={node}
        onUpdate={(customFields) => updateNode(node.id, { customFields })}
      />
    </div>
  );
}
