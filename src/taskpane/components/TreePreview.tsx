import React, { useMemo } from "react";
import { buildRenderModel } from "../../rendering/renderModel";
import { PREVIEW_CELL, RENDER_TOKENS } from "../../rendering/designTokens";
import { computeLayout } from "../../renderer/TreeLayoutEngine";
import { GRID } from "../../renderer/StyleConfig";
import { useTree } from "../context/TreeContext";

export function TreePreview() {
  const { state } = useTree();

  const layout = useMemo(() => computeLayout(state.tree), [state.tree]);
  const renderModel = useMemo(() => buildRenderModel(state.tree, layout), [layout, state.tree]);

  if (layout.nodes.length === 0) return null;

  const nodeById = Object.fromEntries(renderModel.nodes.map((node) => [node.id, node]));
  const edgeByKey = Object.fromEntries(
    renderModel.edges.map((edge) => [`${edge.fromId}-${edge.toId}`, edge])
  );

  const pad = 16;
  const cellWidth = PREVIEW_CELL.width;
  const cellHeight = PREVIEW_CELL.height;
  const viewWidth = (layout.maxCol + GRID.colGap + 4) * cellWidth + pad * 2;
  const viewHeight = (layout.maxRow + GRID.rowGap + 4) * cellHeight + pad * 2;
  const nodeWidth = GRID.nodeCols * cellWidth;
  const nodeHeight = GRID.nodeRows * cellHeight;

  return (
    <div className="mini-preview">
      <div className="mini-preview-header">Vista previa aproximada de Excel</div>
      <svg
        width="100%"
        height={Math.min(220, viewHeight * 0.65)}
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block", padding: 4, background: RENDER_TOKENS.previewBg }}
      >
        {layout.edges.map((edge) => {
          const renderEdge = edgeByKey[`${edge.fromId}-${edge.toId}`];
          const x1 = pad + (edge.fromCol + GRID.nodeCols) * cellWidth;
          const y1 = pad + (edge.fromRow + GRID.nodeRows / 2) * cellHeight;
          const x2 = pad + edge.toCol * cellWidth;
          const y2 = pad + (edge.toRow + GRID.nodeRows / 2) * cellHeight;

          return (
            <g key={`${edge.fromId}-${edge.toId}`}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={edge.isOptimal ? RENDER_TOKENS.accent : RENDER_TOKENS.edge}
                strokeWidth={edge.isOptimal ? 2.2 : 1.2}
              />
              {renderEdge?.label && (
                <text
                  x={(x1 + x2) / 2}
                  y={(y1 + y2) / 2 - 6}
                  fontSize={4.3}
                  fill={RENDER_TOKENS.edge}
                  textAnchor="middle"
                  fontFamily="Inter, sans-serif"
                >
                  {renderEdge.label.split("\n")[0]}
                </text>
              )}
            </g>
          );
        })}

        {layout.nodes.map((layoutNode) => {
          const renderNode = nodeById[layoutNode.id];
          const token = RENDER_TOKENS[layoutNode.type];
          const x = pad + layoutNode.col * cellWidth;
          const y = pad + layoutNode.row * cellHeight;
          const titleY = y + 14;
          const primaryY = y + 28;
          const secondaryY = y + 40;

          return (
            <g key={layoutNode.id}>
              <rect
                x={x}
                y={y}
                width={nodeWidth}
                height={nodeHeight}
                rx={layoutNode.type === "chance" ? 28 : 8}
                fill={token.fill}
                stroke={layoutNode.isOptimal ? RENDER_TOKENS.accent : token.border}
                strokeWidth={layoutNode.isOptimal ? 2.2 : 1}
              />
              <text
                x={x + nodeWidth / 2}
                y={titleY}
                textAnchor="middle"
                fontSize={4.8}
                fill={token.text}
                fontFamily="Montserrat, sans-serif"
                fontWeight="700"
              >
                {renderNode.title}
              </text>
              <text
                x={x + nodeWidth / 2}
                y={primaryY}
                textAnchor="middle"
                fontSize={4.1}
                fill={token.text}
                fontFamily="Inter, sans-serif"
                fontWeight="600"
              >
                {renderNode.primaryValue}
              </text>
              {renderNode.secondaryLines[0] && (
                <text
                  x={x + nodeWidth / 2}
                  y={secondaryY}
                  textAnchor="middle"
                  fontSize={3.7}
                  fill={token.text}
                  fontFamily="Inter, sans-serif"
                >
                  {renderNode.secondaryLines[0]}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
