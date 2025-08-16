// Edge Renderer - Pure edge rendering logic, no business logic
import React from 'react'
import { NodeData, Edge, UnifiedEdge, GraphRenderConfig } from '@/types/graph'
import { drawStraightEdgeBetweenNodes } from '@/utils/graph-utils'

interface EdgeRendererProps {
  edges: Edge[]
  unifiedEdges: UnifiedEdge[]
  nodes: NodeData[]
  config: GraphRenderConfig
  onEdgeHover: (edge: Edge | null) => void
  onEdgeClick: (edge: Edge | null) => void
  onMouseLeave: () => void
  hoveredEdge: Edge | null
  selectedEdge: Edge | null
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
  selectedEdge
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
          console.log(`Missing node for edge: ${unifiedEdge.from} -> ${unifiedEdge.to}`)
          return null
        }

        // Create a composite edge that represents the complete relationship
        const compositeEdge: Edge = {
          from: unifiedEdge.from,
          to: unifiedEdge.to,
          type: unifiedEdge.matchScore > 0.001 ? "positive" : "negative",
          matchingFields: unifiedEdge.positiveFields,
          nonMatchingFields: unifiedEdge.negativeFields,
          rulesUsed: unifiedEdge.allRulesUsed,
          matchScore: parseFloat((unifiedEdge.matchScore || 0).toFixed(3))
        }

        // Ensure we always have a valid edge type for rendering
        const renderEdgeType = unifiedEdge.matchScore > 0.001 ? "positive" : "negative"

        const isHovered = hoveredEdge && (hoveredEdge.from === unifiedEdge.from && hoveredEdge.to === unifiedEdge.to)
        const isSelected = selectedEdge && (selectedEdge.from === unifiedEdge.from && selectedEdge.to === unifiedEdge.to)

        const isConnectedToNode = false // This will be handled by the parent component

        // Simplified opacity logic - ensure edges are always visible
        let edgeOpacity = 1
        if (isHovered || isSelected) {
          edgeOpacity = 1
        } else if (isConnectedToNode) {
          edgeOpacity = 0.8
        } else {
          edgeOpacity = 0.7
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

        // Ensure edges are always clickable with sufficient stroke width
        if (isSelected) strokeWidth = config.edgeStrokeWidth + 2
        else if (isHovered) strokeWidth = config.edgeStrokeWidth + 1
        else strokeWidth = config.edgeStrokeWidth

        // Pass the actual stroke width to collision detection for more accurate results
        const effectiveNodeRadius = isSelected ? Math.max(30, strokeWidth + 5) : 30
        const pathData = drawStraightEdgeBetweenNodes(fromNode, toNode, renderEdgeType, nodes, effectiveNodeRadius, false)

        return (
          <path
            key={`${unifiedEdge.from}-${unifiedEdge.to}-${index}`}
            d={pathData}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            opacity={edgeOpacity}
            fill="none"
            strokeDasharray={strokeDasharray}
            filter={isSelected ? "url(#glow)" : "none"}
            className="cursor-pointer transition-all duration-200"
            onMouseEnter={() => onEdgeHover(compositeEdge)}
            onMouseLeave={onMouseLeave}
            onClick={() => onEdgeClick(compositeEdge)}
          />
        )
      })}
    </>
  )
} 