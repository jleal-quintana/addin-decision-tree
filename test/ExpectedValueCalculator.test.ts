import { calculateExpectedValues } from "../src/engine/ExpectedValueCalculator";
import { productLaunchExample, vacaMuertaDevelopmentExample, workoverExample } from "../src/engine/Examples";

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

  it("includes the Vaca Muerta development example with balanced probabilities and investments", () => {
    const tree = vacaMuertaDevelopmentExample();
    const evMap = calculateExpectedValues(tree);

    expect(tree.metadata.mode).toBe("maximize");
    expect(evMap.vm_root).toBeCloseTo(289.511825, 6);
    expect(evMap.vm_pilot).toBeCloseTo(289.511825, 6);
    // Estos nodos ya incluyen el costo de rama de 40 MM$; en el Excel pro
    // aparecen como valor bruto separado de la celda de costo (-40).
    expect(evMap.vm_p1_success).toBeCloseTo(723.19025, 6);
    expect(evMap.vm_p1_fail).toBeCloseTo(160.7925, 6);
    expect(evMap.vm_withdraw).toBe(0);

    for (const node of Object.values(tree.nodes)) {
      if (node.type !== "chance" || node.childIds.length === 0) continue;
      const sum = node.childIds.reduce((total, childId) => total + (tree.nodes[childId]?.probability ?? 0), 0);
      expect(sum).toBeCloseTo(1, 8);
    }
  });

  it("discounts node cost once on terminal nodes", () => {
    const tree = productLaunchExample();
    tree.nodes.low_demand.cost = 10000;

    const evMap = calculateExpectedValues(tree);
    expect(evMap.low_demand).toBe(-210000);
  });
});
