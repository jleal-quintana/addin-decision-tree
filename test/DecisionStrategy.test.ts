import { buildDecisionStrategy } from "../src/engine/DecisionStrategy";
import { workoverExample } from "../src/engine/Examples";

describe("buildDecisionStrategy", () => {
  it("includes decisions that are only reached after an uncertain outcome", () => {
    const strategy = buildDecisionStrategy(workoverExample());

    expect(strategy).toHaveLength(2);
    expect(strategy[0]).toMatchObject({
      decisionId: "wo_root",
      choiceId: "wo_do",
      choiceLabel: "Hacer workover",
      conditionLabel: null,
    });
    expect(strategy[1]).toMatchObject({
      decisionId: "wo_fail",
      choiceId: "wo_abandon",
      choiceLabel: "Abandonar pozo",
      conditionLabel: "Ante falla operativa",
    });
  });
});
