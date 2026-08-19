import React, { useEffect, useMemo, useState } from "react";
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

interface LeafInfo {
  node: DraftResultNode;
  path: string[];
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
    target: createResult(),
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
    branches: [createBranch("Resultado favorable", 0.5), createBranch("Resultado adverso", 0.5)],
  };
}

function parseValue(raw: string): number | null {
  if (!raw.trim()) return null;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? value : null;
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

function collectLeaves(node: DraftNode, path: string[] = []): LeafInfo[] {
  if (node.type === "result") return [{ node, path }];
  return node.branches.flatMap((branch) =>
    collectLeaves(branch.target, [...path, branch.label.trim() || "Rama sin nombre"])
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
    return parseValue(node.value) === null ? [`Falta el valor de “${node.label || "Resultado final"}”.`] : [];
  }

  const issues: string[] = [];
  if (!node.label.trim()) {
    issues.push(node.type === "decision" ? "Falta la pregunta de una decisión." : "Falta el nombre de una incertidumbre.");
  }
  if (node.branches.length < 2) issues.push(`“${node.label || "Esta etapa"}” necesita al menos dos ramas.`);
  if (node.type === "chance") {
    const sum = node.branches.reduce((total, branch) => total + branch.probability, 0);
    if (Math.abs(sum - 1) > 0.0001) issues.push(`Las probabilidades de “${node.label || "Esta incertidumbre"}” no suman 100%.`);
  }
  for (const branch of node.branches) {
    if (!branch.label.trim()) issues.push(`Hay una rama sin nombre en “${node.label || "Esta etapa"}”.`);
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
    target: normalizeNode(branch.target),
  }));
  return node.type === "decision"
    ? { id: node.id, type: "decision", label: node.label, branches }
    : { id: node.id, type: "chance", label: node.label, branches };
}

function isExpandedInitialBranch(branch: DraftBranch): boolean {
  if (branch.target.type === "decision") return true;
  return branch.target.type === "chance" && branch.target.branches.some((item) => item.target.type !== "result");
}

export function GuidedTreeWizard({ onCancel, onComplete }: GuidedTreeWizardProps) {
  const [step, setStep] = useState(0);
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"maximize" | "minimize">("maximize");
  const [root, setRoot] = useState<DraftDecisionNode>(() => createDecision());
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [continuingLeafId, setContinuingLeafId] = useState<string | null>(null);

  const currentAlternative = root.branches[scenarioIndex];
  const editingNode = editingNodeId ? findNode(root, editingNodeId) : null;
  const editingInternal = editingNode && editingNode.type !== "result" ? editingNode : null;
  const leaves = useMemo(() => collectLeaves(root), [root]);
  const stages = useMemo(() => collectStages(root).filter((stage) => stage.node.id !== root.id), [root]);
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

  useEffect(() => {
    setScenarioIndex((index) => Math.min(index, Math.max(root.branches.length - 1, 0)));
  }, [root.branches.length]);

  const setRootNode = (node: DraftNode) => setRoot(node as DraftDecisionNode);
  const updateNode = (nodeId: string, update: (node: DraftNode) => DraftNode) =>
    setRoot((current) => mapNode(current, nodeId, update) as DraftDecisionNode);
  const updateBranch = (
    branchId: string,
    update: (branch: DraftBranch, parent: DraftInternalNode) => DraftBranch
  ) => setRoot((current) => mapBranch(current, branchId, update) as DraftDecisionNode);

  const setQuestion = (value: string) =>
    updateNode(root.id, (node) => ({ ...(node as DraftDecisionNode), label: value }));

  const setInitialKind = (branch: DraftBranch, kind: "result" | "chance") => {
    updateBranch(branch.id, (current) => {
      if (kind === "result") {
        const existingValue = current.target.type === "result" ? current.target.value : "";
        return {
          ...current,
          target: createResult(`Resultado de ${current.label}`, existingValue),
        };
      }
      return {
        ...current,
        target: createChance(`Resultados de ${current.label}`),
      };
    });
  };

  const continueLeaf = (leafId: string, type: "decision" | "chance") => {
    const next = type === "decision" ? createDecision() : createChance();
    setRoot((current) => mapNode(current, leafId, () => next) as DraftDecisionNode);
    setContinuingLeafId(null);
    setEditingNodeId(next.id);
  };

  const addBranchToNode = (node: DraftInternalNode) => {
    updateNode(node.id, (current) => {
      if (current.type === "result") return current;
      const label = current.type === "decision"
        ? `Alternativa ${current.branches.length + 1}`
        : `Resultado ${current.branches.length + 1}`;
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
    if (step === 1) return root.branches.length >= 2 && root.branches.every((branch) => branch.label.trim());
    if (step === 2 && currentAlternative) return collectDraftIssues(currentAlternative.target).length === 0;
    if (step === 3) return draftIssues.length === 0 && !editingNodeId;
    return true;
  }, [currentAlternative, draftIssues.length, editingNodeId, root.branches, root.label, step]);

  const goNext = () => {
    if (!stepValid) return;
    if (step === 2 && scenarioIndex < root.branches.length - 1) {
      setScenarioIndex((index) => index + 1);
      return;
    }
    setStep((current) => Math.min(current + 1, 4));
  };

  const goBack = () => {
    if (step === 3 && editingNodeId) {
      setEditingNodeId(null);
      setContinuingLeafId(null);
      return;
    }
    if (step === 2 && scenarioIndex > 0) {
      setScenarioIndex((index) => index - 1);
      return;
    }
    if (step === 3) {
      setScenarioIndex(Math.max(root.branches.length - 1, 0));
      setStep(2);
      return;
    }
    if (step === 4) {
      setStep(3);
      return;
    }
    setStep((current) => Math.max(current - 1, 0));
  };

  const stepTitles = ["La decisión", "Las alternativas", "Los resultados", "Las continuaciones", "Revisión"];

  const renderContinuationPicker = (leaf: LeafInfo) => (
    <div className="guided-continuation-picker" role="group" aria-label={`Continuar ${leaf.path.join(", ")}`}>
      <p>¿Qué ocurre después de esta rama?</p>
      <div>
        <button type="button" onClick={() => continueLeaf(leaf.node.id, "decision")}>
          <strong>Nueva decisión</strong>
          <span>La persona elige el próximo camino</span>
        </button>
        <button type="button" onClick={() => continueLeaf(leaf.node.id, "chance")}>
          <strong>Nueva incertidumbre</strong>
          <span>Puede ocurrir más de un resultado</span>
        </button>
      </div>
      <button type="button" className="guided-exit" onClick={() => setContinuingLeafId(null)}>
        Cancelar
      </button>
    </div>
  );

  const renderStageEditor = (node: DraftInternalNode) => {
    const path = findPath(root, node.id) ?? [];
    return (
      <div className="guided-stage-editor">
        <button type="button" className="guided-exit" onClick={() => setEditingNodeId(null)}>
          Volver al mapa de ramas
        </button>
        <div className="guided-stage-path">{path.join(" › ")}</div>
        <label className="guided-field">
          <span>{node.type === "decision" ? "Pregunta de esta decisión" : "Nombre de la incertidumbre"}</span>
          <input
            autoFocus
            type="text"
            value={node.label}
            onChange={(event) =>
              updateNode(node.id, (current) => ({ ...current, label: event.target.value }))
            }
            placeholder={node.type === "decision" ? "Ej: ¿Reparar o abandonar?" : "Ej: Resultado de la prueba"}
          />
        </label>

        <div className="guided-stage-branches">
          {node.branches.map((branch, index) => {
            const targetLeaf = branch.target.type === "result"
              ? { node: branch.target, path: [...path, branch.label] }
              : null;
            return (
              <section key={branch.id} className="guided-stage-branch">
                <div className="guided-branch-head">
                  <span>{node.type === "decision" ? "Alternativa" : "Resultado"} {index + 1}</span>
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
                  aria-label={`${node.type === "decision" ? "Alternativa" : "Resultado"} ${index + 1}`}
                  value={branch.label}
                  onChange={(event) =>
                    updateBranch(branch.id, (current) => ({ ...current, label: event.target.value }))
                  }
                />
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

                {branch.target.type === "result" ? (
                  <div className="guided-stage-target">
                    <label className="guided-compact-field">
                      <span>{mode === "minimize" ? "Costo terminal" : "Valor terminal"}</span>
                      <div className="guided-prefix-input">
                        <span>$</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          value={branch.target.value}
                          aria-label={`${mode === "minimize" ? "Costo" : "Valor"} de ${branch.label}`}
                          onChange={(event) =>
                            updateNode(branch.target.id, (current) =>
                              current.type === "result" ? { ...current, value: event.target.value } : current
                            )
                          }
                        />
                      </div>
                    </label>
                    <button
                      type="button"
                      className="guided-continue-link"
                      onClick={() => setContinuingLeafId(branch.target.id)}
                    >
                      Esta rama continúa…
                    </button>
                    {continuingLeafId === branch.target.id && targetLeaf && renderContinuationPicker(targetLeaf)}
                  </div>
                ) : (
                  <div className="guided-nested-stage">
                    <span className={`guided-node-kind guided-node-kind--${branch.target.type}`}>
                      {branch.target.type === "decision" ? "Decisión" : "Incertidumbre"}
                    </span>
                    <strong>{branch.target.label || "Etapa sin nombre"}</strong>
                    <button type="button" onClick={() => setEditingNodeId(branch.target.id)}>
                      Editar etapa
                    </button>
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <button type="button" className="guided-add" onClick={() => addBranchToNode(node)}>
          + Agregar {node.type === "decision" ? "otra alternativa" : "otro resultado"}
        </button>
        <div className="guided-stage-actions">
          <button
            type="button"
            className="guided-danger-link"
            onClick={() => {
              setRoot((current) => mapNode(current, node.id, () => createResult()) as DraftDecisionNode);
              setEditingNodeId(null);
            }}
          >
            Hacer que esta rama termine aquí
          </button>
          <button type="button" className="guided-stage-done" onClick={() => setEditingNodeId(null)}>
            Listo con esta etapa
          </button>
        </div>
      </div>
    );
  };

  return (
    <section className="guided-wizard" aria-labelledby="guided-title">
      <div className="guided-topline">
        <button type="button" className="guided-exit" onClick={onCancel}>Salir del asistente</button>
        <span>Paso {step + 1} de 5</span>
      </div>
      <div className="guided-progress guided-progress--five" aria-label={`Paso ${step + 1} de 5`}>
        {[0, 1, 2, 3, 4].map((index) => <span key={index} className={index <= step ? "active" : ""} />)}
      </div>

      <header className="guided-heading">
        <div className="guided-step-label">{stepTitles[step]}</div>
        <h2 id="guided-title">
          {step === 0 && "¿Qué necesitás decidir?"}
          {step === 1 && "¿Entre qué alternativas?"}
          {step === 2 && currentAlternative && `¿Qué puede pasar con “${currentAlternative.label}”?`}
          {step === 3 && "¿Alguna rama continúa?"}
          {step === 4 && "Revisá el análisis antes de crearlo"}
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
          <p className="guided-intro">Empezá con dos. Podés agregar cinco, diez o todas las alternativas que necesites.</p>
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
                  onChange={(event) => updateBranch(branch.id, (current) => ({ ...current, label: event.target.value }))}
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

      {step === 2 && currentAlternative && (
        <div className="guided-fields">
          <div className="guided-scenario-count">Alternativa {scenarioIndex + 1} de {root.branches.length}</div>
          {isExpandedInitialBranch(currentAlternative) ? (
            <div className="guided-expanded-note">
              Esta alternativa ya contiene decisiones posteriores. Podés editarla en el paso siguiente sin perder sus ramas.
            </div>
          ) : (
            <>
              <fieldset className="guided-kind-toggle" role="radiogroup">
                <legend>Tipo de resultado</legend>
                <button type="button" role="radio" aria-checked={currentAlternative.target.type === "result"} className={currentAlternative.target.type === "result" ? "selected" : ""} onClick={() => setInitialKind(currentAlternative, "result")}>Resultado conocido</button>
                <button type="button" role="radio" aria-checked={currentAlternative.target.type === "chance"} className={currentAlternative.target.type === "chance" ? "selected" : ""} onClick={() => setInitialKind(currentAlternative, "chance")}>Hay incertidumbre</button>
              </fieldset>

              {currentAlternative.target.type === "result" && (
                <label className="guided-field">
                  <span>{mode === "minimize" ? "Costo total ($)" : "Valor neto o VAN ($)"}</span>
                  <input
                    autoFocus
                    type="number"
                    inputMode="decimal"
                    aria-label={mode === "minimize" ? "Costo total ($)" : "Valor neto o VAN ($)"}
                    value={currentAlternative.target.value}
                    onChange={(event) => updateNode(currentAlternative.target.id, (node) => node.type === "result" ? { ...node, value: event.target.value } : node)}
                    placeholder="0"
                  />
                </label>
              )}

              {currentAlternative.target.type === "chance" && (
                <div className="guided-outcomes">
                  <p className="guided-intro">Las probabilidades se ajustan automáticamente para mantener el 100%.</p>
                  {currentAlternative.target.branches.map((outcome, index) => (
                    <div key={outcome.id} className="guided-outcome">
                      <div className="guided-outcome-name">
                        <label htmlFor={`guided-outcome-${outcome.id}`}>Resultado {index + 1}</label>
                        {currentAlternative.target.type === "chance" && currentAlternative.target.branches.length > 2 && (
                          <button
                            type="button"
                            className="guided-remove"
                            aria-label={`Eliminar ${outcome.label}`}
                            onClick={() => updateNode(currentAlternative.target.id, (node) => node.type === "chance" ? { ...node, branches: equalizeBranches(node.branches.filter((item) => item.id !== outcome.id)) } : node)}
                          >×</button>
                        )}
                      </div>
                      <input id={`guided-outcome-${outcome.id}`} type="text" value={outcome.label} onChange={(event) => updateBranch(outcome.id, (branch) => ({ ...branch, label: event.target.value }))} />
                      <div className="guided-outcome-values">
                        <label>
                          <span>Probabilidad</span>
                          <div className="guided-suffix-input">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={Number((outcome.probability * 100).toFixed(1))}
                              aria-label={`Probabilidad de ${outcome.label}`}
                              onChange={(event) => updateNode(currentAlternative.target.id, (node) => node.type === "chance" ? { ...node, branches: rebalanceBranches(node.branches, outcome.id, Number(event.target.value) / 100) } : node)}
                            />
                            <span>%</span>
                          </div>
                        </label>
                        {outcome.target.type === "result" ? (
                          <label>
                            <span>{mode === "minimize" ? "Costo total" : "Valor neto"}</span>
                            <div className="guided-prefix-input">
                              <span>$</span>
                              <input
                                type="number"
                                inputMode="decimal"
                                value={outcome.target.value}
                                aria-label={`${mode === "minimize" ? "Costo" : "Valor"} de ${outcome.label}`}
                                onChange={(event) => updateNode(outcome.target.id, (node) => node.type === "result" ? { ...node, value: event.target.value } : node)}
                              />
                            </div>
                          </label>
                        ) : <span />}
                      </div>
                    </div>
                  ))}
                  <button type="button" className="guided-add" onClick={() => updateNode(currentAlternative.target.id, (node) => node.type === "chance" ? { ...node, branches: equalizeBranches([...node.branches, createBranch(`Resultado ${node.branches.length + 1}`, 0)]) } : node)}>
                    + Agregar otro resultado
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {step === 3 && (
        editingInternal ? renderStageEditor(editingInternal) : (
          <div className="guided-continuations">
            <p className="guided-intro">Cada resultado puede terminar aquí o abrir otra decisión o incertidumbre. Podés repetirlo todas las veces que necesites.</p>
            <div className="guided-depth-summary" aria-label="Resumen de estructura">
              <span><strong>{stats.decisions}</strong> decisiones</span>
              <span><strong>{stats.chances}</strong> incertidumbres</span>
              <span><strong>{stats.maxDepth}</strong> niveles</span>
            </div>
            {draftIssues.length > 0 && (
              <div className="guided-issues" role="status">
                <strong>{draftIssues.length} {draftIssues.length === 1 ? "dato pendiente" : "datos pendientes"}</strong>
                <span>Entrá en la etapa correspondiente para completarlos.</span>
              </div>
            )}
            {stages.length > 0 && (
              <div className="guided-stage-map">
                <div className="guided-map-label">Etapas posteriores</div>
                {stages.map((stage) => (
                  <button key={stage.node.id} type="button" onClick={() => setEditingNodeId(stage.node.id)}>
                    <span className={`guided-node-kind guided-node-kind--${stage.node.type}`}>
                      {stage.node.type === "decision" ? "Decisión" : "Incertidumbre"}
                    </span>
                    <span>{stage.path.join(" › ")}</span>
                    <strong>{stage.node.label || "Etapa sin nombre"}</strong>
                  </button>
                ))}
              </div>
            )}
            <div className="guided-map-label">Resultados finales</div>
            <div className="guided-leaf-map">
              {leaves.map((leaf) => (
                <div key={leaf.node.id} className="guided-leaf-row">
                  <div>
                    <span className="guided-leaf-path">{leaf.path.join(" › ")}</span>
                    <label className="guided-leaf-value">
                      <span>{mode === "minimize" ? "Costo terminal" : "Valor terminal"}</span>
                      <div className="guided-prefix-input">
                        <span>$</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          value={leaf.node.value}
                          aria-label={`${mode === "minimize" ? "Costo" : "Valor"} terminal de ${leaf.path.join(" › ")}`}
                          onChange={(event) =>
                            updateNode(leaf.node.id, (current) =>
                              current.type === "result" ? { ...current, value: event.target.value } : current
                            )
                          }
                        />
                      </div>
                    </label>
                  </div>
                  <button type="button" onClick={() => setContinuingLeafId(leaf.node.id)}>Continuar rama</button>
                  {continuingLeafId === leaf.node.id && renderContinuationPicker(leaf)}
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {step === 4 && (
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

      {!(step === 3 && editingInternal) && (
        <footer className="guided-footer">
          {step > 0 ? <button type="button" className="btn btn-ghost guided-back" onClick={goBack}>Atrás</button> : <span />}
          {step < 4 ? (
            <button type="button" className="btn btn-hero guided-next" disabled={!stepValid} onClick={goNext}>
              {step === 2 && scenarioIndex < root.branches.length - 1 ? "Siguiente alternativa" : step === 3 ? "Revisar árbol" : "Continuar"}
            </button>
          ) : (
            <button type="button" className="btn btn-hero guided-next" onClick={() => onComplete(tree)}>Crear árbol y revisarlo</button>
          )}
        </footer>
      )}
    </section>
  );
}
