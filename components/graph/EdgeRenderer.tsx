// Edge Renderer - Pure edge rendering logic, no business logic
import React from 'react'
import { NodeData, Edge, UnifiedEdge } from '@/types/common'
import { GraphRenderConfig } from '@/types/graph'
import { drawStraightEdgeBetweenNodes } from '@/utils/graph-utils'

interface EdgeRendererProps {
  edges: Edge[]
  unifiedEdges: Edge[] // Changed from UnifiedEdge[] to Edge[]
  nodes: NodeData[]
  config: GraphRenderConfig
  onEdgeHover: (edge: Edge | null) => void
  onEdgeClick: (edge: Edge | null) => void
  onMouseLeave: () => void
  hoveredEdge: Edge | null
  selectedEdge: Edge | null
  hoveredNode: string | null
}

export function EdgeRenderer({
  edges,
  unifiedEdges,
  nodes,
  config,
  onEdgeHover,
  onEdgeClick,
  onMouseLeave,
  hoveredEdge,
  selectedEdge,
  hoveredNode
}: EdgeRendererProps) {
  // Helper function to get node by record ID
  const getNodeByRecordId = (recordId: string) => {
    return nodes.find((node) => node.recordId === recordId)
  }

  // Helper function to check if a node pair has both positive and negative edges
  const hasCounterpartEdge = (fromId: string, toId: string, currentType: "positive" | "negative"): boolean => {
    const oppositeType = currentType === "positive" ? "negative" : "positive"
    return edges.some(
      (edge) =>
        ((edge.from === fromId && edge.to === toId) || (edge.from === toId && edge.to === fromId)) &&
        edge.type === oppositeType,
    )
  }

  return (
    <>
      {unifiedEdges.map((unifiedEdge, index) => {
        const fromNode = getNodeByRecordId(unifiedEdge.from)
        const toNode = getNodeByRecordId(unifiedEdge.to)

        if (!fromNode || !toNode) {
          return null
        }

        // Create a composite edge that represents the complete relationship
        const compositeEdge: Edge = {
          from: unifiedEdge.from,
          to: unifiedEdge.to,
          type: unifiedEdge.type,
          matchingFields: unifiedEdge.matchingFields || [],
          nonMatchingFields: unifiedEdge.nonMatchingFields || [],
          rulesUsed: unifiedEdge.rulesUsed || [],
          matchScore: unifiedEdge.matchScore,
          results: unifiedEdge.results || []
        }

        // Ensure we always have a valid edge type for rendering
        const renderEdgeType = unifiedEdge.matchScore > 0.001 ? "positive" : "negative"

        // Edge state detection - these work independently and can be combined
        const isHovered = hoveredEdge && (hoveredEdge.from === unifiedEdge.from && hoveredEdge.to === unifiedEdge.to)
        const isSelected = selectedEdge && (selectedEdge.from === unifiedEdge.from && selectedEdge.to === unifiedEdge.to)
        
        // Check if this edge is connected to the currently hovered node
        // This allows edges to show hover effects when their connected nodes are hovered
        const isConnectedToHoveredNode = hoveredNode && (hoveredNode === unifiedEdge.from || hoveredNode === unifiedEdge.to)

        // Enhanced opacity logic - more visible default edges with better color
        let edgeOpacity = 0.7 // Increased from 0.4 for better color visibility
        if (isHovered || isSelected) {
          edgeOpacity = 1.0 // Full opacity when edge is directly hovered/selected
        } else if (isConnectedToHoveredNode) {
          edgeOpacity = 0.9 // High opacity when connected to hovered node for better visibility
        } else {
          edgeOpacity = 0.7 // More visible default opacity for better color
        }

        // Determine edge styling based on match score
        let strokeColor = "#10b981" // default green for positive
        let strokeDasharray = "none"
        let strokeWidth = config.edgeStrokeWidth

        // Use match score to determine edge color and style
        // Rendering should never be affected by evaluation logic
        if (unifiedEdge.matchScore > 0.001) {
          // Positive relationship - green solid line
          strokeColor = "#10b981" // green
          strokeDasharray = "none"
        } else if (unifiedEdge.matchScore < -0.001) {
          // Negative relationship - red dashed line
          strokeColor = "#ef4444" // red
          strokeDasharray = "5,5"
        } else {
          // Neutral/zero score - render as neutral edge (not invisible)
          strokeColor = "#6b7280" // gray
          strokeDasharray = "3,3"
        }

        // Enhanced stroke width - thinner default, thicker when selected/hovered/connected to hovered node
        if (isSelected) strokeWidth = config.edgeStrokeWidth + 6 // Increased contrast for selection
        else if (isHovered) strokeWidth = config.edgeStrokeWidth + 4 // More prominent hover effect
        else if (isConnectedToHoveredNode) strokeWidth = config.edgeStrokeWidth + 3 // Thicker when connected to hovered node
        else strokeWidth = config.edgeStrokeWidth // Thin default width

        // Draw edges directly between node centers - no collision avoidance needed
        const pathData = drawStraightEdgeBetweenNodes(fromNode, toNode, renderEdgeType, nodes, 0, false)

        // Calculate edge density around nodes to determine label positioning
        const fromNodeEdgeCount = unifiedEdges.filter(e => e.from === unifiedEdge.from || e.to === unifiedEdge.from).length
        const toNodeEdgeCount = unifiedEdges.filter(e => e.from === unifiedEdge.to || e.to === unifiedEdge.to).length
        
        // Smart positioning: use offset for low-density areas, on-edge for high-density areas
        const useOffset = fromNodeEdgeCount <= 3 && toNodeEdgeCount <= 3
        const offsetDistance = useOffset ? 25 : 0
        const labelRotation = useOffset ? 90 : 0 // Rotate labels when using offset
        
        // Ensure labels don't overlap with nodes by checking minimum distance
        const nodeRadius = 30 // Match the node radius from graph config
        const minDistanceFromNode = nodeRadius + 15 // Extra buffer for label visibility

        return (
          <g key={`${unifiedEdge.from}-${unifiedEdge.to}-${index}`}>
            {/* Subtle glow effect for better edge visibility */}
            <path
              d={pathData}
              stroke={strokeColor}
              strokeWidth={strokeWidth + 1}
              opacity={edgeOpacity * 0.2}
              fill="none"
              strokeDasharray={strokeDasharray}
              filter="url(#glow)"
              className="pointer-events-none"
            />
            {/* Main edge path - clickable with enhanced contrast */}
            <path
              d={pathData}
              stroke={strokeColor}
              strokeWidth={strokeWidth} // Use calculated stroke width for better contrast
              opacity={edgeOpacity}
              fill="none"
              strokeDasharray={strokeDasharray}
              filter={isSelected || isHovered || isConnectedToHoveredNode ? "url(#glow)" : "none"}
              className="cursor-pointer transition-all duration-200"
              onMouseEnter={() => onEdgeHover(compositeEdge)}
              onMouseLeave={onMouseLeave}
              onClick={() => onEdgeClick(compositeEdge)}
            />
            
            {/* Match Score Labels - Smart positioning based on edge density */}
            {/* Label near the "from" node - smart positioning */}
            <g transform={`translate(${fromNode.x + (toNode.x - fromNode.x) * Math.max(0.15, minDistanceFromNode / Math.sqrt(Math.pow(toNode.x - fromNode.x, 2) + Math.pow(toNode.y - fromNode.y, 2))) + Math.cos(Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x) + Math.PI/2) * offsetDistance}, ${fromNode.y + (toNode.y - fromNode.y) * Math.max(0.15, minDistanceFromNode / Math.sqrt(Math.pow(toNode.x - fromNode.x, 2) + Math.pow(toNode.y - fromNode.y, 2))) + Math.sin(Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x) + Math.PI/2) * offsetDistance}) rotate(${Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x) * 180 / Math.PI + labelRotation})`}>
              <text
                x="0"
                y="0"
                fontSize="10"
                fontWeight="600"
                fill={useOffset ? "#1f2937" : "#000000"}
                opacity={edgeOpacity}
                textAnchor="middle"
                dominantBaseline="middle"
                className="pointer-events-none select-none"
                stroke={useOffset ? "white" : "#ffffff"}
                strokeWidth={useOffset ? "1.5" : "2"}
                paintOrder="stroke"
              >
                {compositeEdge.matchScore.toFixed(2)}
              </text>
            </g>
            
            {/* Label near the "to" node - smart positioning */}
            <g transform={`translate(${fromNode.x + (toNode.x - fromNode.x) * Math.max(0.85, 1 - minDistanceFromNode / Math.sqrt(Math.pow(toNode.x - fromNode.x, 2) + Math.pow(toNode.y - fromNode.y, 2))) + Math.cos(Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x) + Math.PI/2) * offsetDistance}, ${fromNode.y + (toNode.y - fromNode.y) * Math.max(0.85, 1 - minDistanceFromNode / Math.sqrt(Math.pow(toNode.x - fromNode.x, 2) + Math.pow(toNode.y - fromNode.y, 2))) + Math.sin(Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x) + Math.PI/2) * offsetDistance}) rotate(${Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x) * 180 / Math.PI + labelRotation})`}>
              <text
                x="0"
                y="0"
                fontSize="10"
                fontWeight="600"
                fill={useOffset ? "#1f2937" : "#000000"}
                opacity={edgeOpacity}
                textAnchor="middle"
                dominantBaseline="middle"
                className="pointer-events-none select-none"
                stroke={useOffset ? "white" : "#ffffff"}
                strokeWidth={useOffset ? "1.5" : "2"}
                paintOrder="stroke"
              >
                {compositeEdge.matchScore.toFixed(2)}
              </text>
            </g>
          </g>
        )
      })}
    </>
  )
} 