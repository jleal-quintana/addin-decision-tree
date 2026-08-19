import { compareRootDecision } from "../src/engine/DecisionComparison";
import { oilDrillingExample, workoverExample } from "../src/engine/Examples";

describe("compareRootDecision", () => {
  it("compares expected values of root alternatives in value mode", () => {
    const comparison = compareRootDecision(oilDrillingExample());

    expect(comparison?.recommendedId).toBe("drill");
    expect(comparison?.alternativeId).toBe("no_drill");
    expect(comparison?.recommendedValue).toBe(200000);
    expect(comparison?.delta).toBe(200000);
  });

  it("compares expected costs instead of terminal outcomes in cost mode", () => {
    const comparison = compareRootDecision(workoverExample());

    expect(comparison?.recommendedId).toBe("wo_do");
    expect(comparison?.alternativeId).toBe("wo_no");
    expect(comparison?.recommendedValue).toBe(315500);
    expect(comparison?.delta).toBe(4500);
    expect(comparison?.relativeDelta).toBeCloseTo(4500 / 320000, 8);
    expect(comparison?.isTie).toBe(false);
  });

  it("reports an exact tie instead of presenting an arbitrary winner", () => {
    const tree = oilDrillingExample();
    tree.nodes.no_drill.payoff = 200000;

    const comparison = compareRootDecision(tree);

    expect(comparison?.delta).toBe(0);
    expect(comparison?.isTie).toBe(true);
  });
});
