import {
  addNode,
  createEmptyTree,
  removeNode,
  updateNode,
  validate,
} from "../src/models/DecisionTree";

describe("DecisionTree", () => {
  it("creates a root and children", () => {
    let tree = createEmptyTree();
    tree = addNode(tree, null, "decision", "Root");
    tree = addNode(tree, tree.rootId, "chance", "Chance");

    expect(tree.rootId).toBeTruthy();
    expect(Object.keys(tree.nodes)).toHaveLength(2);
    expect(tree.nodes[tree.rootId!].childIds).toHaveLength(1);
  });

  it("removes a subtree", () => {
    let tree = createEmptyTree();
    tree = addNode(tree, null, "decision", "Root");
    tree = addNode(tree, tree.rootId, "chance", "Chance");
    const chanceId = tree.nodes[tree.rootId!].childIds[0];
    tree = addNode(tree, chanceId, "end", "Leaf");

    tree = removeNode(tree, chanceId);

    expect(Object.keys(tree.nodes)).toHaveLength(1);
    expect(tree.nodes[tree.rootId!].childIds).toEqual([]);
  });

  it("drops descendants when switching to end node", () => {
    let tree = createEmptyTree();
    tree = addNode(tree, null, "decision", "Root");
    tree = addNode(tree, tree.rootId, "chance", "Branch");
    const branchId = tree.nodes[tree.rootId!].childIds[0];
    tree = addNode(tree, branchId, "end", "Leaf");

    tree = updateNode(tree, branchId, { type: "end", payoff: 10 });

    expect(tree.nodes[branchId].type).toBe("end");
    expect(tree.nodes[branchId].childIds).toEqual([]);
    expect(Object.keys(tree.nodes)).toHaveLength(2);
  });

  it("validates duplicate children, invalid root and probability sum", () => {
    const tree = createEmptyTree("Test");
    tree.rootId = "root";
    tree.nodes.root = {
      id: "root",
      type: "chance",
      label: "Root",
      payoff: null,
      cost: null,
      time: null,
      expectedValue: null,
      isOptimal: false,
      parentId: null,
      childIds: ["a", "a"],
      probability: null,
      collapsed: false,
      customFields: {},
    };
    tree.nodes.a = {
      id: "a",
      type: "end",
      label: "Leaf",
      payoff: 100,
      cost: null,
      time: null,
      expectedValue: null,
      isOptimal: false,
      parentId: "root",
      childIds: [],
      probability: 0.4,
      collapsed: false,
      customFields: {},
    };

    const errors = validate(tree).map((error) => error.message);

    expect(errors.some((message) => message.includes("raiz debe ser un nodo de decision"))).toBe(true);
    expect(errors.some((message) => message.includes("hijos duplicados"))).toBe(true);
    expect(errors.some((message) => message.includes("80.0%"))).toBe(true);
  });
});
