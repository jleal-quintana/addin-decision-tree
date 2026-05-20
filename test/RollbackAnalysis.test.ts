import {
  describeOptimalStrategy,
  findOptimalPath,
  getOptimalChildId,
} from "../src/engine/RollbackAnalysis";
import { productLaunchExample, workoverExample } from "../src/engine/Examples";
import { calculateExpectedValues } from "../src/engine/ExpectedValueCalculator";

describe("RollbackAnalysis", () => {
  it("finds the optimal branch in maximize mode", () => {
    const tree = productLaunchExample();
    const evMap = calculateExpectedValues(tree);

    expect(getOptimalChildId(tree, "root", evMap)).toBe("launch");
    expect(findOptimalPath(tree, evMap)).toEqual(["root", "launch", "high_demand", "med_demand", "low_demand"]);
  });

  it("describes minimize mode using cost wording", () => {
    const tree = workoverExample();
    const evMap = calculateExpectedValues(tree);
    const strategy = describeOptimalStrategy(tree, evMap);

    expect(getOptimalChildId(tree, "wo_root", evMap)).toBe("wo_do");
    expect(strategy).toContain("Costo esperado");
    expect(strategy).toContain("Hacer workover");
  });
});
