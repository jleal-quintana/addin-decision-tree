import {
  getSensitivityParameters,
  runSensitivityAnalysis,
} from "../src/engine/SensitivityAnalysis";
import { productLaunchExample } from "../src/engine/Examples";

describe("SensitivityAnalysis", () => {
  it("runs payoff sensitivity on a terminal node", () => {
    const tree = productLaunchExample();
    const result = runSensitivityAnalysis(tree, {
      parameter: { kind: "payoff", nodeId: "high_demand" },
      min: 100000,
      max: 500000,
      steps: 5,
    });

    expect(result.parameterValues).toHaveLength(5);
    expect(result.rootEVs[0]).toBeLessThan(result.rootEVs[4]);
  });

  it("returns sensitivity candidates for payoff and probability", () => {
    const tree = productLaunchExample();
    const labels = getSensitivityParameters(tree).map((item) => item.label);

    expect(labels.some((label) => label.includes("Payoff"))).toBe(true);
    expect(labels.some((label) => label.includes("Prob"))).toBe(true);
  });
});
