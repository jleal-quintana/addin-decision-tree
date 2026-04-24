import { DecisionTreeData, LayoutEdge, LayoutNode } from "../models/types";
import { RENDER_LIMITS } from "./designTokens";

function truncate(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "N/D";
  return `$${value.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

export function formatPrimaryMetricLabel(tree: DecisionTreeData): string {
  return tree.metadata.mode === "minimize" ? "Costo esperado" : "Valor esperado";
}

export function formatTerminalMetricLabel(tree: DecisionTreeData): string {
  return tree.metadata.mode === "minimize" ? "Costo terminal" : "Resultado terminal";
}

export function buildNodeTitle(node: LayoutNode): string {
  return truncate(node.label, RENDER_LIMITS.titleChars);
}

export function buildNodePrimaryValue(tree: DecisionTreeData, node: LayoutNode): string {
  const label = formatPrimaryMetricLabel(tree);

  if (node.expectedValue !== null) {
    return `${label}: ${formatCurrency(node.expectedValue)}`;
  }

  if (node.type === "end" && node.payoff !== null) {
    return `${formatTerminalMetricLabel(tree)}: ${formatCurrency(node.payoff)}`;
  }

  return `${label}: N/D`;
}

export function buildNodeSecondaryLines(node: LayoutNode): string[] {
  const parts: string[] = [];

  if (node.probability !== null && node.probability > 0) {
    parts.push(`Prob. ${(node.probability * 100).toFixed(0)}%`);
  }
  if (node.cost !== null && node.cost !== 0) {
    parts.push(`Costo ${formatCurrency(node.cost)}`);
  }
  if (node.time) {
    parts.push(node.time);
  }
  if (node.type === "end" && node.payoff !== null) {
    parts.push(formatCurrency(node.payoff));
  }

  return parts
    .slice(0, RENDER_LIMITS.maxSecondaryLines)
    .map((line) => truncate(line, RENDER_LIMITS.secondaryLineChars));
}

export function buildNodeNoteLines(node: LayoutNode): string[] {
  return Object.entries(node.customFields ?? {})
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, RENDER_LIMITS.maxNoteLines)
    .map(([key, value]) => truncate(`${key}: ${String(value)}`, RENDER_LIMITS.noteLineChars));
}

export function buildEdgeLabel(edge: LayoutEdge, childNode: LayoutNode | undefined): string {
  const lines: string[] = [];
  const childCost = childNode?.cost;
  const childTime = childNode?.time;

  if (edge.probability !== null && edge.probability > 0) {
    lines.push(`${(edge.probability * 100).toFixed(0)}%`);
  }
  if (childCost !== null && childCost !== undefined && childCost !== 0) {
    lines.push(`Costo ${formatCurrency(childCost)}`);
  }
  if (childTime) {
    lines.push(childTime);
  }

  return lines
    .slice(0, RENDER_LIMITS.maxSecondaryLines)
    .map((line) => truncate(line, RENDER_LIMITS.secondaryLineChars))
    .join("\n");
}
