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
