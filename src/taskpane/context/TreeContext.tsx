import React, { createContext, useContext, useReducer, ReactNode } from "react";
import { DecisionTreeData, TreeAction, TreeNode } from "../../models/types";
import { addNode, createEmptyTree, removeNode, updateNode, validate } from "../../models/DecisionTree";
import { calculateExpectedValues } from "../../engine/ExpectedValueCalculator";
import { findOptimalPath } from "../../engine/RollbackAnalysis";

interface TreeState {
  tree: DecisionTreeData;
  selectedNodeId: string | null;
  activeTab: "build" | "results" | "sensitivity";
}

type FullAction =
  | TreeAction
  | { type: "SELECT_NODE"; nodeId: string | null }
  | { type: "SET_TAB"; tab: "build" | "results" | "sensitivity" };

const initialState: TreeState = {
  tree: createEmptyTree(),
  selectedNodeId: null,
  activeTab: "build",
};

/** After any tree mutation, auto-recalculate EVs if tree is valid */
function autoCalculate(tree: DecisionTreeData): DecisionTreeData {
  if (!tree.rootId) return tree;
  const errors = validate(tree);
  if (errors.length > 0) {
    // Clear EVs on invalid tree
    const nodes = { ...tree.nodes };
    for (const id of Object.keys(nodes)) {
      nodes[id] = { ...nodes[id], expectedValue: null, isOptimal: false };
    }
    return { ...tree, nodes };
  }
  const evMap = calculateExpectedValues(tree);
  const optimalPath = findOptimalPath(tree, evMap);
  const nodes = { ...tree.nodes };
  for (const id of Object.keys(nodes)) {
    nodes[id] = {
      ...nodes[id],
      expectedValue: evMap[id] ?? null,
      isOptimal: optimalPath.includes(id),
    };
  }
  return { ...tree, nodes };
}

function treeReducer(state: TreeState, action: FullAction): TreeState {
  switch (action.type) {
    case "ADD_NODE": {
      const newTree = autoCalculate(addNode(state.tree, action.parentId, action.nodeType, action.label));
      const newNodeIds = Object.keys(newTree.nodes).filter((id) => !state.tree.nodes[id]);
      return { ...state, tree: newTree, selectedNodeId: newNodeIds[0] ?? state.selectedNodeId };
    }
    case "REMOVE_NODE": {
      const newTree = autoCalculate(removeNode(state.tree, action.nodeId));
      return {
        ...state, tree: newTree,
        selectedNodeId: state.selectedNodeId === action.nodeId ? null : state.selectedNodeId,
      };
    }
    case "UPDATE_NODE":
      return { ...state, tree: autoCalculate(updateNode(state.tree, action.nodeId, action.updates)) };
    case "SET_TREE":
      return { ...state, tree: autoCalculate(action.data), selectedNodeId: null };
    case "CLEAR_TREE":
      return { ...state, tree: createEmptyTree("Nuevo Arbol", action.mode ?? "maximize"), selectedNodeId: null };
    case "SET_EXPECTED_VALUES": {
      // Manual calculate (still supported)
      const nodes = { ...state.tree.nodes };
      for (const id of Object.keys(nodes)) {
        nodes[id] = { ...nodes[id], expectedValue: null, isOptimal: false };
      }
      for (const [id, ev] of Object.entries(action.values)) {
        if (nodes[id]) nodes[id] = { ...nodes[id], expectedValue: ev };
      }
      for (const id of action.optimalPath) {
        if (nodes[id]) nodes[id] = { ...nodes[id], isOptimal: true };
      }
      return { ...state, tree: { ...state.tree, nodes }, activeTab: "results" };
    }
    case "CLEAR_RESULTS": {
      const nodes = { ...state.tree.nodes };
      for (const id of Object.keys(nodes)) {
        nodes[id] = { ...nodes[id], expectedValue: null, isOptimal: false };
      }
      return { ...state, tree: { ...state.tree, nodes } };
    }
    case "LOAD_EXAMPLE":
      return { ...state, tree: autoCalculate(action.data), selectedNodeId: null };
    case "SELECT_NODE":
      return { ...state, selectedNodeId: action.nodeId };
    case "SET_TAB":
      return { ...state, activeTab: action.tab };
    default:
      return state;
  }
}

const TreeContext = createContext<{
  state: TreeState;
  dispatch: React.Dispatch<FullAction>;
} | null>(null);

export function TreeProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(treeReducer, initialState);
  return (
    <TreeContext.Provider value={{ state, dispatch }}>
      {children}
    </TreeContext.Provider>
  );
}

export function useTree() {
  const ctx = useContext(TreeContext);
  if (!ctx) throw new Error("useTree must be used within TreeProvider");
  return ctx;
}
