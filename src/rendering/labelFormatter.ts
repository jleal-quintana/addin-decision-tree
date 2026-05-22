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

function formatTerminalMetricLabel(tree: DecisionTreeData): string {
  return tree.metadata.mode === "minimize" ? "Costo terminal" : "Resultado terminal";
}

export function buildNodeTitle(node: LayoutNode): string {
  const role =
    node.type === "decision"
      ? "Decision"
      : node.type === "chance"
        ? "Evento"
        : "Resultado";
  return truncate(`${role}: ${node.label}`, RENDER_LIMITS.titleChars);
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

  // La probabilidad vive en la rama entrante; repetirla dentro del nodo hace
  // dificil distinguir que numero describe la rama y cual describe el nodo.
  if (node.cost !== null && node.cost !== 0) {
    parts.push(`Costo ${formatCurrency(node.cost)}`);
  }
  if (node.time) {
    parts.push(node.time);
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
  const lines: string[] = [];
  for (const [key, value] of Object.entries(node.customFields ?? {})) {
    if (value === null || value === undefined || value === "") continue;
    if (isDuplicateOfCost(value, node.cost)) continue;
    lines.push(truncate(`${key}: ${formatNoteValue(value)}`, RENDER_LIMITS.noteLineChars));
    if (lines.length === RENDER_LIMITS.maxNoteLines) break;
  }
  return lines;
}

export function buildEdgeLabel(edge: LayoutEdge, childNode: LayoutNode | undefined): string {
  const lines: string[] = [];
  const childCost = childNode?.cost;
  const childTime = childNode?.time;

  const branchText = edge.label?.trim();
  if (branchText) {
    const probabilityText =
      edge.probability !== null && edge.probability !== undefined
        ? `${(edge.probability * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`
        : "";
    lines.push([branchText, probabilityText].filter(Boolean).join(" · "));
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
