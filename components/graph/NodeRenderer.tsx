// Node Renderer - Pure node rendering logic, no business logic
import React from 'react'
import { NodeData, GraphRenderConfig } from '@/types/graph'

interface NodeRendererProps {
  nodes: NodeData[]
  config: GraphRenderConfig
  onNodeHover: (node: NodeData | null) => void
  onNodeClick: (node: NodeData | null) => void
  onMouseLeave: () => void
  hoveredNode: NodeData | null
  selectedNode: NodeData | null
  getNodeColor: (recordId: string) => string
}

export function NodeRenderer({
  nodes,
  config,
  onNodeHover,
  onNodeClick,
  onMouseLeave,
  hoveredNode,
  selectedNode,
  getNodeColor
}: NodeRendererProps) {
  return (
    <>
      {nodes.map((node) => {
        const isHovered = hoveredNode === node
        const isSelected = selectedNode === node
        
        const radius = isHovered || isSelected 
          ? config.nodeRadius * config.hoverScale 
          : config.nodeRadius

        return (
          <g key={node.recordId}>
            <circle
              cx={node.x}
              cy={node.y}
              r={radius}
              fill={getNodeColor(node.recordId)}
              stroke="#ffffff"
              strokeWidth={isHovered || isSelected ? 4 : 3}
              className="cursor-pointer transition-all duration-200"
              onMouseEnter={() => onNodeHover(node)}
              onMouseLeave={onMouseLeave}
              onClick={() => onNodeClick(node)}
            />
            <text
              x={node.x}
              y={node.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-white text-xs font-semibold pointer-events-none select-none"
            >
              {node.recordId}
            </text>
          </g>
        )
      })}
    </>
  )
} 