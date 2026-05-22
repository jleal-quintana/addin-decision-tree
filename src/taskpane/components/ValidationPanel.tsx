import React, { useCallback } from "react";
import { useTree } from "../context/TreeContext";
import { RichIssue, IssueFix } from "../utils/validationIssues";

interface ValidationPanelProps {
  issues: RichIssue[];
}

function AlertIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 1.5L1 14h14L8 1.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M8 6v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="12" r="0.7" fill="currentColor" />
    </svg>
  );
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

  if (issues.length === 0) return null;

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const hasError = errorCount > 0;

  const title = hasError
    ? `${issues.length} ${issues.length === 1 ? "cosa por resolver" : "cosas por resolver"}`
    : "Revisar antes de dibujar";

  return (
    <div
      className={`validation-panel ${hasError ? "" : "warn"}`}
      role="alert"
      aria-live="polite"
    >
      <div className="validation-panel__title">
        <AlertIcon />
        <span>{title}</span>
      </div>
      <ul className="validation-issues">
        {issues.map((issue) => (
          <li key={issue.key} className="validation-issue">
            <span className="validation-issue__icon" aria-hidden="true">
              <AlertIcon />
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
                  onClick={() =>
                    dispatch({ type: "SELECT_NODE", nodeId: issue.nodeId })
                  }
                >
                  Ir
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
