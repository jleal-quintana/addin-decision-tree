import { compareRootDecision } from "../src/engine/DecisionComparison";
import { calculateExpectedValues } from "../src/engine/ExpectedValueCalculator";
import { buildGuidedTree } from "../src/engine/GuidedTreeBuilder";

describe("GuidedTreeBuilder", () => {
  it("creates a calculated decision from known alternatives", () => {
    const tree = buildGuidedTree({
      name: "Plan de intervención",
      question: "¿Conviene intervenir el pozo?",
      mode: "maximize",
      alternatives: [
        {
          id: "intervene",
          label: "Hacer workover",
          kind: "certain",
          certainValue: 100,
          outcomes: [],
        },
        {
          id: "wait",
          label: "No intervenir",
          kind: "certain",
          certainValue: 40,
          outcomes: [],
        },
      ],
    });

    expect(tree.metadata.name).toBe("Plan de intervención");
    expect(tree.nodes.guided_root.label).toBe("¿Conviene intervenir el pozo?");
    expect(tree.nodes.guided_root.childIds).toHaveLength(2);
    expect(calculateExpectedValues(tree).guided_root).toBe(100);
    expect(compareRootDecision(tree)?.recommendedLabel).toBe("Hacer workover");
  });

  it("creates chance branches with their expected values and supports cost mode", () => {
    const tree = buildGuidedTree({
      name: "",
      question: "¿Qué reparación conviene?",
      mode: "minimize",
      alternatives: [
        {
          id: "repair",
          label: "Reparar ahora",
          kind: "uncertain",
          certainValue: 0,
          outcomes: [
            { id: "ok", label: "Éxito", probability: 0.75, value: 80 },
            { id: "fail", label: "Falla", probability: 0.25, value: 200 },
          ],
        },
        {
          id: "replace",
          label: "Reemplazar",
          kind: "certain",
          certainValue: 120,
          outcomes: [],
        },
      ],
    });

    const values = calculateExpectedValues(tree);
    expect(tree.metadata.name).toBe("¿Qué reparación conviene?");
    expect(tree.nodes.guided_alt_1.type).toBe("chance");
    expect(tree.nodes.guided_alt_1.childIds).toHaveLength(2);
    expect(values.guided_alt_1).toBe(110);
    expect(values.guided_root).toBe(110);
    expect(compareRootDecision(tree)?.recommendedLabel).toBe("Reparar ahora");
  });
});
