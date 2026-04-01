export type NodeType = "decision" | "chance" | "end";

export interface TreeNode {
  id: string;
  type: NodeType;
  label: string;
  payoff: number | null;
  cost: number | null;
  time: string | null;
  expectedValue: number | null;
  isOptimal: boolean;
  parentId: string | null;
  childIds: string[];
  probability: number | null;
  collapsed: boolean;
  customFields: Record<string, string | number | null>;
}

export interface DecisionTreeData {
  nodes: Record<string, TreeNode>;
  rootId: string | null;
  metadata: TreeMetadata;
}

export interface TreeMetadata {
  name: string;
  createdAt: string;
  updatedAt: string;
  mode: "maximize" | "minimize";
}

// Grid-based layout (row/col in Excel grid)
export interface LayoutNode {
  id: string;
  row: number;
  col: number;
  midRow: number;
  calcRow: number | null;
  type: NodeType;
  label: string;
  expectedValue: number | null;
  payoff: number | null;
  cost: number | null;
  time: string | null;
  probability: number | null;
  isOptimal: boolean;
  isLeaf: boolean;
  customFields: Record<string, string | number | null>;
}

export interface LayoutEdge {
  fromId: string;
  toId: string;
  fromRow: number;
  fromCol: number;
  fromMidRow: number;
  toRow: number;
  toCol: number;
  toMidRow: number;
  connectorCol: number;
  calcRow: number | null;
  label: string;
  probability: number | null;
  isOptimal: boolean;
}

export interface LayoutResult {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  maxRow: number;
  maxCol: number;
}

export interface ValidationError {
  nodeId: string;
  message: string;
}

export interface CalcSheetNodeRef {
  rowIndex: number;
  sheetRow: number;
  probabilityAddress: string;
  costAddress: string;
  terminalValueAddress: string;
  childrenEvAddress: string;
  netEvAddress: string;
}

export interface CalcSheetMetadata {
  sheetName: string;
  tableName: string;
  nodeRefs: Record<string, CalcSheetNodeRef>;
}

export interface SensitivityResult {
  parameterValues: number[];
  evByDecision: Record<string, number[]>;
  switchPoints: SwitchPoint[];
  rootEVs: number[];
}

export interface SwitchPoint {
  parameterValue: number;
  fromDecision: string;
  toDecision: string;
  ev: number;
}

export type TreeAction =
  | { type: "ADD_NODE"; parentId: string | null; nodeType: NodeType; label: string }
  | { type: "REMOVE_NODE"; nodeId: string }
  | { type: "UPDATE_NODE"; nodeId: string; updates: Partial<Pick<TreeNode, "label" | "type" | "payoff" | "probability" | "cost" | "time" | "customFields">> }
  | { type: "SET_TREE"; data: DecisionTreeData }
  | { type: "CLEAR_TREE"; mode?: "maximize" | "minimize" }
  | { type: "SET_EXPECTED_VALUES"; values: Record<string, number | null>; optimalPath: string[] }
  | { type: "CLEAR_RESULTS" }
  | { type: "LOAD_EXAMPLE"; data: DecisionTreeData };
