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
    branchLabel: parent ? label : null,
    payoff: type === "end" ? 0 : null,
    cost: null,
    time: null,
    expectedValue: null,
    isOptimal: false,
    parentId,
    childIds: [],
    probability: parent?.type === "chance" ? (parent.childIds.length === 0 ? 1 : 0) : null,
    collapsed: false,
    customFields: {},
  };
  const nodes = { ...tree.nodes, [id]: newNode };
  if (parentId && nodes[parentId]) {
    nodes[parentId] = { ...nodes[parentId], childIds: [...nodes[parentId].childIds, id] };
    if (parent?.type === "chance") {
      const share = 1 / nodes[parentId].childIds.length;
      for (const childId of nodes[parentId].childIds) {
        nodes[childId] = { ...nodes[childId], probability: share };
      }
    }
  }
  return { ...tree, nodes, rootId: parentId === null ? id : tree.rootId, metadata: { ...tree.metadata, updatedAt: new Date().toISOString() } };
}

export function insertIntermediateNode(
  tree: DecisionTreeData,
  nodeId: string,
  type: Exclude<NodeType, "end">,
  label: string
): DecisionTreeData {
  const child = tree.nodes[nodeId];
  if (!child?.parentId) return tree;

  const parent = tree.nodes[child.parentId];
  if (!parent) return tree;

  const id = generateId();
  const intermediate: TreeNode = {
    id,
    type,
    label,
    branchLabel: child.branchLabel ?? child.label,
    payoff: null,
    cost: null,
    time: null,
    expectedValue: null,
    isOptimal: false,
    parentId: parent.id,
    childIds: [child.id],
    probability: parent.type === "chance" ? child.probability ?? 1 : null,
    collapsed: false,
    customFields: {},
  };

  const nodes = { ...tree.nodes };
  nodes[parent.id] = {
    ...parent,
    childIds: parent.childIds.map((id) => (id === child.id ? intermediate.id : id)),
  };
  nodes[child.id] = {
    ...child,
    parentId: intermediate.id,
    branchLabel: "Continuar",
    probability: type === "chance" ? 1 : null,
  };
  nodes[intermediate.id] = intermediate;

  return { ...tree, nodes, metadata: { ...tree.metadata, updatedAt: new Date().toISOString() } };
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

export function updateNode(tree: DecisionTreeData, nodeId: string, updates: Partial<Pick<TreeNode, "label" | "branchLabel" | "type" | "payoff" | "probability" | "cost" | "time" | "customFields">>): DecisionTreeData {
  const node = tree.nodes[nodeId];
  if (!node) return tree;
  const nodes = { ...tree.nodes };
  const updatedNode = { ...node, ...updates };

  // Mientras el texto de rama conserve el valor automatico inicial, renombrar
  // el nodo tambien lo mantiene sincronizado. Una rama editada a mano no se pisa.
  if (
    updates.label !== undefined &&
    updates.branchLabel === undefined &&
    node.parentId !== null &&
    node.branchLabel === node.label
  ) {
    updatedNode.branchLabel = updates.label;
  }

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

    if (!node.label.trim()) {
      errors.push({ nodeId, message: "Todos los nodos necesitan un nombre" });
    }
    if (node.cost !== null && node.cost !== undefined && !Number.isFinite(node.cost)) {
      errors.push({ nodeId, message: `El costo de "${node.label}" debe ser un número válido` });
    }

    if (node.type === "end") {
      if (node.childIds.length > 0) {
        errors.push({ nodeId, message: `"${node.label}" es terminal y no puede tener hijos` });
      }
      if (node.payoff === null || node.payoff === undefined) {
        errors.push({ nodeId, message: `"${node.label}" necesita un VAN terminal` });
      } else if (!Number.isFinite(node.payoff)) {
        errors.push({ nodeId, message: `El resultado de "${node.label}" debe ser un número válido` });
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
        const branchName = child.branchLabel || child.label;
        if (child.probability === null || child.probability === undefined) {
          errors.push({ nodeId: childId, message: `Falta probabilidad en la rama "${branchName}"` });
          return acc;
        }
        if (!Number.isFinite(child.probability)) {
          errors.push({ nodeId: childId, message: `La probabilidad de la rama "${branchName}" debe ser un número válido` });
          return acc;
        }
        if (child.probability < 0 || child.probability > 1) {
          errors.push({ nodeId: childId, message: `La probabilidad de la rama "${branchName}" debe estar entre 0% y 100%` });
        }
        return acc + child.probability;
      }, 0);
      if (Math.abs(sum - 1) > 0.001) {
        errors.push({ nodeId, message: `Las probabilidades que salen de "${node.label}" suman ${(sum * 100).toFixed(1)}% (deben ser 100%)` });
      }
    }

    if (node.type === "decision") {
      for (const childId of node.childIds) {
        const child = tree.nodes[childId];
        if (child && child.probability !== null && Math.abs(child.probability) > 0.000001) {
          const branchName = child.branchLabel || child.label;
          errors.push({ nodeId: childId, message: `La rama "${branchName}" sale de una decision y no debe tener probabilidad` });
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
    if (node.branchLabel === undefined) node.branchLabel = node.parentId ? node.label : null;
    if (!node.customFields) node.customFields = {};
  }
  return data;
}
