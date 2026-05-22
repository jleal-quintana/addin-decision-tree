import React, { useCallback, useMemo } from "react";
import { useTree } from "../context/TreeContext";
import { RichIssue, IssueFix, IssueSeverity } from "../utils/validationIssues";
import { focusNodeInTree } from "../utils/focusNode";

interface ValidationPanelProps {
  issues: RichIssue[];
}

function ErrorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 5v3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="11" r="0.7" fill="currentColor" />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 1.5L1 14h14L8 1.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M8 6v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="12" r="0.7" fill="currentColor" />
    </svg>
  );
}

function SeverityIcon({ severity }: { severity: IssueSeverity }) {
  return severity === "error" ? <ErrorIcon /> : <WarnIcon />;
}

export function ValidationPanel({ issues }: ValidationPanelProps) {
  const { state, dispatch } = useTree();

  const applyFix = useCallback(
    (fix: IssueFix) => {
      switch (fix.kind) {
        case "setProbability":
          dispatch({
            type: "UPDATE_NODE",
            nodeId: fix.nodeId,
            updates: { probability: fix.value },
          });
          return;
        case "clearProbability":
          dispatch({
            type: "UPDATE_NODE",
            nodeId: fix.nodeId,
            updates: { probability: null },
          });
          return;
        case "setPayoff":
          dispatch({
            type: "UPDATE_NODE",
            nodeId: fix.nodeId,
            updates: { payoff: fix.value },
          });
          return;
        case "distributeProbabilities": {
          const chance = state.tree.nodes[fix.chanceId];
          if (!chance) return;
          const children = chance.childIds
            .map((id) => state.tree.nodes[id])
            .filter(Boolean);
          if (children.length === 0) return;
          const sum = children.reduce(
            (acc, c) => acc + (c.probability ?? 0),
            0
          );
          if (sum > 0) {
            for (const child of children) {
              const next = (child.probability ?? 0) / sum;
              dispatch({
                type: "UPDATE_NODE",
                nodeId: child.id,
                updates: { probability: next },
              });
            }
          } else {
            const share = 1 / children.length;
            for (const child of children) {
              dispatch({
                type: "UPDATE_NODE",
                nodeId: child.id,
                updates: { probability: share },
              });
            }
          }
          return;
        }
      }
    },
    [dispatch, state.tree]
  );

  const groupedIssues = useMemo(() => {
    const groups = new Map<string, { nodeLabel: string; issues: RichIssue[] }>();
    const ungrouped: RichIssue[] = [];
    for (const issue of issues) {
      if (!issue.nodeId) {
        ungrouped.push(issue);
        continue;
      }
      const node = state.tree.nodes[issue.nodeId];
      const label = node?.label ?? "Nodo";
      const existing = groups.get(issue.nodeId);
      if (existing) {
        existing.issues.push(issue);
      } else {
        groups.set(issue.nodeId, { nodeLabel: label, issues: [issue] });
      }
    }
    return { groups, ungrouped };
  }, [issues, state.tree.nodes]);

  if (issues.length === 0) return null;

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const hasError = errorCount > 0;

  const title = hasError
    ? `${issues.length} ${issues.length === 1 ? "cosa por resolver" : "cosas por resolver"}`
    : "Revisar antes de dibujar";

  const renderIssue = (issue: RichIssue) => (
    <li key={issue.key} className={`validation-issue validation-issue--${issue.severity}`}>
      <span className="validation-issue__icon" aria-hidden="true">
        <SeverityIcon severity={issue.severity} />
      </span>
      <span className="validation-issue__msg">{issue.message}</span>
      <span className="validation-issue__actions">
        {issue.fix && issue.fixLabel && (
          <button
            type="button"
            className="validation-issue__fix"
            onClick={() => applyFix(issue.fix!)}
          >
            {issue.fixLabel}
          </button>
        )}
        {issue.nodeId && (
          <button
            type="button"
            className="validation-issue__fix secondary"
            onClick={() => focusNodeInTree(dispatch, issue.nodeId)}
          >
            Ir
          </button>
        )}
      </span>
    </li>
  );

  return (
    <div
      className={`validation-panel ${hasError ? "" : "warn"}`}
      role="alert"
      aria-live="polite"
    >
      <div className="validation-panel__title">
        <SeverityIcon severity={hasError ? "error" : "warn"} />
        <span>{title}</span>
      </div>
      {Array.from(groupedIssues.groups.entries()).map(([nodeId, group]) => (
        <div key={nodeId} className="validation-group">
          {group.issues.length > 1 && (
            <button
              type="button"
              className="validation-group__heading"
              onClick={() => focusNodeInTree(dispatch, nodeId)}
              title="Ir al nodo"
            >
              {group.nodeLabel}
              <span className="validation-group__count">{group.issues.length}</span>
            </button>
          )}
          <ul className="validation-issues">{group.issues.map(renderIssue)}</ul>
        </div>
      ))}
      {groupedIssues.ungrouped.length > 0 && (
        <ul className="validation-issues">{groupedIssues.ungrouped.map(renderIssue)}</ul>
      )}
    </div>
  );
}
