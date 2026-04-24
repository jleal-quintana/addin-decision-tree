import { calculateExpectedValues } from "../src/engine/ExpectedValueCalculator";
import { productLaunchExample, workoverExample } from "../src/engine/Examples";

describe("ExpectedValueCalculator", () => {
  it("calculates maximize trees", () => {
    const tree = productLaunchExample();
    const evMap = calculateExpectedValues(tree);

    expect(evMap.root).toBe(10000);
    expect(evMap.launch).toBe(10000);
    expect(evMap.no_launch).toBe(0);
  });

  it("calculates minimize trees", () => {
    const tree = workoverExample();
    const evMap = calculateExpectedValues(tree);

    expect(evMap.wo_do).toBe(15500);
    expect(evMap.wo_root).toBe(15500);
    expect(evMap.wo_no).toBe(320000);
  });

  it("discounts node cost once on terminal nodes", () => {
    const tree = productLaunchExample();
    tree.nodes.low_demand.cost = 10000;

    const evMap = calculateExpectedValues(tree);
    expect(evMap.low_demand).toBe(-210000);
  });
});
