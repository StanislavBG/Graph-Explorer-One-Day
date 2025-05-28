"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface NodeData {
  recordId: string
  uuid: string
  salutation?: string
  firstName?: string
  middleName?: string
  lastName?: string
  email?: string
  x: number
  y: number
}

interface Edge {
  from: string
  to: string
  type: "positive" | "negative"
  matchingFields: string[]
  nonMatchingFields: string[]
}

// Your final data with corrected mapping for id-007
const rawData = [
  {
    "Record-Id": "id-001",
    UUDI: "uid-0001",
    Salutation: "Ms.",
    "First Name": "Eleanor",
    "Middle Name": "Grace",
    "Last Name": "Vance",
    Email: "e.vance@example.com",
  },
  {
    "Record-Id": "id-002",
    UUDI: "uid-0001",
    Salutation: null,
    "First Name": "Eleanor",
    "Middle Name": "Grace",
    "Last Name": "Vance",
    Email: "e.vance@example.com",
  },
  {
    "Record-Id": "id-003",
    UUDI: "uid-0001",
    Salutation: null,
    "First Name": null,
    "Middle Name": "Grace",
    "Last Name": "Vance",
    Email: "e.vance@example.com",
  },
  {
    "Record-Id": "id-004",
    UUDI: "uid-0001",
    Salutation: null,
    "First Name": null,
    "Middle Name": null,
    "Last Name": "Vance",
    Email: "e.vance@example.com",
  },
  {
    "Record-Id": "id-005",
    UUDI: "uid-0001",
    Salutation: null,
    "First Name": null,
    "Middle Name": null,
    "Last Name": null,
    Email: "e.vance@example.com",
  },
  {
    "Record-Id": "id-006",
    UUDI: "uid-0002",
    Salutation: null,
    "First Name": null,
    "Middle Name": "Jordan",
    "Last Name": "Vance",
    Email: "e.vance@example.com",
  },
  {
    "Record-Id": "id-007",
    UUDI: "uid-0002",
    Salutation: "Casey",
    "First Name": "Jordan",
    "Middle Name": "Vance",
    "Last Name": "e.vance@example.com",
    Email: null,
  },
  {
    "Record-Id": "id-008",
    UUDI: "uid-0002",
    Salutation: "Mr.",
    "First Name": "Casey",
    "Middle Name": "Jordan",
    "Last Name": "Vance",
    Email: "e.vance@example.com",
  },
]

export default function GraphExplorer() {
  const [hoveredNode, setHoveredNode] = useState<NodeData | null>(null)
  const [hoveredEdge, setHoveredEdge] = useState<Edge | null>(null)
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null)

  // For dynamic sizing
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [svgSize, setSvgSize] = useState({ width: 800, height: 600 })

  useEffect(() => {
    function updateSize() {
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect()
        setSvgSize({ width: rect.width, height: rect.height })
      }
    }
    updateSize()
    window.addEventListener("resize", updateSize)
    return () => window.removeEventListener("resize", updateSize)
  }, [])

  // Calculate center and radius dynamically for the graph area only
  const centerX = svgSize.width / 2
  const centerY = svgSize.height / 2
  const radius = Math.min(svgSize.width, svgSize.height) * 0.425 // ~85% diameter of the SVG area

  // Transform raw data to our format with positioning
  const nodeData: NodeData[] = useMemo(() => rawData.map((item, index) => {
    // Special handling for id-007 which has shifted data
    if (item["Record-Id"] === "id-007") {
      return {
        recordId: item["Record-Id"],
        uuid: item["UUDI"],
        salutation: undefined, // Original: "Casey" but this seems to be shifted
        firstName: item["Salutation"] || undefined, // "Casey" - appears to be the actual first name
        middleName: item["First Name"] || undefined, // "Jordan" - appears to be the actual middle name
        lastName: item["Middle Name"] || undefined, // "Vance" - appears to be the actual last name
        email: item["Last Name"] || undefined, // "e.vance@example.com" - appears to be the actual email
        x: centerX + radius * Math.cos((index * 2 * Math.PI) / rawData.length),
        y: centerY + radius * Math.sin((index * 2 * Math.PI) / rawData.length),
      }
    }
    // Normal mapping for all other records
    return {
      recordId: item["Record-Id"],
      uuid: item["UUDI"],
      salutation: item["Salutation"] || undefined,
      firstName: item["First Name"] || undefined,
      middleName: item["Middle Name"] || undefined,
      lastName: item["Last Name"] || undefined,
      email: item["Email"] || undefined,
      x: centerX + radius * Math.cos((index * 2 * Math.PI) / rawData.length),
      y: centerY + radius * Math.sin((index * 2 * Math.PI) / rawData.length),
    }
  }), [centerX, centerY, radius])

  // Generate all edges automatically
  const edges = useMemo(() => {
    const edgeList: Edge[] = []
    const fieldsToCompare = ["salutation", "firstName", "middleName", "lastName", "email"]

    for (let i = 0; i < nodeData.length; i++) {
      for (let j = i + 1; j < nodeData.length; j++) {
        const node1 = nodeData[i]
        const node2 = nodeData[j]

        const matchingFields: string[] = []
        const nonMatchingFields: string[] = []

        fieldsToCompare.forEach((field) => {
          const value1 = node1[field as keyof NodeData]
          const value2 = node2[field as keyof NodeData]

          // Only compare if both values exist and are not empty
          if (value1 && value2) {
            if (value1 === value2) {
              matchingFields.push(field)
            } else {
              nonMatchingFields.push(field)
            }
          }
        })

        // Create positive edge if there are matching fields
        if (matchingFields.length > 0) {
          edgeList.push({
            from: node1.recordId,
            to: node2.recordId,
            type: "positive",
            matchingFields,
            nonMatchingFields: [],
          })
        }

        // Create negative edge if there are non-matching fields
        if (nonMatchingFields.length > 0) {
          edgeList.push({
            from: node1.recordId,
            to: node2.recordId,
            type: "negative",
            matchingFields: [],
            nonMatchingFields,
          })
        }
      }
    }

    return edgeList
  }, [])

  const handleNodeHover = (node: NodeData) => {
    setHoveredNode(node)
    setHoveredEdge(null)
  }

  const handleNodeClick = (node: NodeData) => {
    setSelectedNode(node)
    setSelectedEdge(null)
  }

  const handleEdgeHover = (edge: Edge) => {
    setHoveredEdge(edge)
    setHoveredNode(null)
  }

  const handleEdgeClick = (edge: Edge) => {
    setSelectedEdge(edge)
    setSelectedNode(null)
  }

  const handleMouseLeave = () => {
    setHoveredNode(null)
    setHoveredEdge(null)
  }

  const formatName = (node: NodeData) => {
    const parts = [node.salutation, node.firstName, node.middleName, node.lastName].filter(Boolean)
    return parts.length > 0 ? parts.join(" ") : "No name"
  }

  const getNodeByRecordId = (recordId: string) => {
    return nodeData.find((node) => node.recordId === recordId)
  }

  /**
   * Checks if a line segment intersects with a circle (node)
   */
  const lineIntersectsCircle = (
    lineStart: { x: number; y: number },
    lineEnd: { x: number; y: number },
    circleCenter: { x: number; y: number },
    radius: number,
  ): boolean => {
    // Vector from line start to circle center
    const dx = circleCenter.x - lineStart.x
    const dy = circleCenter.y - lineStart.y

    // Vector of the line
    const lineDx = lineEnd.x - lineStart.x
    const lineDy = lineEnd.y - lineStart.y
    const lineLength = Math.sqrt(lineDx * lineDx + lineDy * lineDy)

    if (lineLength === 0) return false

    // Project circle center onto line
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
  const drawStraightEdgeBetweenNodes = (
    fromNode: NodeData,
    toNode: NodeData,
    edgeType: "positive" | "negative",
    allNodes: NodeData[],
    nodeRadius: number,
    hasCounterpart = false,
  ): string => {
    // Calculate base line from node edge to node edge
    const dx = toNode.x - fromNode.x
    const dy = toNode.y - fromNode.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    const unitX = dx / distance
    const unitY = dy / distance

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

    return `M ${startX} ${startY} L ${endX} ${endY}`
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

  // Get unique UUIDs for coloring
  const uniqueUUIDs = useMemo(() => {
    return Array.from(new Set(nodeData.map((node) => node.uuid)))
  }, [])

  const getNodeColor = (uuid: string) => {
    const index = uniqueUUIDs.indexOf(uuid)
    const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"]
    return colors[index % colors.length]
  }

  return (
    <div className="w-full h-screen bg-gray-50 flex">
      {/* Left Panel - Legend and Controls */}
      <div className="w-80 bg-white border-r border-gray-200 p-6 overflow-y-auto">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Graph Explorer</h1>
            <p className="text-gray-600 mt-1">Data Relationship Visualization</p>
          </div>

          {/* Edge Legend */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Edge Types</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-6 h-0.5 bg-green-500"></div>
                <div>
                  <div className="font-medium text-green-600">Positive Edges</div>
                  <div className="text-sm text-gray-600">Fields that match between nodes</div>
                  <div className="text-xs text-gray-500">
                    Count: {edges.filter((e) => e.type === "positive").length}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-0.5 bg-red-500 border-dashed border border-red-500"></div>
                <div>
                  <div className="font-medium text-red-600">Negative Edges</div>
                  <div className="text-sm text-gray-600">Fields that differ between nodes</div>
                  <div className="text-xs text-gray-500">
                    Count: {edges.filter((e) => e.type === "negative").length}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Unified Profiles (was Node Groups) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Unified Profiles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {uniqueUUIDs.map((uuid, index) => {
                const nodeCount = nodeData.filter((node) => node.uuid === uuid).length
                const recordIds = nodeData.filter((node) => node.uuid === uuid).map((node) => node.recordId)
                return (
                  <div key={uuid} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full" style={{ backgroundColor: getNodeColor(uuid) }}></div>
                    <div>
                      <div className="font-medium" style={{ color: getNodeColor(uuid) }}>
                        {uuid}
                      </div>
                      <div className="text-sm text-gray-600">
                        {nodeCount} records: {recordIds.join(", ")}
                      </div>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Nodes:</span>
                <span className="font-medium">{nodeData.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Edges:</span>
                <span className="font-medium">{edges.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Possible Pairs:</span>
                <span className="font-medium">{(nodeData.length * (nodeData.length - 1)) / 2}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Positive Edges:</span>
                <span className="font-medium text-green-600">{edges.filter((e) => e.type === "positive").length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Negative Edges:</span>
                <span className="font-medium text-red-600">{edges.filter((e) => e.type === "negative").length}</span>
              </div>
            </CardContent>
          </Card>

          {/* Field Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Comparison Fields</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                  <span>Salutation</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                  <span>First Name</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                  <span>Middle Name</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                  <span>Last Name</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                  <span>Email</span>
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-500">
                Edges are created only when both nodes have non-null values for the compared field.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Center Panel - Graph Display */}
      <div className="flex-1 relative flex flex-col">
        {/* Graph area with fixed height */}
        <div className="relative" style={{ height: '62vh', minHeight: 350 }}>
          <svg ref={svgRef} width="100%" height="100%" className="cursor-crosshair">
            {/* Render edges first so they appear behind nodes */}
            {edges.map((edge, index) => {
              const fromNode = getNodeByRecordId(edge.from)
              const toNode = getNodeByRecordId(edge.to)

              if (!fromNode || !toNode) return null

              const hasCounterpart = hasCounterpartEdge(edge.from, edge.to, edge.type)
              const pathData = drawStraightEdgeBetweenNodes(fromNode, toNode, edge.type, nodeData, 30, hasCounterpart)

              const isHovered = hoveredEdge === edge
              const isSelected = selectedEdge === edge
              const isConnectedToNode =
                (hoveredNode || selectedNode) &&
                (edge.from === (hoveredNode || selectedNode)?.recordId || edge.to === (hoveredNode || selectedNode)?.recordId)

              const shouldPop = isHovered || isSelected || isConnectedToNode

              return (
                <path
                  key={`${edge.from}-${edge.to}-${edge.type}-${index}`}
                  d={pathData}
                  stroke={edge.type === "positive" ? "#10b981" : "#ef4444"}
                  strokeWidth={shouldPop ? 4 : 2}
                  opacity={shouldPop ? 1 : 0.7}
                  fill="none"
                  strokeDasharray={edge.type === "negative" ? "5,5" : "none"}
                  className="cursor-pointer transition-all duration-200"
                  onMouseEnter={() => handleEdgeHover(edge)}
                  onMouseLeave={handleMouseLeave}
                  onClick={() => handleEdgeClick(edge)}
                />
              )
            })}

            {/* Render nodes */}
            {nodeData.map((node) => {
              const isHovered = hoveredNode === node
              const isSelected = selectedNode === node

              return (
                <g key={node.recordId}>
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={isHovered || isSelected ? 35 : 30}
                    fill={getNodeColor(node.uuid)}
                    stroke="#ffffff"
                    strokeWidth={isHovered || isSelected ? 4 : 3}
                    className="cursor-pointer transition-all duration-200"
                    onMouseEnter={() => handleNodeHover(node)}
                    onMouseLeave={handleMouseLeave}
                    onClick={() => handleNodeClick(node)}
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
          </svg>
        </div>
        {/* Data Table Below the Graph */}
        <div className="w-full bg-white border-t border-gray-200 overflow-x-auto mt-4" style={{ fontSize: '12px' }}>
          <table className="min-w-full text-xs text-left">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-2 py-1 border">Record ID</th>
                <th className="px-2 py-1 border">UUDI</th>
                <th className="px-2 py-1 border">Salutation</th>
                <th className="px-2 py-1 border">First Name</th>
                <th className="px-2 py-1 border">Middle Name</th>
                <th className="px-2 py-1 border">Last Name</th>
                <th className="px-2 py-1 border">Email</th>
              </tr>
            </thead>
            <tbody>
              {nodeData.map((node) => (
                <tr
                  key={node.recordId}
                  className="hover:bg-gray-50"
                  onMouseEnter={() => setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  <td className="px-2 py-1 border font-mono">{node.recordId}</td>
                  <td className="px-2 py-1 border font-mono">{node.uuid}</td>
                  <td className="px-2 py-1 border">{node.salutation || "—"}</td>
                  <td className="px-2 py-1 border">{node.firstName || "—"}</td>
                  <td className="px-2 py-1 border">{node.middleName || "—"}</td>
                  <td className="px-2 py-1 border">{node.lastName || "—"}</td>
                  <td className="px-2 py-1 border break-all">{node.email || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right Panel - Record Details */}
      <div className="w-80 bg-white border-l border-gray-200 p-6 overflow-y-auto">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h2 className="text-xl font-bold text-gray-800">Record Details</h2>
            <p className="text-gray-600 mt-1">
              {selectedNode || selectedEdge || hoveredNode || hoveredEdge
                ? "Click or hover to explore"
                : "Click or hover on nodes/edges"}
            </p>
          </div>

          {/* Node Details */}
          {(selectedNode || hoveredNode) && (
            <Card className="border-2 border-blue-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: getNodeColor((selectedNode || hoveredNode)!.uuid) }}
                  />
                  {(selectedNode || hoveredNode)!.recordId}
                  {selectedNode && <span className="text-sm font-normal text-gray-500">(Selected)</span>}
                  {(selectedNode || hoveredNode)!.recordId === "id-007" && (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Data Corrected</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <span className="font-medium text-gray-600">UUDI:</span>
                  <span className="col-span-2 font-mono text-xs">{(selectedNode || hoveredNode)!.uuid}</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-sm">
                  <span className="font-medium text-gray-600">Full Name:</span>
                  <span className="col-span-2">{formatName(selectedNode || hoveredNode!)}</span>
                </div>

                <hr className="my-3" />

                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="font-medium text-gray-600">Salutation:</span>
                    <span className="col-span-2">{(selectedNode || hoveredNode)!.salutation || "—"}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="font-medium text-gray-600">First Name:</span>
                    <span className="col-span-2">{(selectedNode || hoveredNode)!.firstName || "—"}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="font-medium text-gray-600">Middle Name:</span>
                    <span className="col-span-2">{(selectedNode || hoveredNode)!.middleName || "—"}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="font-medium text-gray-600">Last Name:</span>
                    <span className="col-span-2">{(selectedNode || hoveredNode)!.lastName || "—"}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="font-medium text-gray-600">Email:</span>
                    <span className="col-span-2 break-all">{(selectedNode || hoveredNode)!.email || "—"}</span>
                  </div>
                </div>

                {/* Edge Summary Section */}
                <hr className="my-2" />
                <div className="text-xs text-gray-700">
                  <div className="font-semibold mb-1">Edge Summary</div>
                  {(() => {
                    const node = selectedNode || hoveredNode
                    if (!node) return null
                    const posEdges = edges.filter(e => (e.from === node.recordId || e.to === node.recordId) && e.type === "positive")
                    const negEdges = edges.filter(e => (e.from === node.recordId || e.to === node.recordId) && e.type === "negative")
                    const getOther = (e: Edge) => e.from === node.recordId ? e.to : e.from
                    return (
                      <div className="space-y-1">
                        <div>
                          <span className="font-medium text-green-700">Positive:</span> {posEdges.length}
                          {posEdges.length > 0 && (
                            <span className="ml-2">[
                              {posEdges.map(getOther).join(", ")}
                            ]</span>
                          )}
                        </div>
                        <div>
                          <span className="font-medium text-red-700">Negative:</span> {negEdges.length}
                          {negEdges.length > 0 && (
                            <span className="ml-2">[
                              {negEdges.map(getOther).join(", ")}
                            ]</span>
                          )}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Edge Details */}
          {(selectedEdge || hoveredEdge) && (
            <Card className="border-2 border-green-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div
                    className="w-4 h-1 rounded"
                    style={{
                      backgroundColor: (selectedEdge || hoveredEdge)!.type === "positive" ? "#10b981" : "#ef4444",
                    }}
                  />
                  {(selectedEdge || hoveredEdge)!.from} ↔ {(selectedEdge || hoveredEdge)!.to}
                  {selectedEdge && <span className="text-sm font-normal text-gray-500">(Selected)</span>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm">
                  <span className="font-medium text-gray-600">Edge Type: </span>
                  <span
                    className={`font-semibold ${
                      (selectedEdge || hoveredEdge)!.type === "positive" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {(selectedEdge || hoveredEdge)!.type === "positive" ? "Positive" : "Negative"}
                  </span>
                </div>

                {(selectedEdge || hoveredEdge)!.matchingFields.length > 0 && (
                  <div>
                    <div className="font-medium text-green-600 text-sm mb-2">Matching Fields:</div>
                    <div className="flex flex-wrap gap-1">
                      {(selectedEdge || hoveredEdge)!.matchingFields.map((field) => (
                        <span key={field} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                          {field}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {(selectedEdge || hoveredEdge)!.nonMatchingFields.length > 0 && (
                  <div>
                    <div className="font-medium text-red-600 text-sm mb-2">Non-matching Fields:</div>
                    <div className="flex flex-wrap gap-1">
                      {(selectedEdge || hoveredEdge)!.nonMatchingFields.map((field) => (
                        <span key={field} className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                          {field}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Show the actual values being compared */}
                <hr className="my-3" />
                <div className="text-xs text-gray-600">
                  <div className="font-medium mb-2">Field Comparison:</div>
                  {["salutation", "firstName", "middleName", "lastName", "email"].map((field) => {
                    const fromNode = getNodeByRecordId((selectedEdge || hoveredEdge)!.from)
                    const toNode = getNodeByRecordId((selectedEdge || hoveredEdge)!.to)
                    const fromValue = fromNode?.[field as keyof NodeData] || "—"
                    const toValue = toNode?.[field as keyof NodeData] || "—"
                    const isMatching = fromValue !== "—" && toValue !== "—" && fromValue === toValue
                    const isDifferent = fromValue !== "—" && toValue !== "—" && fromValue !== toValue

                    return (
                      <div key={field} className="flex justify-between py-1">
                        <span className="capitalize">{field}:</span>
                        <span
                          className={`text-xs ${
                            isMatching ? "text-green-600" : isDifferent ? "text-red-600" : "text-gray-400"
                          }`}
                        >
                          {fromValue} | {toValue}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Instructions */}
          {!selectedNode && !selectedEdge && !hoveredNode && !hoveredEdge && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Instructions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-gray-600">
                <p>
                  • <strong>Hover</strong> over nodes or edges to see details
                </p>
                <p>
                  • <strong>Click</strong> on nodes or edges to pin details
                </p>
                <p>
                  • <strong>Green edges</strong> show matching fields
                </p>
                <p>
                  • <strong>Red dashed edges</strong> show different fields
                </p>
                <p>• Node colors represent different UUDI groups</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
