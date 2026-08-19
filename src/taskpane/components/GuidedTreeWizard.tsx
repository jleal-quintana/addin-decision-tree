import React, { useMemo, useState } from "react";
import { compareRootDecision } from "../../engine/DecisionComparison";
import {
  buildGuidedTree,
  GuidedAlternativeInput,
  GuidedOutcomeInput,
} from "../../engine/GuidedTreeBuilder";
import { calculateExpectedValues } from "../../engine/ExpectedValueCalculator";
import { DecisionTreeData } from "../../models/types";

interface DraftOutcome extends Omit<GuidedOutcomeInput, "value"> {
  value: string;
}

interface DraftAlternative extends Omit<GuidedAlternativeInput, "certainValue" | "outcomes"> {
  certainValue: string;
  outcomes: DraftOutcome[];
}

interface GuidedTreeWizardProps {
  onCancel: () => void;
  onComplete: (tree: DecisionTreeData) => void;
}

let draftId = 0;
function nextDraftId(prefix: string): string {
  draftId += 1;
  return `${prefix}_${draftId}`;
}

function createOutcome(label: string, probability: number): DraftOutcome {
  return { id: nextDraftId("outcome"), label, probability, value: "" };
}

function createAlternative(label: string): DraftAlternative {
  return {
    id: nextDraftId("alternative"),
    label,
    kind: "certain",
    certainValue: "",
    outcomes: [
      createOutcome("Resultado favorable", 0.5),
      createOutcome("Resultado adverso", 0.5),
    ],
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

function equalizeOutcomes(outcomes: DraftOutcome[]): DraftOutcome[] {
  if (outcomes.length === 0) return outcomes;
  const share = 1 / outcomes.length;
  return outcomes.map((outcome) => ({ ...outcome, probability: share }));
}

function rebalanceOutcomes(
  outcomes: DraftOutcome[],
  outcomeId: string,
  probability: number
): DraftOutcome[] {
  const clamped = Math.min(Math.max(probability, 0), 1);
  const siblings = outcomes.filter((outcome) => outcome.id !== outcomeId);
  if (siblings.length === 0) {
    return outcomes.map((outcome) => ({ ...outcome, probability: 1 }));
  }

  const remaining = 1 - clamped;
  const siblingTotal = siblings.reduce((sum, outcome) => sum + outcome.probability, 0);
  let assigned = 0;
  return outcomes.map((outcome) => {
    if (outcome.id === outcomeId) return { ...outcome, probability: clamped };
    const isLast = outcome.id === siblings[siblings.length - 1].id;
    const next = isLast
      ? remaining - assigned
      : siblingTotal > 0
        ? (outcome.probability / siblingTotal) * remaining
        : remaining / siblings.length;
    assigned += next;
    return { ...outcome, probability: Math.max(0, next) };
  });
}

export function GuidedTreeWizard({ onCancel, onComplete }: GuidedTreeWizardProps) {
  const [step, setStep] = useState(0);
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [name, setName] = useState("");
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<"maximize" | "minimize">("maximize");
  const [alternatives, setAlternatives] = useState<DraftAlternative[]>(() => [
    createAlternative("Alternativa 1"),
    createAlternative("Alternativa 2"),
  ]);

  const currentAlternative = alternatives[scenarioIndex];

  const tree = useMemo(() => {
    const normalized: GuidedAlternativeInput[] = alternatives.map((alternative) => ({
      ...alternative,
      certainValue: parseValue(alternative.certainValue) ?? 0,
      outcomes: alternative.outcomes.map((outcome) => ({
        ...outcome,
        value: parseValue(outcome.value) ?? 0,
      })),
    }));
    return buildGuidedTree({ name, question, mode, alternatives: normalized });
  }, [alternatives, mode, name, question]);

  const evMap = useMemo(() => calculateExpectedValues(tree), [tree]);
  const comparison = useMemo(() => compareRootDecision(tree), [tree]);

  const stepValid = useMemo(() => {
    if (step === 0) return question.trim().length > 0;
    if (step === 1) {
      return alternatives.length >= 2 && alternatives.every((alternative) => alternative.label.trim());
    }
    if (step === 2 && currentAlternative) {
      if (currentAlternative.kind === "certain") {
        return parseValue(currentAlternative.certainValue) !== null;
      }
      return (
        currentAlternative.outcomes.length >= 2 &&
        currentAlternative.outcomes.every(
          (outcome) => outcome.label.trim() && parseValue(outcome.value) !== null
        )
      );
    }
    return true;
  }, [alternatives, currentAlternative, question, step]);

  const updateAlternative = (id: string, updates: Partial<DraftAlternative>) => {
    setAlternatives((items) =>
      items.map((alternative) =>
        alternative.id === id ? { ...alternative, ...updates } : alternative
      )
    );
  };

  const updateOutcome = (
    alternativeId: string,
    outcomeId: string,
    updates: Partial<DraftOutcome>
  ) => {
    setAlternatives((items) =>
      items.map((alternative) =>
        alternative.id === alternativeId
          ? {
              ...alternative,
              outcomes: alternative.outcomes.map((outcome) =>
                outcome.id === outcomeId ? { ...outcome, ...updates } : outcome
              ),
            }
          : alternative
      )
    );
  };

  const updateProbability = (alternativeId: string, outcomeId: string, pct: number) => {
    setAlternatives((items) =>
      items.map((alternative) =>
        alternative.id === alternativeId
          ? {
              ...alternative,
              outcomes: rebalanceOutcomes(alternative.outcomes, outcomeId, pct / 100),
            }
          : alternative
      )
    );
  };

  const goNext = () => {
    if (!stepValid) return;
    if (step === 2 && scenarioIndex < alternatives.length - 1) {
      setScenarioIndex((index) => index + 1);
      return;
    }
    setStep((current) => Math.min(current + 1, 3));
  };

  const goBack = () => {
    if (step === 2 && scenarioIndex > 0) {
      setScenarioIndex((index) => index - 1);
      return;
    }
    if (step === 3) {
      setScenarioIndex(Math.max(alternatives.length - 1, 0));
      setStep(2);
      return;
    }
    setStep((current) => Math.max(current - 1, 0));
  };

  const stepTitles = ["La decisión", "Las alternativas", "Los resultados", "Revisión"];

  return (
    <section className="guided-wizard" aria-labelledby="guided-title">
      <div className="guided-topline">
        <button type="button" className="guided-exit" onClick={onCancel}>
          Salir del asistente
        </button>
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
          {step === 2 && currentAlternative && `¿Qué puede pasar con “${currentAlternative.label}”?`}
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
              value={question}
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
            <button
              type="button"
              role="radio"
              aria-checked={mode === "maximize"}
              className={mode === "maximize" ? "selected" : ""}
              onClick={() => setMode("maximize")}
            >
              <strong>El mayor valor</strong>
              <span>Ingresos, VAN o beneficio</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mode === "minimize"}
              className={mode === "minimize" ? "selected" : ""}
              onClick={() => setMode("minimize")}
            >
              <strong>El menor costo</strong>
              <span>Costos de intervención, pérdida o abandono</span>
            </button>
          </fieldset>
        </div>
      )}

      {step === 1 && (
        <div className="guided-fields">
          <p className="guided-intro">Agregá por lo menos dos opciones que realmente puedas elegir.</p>
          <div className="guided-alternatives">
            {alternatives.map((alternative, index) => (
              <div key={alternative.id} className="guided-alternative-row">
                <span aria-hidden="true">{index + 1}</span>
                <label className="sr-only" htmlFor={`guided-alt-${alternative.id}`}>
                  Alternativa {index + 1}
                </label>
                <input
                  id={`guided-alt-${alternative.id}`}
                  type="text"
                  value={alternative.label}
                  onFocus={(event) => event.target.select()}
                  onChange={(event) => updateAlternative(alternative.id, { label: event.target.value })}
                />
                {alternatives.length > 2 && (
                  <button
                    type="button"
                    className="guided-remove"
                    aria-label={`Eliminar ${alternative.label}`}
                    onClick={() =>
                      setAlternatives((items) => items.filter((item) => item.id !== alternative.id))
                    }
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            className="guided-add"
            onClick={() =>
              setAlternatives((items) => [
                ...items,
                createAlternative(`Alternativa ${items.length + 1}`),
              ])
            }
          >
            + Agregar otra alternativa
          </button>
        </div>
      )}

      {step === 2 && currentAlternative && (
        <div className="guided-fields">
          <div className="guided-scenario-count">
            Alternativa {scenarioIndex + 1} de {alternatives.length}
          </div>
          <fieldset className="guided-kind-toggle" role="radiogroup">
            <legend>Tipo de resultado</legend>
            <button
              type="button"
              role="radio"
              aria-checked={currentAlternative.kind === "certain"}
              className={currentAlternative.kind === "certain" ? "selected" : ""}
              onClick={() => updateAlternative(currentAlternative.id, { kind: "certain" })}
            >
              Resultado conocido
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={currentAlternative.kind === "uncertain"}
              className={currentAlternative.kind === "uncertain" ? "selected" : ""}
              onClick={() => updateAlternative(currentAlternative.id, { kind: "uncertain" })}
            >
              Hay incertidumbre
            </button>
          </fieldset>

          {currentAlternative.kind === "certain" ? (
            <label className="guided-field">
              <span>{mode === "minimize" ? "Costo total ($)" : "Valor neto o VAN ($)"}</span>
              <input
                autoFocus
                type="number"
                inputMode="decimal"
                aria-label={mode === "minimize" ? "Costo total ($)" : "Valor neto o VAN ($)"}
                value={currentAlternative.certainValue}
                onChange={(event) =>
                  updateAlternative(currentAlternative.id, { certainValue: event.target.value })
                }
                placeholder="0"
              />
              <small>Usá un valor negativo si el resultado representa una pérdida.</small>
            </label>
          ) : (
            <div className="guided-outcomes">
              <p className="guided-intro">
                Las probabilidades se ajustan automáticamente para mantener el 100%.
              </p>
              {currentAlternative.outcomes.map((outcome, index) => (
                <div key={outcome.id} className="guided-outcome">
                  <div className="guided-outcome-name">
                    <label htmlFor={`guided-outcome-${outcome.id}`}>Resultado {index + 1}</label>
                    {currentAlternative.outcomes.length > 2 && (
                      <button
                        type="button"
                        className="guided-remove"
                        aria-label={`Eliminar ${outcome.label}`}
                        onClick={() =>
                          updateAlternative(currentAlternative.id, {
                            outcomes: equalizeOutcomes(
                              currentAlternative.outcomes.filter((item) => item.id !== outcome.id)
                            ),
                          })
                        }
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <input
                    id={`guided-outcome-${outcome.id}`}
                    type="text"
                    value={outcome.label}
                    onChange={(event) =>
                      updateOutcome(currentAlternative.id, outcome.id, { label: event.target.value })
                    }
                  />
                  <div className="guided-outcome-values">
                    <label>
                      <span>Probabilidad</span>
                      <div className="guided-suffix-input">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={Number((outcome.probability * 100).toFixed(1))}
                          onFocus={(event) => event.target.select()}
                          onChange={(event) =>
                            updateProbability(
                              currentAlternative.id,
                              outcome.id,
                              Number(event.target.value)
                            )
                          }
                          aria-label={`Probabilidad de ${outcome.label}`}
                        />
                        <span>%</span>
                      </div>
                    </label>
                    <label>
                      <span>{mode === "minimize" ? "Costo total" : "Valor neto"}</span>
                      <div className="guided-prefix-input">
                        <span>$</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          value={outcome.value}
                          onChange={(event) =>
                            updateOutcome(currentAlternative.id, outcome.id, {
                              value: event.target.value,
                            })
                          }
                          aria-label={`${mode === "minimize" ? "Costo" : "Valor"} de ${outcome.label}`}
                        />
                      </div>
                    </label>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="guided-add"
                onClick={() =>
                  updateAlternative(currentAlternative.id, {
                    outcomes: equalizeOutcomes([
                      ...currentAlternative.outcomes,
                      createOutcome(`Resultado ${currentAlternative.outcomes.length + 1}`, 0),
                    ]),
                  })
                }
              >
                + Agregar otro resultado
              </button>
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="guided-review">
          <dl>
            <div>
              <dt>Decisión</dt>
              <dd>{question}</dd>
            </div>
            <div>
              <dt>Criterio</dt>
              <dd>{mode === "minimize" ? "Menor costo esperado" : "Mayor valor esperado"}</dd>
            </div>
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
              <strong>
                {comparison.isTie && comparison.alternativeLabel
                  ? `Empate: ${comparison.recommendedLabel} y ${comparison.alternativeLabel}`
                  : comparison.recommendedLabel}
              </strong>
              <small>
                {mode === "minimize" ? "Costo esperado" : "Valor esperado"}: {formatCurrency(comparison.recommendedValue)}
              </small>
            </div>
          )}
          <p className="guided-review-note">
            Se creará un árbol completamente editable. Después podés desglosar costos, tiempos o agregar decisiones posteriores.
          </p>
        </div>
      )}

      <footer className="guided-footer">
        {step > 0 ? (
          <button type="button" className="btn btn-ghost guided-back" onClick={goBack}>
            Atrás
          </button>
        ) : (
          <span />
        )}
        {step < 3 ? (
          <button type="button" className="btn btn-hero guided-next" disabled={!stepValid} onClick={goNext}>
            {step === 2 && scenarioIndex < alternatives.length - 1
              ? "Siguiente alternativa"
              : "Continuar"}
          </button>
        ) : (
          <button type="button" className="btn btn-hero guided-next" onClick={() => onComplete(tree)}>
            Crear árbol y revisarlo
          </button>
        )}
      </footer>
    </section>
  );
}
