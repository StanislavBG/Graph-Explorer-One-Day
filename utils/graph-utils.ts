// Graph utility functions - Pure utility functions for graph operations
import { NodeData } from '@/types/common'

/**
 * Checks if a line segment intersects with a circle (node)
 */
export function lineIntersectsCircle(
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number },
  circleCenter: { x: number; y: number },
  radius: number,
): boolean {
  // Vector from line start to circle center
  const dx = circleCenter.x - lineStart.x
  const dy = circleCenter.y - lineStart.y

  // Vector of the line
  const lineDx = lineEnd.x - lineStart.x
  const lineDy = lineEnd.y - lineStart.y
  const lineLength = Math.sqrt(lineDx * lineDx + lineDy * lineDy)

  if (lineLength === 0) return false

  // Handle vertical lines (lineDx = 0) and horizontal lines (lineDy = 0) as special cases
  if (Math.abs(lineDx) < 0.001) {
    // Vertical line - closest point has same X coordinate
    const closestX = lineStart.x
    const closestY = Math.max(lineStart.y, Math.min(lineEnd.y, circleCenter.y))
    const distanceX = circleCenter.x - closestX
    const distanceY = circleCenter.y - closestY
    const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY)
    return distance < radius
  } else if (Math.abs(lineDy) < 0.001) {
    // Horizontal line - closest point has same Y coordinate
    const closestX = Math.max(lineStart.x, Math.min(lineEnd.x, circleCenter.x))
    const closestY = lineStart.y
    const distanceX = circleCenter.x - closestX
    const distanceY = circleCenter.y - closestY
    const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY)
    return distance < radius
  }

  // General case: project circle center onto line
  const t = Math.max(0, Math.min(1, (dx * lineDx + dy * lineDy) / (lineLength * lineLength)))

  // Closest point on line to circle center
  const closestX = lineStart.x + t * lineDx
  const closestY = lineStart.y + t * lineDy

  // Distance from circle center to closest point
  const distanceX = circleCenter.x - closestX
  const distanceY = circleCenter.y - closestY
  const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY)

  return distance < radius
}

/**
 * Draws a straight edge between two nodes
 */
export function drawStraightEdgeBetweenNodes(
  fromNode: NodeData,
  toNode: NodeData,
  edgeType: "positive" | "negative",
  allNodes: NodeData[],
  nodeRadius: number,
  hasCounterpart = false,
): string {
  // Simple direct line between node centers with small tilt to prevent perfect horizontal/vertical alignment
  let startX = fromNode.x
  let startY = fromNode.y
  let endX = toNode.x
  let endY = toNode.y
  
  // Add small tilt (0.01) to prevent perfect horizontal/vertical edges
  const tiltAmount = 0.01
  const isHorizontal = Math.abs(startY - endY) < 0.1
  const isVertical = Math.abs(startX - endX) < 0.1
  
  if (isHorizontal) {
    // Add small vertical tilt to horizontal edges
    startY += tiltAmount
    endY += tiltAmount
  } else if (isVertical) {
    // Add small horizontal tilt to vertical edges
    startX += tiltAmount
    endX += tiltAmount
  }
  
  // Debug: Check if this was a horizontal or vertical edge (before tilt)
  if (isHorizontal || isVertical) {
    console.log(`🔍 ${isHorizontal ? 'HORIZONTAL' : 'VERTICAL'} EDGE TILTED: ${fromNode.recordId} -> ${toNode.recordId}`)
    console.log(`   Original: (${fromNode.x.toFixed(2)}, ${fromNode.y.toFixed(2)}) -> (${toNode.x.toFixed(2)}, ${toNode.y.toFixed(2)})`)
    console.log(`   Tilted: (${startX.toFixed(2)}, ${startY.toFixed(2)}) -> (${endX.toFixed(2)}, ${endY.toFixed(2)})`)
    console.log(`   Edge type: ${edgeType}`)
  }
  
  // Round coordinates to 2 decimal places to prevent hydration mismatches
  const roundedStartX = Math.round(startX * 100) / 100
  const roundedStartY = Math.round(startY * 100) / 100
  const roundedEndX = Math.round(endX * 100) / 100
  const roundedEndY = Math.round(endY * 100) / 100
  
  const path = `M ${roundedStartX} ${roundedStartY} L ${roundedEndX} ${roundedEndY}`
  
  return path
}

/**
 * Calculate graph bounds based on node positions
 */
export function calculateGraphBounds(nodes: NodeData[], padding: number = 50) {
  if (nodes.length === 0) {
    return {
      minX: 0,
      maxX: 800,
      minY: 0,
      maxY: 600,
      padding
    }
  }

  const minX = Math.min(...nodes.map(n => n.x)) - padding
  const maxX = Math.max(...nodes.map(n => n.x)) + padding
  const minY = Math.min(...nodes.map(n => n.y)) - padding
  const maxY = Math.max(...nodes.map(n => n.y)) + padding

  return {
    minX,
    maxX,
    minY,
    maxY,
    padding
  }
}

/**
 * Calculate optimal graph layout dimensions
 */
export function calculateOptimalLayout(nodes: NodeData[], containerWidth: number, containerHeight: number) {
  if (nodes.length === 0) {
    return {
      width: containerWidth,
      height: containerHeight,
      centerX: containerWidth / 2,
      centerY: containerHeight / 2,
      radius: Math.min(containerWidth, containerHeight) * 0.3
    }
  }

  const bounds = calculateGraphBounds(nodes, 50)
  const graphWidth = bounds.maxX - bounds.minX
  const graphHeight = bounds.maxY - bounds.minY
  
  const centerX = bounds.minX + graphWidth / 2
  const centerY = bounds.minY + graphHeight / 2
  const radius = Math.min(graphWidth, graphHeight) * 0.3

  return {
    width: Math.max(containerWidth, graphWidth + 100),
    height: Math.max(containerHeight, graphHeight + 100),
    centerX,
    centerY,
    radius
  }
} 