import { oilDrillingExample, productLaunchExample } from "../src/engine/Examples";
import { computeLayout } from "../src/renderer/TreeLayoutEngine";

describe("TreeLayoutEngine", () => {
  it("lays out a simple tree left-to-right", () => {
    const layout = computeLayout(oilDrillingExample());

    expect(layout.nodes).toHaveLength(5);
    const root = layout.nodes.find((node) => node.id === "root")!;
    const drill = layout.nodes.find((node) => node.id === "drill")!;
    expect(drill.col).toBeGreaterThan(root.col);
  });

  it("centers parents between their children", () => {
    const layout = computeLayout(productLaunchExample());

    const launch = layout.nodes.find((node) => node.id === "launch")!;
    const high = layout.nodes.find((node) => node.id === "high_demand")!;
    const low = layout.nodes.find((node) => node.id === "low_demand")!;

    expect(launch.row).toBe(Math.round((high.row + low.row) / 2));
  });

  it("respects grid overrides", () => {
    const layout = computeLayout(oilDrillingExample(), undefined, {
      grid: { nodeCols: 7, colGap: 9 },
    });

    const drill = layout.nodes.find((node) => node.id === "drill")!;
    const root = layout.nodes.find((node) => node.id === "root")!;
    expect(drill.col - root.col).toBe(16);
  });
});
