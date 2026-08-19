import {
  addNode,
  createEmptyTree,
  deserialize,
  insertIntermediateNode,
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

  it("keeps branch text separate from node text", () => {
    let tree = createEmptyTree();
    tree = addNode(tree, null, "decision", "Intervenir pozo?");
    tree = addNode(tree, tree.rootId, "chance", "Prueba de hermeticidad");
    const childId = tree.nodes[tree.rootId!].childIds[0];

    tree = updateNode(tree, childId, { branchLabel: "No desplaza" });

    expect(tree.nodes[childId].label).toBe("Prueba de hermeticidad");
    expect(tree.nodes[childId].branchLabel).toBe("No desplaza");
  });

  it("keeps an automatic branch label in sync until the user customizes it", () => {
    let tree = createEmptyTree();
    tree = addNode(tree, null, "decision", "Root");
    tree = addNode(tree, tree.rootId, "chance", "Alternativa inicial");
    const childId = tree.nodes[tree.rootId!].childIds[0];

    tree = updateNode(tree, childId, { label: "Alternativa renombrada" });
    expect(tree.nodes[childId].branchLabel).toBe("Alternativa renombrada");

    tree = updateNode(tree, childId, { branchLabel: "Texto manual" });
    tree = updateNode(tree, childId, { label: "Nombre del nodo" });
    expect(tree.nodes[childId].branchLabel).toBe("Texto manual");
  });

  it("distributes probabilities when a new uncertainty outcome is added", () => {
    let tree = createEmptyTree();
    tree = addNode(tree, null, "decision", "Root");
    tree = addNode(tree, tree.rootId, "chance", "Mercado");
    const chanceId = tree.nodes[tree.rootId!].childIds[0];
    tree = addNode(tree, chanceId, "end", "Favorable");
    tree = addNode(tree, chanceId, "end", "Adverso");

    const probabilities = tree.nodes[chanceId].childIds.map(
      (id) => tree.nodes[id].probability
    );
    expect(probabilities).toEqual([0.5, 0.5]);
  });

  it("inserts an intermediate step without dropping the existing subtree", () => {
    let tree = createEmptyTree();
    tree = addNode(tree, null, "decision", "Intervenir pozo?");
    tree = addNode(tree, tree.rootId, "end", "Abandona intervencion");
    const originalChildId = tree.nodes[tree.rootId!].childIds[0];
    tree = updateNode(tree, originalChildId, { branchLabel: "Desplaza", payoff: 10 });

    tree = insertIntermediateNode(tree, originalChildId, "chance", "Prueba de hermeticidad");

    const insertedId = tree.nodes[tree.rootId!].childIds[0];
    expect(insertedId).not.toBe(originalChildId);
    expect(tree.nodes[insertedId].label).toBe("Prueba de hermeticidad");
    expect(tree.nodes[insertedId].branchLabel).toBe("Desplaza");
    expect(tree.nodes[insertedId].childIds).toEqual([originalChildId]);
    expect(tree.nodes[originalChildId].parentId).toBe(insertedId);
    expect(tree.nodes[originalChildId].branchLabel).toBe("Continuar");
  });

  it("migrates old saved trees with branch labels derived from child labels", () => {
    const data = deserialize(JSON.stringify({
      rootId: "root",
      metadata: {
        name: "Viejo",
        createdAt: "2026-04-24T00:00:00.000Z",
        updatedAt: "2026-04-24T00:00:00.000Z",
        mode: "maximize",
      },
      nodes: {
        root: {
          id: "root",
          type: "decision",
          label: "Root",
          payoff: null,
          cost: null,
          time: null,
          expectedValue: null,
          isOptimal: false,
          parentId: null,
          childIds: ["child"],
          probability: null,
          collapsed: false,
          customFields: {},
        },
        child: {
          id: "child",
          type: "end",
          label: "No perforar",
          payoff: 0,
          cost: null,
          time: null,
          expectedValue: null,
          isOptimal: false,
          parentId: "root",
          childIds: [],
          probability: null,
          collapsed: false,
          customFields: {},
        },
      },
    }));

    expect(data.nodes.root.branchLabel).toBeNull();
    expect(data.nodes.child.branchLabel).toBe("No perforar");
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

  it("rejects empty labels and out-of-range probabilities", () => {
    let tree = createEmptyTree();
    tree = addNode(tree, null, "decision", "Root");
    tree = addNode(tree, tree.rootId, "chance", "Mercado");
    const chanceId = tree.nodes[tree.rootId!].childIds[0];
    tree = addNode(tree, chanceId, "end", "");
    const firstId = tree.nodes[chanceId].childIds[0];
    tree = updateNode(tree, firstId, { probability: 1.2 });

    const errors = validate(tree).map((error) => error.message);
    expect(errors).toContain("Todos los nodos necesitan un nombre");
    expect(errors.some((message) => message.includes("entre 0% y 100%"))).toBe(true);
  });
});
