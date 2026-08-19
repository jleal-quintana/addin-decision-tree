import { enumeratePaths } from "../src/engine/PathEnumeration";
import { oilDrillingExample } from "../src/engine/Examples";

describe("enumeratePaths", () => {
  it("includes a cost assigned to the root, matching the expected-value engine", () => {
    const tree = oilDrillingExample();
    tree.nodes.root.cost = 25_000;

    const paths = enumeratePaths(tree);
    const noDrill = paths.find((path) => path.ids.at(-1) === "no_drill");

    expect(noDrill?.value).toBe(-25_000);
  });
});
