"use client"

import React from "react"
import { useState, useMemo, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// Import data directly - Next.js will handle this for static export
import rawData from './data.json';

interface NodeData {
  recordId: string
  uuid: string
  salutation?: string
  firstName?: string
  middleName?: string
  lastName?: string
  email?: string
  phone?: string
  x: number
  y: number
}

interface Edge {
  from: string
  to: string
  type: "positive" | "negative"
  matchingFields: string[]
  nonMatchingFields: string[]
  rulesUsed: string[][]
}

// --- Match Rule Structure ---
// Each rule has: name, fields, children (for nested rules)
const matchRules = [
  {
    name: "Rule-1",
    fields: ["salutation", "firstName", "lastName", "email"],
    children: [
      {
        name: "Rule-4",
        fields: ["firstName", "lastName", "email"],
        children: [
          {
            name: "Rule-5",
            fields: ["firstName", "email"],
            children: [
              { name: "Rule-7", fields: ["email"], children: [] },
            ],
          },
          {
            name: "Rule-6",
            fields: ["lastName", "email"],
            children: [
              { name: "Rule-7", fields: ["email"], children: [] },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "Rule-2",
    fields: ["salutation", "firstName", "lastName", "phone"],
    children: [
      {
        name: "Rule-8",
        fields: ["firstName", "lastName", "phone"],
        children: [
          {
            name: "Rule-9",
            fields: ["firstName", "phone"],
            children: [
              { name: "Rule-11", fields: ["phone"], children: [] },
            ],
          },
          {
            name: "Rule-10",
            fields: ["lastName", "phone"],
            children: [
              { name: "Rule-11", fields: ["phone"], children: [] },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "Rule-3",
    fields: ["salutation", "firstName", "lastName", "addressLine1", "city", "country"],
    children: [
      {
        name: "Rule-12",
        fields: ["firstName", "lastName", "addressLine1", "city", "country"],
        children: [
          {
            name: "Rule-13",
            fields: ["firstName", "addressLine1", "city", "country"],
            children: [],
          },
          {
            name: "Rule-14",
            fields: ["lastName", "addressLine1", "city", "country"],
            children: [],
          },
        ],
      },
    ],
  },
]

// --- Types for Match Rules ---
type MatchRule = {
  name: string;
  fields: string[];
  children: MatchRule[];
};

type RuleEvalResult =
  | { status: "positive" | "negative"; matchingFields: string[]; nonMatchingFields: string[]; rulesUsed: string[][] }
  | { status: "unknown"; rulesUsed: string[][] };

// --- Rule Evaluation (OR logic for all children, returns all paths) ---
function evaluateRuleAll(rule: MatchRule, node1: any, node2: any, path: string[] = []): RuleEvalResult[] {
  // Check if all fields are present in both nodes
  const missing = rule.fields.filter(f => node1[f] == null || node2[f] == null)
  if (missing.length > 0) {
    // Not enough data, try all children (OR logic)
    let results: RuleEvalResult[] = []
    let unknownPaths: string[][] = []
    for (const child of rule.children || []) {
      const childResults = evaluateRuleAll(child, node1, node2, [...path, rule.name])
      // Collect all non-unknowns for results
      results = results.concat(childResults.filter(r => r.status !== "unknown"))
      // Collect all unknown paths
      unknownPaths = unknownPaths.concat(childResults.filter(r => r.status === "unknown").flatMap(r => r.rulesUsed))
    }
    if (results.length > 0) {
      return results
    }
    if (unknownPaths.length > 0) {
      return unknownPaths.map(p => ({ status: "unknown", rulesUsed: [p] }))
    }
    return [{ status: "unknown", rulesUsed: [[...path, rule.name]] }]
  }
  // All fields present, compare
  const matchingFields = []
  const nonMatchingFields = []
  for (const f of rule.fields) {
    if ((node1[f] || "").toLowerCase() === (node2[f] || "").toLowerCase()) {
      matchingFields.push(f)
    } else {
      nonMatchingFields.push(f)
    }
  }
  if (nonMatchingFields.length === 0) {
    return [{ status: "positive", matchingFields, nonMatchingFields, rulesUsed: [[...path, rule.name]] }]
  } else {
    return [{ status: "negative", matchingFields, nonMatchingFields, rulesUsed: [[...path, rule.name]] }]
  }
}

// Recursive component to render all match rules and their children
function RenderMatchRules({ rules, level = 0 }: { rules: MatchRule[]; level?: number }) {
  return (
    <div>
      {rules.map((rule) => (
        <div key={rule.name} style={{ marginLeft: level * 16 }}>
          <span className={`font-semibold ${level === 0 ? 'text-gray-800' : level === 1 ? 'text-gray-700' : 'text-gray-500'}`}>{rule.name}:</span>
          <span className={`ml-1 ${level === 0 ? 'text-gray-600' : level === 1 ? 'text-gray-500' : 'text-gray-400'}`}>{rule.fields.join(', ')}</span>
          {rule.children && rule.children.length > 0 && (
            <RenderMatchRules rules={rule.children} level={level + 1} />
          )}
        </div>
      ))}
    </div>
  )
}

export default function GraphExplorer() {
  const [hoveredNode, setHoveredNode] = useState<NodeData | null>(null)
  const [hoveredEdge, setHoveredEdge] = useState<Edge | null>(null)
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null)
  const [showRuleModal, setShowRuleModal] = useState(false)


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
  const nodeData: NodeData[] = useMemo(() => rawData.map((item: any, index: number) => {
    // Normal mapping for all other records
    return {
      recordId: item["Record-Id"],
      uuid: item["UUDI"],
      salutation: item["Salutation"] || undefined,
      firstName: item["First Name"] || undefined,
      middleName: item["Middle Name"] || undefined,
      lastName: item["Last Name"] || undefined,
      email: item["Email"] || undefined,
      phone: item["Phone"] || undefined,
      x: centerX + radius * Math.cos((index * 2 * Math.PI) / rawData.length),
      y: centerY + radius * Math.sin((index * 2 * Math.PI) / rawData.length),
    }
  }), [centerX, centerY, radius])

  // Generate all edges using match rules (OR logic, all rule paths)
  const edges = useMemo(() => {
    const edgeMap = new Map<string, Edge>()
    for (let i = 0; i < nodeData.length; i++) {
      for (let j = i + 1; j < nodeData.length; j++) {
        const node1 = nodeData[i]
        const node2 = nodeData[j]
        // Evaluate all top-level rules (OR logic)
        let allResults: RuleEvalResult[] = []
        for (const rule of matchRules) {
          allResults = allResults.concat(evaluateRuleAll(rule, node1, node2))
        }
        // Group by type and matching/nonMatching fields
        const grouped: { [key: string]: { matchingFields: string[], nonMatchingFields: string[], rulesUsed: string[][] } } = {}
        for (const result of allResults) {
          if (result.status === "positive" || result.status === "negative") {
            const key = result.status + '|' + (result.matchingFields || []).join(',') + '|' + (result.nonMatchingFields || []).join(',')
            if (!grouped[key]) {
              grouped[key] = {
                matchingFields: result.matchingFields,
                nonMatchingFields: result.nonMatchingFields,
                rulesUsed: [],
              }
            }
            grouped[key].rulesUsed.push(...(result.rulesUsed as string[][]))
          }
        }
        for (const key in grouped) {
          const [type] = key.split('|')
          edgeMap.set(
            node1.recordId + '-' + node2.recordId + '-' + key,
            {
              from: node1.recordId,
              to: node2.recordId,
              type: type as 'positive' | 'negative',
              matchingFields: grouped[key].matchingFields,
              nonMatchingFields: grouped[key].nonMatchingFields,
              rulesUsed: grouped[key].rulesUsed,
            }
          )
        }
      }
    }
    return Array.from(edgeMap.values())
  }, [nodeData])

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

  // Helper to get rule fields by rule name
  function getRuleFields(ruleName: string): string[] {
    function findRule(rules: MatchRule[]): string[] | null {
      for (const rule of rules) {
        if (rule.name === ruleName) return rule.fields
        if (rule.children && rule.children.length > 0) {
          const found = findRule(rule.children)
          if (found) return found
        }
      }
      return null
    }
    return findRule(matchRules) || []
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
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            className="cursor-crosshair"
            onClick={(e) => {
              // Only clear selection if the click target is the SVG itself (not a node or edge)
              if (e.target === svgRef.current) {
                setSelectedNode(null);
                setSelectedEdge(null);
              }
            }}
          >
            {/* SVG Filters for visual effects */}
            <defs>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge> 
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
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

              let edgeOpacity = 1
              if (isHovered || isSelected || isConnectedToNode) {
                edgeOpacity = 1
              } else if (selectedEdge) {
                // When any edge is selected, tone down all non-selected edges significantly
                edgeOpacity = 0.1
              } else if (hoveredNode || selectedNode) {
                edgeOpacity = 0.15 // much dimmer for non-connected edges
              } else {
                edgeOpacity = 0.7 // default
              }

              return (
                <path
                  key={`${edge.from}-${edge.to}-${edge.type}-${index}`}
                  d={pathData}
                  stroke={edge.type === "positive" ? "#10b981" : "#ef4444"}
                  strokeWidth={isSelected ? 6 : (isHovered || isConnectedToNode) ? 4 : 2}
                  opacity={edgeOpacity}
                  fill="none"
                  strokeDasharray={edge.type === "negative" ? "5,5" : "none"}
                  filter={isSelected ? "url(#glow)" : "none"}
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
                <th className="px-2 py-1 border">Phone</th>
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
                  <td className="px-2 py-1 border">{node.phone || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right Panel - Match Details */}
      <div className="w-80 bg-white border-l border-gray-200 p-6 overflow-y-auto">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h2 className="text-xl font-bold text-gray-800">Match Details</h2>
            <p className="text-gray-500 mt-1 text-xs">
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
                    // Helper to render rule paths as styled boxes/arrows, with wrapping
                    const renderRulePath = (rulePath: string[], status: string) => (
                      <div className="flex flex-row flex-wrap items-center space-x-1 break-all whitespace-normal w-full">
                        {rulePath.map((rule, i) => {
                          const isLast = i === rulePath.length - 1
                          let className = 'px-1.5 py-0.5 rounded font-semibold text-[9px]'
                          if (status === 'unknown') {
                            className += ' bg-gray-200 text-gray-500'
                          } else if (isLast) {
                            className += status === 'positive'
                              ? ' bg-green-100 text-green-700'
                              : ' bg-red-100 text-red-700'
                          } else {
                            className += ' bg-gray-100 text-gray-600'
                          }
                          return (
                            <React.Fragment key={rule + '-' + i}>
                              <span
                                className={className}
                                style={{ minWidth: 44, textAlign: 'center', display: 'inline-block' }}
                                title={`Rule: ${rule}`}
                              >
                                {rule}
                              </span>
                              {i < rulePath.length - 1 && (
                                <span className="text-gray-400 text-[12px] font-bold mx-0.5" style={{ verticalAlign: 'middle' }}>→</span>
                              )}
                            </React.Fragment>
                          )
                        })}
                      </div>
                    )
                    return (
                      <div className="space-y-1">
                        <div>
                          <span className="font-medium text-green-700">Positive:</span> {posEdges.length}
                          {posEdges.length > 0 && (
                            <div className="ml-2 flex flex-col space-y-1 w-full">
                              {posEdges.map((e, i) => (
                                <div key={e.from + e.to + e.rulesUsed.join('-') + '-' + i} className="flex flex-col items-start w-full">
                                  <span className="font-mono mr-1">{getOther(e)}</span>
                                  {/* Render all rule paths for this edge, each on its own line */}
                                  {e.rulesUsed.map((rulePath, idx) => (
                                    <div key={rulePath.join('-') + '-' + idx} className="w-full">
                                      {renderRulePath(rulePath, e.type)}
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div>
                          <span className="font-medium text-red-700">Negative:</span> {negEdges.length}
                          {negEdges.length > 0 && (
                            <div className="ml-2 flex flex-col space-y-1 w-full">
                              {negEdges.map((e, i) => (
                                <div key={e.from + e.to + e.rulesUsed.join('-') + '-' + i} className="flex flex-col items-start w-full">
                                  <span className="font-mono mr-1">{getOther(e)}</span>
                                  {/* Render all rule paths for this edge, each on its own line */}
                                  {e.rulesUsed.map((rulePath, idx) => (
                                    <div key={rulePath.join('-') + '-' + idx} className="w-full">
                                      {renderRulePath(rulePath, e.type)}
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Match Rules Evaluation Panel */}
          {(selectedEdge || hoveredEdge) && (
            <Card className="mb-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-gray-700">Match Rules Evaluation</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-col space-y-1 text-[9px] text-gray-700">
                  {/* Show all rule paths, including unknowns */}
                  {(() => {
                    const edge = selectedEdge || hoveredEdge
                    if (!edge) return null
                    // Re-evaluate all rules to get all paths, including unknowns
                    const node1 = getNodeByRecordId(edge.from)
                    const node2 = getNodeByRecordId(edge.to)
                    if (!node1 || !node2) return null
                    let allResults: RuleEvalResult[] = []
                    for (const rule of matchRules) {
                      allResults = allResults.concat(evaluateRuleAll(rule, node1, node2))
                    }
                    return allResults.map((result, idx) => (
                      <div key={result.rulesUsed[0].join('-') + '-' + idx} className="flex flex-row items-center space-x-1">
                        {result.rulesUsed[0].map((rule: string, i: number) => {
                          // Consistent path styling: all segments gray for unknown, else only last colored
                          const isLast = i === result.rulesUsed[0].length - 1
                          let className = 'px-1.5 py-0.5 rounded font-semibold'
                          if (result.status === 'unknown') {
                            className += ' bg-gray-200 text-gray-500'
                          } else if (isLast) {
                            className += result.status === 'positive'
                              ? ' bg-green-100 text-green-700'
                              : ' bg-red-100 text-red-700'
                          } else {
                            className += ' bg-gray-100 text-gray-600'
                          }
                          return (
                            <React.Fragment key={rule + '-' + i}>
                              <span
                                className={className}
                                style={{ minWidth: 44, textAlign: 'center', display: 'inline-block' }}
                                title={`Rule: ${rule} - compares ${getRuleFields(rule).join(', ')}`}
                              >
                                {rule}
                              </span>
                              {i < result.rulesUsed[0].length - 1 && (
                                <span className="text-gray-400 text-[12px] font-bold mx-0.5" style={{ verticalAlign: 'middle' }}>→</span>
                              )}
                            </React.Fragment>
                          )
                        })}
                      </div>
                    ))
                  })()}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Match Rules Panel (moved directly under Match Rules Evaluation) */}
          {(selectedEdge || hoveredEdge) && (
            <Card className="mb-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-gray-700">Match Rules</CardTitle>
              </CardHeader>
              <CardContent className="text-xs">
                <RenderMatchRules rules={matchRules} />
              </CardContent>
            </Card>
          )}

          {/* Edge Details */}
          {(selectedEdge || hoveredEdge) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div
                    className="w-4 h-1 rounded"
                    style={{ backgroundColor: '#d1d5db' }}
                  />
                  {(selectedEdge || hoveredEdge)!.from} ↔ {(selectedEdge || hoveredEdge)!.to}
                  {selectedEdge && <span className="text-sm font-normal text-gray-400">(Selected)</span>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Show the actual values being compared */}
                <hr className="my-3" />
                <div className="text-xs text-gray-400">
                  <div className="font-medium mb-2">Field Comparison:</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="font-semibold">Field</div>
                    <div className="font-semibold">Value 1</div>
                    <div className="font-semibold">Value 2</div>
                    {['salutation', 'firstName', 'middleName', 'lastName', 'email', 'phone'].map((field) => {
                      const fromNode = getNodeByRecordId((selectedEdge || hoveredEdge)!.from)
                      const toNode = getNodeByRecordId((selectedEdge || hoveredEdge)!.to)
                      const fromValue = fromNode?.[field as keyof NodeData] || "—"
                      const toValue = toNode?.[field as keyof NodeData] || "—"
                      const isMatching = fromValue !== "—" && toValue !== "—" && fromValue === toValue
                      const isDifferent = fromValue !== "—" && toValue !== "—" && fromValue !== toValue
                      return (
                        <div key={field} className="contents">
                          <div className="capitalize py-1">{field}:</div>
                          <div className={`py-1 ${isMatching ? 'text-green-400' : isDifferent ? 'text-red-400' : 'text-gray-300'}`}>{fromValue}</div>
                          <div className={`py-1 ${isMatching ? 'text-green-400' : isDifferent ? 'text-red-400' : 'text-gray-300'}`}>{toValue}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Instructions Panel (show only if nothing is selected) */}
          {!(selectedNode || selectedEdge || hoveredNode || hoveredEdge) && (
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
