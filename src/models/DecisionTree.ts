import { DecisionTreeData, NodeType, TreeNode, ValidationError } from "./types";

let idCounter = 0;
function generateId(): string {
  return `node_${Date.now()}_${++idCounter}`;
}

export function createEmptyTree(name = "Nuevo Arbol", mode: "maximize" | "minimize" = "maximize"): DecisionTreeData {
  return {
    nodes: {},
    rootId: null,
    metadata: { name, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), mode },
  };
}

export function addNode(tree: DecisionTreeData, parentId: string | null, type: NodeType, label: string): DecisionTreeData {
  const id = generateId();
  const parent = parentId ? tree.nodes[parentId] : null;
  const newNode: TreeNode = {
    id, type, label,
    payoff: type === "end" ? 0 : null,
    cost: null,
    time: null,
    expectedValue: null,
    isOptimal: false,
    parentId,
    childIds: [],
    probability: parent?.type === "chance" ? 0 : null,
    collapsed: false,
    customFields: {},
  };
  const nodes = { ...tree.nodes, [id]: newNode };
  if (parentId && nodes[parentId]) {
    nodes[parentId] = { ...nodes[parentId], childIds: [...nodes[parentId].childIds, id] };
  }
  return { ...tree, nodes, rootId: parentId === null ? id : tree.rootId, metadata: { ...tree.metadata, updatedAt: new Date().toISOString() } };
}

function collectSubtreeIds(tree: DecisionTreeData, nodeId: string): Set<string> {
  const toRemove = new Set<string>();
  const queue = [nodeId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (toRemove.has(cur)) continue;
    toRemove.add(cur);
    const node = tree.nodes[cur];
    if (node) queue.push(...node.childIds);
  }
  return toRemove;
}

export function removeNode(tree: DecisionTreeData, nodeId: string): DecisionTreeData {
  const node = tree.nodes[nodeId];
  if (!node) return tree;
  const toRemove = collectSubtreeIds(tree, nodeId);
  const nodes = { ...tree.nodes };
  for (const id of toRemove) delete nodes[id];
  if (node.parentId && nodes[node.parentId]) {
    nodes[node.parentId] = { ...nodes[node.parentId], childIds: nodes[node.parentId].childIds.filter((id) => id !== nodeId) };
  }
  return { ...tree, nodes, rootId: tree.rootId && toRemove.has(tree.rootId) ? null : tree.rootId, metadata: { ...tree.metadata, updatedAt: new Date().toISOString() } };
}

export function updateNode(tree: DecisionTreeData, nodeId: string, updates: Partial<Pick<TreeNode, "label" | "type" | "payoff" | "probability" | "cost" | "time" | "customFields">>): DecisionTreeData {
  const node = tree.nodes[nodeId];
  if (!node) return tree;
  const nodes = { ...tree.nodes };
  const updatedNode = { ...node, ...updates };

  if (updates.type === "end" && node.type !== "end") {
    for (const childId of node.childIds) {
      for (const id of collectSubtreeIds(tree, childId)) {
        delete nodes[id];
      }
    }
    updatedNode.childIds = [];
    updatedNode.payoff = updatedNode.payoff ?? 0;
  }

  if (updates.type && updates.type !== "end" && node.type === "end") {
    updatedNode.payoff = null;
  }

  nodes[nodeId] = updatedNode;

  if (updates.type === "decision") {
    for (const childId of updatedNode.childIds) {
      const child = nodes[childId];
      if (child) nodes[childId] = { ...child, probability: null };
    }
  }

  if (updates.type === "chance") {
    for (const childId of updatedNode.childIds) {
      const child = nodes[childId];
      if (child) nodes[childId] = { ...child, probability: child.probability ?? 0 };
    }
  }

  return { ...tree, nodes, metadata: { ...tree.metadata, updatedAt: new Date().toISOString() } };
}

export function validate(tree: DecisionTreeData): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!tree.rootId) return [{ nodeId: "", message: "El arbol esta vacio" }];

  const root = tree.nodes[tree.rootId];
  if (!root) {
    return [{ nodeId: "", message: "La raiz del arbol no existe en la estructura actual" }];
  }
  if (root.parentId !== null) {
    errors.push({ nodeId: root.id, message: `La raiz "${root.label}" no puede tener padre` });
  }
  if (root.type !== "decision") {
    errors.push({ nodeId: root.id, message: "La raiz debe ser un nodo de decision" });
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  function walk(nodeId: string) {
    if (visiting.has(nodeId)) {
      errors.push({ nodeId, message: "El arbol contiene un ciclo y no puede calcularse" });
      return;
    }
    if (visited.has(nodeId)) return;

    const node = tree.nodes[nodeId];
    if (!node) {
      errors.push({ nodeId, message: `El nodo "${nodeId}" no existe` });
      return;
    }

    visiting.add(nodeId);
    visited.add(nodeId);

    if (node.type === "end") {
      if (node.childIds.length > 0) {
        errors.push({ nodeId, message: `"${node.label}" es terminal y no puede tener hijos` });
      }
      if (node.payoff === null || node.payoff === undefined) {
        errors.push({ nodeId, message: `"${node.label}" necesita un VAN terminal` });
      }
    } else if (node.childIds.length === 0) {
      errors.push({ nodeId, message: `"${node.label}" necesita al menos un hijo` });
    }

    if (node.childIds.length !== new Set(node.childIds).size) {
      errors.push({ nodeId, message: `"${node.label}" tiene hijos duplicados` });
    }

    if (node.type === "chance" && node.childIds.length > 0) {
      const sum = node.childIds.reduce((acc, childId) => {
        const child = tree.nodes[childId];
        if (!child) return acc;
        if (child.probability === null || child.probability === undefined) {
          errors.push({ nodeId: childId, message: `"${child.label}" necesita una probabilidad porque su padre es de azar` });
          return acc;
        }
        return acc + child.probability;
      }, 0);
      if (Math.abs(sum - 1) > 0.001) {
        errors.push({ nodeId, message: `Prob. de "${node.label}" suman ${(sum * 100).toFixed(1)}% (deben ser 100%)` });
      }
    }

    if (node.type === "decision") {
      for (const childId of node.childIds) {
        const child = tree.nodes[childId];
        if (child && child.probability !== null && Math.abs(child.probability) > 0.000001) {
          errors.push({ nodeId: childId, message: `"${child.label}" no debe tener probabilidad operativa bajo una decision` });
        }
      }
    }

    for (const childId of node.childIds) {
      const child = tree.nodes[childId];
      if (!child) {
        errors.push({ nodeId, message: `"${node.label}" referencia al hijo inexistente "${childId}"` });
        continue;
      }
      if (child.parentId !== nodeId) {
        errors.push({ nodeId: childId, message: `"${child.label}" no tiene como padre a "${node.label}"` });
      }
      walk(childId);
    }

    visiting.delete(nodeId);
  }

  walk(tree.rootId);

  for (const [id, node] of Object.entries(tree.nodes)) {
    if (!visited.has(id)) {
      errors.push({ nodeId: id, message: `"${node.label}" quedo fuera de la raiz y debe eliminarse o reconectarse` });
    }
    if (id !== tree.rootId && node.parentId === null) {
      errors.push({ nodeId: id, message: `"${node.label}" no puede tener parentId nulo si no es la raiz` });
    }
  }

  return errors;
}

export function serialize(tree: DecisionTreeData): string { return JSON.stringify(tree); }
export function deserialize(json: string): DecisionTreeData {
  const data = JSON.parse(json) as DecisionTreeData;
  if (!data.nodes || !data.metadata) throw new Error("Formato invalido");
  // Backwards compat: add mode if missing
  if (!data.metadata.mode) data.metadata.mode = "maximize";
  // Backwards compat: add customFields if missing
  for (const node of Object.values(data.nodes)) {
    if (!node.customFields) node.customFields = {};
  }
  return data;
}
