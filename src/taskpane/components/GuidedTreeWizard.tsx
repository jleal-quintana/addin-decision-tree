import React, { useMemo, useState } from "react";
import { compareRootDecision } from "../../engine/DecisionComparison";
import {
  buildGuidedTree,
  GuidedBranchInput,
  GuidedDecisionNodeInput,
  GuidedNodeInput,
} from "../../engine/GuidedTreeBuilder";
import { calculateExpectedValues } from "../../engine/ExpectedValueCalculator";
import { DecisionTreeData } from "../../models/types";

interface DraftBranch {
  id: string;
  label: string;
  probability: number;
  cost: string;
  target: DraftNode;
}

interface DraftDecisionNode {
  id: string;
  type: "decision";
  label: string;
  branches: DraftBranch[];
}

interface DraftChanceNode {
  id: string;
  type: "chance";
  label: string;
  branches: DraftBranch[];
}

interface DraftResultNode {
  id: string;
  type: "result";
  label: string;
  value: string;
}

type DraftInternalNode = DraftDecisionNode | DraftChanceNode;
type DraftNode = DraftInternalNode | DraftResultNode;
type DestinationType = DraftNode["type"];

interface LeafInfo {
  node: DraftResultNode;
  path: string[];
  accumulatedCost: number;
}

interface DraftStats {
  decisions: number;
  chances: number;
  results: number;
  maxDepth: number;
}

interface StageInfo {
  node: DraftInternalNode;
  path: string[];
}

interface GuidedTreeWizardProps {
  onCancel: () => void;
  onComplete: (tree: DecisionTreeData) => void;
}

let draftId = 0;
function nextDraftId(prefix: string): string {
  draftId += 1;
  return `guided_${prefix}_${draftId}`;
}

function createResult(label = "Resultado final", value = ""): DraftResultNode {
  return { id: nextDraftId("result"), type: "result", label, value };
}

function createBranch(label: string, probability: number): DraftBranch {
  return {
    id: nextDraftId("branch"),
    label,
    probability,
    cost: "",
    target: createResult(`Resultado de ${label}`),
  };
}

function createDecision(label = ""): DraftDecisionNode {
  return {
    id: nextDraftId("decision"),
    type: "decision",
    label,
    branches: [createBranch("Alternativa 1", 0), createBranch("Alternativa 2", 0)],
  };
}

function createChance(label = ""): DraftChanceNode {
  return {
    id: nextDraftId("chance"),
    type: "chance",
    label,
    branches: [createBranch("Evento favorable", 0.5), createBranch("Evento adverso", 0.5)],
  };
}

function parseValue(raw: string): number | null {
  if (!raw.trim()) return null;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function parseCost(raw: string): number | null {
  const value = parseValue(raw);
  return value !== null && value >= 0 ? value : null;
}

function formatCurrency(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

function equalizeBranches(branches: DraftBranch[]): DraftBranch[] {
  if (branches.length === 0) return branches;
  const share = 1 / branches.length;
  return branches.map((branch) => ({ ...branch, probability: share }));
}

function rebalanceBranches(
  branches: DraftBranch[],
  branchId: string,
  probability: number
): DraftBranch[] {
  const clamped = Math.min(Math.max(probability, 0), 1);
  const siblings = branches.filter((branch) => branch.id !== branchId);
  if (siblings.length === 0) {
    return branches.map((branch) => ({ ...branch, probability: 1 }));
  }

  const remaining = 1 - clamped;
  const siblingTotal = siblings.reduce((sum, branch) => sum + branch.probability, 0);
  let assigned = 0;
  return branches.map((branch) => {
    if (branch.id === branchId) return { ...branch, probability: clamped };
    const isLast = branch.id === siblings[siblings.length - 1].id;
    const next = isLast
      ? remaining - assigned
      : siblingTotal > 0
        ? (branch.probability / siblingTotal) * remaining
        : remaining / siblings.length;
    assigned += next;
    return { ...branch, probability: Math.max(0, next) };
  });
}

function mapNode(node: DraftNode, nodeId: string, update: (current: DraftNode) => DraftNode): DraftNode {
  if (node.id === nodeId) return update(node);
  if (node.type === "result") return node;
  return {
    ...node,
    branches: node.branches.map((branch) => ({
      ...branch,
      target: mapNode(branch.target, nodeId, update),
    })),
  };
}

function mapBranch(
  node: DraftNode,
  branchId: string,
  update: (current: DraftBranch, parent: DraftInternalNode) => DraftBranch
): DraftNode {
  if (node.type === "result") return node;
  return {
    ...node,
    branches: node.branches.map((branch) =>
      branch.id === branchId
        ? update(branch, node)
        : { ...branch, target: mapBranch(branch.target, branchId, update) }
    ),
  };
}

function findNode(node: DraftNode, nodeId: string): DraftNode | null {
  if (node.id === nodeId) return node;
  if (node.type === "result") return null;
  for (const branch of node.branches) {
    const found = findNode(branch.target, nodeId);
    if (found) return found;
  }
  return null;
}

function findPath(node: DraftNode, nodeId: string, path: string[] = []): string[] | null {
  if (node.id === nodeId) return path;
  if (node.type === "result") return null;
  for (const branch of node.branches) {
    const found = findPath(branch.target, nodeId, [...path, branch.label]);
    if (found) return found;
  }
  return null;
}

function collectLeaves(node: DraftNode, path: string[] = [], accumulatedCost = 0): LeafInfo[] {
  if (node.type === "result") return [{ node, path, accumulatedCost }];
  return node.branches.flatMap((branch) =>
    collectLeaves(
      branch.target,
      [...path, branch.label.trim() || "Rama sin nombre"],
      accumulatedCost + (parseCost(branch.cost) ?? 0)
    )
  );
}

function collectStages(node: DraftNode, path: string[] = []): StageInfo[] {
  if (node.type === "result") return [];
  return [
    { node, path },
    ...node.branches.flatMap((branch) =>
      collectStages(branch.target, [...path, branch.label.trim() || "Rama sin nombre"])
    ),
  ];
}

function getDraftStats(root: DraftNode): DraftStats {
  const stats: DraftStats = { decisions: 0, chances: 0, results: 0, maxDepth: 0 };
  const walk = (node: DraftNode, depth: number) => {
    if (node.type === "result") {
      stats.results += 1;
      return;
    }
    if (node.type === "decision") stats.decisions += 1;
    else stats.chances += 1;
    stats.maxDepth = Math.max(stats.maxDepth, depth);
    node.branches.forEach((branch) => walk(branch.target, depth + 1));
  };
  walk(root, 1);
  return stats;
}

function collectDraftIssues(node: DraftNode): string[] {
  if (node.type === "result") {
    return parseValue(node.value) === null
      ? [`Falta el valor de “${node.label || "Resultado final"}”.`]
      : [];
  }

  const issues: string[] = [];
  if (!node.label.trim()) {
    issues.push(
      node.type === "decision"
        ? "Falta la pregunta de una decisión."
        : "Falta el nombre de una incertidumbre."
    );
  }
  if (node.branches.length < 2) {
    issues.push(`“${node.label || "Esta etapa"}” necesita al menos dos ramas.`);
  }
  if (node.type === "chance") {
    const sum = node.branches.reduce((total, branch) => total + branch.probability, 0);
    if (Math.abs(sum - 1) > 0.0001) {
      issues.push(`Las probabilidades de “${node.label || "Esta incertidumbre"}” no suman 100%.`);
    }
  }
  for (const branch of node.branches) {
    if (!branch.label.trim()) {
      issues.push(`Hay una rama sin nombre en “${node.label || "Esta etapa"}”.`);
    }
    if (branch.cost.trim() && parseCost(branch.cost) === null) {
      issues.push(`El costo de “${branch.label || "una rama"}” debe ser cero o mayor.`);
    }
    issues.push(...collectDraftIssues(branch.target));
  }
  return issues;
}

function normalizeNode(node: DraftNode): GuidedNodeInput {
  if (node.type === "result") {
    return {
      id: node.id,
      type: "result",
      label: node.label,
      value: parseValue(node.value) ?? 0,
    };
  }

  const branches: GuidedBranchInput[] = node.branches.map((branch) => ({
    id: branch.id,
    label: branch.label,
    probability: node.type === "chance" ? branch.probability : null,
    cost: parseCost(branch.cost),
    target: normalizeNode(branch.target),
  }));
  return node.type === "decision"
    ? { id: node.id, type: "decision", label: node.label, branches }
    : { id: node.id, type: "chance", label: node.label, branches };
}

const destinationOptions: Array<{
  type: DestinationType;
  symbol: string;
  label: string;
}> = [
  { type: "result", symbol: "△", label: "Resultado final" },
  { type: "decision", symbol: "□", label: "Decisión" },
  { type: "chance", symbol: "○", label: "Evento incierto" },
];

export function GuidedTreeWizard({ onCancel, onComplete }: GuidedTreeWizardProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"maximize" | "minimize">("maximize");
  const [root, setRoot] = useState<DraftDecisionNode>(() => createDecision());
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);

  const editingNode = editingNodeId ? findNode(root, editingNodeId) : null;
  const editingInternal = editingNode && editingNode.type !== "result" ? editingNode : null;
  const leaves = useMemo(() => collectLeaves(root), [root]);
  const stages = useMemo(() => collectStages(root), [root]);
  const stats = useMemo(() => getDraftStats(root), [root]);
  const draftIssues = useMemo(() => collectDraftIssues(root), [root]);

  const tree = useMemo(
    () =>
      buildGuidedTree({
        name,
        mode,
        root: normalizeNode(root) as GuidedDecisionNodeInput,
      }),
    [mode, name, root]
  );
  const evMap = useMemo(() => calculateExpectedValues(tree), [tree]);
  const comparison = useMemo(() => compareRootDecision(tree), [tree]);

  const setRootNode = (node: DraftNode) => setRoot(node as DraftDecisionNode);
  const updateNode = (nodeId: string, update: (node: DraftNode) => DraftNode) =>
    setRoot((current) => mapNode(current, nodeId, update) as DraftDecisionNode);
  const updateBranch = (
    branchId: string,
    update: (branch: DraftBranch, parent: DraftInternalNode) => DraftBranch
  ) => setRoot((current) => mapBranch(current, branchId, update) as DraftDecisionNode);

  const renameBranch = (branchId: string, label: string) =>
    updateBranch(branchId, (current) => ({
      ...current,
      label,
      target: current.target.type === "result"
        ? { ...current.target, label: `Resultado de ${label}` }
        : current.target,
    }));

  const setQuestion = (value: string) =>
    updateNode(root.id, (node) => ({ ...(node as DraftDecisionNode), label: value }));

  const setBranchDestination = (branch: DraftBranch, type: DestinationType) => {
    if (branch.target.type === type) return;
    const hasDestinationData = branch.target.type !== "result" || branch.target.value.trim().length > 0;
    if (
      hasDestinationData &&
      !window.confirm("Cambiar el destino eliminará la etapa o el valor cargado en esta rama. ¿Continuar?")
    ) {
      return;
    }
    updateBranch(branch.id, (current) => {
      const target = type === "result"
        ? createResult(`Resultado de ${current.label}`)
        : type === "decision"
          ? createDecision()
          : createChance();
      return { ...current, target };
    });
  };

  const addBranchToNode = (node: DraftInternalNode) => {
    updateNode(node.id, (current) => {
      if (current.type === "result") return current;
      const label = current.type === "decision"
        ? `Alternativa ${current.branches.length + 1}`
        : `Evento ${current.branches.length + 1}`;
      const branches = [...current.branches, createBranch(label, 0)];
      return {
        ...current,
        branches: current.type === "chance" ? equalizeBranches(branches) : branches,
      };
    });
  };

  const removeBranchFromNode = (node: DraftInternalNode, branchId: string) => {
    updateNode(node.id, (current) => {
      if (current.type === "result" || current.branches.length <= 2) return current;
      const branches = current.branches.filter((branch) => branch.id !== branchId);
      return {
        ...current,
        branches: current.type === "chance" ? equalizeBranches(branches) : branches,
      };
    });
  };

  const stepValid = useMemo(() => {
    if (step === 0) return root.label.trim().length > 0;
    if (step === 1) {
      return root.branches.length >= 2 && root.branches.every((branch) => branch.label.trim());
    }
    if (step === 2) return draftIssues.length === 0 && !editingNodeId;
    return true;
  }, [draftIssues.length, editingNodeId, root.branches, root.label, step]);

  const goNext = () => {
    if (!stepValid) return;
    if (step === 1) {
      setStep(2);
      setEditingNodeId(root.id);
      return;
    }
    setStep((current) => Math.min(current + 1, 3));
  };

  const goBack = () => {
    if (step === 2 && editingNodeId) {
      setEditingNodeId(null);
      return;
    }
    if (step === 3) {
      setStep(2);
      return;
    }
    setStep((current) => Math.max(current - 1, 0));
  };

  const renderDestinationSelector = (branch: DraftBranch) => (
    <div className="guided-destination">
      <div className="guided-destination-label">Después de esta rama</div>
      <div
        className="guided-destination-options"
        role="radiogroup"
        aria-label={`Destino de ${branch.label}`}
      >
        {destinationOptions.map((option) => (
          <button
            key={option.type}
            type="button"
            role="radio"
            aria-checked={branch.target.type === option.type}
            className={branch.target.type === option.type ? "selected" : ""}
            onClick={() => setBranchDestination(branch, option.type)}
          >
            <span aria-hidden="true">{option.symbol}</span>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );

  const renderStageEditor = (node: DraftInternalNode) => {
    const path = findPath(root, node.id) ?? [];
    return (
      <div className="guided-stage-editor">
        <button type="button" className="guided-exit" onClick={() => setEditingNodeId(null)}>
          Volver al resumen
        </button>
        <div className="guided-stage-path">{path.length > 0 ? path.join(" › ") : "Inicio"}</div>
        <label className="guided-field">
          <span>{node.type === "decision" ? "Pregunta de esta decisión" : "Nombre de la incertidumbre"}</span>
          <input
            autoFocus
            type="text"
            value={node.label}
            onChange={(event) =>
              updateNode(node.id, (current) => ({ ...current, label: event.target.value }))
            }
            placeholder={
              node.type === "decision"
                ? "Ej: ¿Perforar o vender el área?"
                : "Ej: Resultado del estudio sísmico"
            }
          />
        </label>
        <p className="guided-stage-note">
          Cargá probabilidades y costos en las ramas. El valor económico se ingresa únicamente cuando el camino termina; los valores esperados se calculan automáticamente.
        </p>

        <div className="guided-stage-branches">
          {node.branches.map((branch, index) => (
            <section key={branch.id} className="guided-stage-branch">
              <div className="guided-branch-head">
                <span>{node.type === "decision" ? "Alternativa" : "Evento"} {index + 1}</span>
                {node.branches.length > 2 && (
                  <button
                    type="button"
                    className="guided-remove"
                    aria-label={`Eliminar ${branch.label}`}
                    onClick={() => removeBranchFromNode(node, branch.id)}
                  >
                    ×
                  </button>
                )}
              </div>
              <input
                type="text"
                aria-label={`${node.type === "decision" ? "Alternativa" : "Evento"} ${index + 1}`}
                value={branch.label}
                onChange={(event) =>
                  renameBranch(branch.id, event.target.value)
                }
              />

              <div className={`guided-branch-economics ${node.type === "decision" ? "guided-branch-economics--single" : ""}`}>
                {node.type === "chance" && (
                  <label className="guided-compact-field">
                    <span>Probabilidad</span>
                    <div className="guided-suffix-input">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={Number((branch.probability * 100).toFixed(1))}
                        aria-label={`Probabilidad de ${branch.label}`}
                        onChange={(event) =>
                          updateNode(node.id, (current) =>
                            current.type === "chance"
                              ? {
                                  ...current,
                                  branches: rebalanceBranches(
                                    current.branches,
                                    branch.id,
                                    Number(event.target.value) / 100
                                  ),
                                }
                              : current
                          )
                        }
                      />
                      <span>%</span>
                    </div>
                  </label>
                )}
                <label className="guided-compact-field">
                  <span>Costo al recorrerla</span>
                  <div className="guided-prefix-input">
                    <span>$</span>
                    <input
                      type="number"
                      min="0"
                      inputMode="decimal"
                      value={branch.cost}
                      aria-label={`Costo de ${branch.label}`}
                      placeholder="0"
                      onChange={(event) =>
                        updateBranch(branch.id, (current) => ({ ...current, cost: event.target.value }))
                      }
                    />
                  </div>
                </label>
              </div>

              {renderDestinationSelector(branch)}

              {branch.target.type === "result" ? (
                <div className="guided-terminal-block">
                  <label className="guided-terminal-value">
                    <span>{mode === "minimize" ? "Costo del resultado final" : "Valor del resultado final"}</span>
                    <div className="guided-prefix-input">
                      <span>$</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={branch.target.value}
                        aria-label={`${mode === "minimize" ? "Costo" : "Valor"} del resultado final de ${branch.label}`}
                        onChange={(event) =>
                          updateNode(branch.target.id, (current) =>
                            current.type === "result"
                              ? { ...current, value: event.target.value }
                              : current
                          )
                        }
                      />
                    </div>
                  </label>
                  <small>
                    {mode === "minimize"
                      ? "No incluyas los costos ya cargados en las ramas; el sistema los suma."
                      : "No descuentes los costos ya cargados en las ramas; el sistema los resta."}
                  </small>
                </div>
              ) : (
                <div className="guided-nested-stage">
                  <span className={`guided-node-kind guided-node-kind--${branch.target.type}`}>
                    {branch.target.type === "decision" ? "Decisión" : "Incertidumbre"}
                  </span>
                  <strong>{branch.target.label || "Etapa sin definir"}</strong>
                  <button type="button" onClick={() => setEditingNodeId(branch.target.id)}>
                    {branch.target.label ? "Editar etapa" : "Definir etapa"}
                  </button>
                </div>
              )}
            </section>
          ))}
        </div>

        <button type="button" className="guided-add" onClick={() => addBranchToNode(node)}>
          + Agregar {node.type === "decision" ? "otra alternativa" : "otro evento"}
        </button>
        <button type="button" className="guided-stage-done" onClick={() => setEditingNodeId(null)}>
          Listo con esta etapa
        </button>
      </div>
    );
  };

  const stepTitles = ["La decisión", "Las alternativas", "La estructura", "Revisión"];

  return (
    <section className="guided-wizard" aria-labelledby="guided-title">
      <div className="guided-topline">
        <button type="button" className="guided-exit" onClick={onCancel}>Salir del asistente</button>
        <span>Paso {step + 1} de 4</span>
      </div>
      <div className="guided-progress" aria-label={`Paso ${step + 1} de 4`}>
        {[0, 1, 2, 3].map((index) => (
          <span key={index} className={index <= step ? "active" : ""} />
        ))}
      </div>

      <header className="guided-heading">
        <div className="guided-step-label">{stepTitles[step]}</div>
        <h2 id="guided-title">
          {step === 0 && "¿Qué necesitás decidir?"}
          {step === 1 && "¿Entre qué alternativas?"}
          {step === 2 && "¿Qué ocurre en cada rama?"}
          {step === 3 && "Revisá el análisis antes de crearlo"}
        </h2>
      </header>

      {step === 0 && (
        <div className="guided-fields">
          <label className="guided-field">
            <span>Pregunta principal</span>
            <input
              autoFocus
              type="text"
              aria-label="Pregunta principal"
              value={root.label}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ej: ¿Conviene hacer el workover?"
            />
            <small>Escribila como la pregunta que querés responder.</small>
          </label>
          <label className="guided-field">
            <span>Nombre del análisis <em>opcional</em></span>
            <input
              type="text"
              aria-label="Nombre del análisis"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej: Workover pozo LJ-47"
            />
          </label>
          <fieldset className="guided-choice-group" role="radiogroup">
            <legend>¿Qué número debería ganar?</legend>
            <button type="button" role="radio" aria-checked={mode === "maximize"} className={mode === "maximize" ? "selected" : ""} onClick={() => setMode("maximize")}>
              <strong>El mayor valor</strong><span>Ingresos, VAN o beneficio</span>
            </button>
            <button type="button" role="radio" aria-checked={mode === "minimize"} className={mode === "minimize" ? "selected" : ""} onClick={() => setMode("minimize")}>
              <strong>El menor costo</strong><span>Costos de intervención, pérdida o abandono</span>
            </button>
          </fieldset>
        </div>
      )}

      {step === 1 && (
        <div className="guided-fields">
          <p className="guided-intro">Empezá con dos. Podés agregar todas las alternativas que necesites.</p>
          <div className="guided-alternatives">
            {root.branches.map((branch, index) => (
              <div key={branch.id} className="guided-alternative-row">
                <span aria-hidden="true">{index + 1}</span>
                <label className="sr-only" htmlFor={`guided-alt-${branch.id}`}>Alternativa {index + 1}</label>
                <input
                  id={`guided-alt-${branch.id}`}
                  type="text"
                  value={branch.label}
                  onFocus={(event) => event.target.select()}
                  onChange={(event) => renameBranch(branch.id, event.target.value)}
                />
                {root.branches.length > 2 && (
                  <button
                    type="button"
                    className="guided-remove"
                    aria-label={`Eliminar ${branch.label}`}
                    onClick={() => setRootNode({ ...root, branches: root.branches.filter((item) => item.id !== branch.id) })}
                  >×</button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            className="guided-add"
            onClick={() => setRootNode({
              ...root,
              branches: [...root.branches, createBranch(`Alternativa ${root.branches.length + 1}`, 0)],
            })}
          >
            + Agregar otra alternativa
          </button>
          <div className="guided-count-note">{root.branches.length} alternativas cargadas · sin límite fijo</div>
        </div>
      )}

      {step === 2 && (
        editingInternal ? renderStageEditor(editingInternal) : (
          <div className="guided-continuations">
            <p className="guided-intro">
              Cada rama indica si termina en un resultado, abre otra decisión o depende de un evento incierto. Los importes finales se cargan solo en los resultados.
            </p>
            <div className="guided-depth-summary" aria-label="Resumen de estructura">
              <span><strong>{stats.decisions}</strong> decisiones</span>
              <span><strong>{stats.chances}</strong> incertidumbres</span>
              <span><strong>{stats.maxDepth}</strong> niveles</span>
            </div>
            {draftIssues.length > 0 && (
              <div className="guided-issues" role="status">
                <strong>{draftIssues.length} {draftIssues.length === 1 ? "dato pendiente" : "datos pendientes"}</strong>
                <span>Editá las etapas marcadas para completar el análisis.</span>
              </div>
            )}
            <div className="guided-stage-map">
              <div className="guided-map-label">Etapas del análisis</div>
              {stages.map((stage) => {
                const issues = collectDraftIssues(stage.node).length;
                return (
                  <button key={stage.node.id} type="button" onClick={() => setEditingNodeId(stage.node.id)}>
                    <span className={`guided-node-kind guided-node-kind--${stage.node.type}`}>
                      {stage.node.type === "decision" ? "Decisión" : "Incertidumbre"}
                    </span>
                    <span>{stage.path.length > 0 ? stage.path.join(" › ") : "Inicio"}</span>
                    <strong>{stage.node.label || "Etapa sin nombre"}</strong>
                    <small className={issues > 0 ? "pending" : "complete"}>
                      {issues > 0 ? `${issues} ${issues === 1 ? "dato pendiente" : "datos pendientes"}` : "Completa"}
                    </small>
                  </button>
                );
              })}
            </div>
            <div className="guided-map-label">Valores finales</div>
            <div className="guided-leaf-map">
              {leaves.map((leaf) => {
                const value = parseValue(leaf.node.value);
                const netValue = value === null
                  ? null
                  : mode === "minimize"
                    ? value + leaf.accumulatedCost
                    : value - leaf.accumulatedCost;
                return (
                  <div key={leaf.node.id} className="guided-leaf-row guided-leaf-row--summary">
                    <span className="guided-leaf-path">{leaf.path.join(" › ")}</span>
                    <strong className={value === null ? "pending" : ""}>
                      {value === null ? "Falta valor" : formatCurrency(value)}
                    </strong>
                    {value !== null && (
                      <small>
                        Valor final {formatCurrency(value)} · Costos del camino {formatCurrency(leaf.accumulatedCost)} · {mode === "minimize" ? "Costo total" : "Valor neto"} {formatCurrency(netValue ?? value)}
                      </small>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}

      {step === 3 && (
        <div className="guided-review">
          <dl>
            <div><dt>Decisión</dt><dd>{root.label}</dd></div>
            <div><dt>Criterio</dt><dd>{mode === "minimize" ? "Menor costo esperado" : "Mayor valor esperado"}</dd></div>
            <div><dt>Estructura</dt><dd>{stats.decisions} D · {stats.chances} I · {stats.results} resultados · {stats.maxDepth} niveles</dd></div>
          </dl>
          <div className="guided-review-list">
            {tree.nodes[tree.rootId!].childIds.map((childId) => (
              <div key={childId}>
                <span>{tree.nodes[childId].branchLabel || tree.nodes[childId].label}</span>
                <strong>{formatCurrency(evMap[childId] ?? 0)}</strong>
              </div>
            ))}
          </div>
          <p className="guided-calculation-note">
            Los valores mostrados son cálculos automáticos desde los resultados finales, las probabilidades y los costos de cada camino.
          </p>
          {comparison && (
            <div className="guided-recommendation" role="status">
              <span>Recomendación preliminar</span>
              <strong>{comparison.isTie && comparison.alternativeLabel ? `Empate: ${comparison.recommendedLabel} y ${comparison.alternativeLabel}` : comparison.recommendedLabel}</strong>
              <small>{mode === "minimize" ? "Costo esperado" : "Valor esperado"}: {formatCurrency(comparison.recommendedValue)}</small>
            </div>
          )}
          <p className="guided-review-note">Se creará un árbol completamente editable. Podés seguir ampliándolo desde el editor avanzado.</p>
        </div>
      )}

      {!(step === 2 && editingInternal) && (
        <footer className="guided-footer">
          {step > 0 ? <button type="button" className="btn btn-ghost guided-back" onClick={goBack}>Atrás</button> : <span />}
          {step < 3 ? (
            <button type="button" className="btn btn-hero guided-next" disabled={!stepValid} onClick={goNext}>
              {step === 2 ? "Revisar árbol" : "Continuar"}
            </button>
          ) : (
            <button type="button" className="btn btn-hero guided-next" onClick={() => onComplete(tree)}>Crear árbol y revisarlo</button>
          )}
        </footer>
      )}
    </section>
  );
}
