import { DecisionTreeData, LayoutEdge, LayoutNode } from "../models/types";
import { RENDER_LIMITS } from "./designTokens";

function truncate(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "N/D";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    const formatted = millions.toLocaleString("es-AR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    return `${sign}$${formatted}MM`;
  }
  return `${sign}$${abs.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
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

export function buildNodeSecondaryLines(tree: DecisionTreeData, node: LayoutNode): string[] {
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
    parts.push(`${formatTerminalMetricLabel(tree)} ${formatCurrency(node.payoff)}`);
  }

  return parts
    .slice(0, RENDER_LIMITS.maxSecondaryLines)
    .map((line) => truncate(line, RENDER_LIMITS.secondaryLineChars));
}

// Heurística: si un customField numérico coincide con node.cost, es duplicado
// del campo "Costo" (caso típico: OPEX=120000 con cost=120000). Lo filtramos
// para no mostrar la misma plata dos veces en el tooltip.
function isDuplicateOfCost(value: unknown, cost: number | null): boolean {
  if (cost === null || cost === 0) return false;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) && numeric === cost;
}

function formatNoteValue(value: unknown): string {
  const numeric = typeof value === "number" ? value : Number(value);
  if (typeof value !== "boolean" && Number.isFinite(numeric) && Math.abs(numeric) >= 1000) {
    return formatCurrency(numeric);
  }
  return String(value);
}

export function buildNodeNoteLines(node: LayoutNode): string[] {
  return Object.entries(node.customFields ?? {})
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .filter(([, value]) => !isDuplicateOfCost(value, node.cost))
    .slice(0, RENDER_LIMITS.maxNoteLines)
    .map(([key, value]) => truncate(`${key}: ${formatNoteValue(value)}`, RENDER_LIMITS.noteLineChars));
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
