import { workoverExample } from "../src/engine/Examples";
import { rebalanceChanceProbability } from "../src/engine/ProbabilityRebalancing";

describe("rebalanceChanceProbability", () => {
  it("keeps sibling probabilities at 100 percent", () => {
    const tree = rebalanceChanceProbability(workoverExample(), "wo_ok", 0.7);

    expect(tree.nodes.wo_ok.probability).toBeCloseTo(0.7);
    expect(tree.nodes.wo_fail.probability).toBeCloseTo(0.3);
    expect(
      (tree.nodes.wo_ok.probability ?? 0) + (tree.nodes.wo_fail.probability ?? 0)
    ).toBeCloseTo(1);
  });
});
