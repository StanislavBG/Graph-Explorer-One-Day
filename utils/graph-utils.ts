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
 * Draws a straight edge between two nodes with collision avoidance
 */
export function drawStraightEdgeBetweenNodes(
  fromNode: NodeData,
  toNode: NodeData,
  edgeType: "positive" | "negative",
  allNodes: NodeData[],
  nodeRadius: number,
  hasCounterpart = false,
): string {
  // Calculate base line from node edge to node edge
  const dx = toNode.x - fromNode.x
  const dy = toNode.y - fromNode.y
  const distance = Math.sqrt(dx * dx + dy * dy)
  const unitX = dx / distance
  const unitY = dy / distance
  
  // Debug: Check if this is a vertical or horizontal edge
  const isVertical = Math.abs(dx) < 0.001
  const isHorizontal = Math.abs(dy) < 0.001
  if (isVertical || isHorizontal) {
    console.log(`🔍 ${isVertical ? 'VERTICAL' : 'HORIZONTAL'} EDGE: ${fromNode.recordId} -> ${toNode.recordId}`)
    console.log(`   From: (${fromNode.x}, ${fromNode.y}), To: (${toNode.x}, ${toNode.y})`)
    console.log(`   Distance: ${distance}, Unit: (${unitX}, ${unitY})`)
  }

  // Base connection points at node perimeters
  const baseStartX = fromNode.x + unitX * nodeRadius
  const baseStartY = fromNode.y + unitY * nodeRadius
  const baseEndX = toNode.x - unitX * nodeRadius
  const baseEndY = toNode.y - unitY * nodeRadius

  // Calculate perpendicular offset for multiple edges between same nodes
  const perpX = -unitY // Perpendicular to line direction
  const perpY = unitX

  // Smaller offset for closer spacing between positive and negative edges
  let offsetAmount = 0
  if (hasCounterpart) {
    // Much smaller offset for tighter spacing
    offsetAmount = edgeType === "positive" ? -3 : 3
  }

  // Apply offset to create parallel lines
  let startX = baseStartX + perpX * offsetAmount
  let startY = baseStartY + perpY * offsetAmount
  let endX = baseEndX + perpX * offsetAmount
  let endY = baseEndY + perpY * offsetAmount

  // Check for collisions with other nodes (excluding the two we're connecting)
  const otherNodes = allNodes.filter(
    (node) => node.recordId !== fromNode.recordId && node.recordId !== toNode.recordId,
  )

  let collisionDetected = false
  for (const node of otherNodes) {
    if (
      lineIntersectsCircle({ x: startX, y: startY }, { x: endX, y: endY }, { x: node.x, y: node.y }, nodeRadius + 5)
    ) {
      collisionDetected = true
      if (isVertical || isHorizontal) {
        console.log(`   ❌ COLLISION with node ${node.recordId} at (${node.x}, ${node.y})`)
      }
      break
    }
  }

  // If collision detected, try increasing the offset
  if (collisionDetected) {
    const maxOffset = 25
    for (let offset = 10; offset <= maxOffset; offset += 5) {
      const testOffsetAmount = hasCounterpart ? (edgeType === "positive" ? -offset : offset) : offset

      const testStartX = baseStartX + perpX * testOffsetAmount
      const testStartY = baseStartY + perpY * testOffsetAmount
      const testEndX = baseEndX + perpX * testOffsetAmount
      const testEndY = baseEndY + perpY * testOffsetAmount

      let hasCollision = false
      for (const node of otherNodes) {
        if (
          lineIntersectsCircle(
            { x: testStartX, y: testStartY },
            { x: testEndX, y: testEndY },
            { x: node.x, y: node.y },
            nodeRadius + 5,
          )
        ) {
          hasCollision = true
          break
        }
      }

      if (!hasCollision) {
        startX = testStartX
        startY = testStartY
        endX = testEndX
        endY = testEndY
        break
      }
    }
  }

  // Round coordinates to 2 decimal places to prevent hydration mismatches
  const roundedStartX = Math.round(startX * 100) / 100
  const roundedStartY = Math.round(startY * 100) / 100
  const roundedEndX = Math.round(endX * 100) / 100
  const roundedEndY = Math.round(endY * 100) / 100
  
  const path = `M ${roundedStartX} ${roundedStartY} L ${roundedEndX} ${roundedEndY}`
  
  if (isVertical || isHorizontal) {
    console.log(`   ✅ FINAL PATH: ${path}`)
    console.log(`   📍 Start: (${roundedStartX}, ${roundedStartY}), End: (${roundedEndX}, ${roundedEndY})`)
  }
  
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