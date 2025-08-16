// Graph Visualization - Pure visualization component, no business logic
import React from 'react'
import { NodeData, Edge, UnifiedEdge, GraphLayout, GraphRenderConfig } from '@/types/graph'
import { NodeRenderer } from './NodeRenderer'
import { EdgeRenderer } from './EdgeRenderer'
import { GraphContainer } from './GraphContainer'

interface GraphVisualizationProps {
  nodes: NodeData[]
  edges: Edge[]
  unifiedEdges: UnifiedEdge[]
  layout: GraphLayout
  config: GraphRenderConfig
  onNodeHover: (node: NodeData | null) => void
  onNodeClick: (node: NodeData | null) => void
  onEdgeHover: (edge: Edge | null) => void
  onEdgeClick: (edge: Edge | null) => void
  onMouseLeave: () => void
  hoveredNode: NodeData | null
  selectedNode: NodeData | null
  hoveredEdge: Edge | null
  selectedEdge: Edge | null
  getNodeColor: (recordId: string) => string
}

export function GraphVisualization({
  nodes,
  edges,
  unifiedEdges,
  layout,
  config,
  onNodeHover,
  onNodeClick,
  onEdgeHover,
  onEdgeClick,
  onMouseLeave,
  hoveredNode,
  selectedNode,
  hoveredEdge,
  selectedEdge,
  getNodeColor
}: GraphVisualizationProps) {
  return (
    <GraphContainer layout={layout}>
      {/* Render edges first (behind nodes) */}
      <EdgeRenderer
        edges={edges}
        unifiedEdges={unifiedEdges}
        nodes={nodes}
        config={config}
        onEdgeHover={onEdgeHover}
        onEdgeClick={onEdgeClick}
        onMouseLeave={onMouseLeave}
        hoveredEdge={hoveredEdge}
        selectedEdge={selectedEdge}
      />
      
      {/* Render nodes on top */}
      <NodeRenderer
        nodes={nodes}
        config={config}
        onNodeHover={onNodeHover}
        onNodeClick={onNodeClick}
        onMouseLeave={onMouseLeave}
        hoveredNode={hoveredNode}
        selectedNode={selectedNode}
        getNodeColor={getNodeColor}
      />
    </GraphContainer>
  )
} 