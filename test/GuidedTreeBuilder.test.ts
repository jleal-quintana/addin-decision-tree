import { compareRootDecision } from "../src/engine/DecisionComparison";
import { calculateExpectedValues } from "../src/engine/ExpectedValueCalculator";
import {
  buildGuidedTree,
  GuidedDecisionNodeInput,
} from "../src/engine/GuidedTreeBuilder";

describe("GuidedTreeBuilder", () => {
  it("creates a calculated decision from known alternatives", () => {
    const tree = buildGuidedTree({
      name: "Plan de intervención",
      mode: "maximize",
      root: {
        id: "root",
        type: "decision",
        label: "¿Conviene intervenir el pozo?",
        branches: [
          {
            id: "b_intervene",
            label: "Hacer workover",
            probability: null,
            target: { id: "intervene", type: "result", label: "Resultado", value: 100 },
          },
          {
            id: "b_wait",
            label: "No intervenir",
            probability: null,
            target: { id: "wait", type: "result", label: "Resultado", value: 40 },
          },
        ],
      },
    });

    expect(tree.metadata.name).toBe("Plan de intervención");
    expect(tree.nodes.root.label).toBe("¿Conviene intervenir el pozo?");
    expect(tree.nodes.root.childIds).toHaveLength(2);
    expect(calculateExpectedValues(tree).root).toBe(100);
    expect(compareRootDecision(tree)?.recommendedLabel).toBe("Hacer workover");
  });

  it("applies a branch cost exactly once at its destination", () => {
    const tree = buildGuidedTree({
      name: "Estudio sísmico",
      mode: "maximize",
      root: {
        id: "root_cost",
        type: "decision",
        label: "¿Contratar el estudio?",
        branches: [
          {
            id: "b_study",
            label: "Hacer estudio",
            probability: null,
            cost: 30,
            target: { id: "study_result", type: "result", label: "Valor informado", value: 100 },
          },
          {
            id: "b_sell",
            label: "Vender",
            probability: null,
            cost: 0,
            target: { id: "sell_result", type: "result", label: "Venta", value: 60 },
          },
        ],
      },
    });

    const values = calculateExpectedValues(tree);
    expect(tree.nodes.study_result.cost).toBe(30);
    expect(values.study_result).toBe(70);
    expect(values.root_cost).toBe(70);
  });

  it("alternates chance and decision stages while preserving probabilities", () => {
    const tree = buildGuidedTree({
      name: "",
      mode: "maximize",
      root: {
        id: "root",
        type: "decision",
        label: "¿Perforar?",
        branches: [
          {
            id: "b_drill",
            label: "Perforar",
            probability: null,
            target: {
              id: "geology",
              type: "chance",
              label: "Resultado geológico",
              branches: [
                {
                  id: "b_success",
                  label: "Éxito",
                  probability: 0.6,
                  target: {
                    id: "completion",
                    type: "decision",
                    label: "¿Cómo completar?",
                    branches: [
                      {
                        id: "b_complete",
                        label: "Completar",
                        probability: null,
                        target: { id: "complete", type: "result", label: "Producción", value: 300 },
                      },
                      {
                        id: "b_sidetrack",
                        label: "Sidetrack",
                        probability: null,
                        target: { id: "sidetrack", type: "result", label: "Producción", value: 200 },
                      },
                    ],
                  },
                },
                {
                  id: "b_failure",
                  label: "Falla",
                  probability: 0.4,
                  target: { id: "failure", type: "result", label: "Pérdida", value: -100 },
                },
              ],
            },
          },
          {
            id: "b_exit",
            label: "Vender área",
            probability: null,
            target: { id: "exit", type: "result", label: "Venta", value: 50 },
          },
        ],
      },
    });

    const values = calculateExpectedValues(tree);
    expect(tree.metadata.name).toBe("¿Perforar?");
    expect(tree.nodes.geology.type).toBe("chance");
    expect(tree.nodes.completion.type).toBe("decision");
    expect(tree.nodes.completion.probability).toBe(0.6);
    expect(values.completion).toBe(300);
    expect(values.geology).toBe(140);
    expect(values.root).toBe(140);
    expect(compareRootDecision(tree)?.recommendedLabel).toBe("Perforar");
  });

  it("models an information study with conditional decisions and branch cost", () => {
    const posteriorPositive = (0.8 * 0.45) / 0.4975;
    const posteriorNegative = (0.2 * 0.45) / 0.5025;
    const drillingChance = (id: string, probability: number) => ({
      id,
      type: "chance" as const,
      label: "¿Hay petróleo?",
      branches: [
        {
          id: `${id}_oil_branch`,
          label: "Petróleo",
          probability,
          target: { id: `${id}_oil`, type: "result" as const, label: "Petróleo", value: 500000 },
        },
        {
          id: `${id}_dry_branch`,
          label: "Sin petróleo",
          probability: 1 - probability,
          target: { id: `${id}_dry`, type: "result" as const, label: "Pozo seco", value: -100000 },
        },
      ],
    });

    const tree = buildGuidedTree({
      name: "Exploración petrolera",
      mode: "maximize",
      root: {
        id: "exploration_root",
        type: "decision",
        label: "¿Cómo desarrollar el área?",
        branches: [
          {
            id: "direct_branch",
            label: "Perforar directamente",
            probability: null,
            target: drillingChance("direct_drilling", 0.45),
          },
          {
            id: "sell_branch",
            label: "Vender",
            probability: null,
            target: { id: "sell_now", type: "result", label: "Venta", value: 90000 },
          },
          {
            id: "study_branch",
            label: "Hacer estudio sísmico",
            probability: null,
            cost: 30000,
            target: {
              id: "study_result",
              type: "chance",
              label: "Resultado del estudio",
              branches: [
                {
                  id: "positive_branch",
                  label: "Positivo",
                  probability: 0.4975,
                  target: {
                    id: "positive_decision",
                    type: "decision",
                    label: "¿Qué hacer con resultado positivo?",
                    branches: [
                      {
                        id: "positive_drill_branch",
                        label: "Perforar",
                        probability: null,
                        target: drillingChance("positive_drilling", posteriorPositive),
                      },
                      {
                        id: "positive_sell_branch",
                        label: "Vender",
                        probability: null,
                        target: { id: "positive_sell", type: "result", label: "Venta", value: 90000 },
                      },
                    ],
                  },
                },
                {
                  id: "negative_branch",
                  label: "Negativo",
                  probability: 0.5025,
                  target: {
                    id: "negative_decision",
                    type: "decision",
                    label: "¿Qué hacer con resultado negativo?",
                    branches: [
                      {
                        id: "negative_drill_branch",
                        label: "Perforar",
                        probability: null,
                        target: drillingChance("negative_drilling", posteriorNegative),
                      },
                      {
                        id: "negative_sell_branch",
                        label: "Vender",
                        probability: null,
                        target: { id: "negative_sell", type: "result", label: "Venta", value: 90000 },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    });

    const values = calculateExpectedValues(tree);
    expect(values.direct_drilling).toBeCloseTo(170000);
    expect(values.study_result).toBeCloseTo(181475);
    expect(values.exploration_root).toBeCloseTo(181475);
    expect(tree.nodes.study_result.cost).toBe(30000);
    expect(compareRootDecision(tree)?.recommendedLabel).toBe("Hacer estudio sísmico");
  });

  it("does not impose an artificial depth limit", () => {
    const makeStage = (depth: number): GuidedDecisionNodeInput => ({
      id: `decision_${depth}`,
      type: "decision",
      label: `Decisión ${depth}`,
      branches: [
        {
          id: `continue_${depth}`,
          label: "Continuar",
          probability: null,
          target:
            depth < 12
              ? makeStage(depth + 1)
              : { id: "deep_result", type: "result", label: "Resultado", value: 120 },
        },
        {
          id: `stop_${depth}`,
          label: "Detener",
          probability: null,
          target: { id: `stop_result_${depth}`, type: "result", label: "Resultado", value: depth },
        },
      ],
    });

    const tree = buildGuidedTree({ name: "Profundo", mode: "maximize", root: makeStage(1) });
    expect(Object.values(tree.nodes).filter((node) => node.type === "decision")).toHaveLength(12);
    expect(calculateExpectedValues(tree)[tree.rootId!]).toBe(120);
  });
});
