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

    // Modo Costo: cost suma. wo_do = 0.65·120k + 0.35·250k + CAPEX 150k = 315.5k.
    // wo_root = min(315.5k, 320k) = 315.5k → workover sigue ganando, pero por
    // poco (antes daba 15.5k por bug de signo, una "ganga" falsa).
    expect(evMap.wo_do).toBe(315500);
    expect(evMap.wo_root).toBe(315500);
    expect(evMap.wo_no).toBe(320000);
  });

  it("discounts node cost once on terminal nodes", () => {
    const tree = productLaunchExample();
    tree.nodes.low_demand.cost = 10000;

    const evMap = calculateExpectedValues(tree);
    expect(evMap.low_demand).toBe(-210000);
  });
});
