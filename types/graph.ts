// Types specific to graph visualization

export interface GraphLayout {
  width: number
  height: number
  centerX: number
  centerY: number
  radius: number
}

export interface GraphNode {
  id: string
  x: number
  y: number
  radius: number
  color: string
  isHovered: boolean
  isSelected: boolean
  data: NodeData
}

export interface GraphEdge {
  id: string
  from: string
  to: string
  path: string
  strokeColor: string
  strokeWidth: number
  strokeDasharray: string
  opacity: number
  isHovered: boolean
  isSelected: boolean
  data: Edge
}

export interface GraphInteractionState {
  hoveredNode: string | null
  hoveredEdge: string | null
  selectedNode: string | null
  selectedEdge: string | null
}

export interface GraphRenderConfig {
  nodeRadius: number
  edgeStrokeWidth: number
  hoverScale: number
  selectionScale: number
  animationDuration: number
}

export interface GraphBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
  padding: number
} 