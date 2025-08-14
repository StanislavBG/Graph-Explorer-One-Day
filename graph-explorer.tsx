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
  lastName?: string
  email?: string
  phone?: string
  party?: string
  x: number
  y: number
}

interface Edge {
  from: string
  to: string
  type: "positive" | "negative" | "mixed"
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
        ],
      },
    ],
  },
  {
    name: "Rule-14",
    fields: ["party", "phone"],
    children: [
                      {
                  name: "Rule-15",
                  fields: ["phone"],
                  children: [],
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

// Helper function to check for conflicts between two nodes
function checkForConflicts(node1: any, node2: any): boolean {
  // Check for firstName conflicts (only defined vs defined conflicts)
  const hasFirstNameConflict = (node1.firstName !== undefined && node1.firstName !== "" && 
                               node2.firstName !== undefined && node2.firstName !== "" && 
                               node1.firstName !== node2.firstName)
  
  // Check for lastName conflicts (only defined vs defined conflicts)
  const hasLastNameConflict = (node1.lastName !== undefined && node1.lastName !== "" && 
                              node2.lastName !== undefined && node2.lastName !== "" && 
                              node1.lastName !== node2.lastName)
  
  return hasFirstNameConflict || hasLastNameConflict
}

// Helper function to find conflicting fields between two nodes
function findConflictingFields(node1: any, node2: any): string[] {
  const conflicts: string[] = []
  
  // Check firstName conflicts
  if (node1.firstName !== undefined && node1.firstName !== "" && 
      node2.firstName !== undefined && node2.firstName !== "" && 
      node1.firstName !== node2.firstName) {
    conflicts.push("firstName")
  }
  
  // Check lastName conflicts
  if (node1.lastName !== undefined && node1.lastName !== "" && 
      node2.lastName !== undefined && node2.lastName !== "" && 
      node1.lastName !== node2.lastName) {
    conflicts.push("lastName")
  }
  
  return conflicts
}

// --- Types for Rule Evaluation ---
type RuleEvalResult = {
  status: 'positive' | 'negative' | 'neutral' | 'unknown'
  matchingFields: string[]
  nonMatchingFields: string[]
  rulesUsed: string[][]
}

// --- Rule Evaluation (OR logic for all children, returns all paths) ---
function evaluateRuleAll(rule: MatchRule, node1: any, node2: any, path: string[] = []): RuleEvalResult[] {
  // Check if all fields are present in both nodes (handle null, undefined, and empty strings)
  const missing = rule.fields.filter(f => {
    const val1 = node1[f]
    const val2 = node2[f]
    // Field is missing if it's null, undefined, or empty string
    return val1 == null || val2 == null || val1 === undefined || val2 === undefined || val1 === "" || val2 === ""
  })
  
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
        return unknownPaths.map(p => ({ 
          status: "unknown", 
          rulesUsed: [p],
          matchingFields: [],
          nonMatchingFields: []
        }))
      }
      return [{ 
        status: "unknown", 
        rulesUsed: [[...path, rule.name]],
        matchingFields: [],
        nonMatchingFields: []
      }]
  }
  
  // All fields present, compare
  const matchingFields = []
  const nonMatchingFields = []
  for (const f of rule.fields) {
    try {
      const val1 = node1[f].toString().toLowerCase()
      const val2 = node2[f].toString().toLowerCase()
      if (val1 === val2) {
        matchingFields.push(f)
      } else {
        nonMatchingFields.push(f)
      }
    } catch (error) {
      console.warn(`Error comparing field ${f}:`, error)
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
  const [selectedDataExample, setSelectedDataExample] = useState(0) // Index of selected data example
      const [graphHeight, setGraphHeight] = useState(500) // Resizable graph height - main focus area
    const [leftPanelWidth, setLeftPanelWidth] = useState(320) // Resizable left panel width
    const [rightPanelWidth, setRightPanelWidth] = useState(320) // Resizable right panel width
    const [dataTableHeight, setDataTableHeight] = useState(200) // Resizable data table height - reduced default
  const [isClient, setIsClient] = useState(false) // Prevent hydration mismatch
  
  // Dynamic data creation state
  const [showDynamicForm, setShowDynamicForm] = useState(false)
  const [dynamicRecords, setDynamicRecords] = useState<Array<{
    recordId: string
    salutation: string
    firstName: string
    lastName: string
    email: string
    phone: string
    party: string
  }>>([
    { recordId: "id-001", salutation: "Mr.", firstName: "John", lastName: "Smith", email: "john.smith@email.com", phone: "(555) 123-4567", party: "Party-001" },
    { recordId: "id-002", salutation: "Ms.", firstName: "Sarah", lastName: "Johnson", email: "sarah.j@email.com", phone: "(555) 987-6543", party: "Party-002" }
  ])

  // Editable data state for all examples
  const [editableData, setEditableData] = useState<Array<{
    recordId: string
    salutation: string
    firstName: string
    lastName: string
    email: string
    phone: string
    party: string
  }>>([])



  // For dynamic sizing
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [svgSize, setSvgSize] = useState({ width: 800, height: 600 })

  useEffect(() => {
    setIsClient(true)
  }, [])



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
  }, [graphHeight, leftPanelWidth, rightPanelWidth, dataTableHeight]) // Update when resizable areas change

  // Initialize editable data when example is selected
  useEffect(() => {
    if (selectedDataExample !== -1 && rawData[selectedDataExample]) {
      const exampleData = rawData[selectedDataExample].data
      const editableRecords = exampleData.map((record: any) => ({
        recordId: record["Record-Id"] || "",
        salutation: record["Salutation"] || "",
        firstName: record["First Name"] || "",
        lastName: record["Last Name"] || "",
        email: record["Email"] || "",
        phone: record["Phone"] || "",
        party: record["Party"] || ""
      }))
      setEditableData(editableRecords)
    } else {
      setEditableData([])
    }
  }, [selectedDataExample])

  // Calculate center and radius dynamically for the graph area only
  const centerX = svgSize.width / 2
  const centerY = svgSize.height / 2
  const radius = Math.min(svgSize.width, svgSize.height) * 0.35 // 35% of smaller dimension for better centering

  // Get the currently selected data set
  const currentData = selectedDataExample === -1 
    ? dynamicRecords.map(record => ({
        "Record-Id": record.recordId,
        "Salutation": record.salutation,
        "First Name": record.firstName,
        "Last Name": record.lastName,
        "Email": record.email,
        "Phone": record.phone,
        "Party": record.party
      }))
    : (editableData.length > 0 ? editableData.map(record => ({
        "Record-Id": record.recordId,
        "Salutation": record.salutation,
        "First Name": record.firstName,
        "Last Name": record.lastName,
        "Email": record.email,
        "Phone": record.phone,
        "Party": record.party
      })) : rawData[selectedDataExample]?.data || [])
  
  // Process the selected data into the format expected by the app
  const nodeData = useMemo(() => {
    if (!currentData || currentData.length === 0) return []
    
    return currentData.map((record: any, index: number) => {
      // Calculate position in a circle layout
      const angle = (index / currentData.length) * 2 * Math.PI
      const radius = Math.min(svgSize.width, svgSize.height) * 0.3 // 30% of smaller dimension
      const x = Math.cos(angle) * radius + centerX
      const y = Math.sin(angle) * radius + centerY
      
      return {
        recordId: record["Record-Id"] || `record-${index}`,
        uuid: `cluster-${index}`, // Temporary UUID, will be updated after clustering
        salutation: record["Salutation"] || "",
        firstName: record["First Name"] || "",
        lastName: record["Last Name"] || "",
        email: record["Email"] || "",
        phone: record["Phone"] || "",
        party: record["Party"] || "",
        x,
        y,
      }
    })
  }, [currentData])

  // Generate overall edges based on rule evaluation precedence
  const edges = useMemo(() => {
    try {
      const edgeMap = new Map<string, Edge>()
      for (let i = 0; i < nodeData.length; i++) {
        for (let j = i + 1; j < nodeData.length; j++) {
          try {
            const node1 = nodeData[i]
            const node2 = nodeData[j]
            if (!node1 || !node2) continue
            
            // Evaluate all top-level rules to get overall edge status
            let allResults: RuleEvalResult[] = []
            for (const rule of matchRules) {
              try {
                allResults = allResults.concat(evaluateRuleAll(rule, node1, node2))
              } catch (error) {
                console.warn(`Error evaluating rule ${rule.name}:`, error)
                continue
              }
            }
            
            // Determine overall edge status based on rule precedence
            // Rule-1 has highest precedence, then Rule-2, then Rule-3
            let overallStatus: 'positive' | 'negative' | 'neutral' = 'neutral'
            let matchingFields: string[] = []
            let nonMatchingFields: string[] = []
            let rulesUsed: string[][] = []
            
            // Group results by top-level rule
            const ruleResults: { [ruleName: string]: RuleEvalResult[] } = {}
            for (const result of allResults) {
              const topRule = result.rulesUsed[0][0]
              if (!ruleResults[topRule]) {
                ruleResults[topRule] = []
              }
              ruleResults[topRule].push(result)
            }
            
            // Check each rule in order of precedence and collect results
            const ruleResultsByPrecedence: { ruleName: string; status: 'positive' | 'negative' | 'neutral'; result: RuleEvalResult }[] = []
            
            for (const rule of matchRules) {
              const resultsForThisRule = ruleResults[rule.name] || []
              
              if (resultsForThisRule.length > 0) {
                // Find the highest precedence result for this rule (shortest path)
                let highestPrecedenceResult = resultsForThisRule[0]
                for (const result of resultsForThisRule) {
                  if (result.rulesUsed[0].length < highestPrecedenceResult.rulesUsed[0].length) {
                    highestPrecedenceResult = result
                  }
                }
                
                // If this rule has a definitive result, record it
                if (highestPrecedenceResult.status === 'positive' || highestPrecedenceResult.status === 'negative') {
                  ruleResultsByPrecedence.push({
                    ruleName: rule.name,
                    status: highestPrecedenceResult.status,
                    result: highestPrecedenceResult
                  })
                }
              }
            }
            
                                            // Determine overall status based on OR logic across all rule chains
                                if (ruleResultsByPrecedence.length > 0) {
                                  // Check if ANY rule chain resulted in positive (OR logic)
                                  const hasPositiveResult = ruleResultsByPrecedence.some(r => r.status === 'positive')
                                  
                                  if (hasPositiveResult) {
                                    // If any rule chain is positive, overall is positive
                                    overallStatus = 'positive'
                                    // Find the first positive result to get its details
                                    const positiveResult = ruleResultsByPrecedence.find(r => r.status === 'positive')
                                    if (positiveResult) {
                                      matchingFields = (positiveResult.result as any).matchingFields || []
                                      nonMatchingFields = (positiveResult.result as any).nonMatchingFields || []
                                      rulesUsed = positiveResult.result.rulesUsed || []
                                    }
                                  } else {
                                    // If no positive results, check for negative results
                                    const hasNegativeResult = ruleResultsByPrecedence.some(r => r.status === 'negative')
                                    
                                    if (hasNegativeResult) {
                                      overallStatus = 'negative'
                                      // Find the first negative result to get its details
                                      const negativeResult = ruleResultsByPrecedence.find(r => r.status === 'negative')
                                      if (negativeResult) {
                                        matchingFields = []
                                        nonMatchingFields = (negativeResult.result as any).nonMatchingFields || []
                                        rulesUsed = negativeResult.result.rulesUsed || []
                                      }
                                    } else {
                                      // Only neutral results
                                      overallStatus = 'neutral'
                                      const neutralResult = ruleResultsByPrecedence[0]
                                      if (neutralResult) {
                                        matchingFields = (neutralResult.result as any).matchingFields || []
                                        nonMatchingFields = (neutralResult.result as any).nonMatchingFields || []
                                        rulesUsed = neutralResult.result.rulesUsed || []
                                      }
                                    }
                                  }
                                }
            
            // Only create edges for positive or negative relationships
            if (overallStatus !== 'neutral') {
              if (overallStatus === 'positive') {
                console.log(`POSITIVE EDGE: ${node1.recordId} <-> ${node2.recordId} (${matchingFields.join(', ')})`)
              }
              edgeMap.set(
                node1.recordId + '-' + node2.recordId,
                {
                  from: node1.recordId,
                  to: node2.recordId,
                  type: overallStatus,
                  matchingFields,
                  nonMatchingFields,
                  rulesUsed,
                }
              )
            }
          } catch (error) {
            console.warn(`Error processing node pair ${i}-${j}:`, error)
            continue
          }
        }
      }
      return Array.from(edgeMap.values())
    } catch (error) {
      console.error('Error generating edges:', error)
      return []
    }
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
    const parts = [node.salutation, node.firstName, node.lastName].filter(Boolean)
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

    // Round coordinates to 2 decimal places to prevent hydration mismatches
    const roundedStartX = Math.round(startX * 100) / 100
    const roundedStartY = Math.round(startY * 100) / 100
    const roundedEndX = Math.round(endX * 100) / 100
    const roundedEndY = Math.round(endY * 100) / 100
    
    return `M ${roundedStartX} ${roundedStartY} L ${roundedEndX} ${roundedEndY}`
  }

  // Create unified edges that combine positive and negative relationships
  const unifiedEdges = useMemo(() => {
    const edgeMap = new Map<string, any>()
    
    // Group edges by node pairs
    edges.forEach((edge) => {
      const key = [edge.from, edge.to].sort().join('-')
      
      if (!edgeMap.has(key)) {
        edgeMap.set(key, {
          from: edge.from,
          to: edge.to,
          positiveFields: [],
          negativeFields: [],
          allRulesUsed: [],
          hasBothTypes: false
        })
      }
      
      const unified = edgeMap.get(key)
      if (edge.type === "positive") {
        unified.positiveFields.push(...edge.matchingFields)
        unified.allRulesUsed.push(...edge.rulesUsed)
      } else {
        unified.negativeFields.push(...edge.nonMatchingFields)
        unified.allRulesUsed.push(...edge.rulesUsed)
      }
    })
    
    // Mark edges that have both positive and negative aspects
    edgeMap.forEach((unified) => {
      unified.hasBothTypes = unified.positiveFields.length > 0 && unified.negativeFields.length > 0
    })
    
    return Array.from(edgeMap.values())
  }, [edges])

  // Helper function to check if a node pair has both positive and negative edges
  const hasCounterpartEdge = (fromId: string, toId: string, currentType: "positive" | "negative"): boolean => {
    const oppositeType = currentType === "positive" ? "negative" : "positive"
    return edges.some(
      (edge) =>
        ((edge.from === fromId && edge.to === toId) || (edge.from === toId && edge.to === fromId)) &&
        edge.type === oppositeType,
    )
  }

  // Alternative clustering algorithm that handles negative edge constraints more robustly
  const advancedNodeClusters = useMemo(() => {
    if (nodeData.length === 0) return new Map<string, number>()
    
    const clusters = new Map<string, number>()
    const clusterGroups = new Map<number, Set<string>>()
    let nextClusterId = 1
    
    // First pass: create initial clusters based on positive edges only
    const initialClusters = new Map<string, number>()
    const initialClusterGroups = new Map<number, Set<string>>()
    let initialClusterId = 1
    
    const findInitialConnectedComponent = (startNodeId: string, visited: Set<string> = new Set()): Set<string> => {
      if (visited.has(startNodeId)) return visited
      visited.add(startNodeId)
      
      const positiveEdges = edges.filter(e => 
        e.type === 'positive' && 
        (e.from === startNodeId || e.to === startNodeId)
      )
      
      for (const edge of positiveEdges) {
        const nextNodeId = edge.from === startNodeId ? edge.to : edge.from
        if (!visited.has(nextNodeId)) {
          findInitialConnectedComponent(nextNodeId, visited)
        }
      }
      
      return visited
    }
    
    const visitedNodes = new Set<string>()
    for (const node of nodeData) {
      if (!node || visitedNodes.has(node.recordId)) continue
      
      const component = findInitialConnectedComponent(node.recordId)
      for (const nodeId of component) {
        visitedNodes.add(nodeId)
        initialClusters.set(nodeId, initialClusterId)
      }
      initialClusterGroups.set(initialClusterId, component)
      initialClusterId++
    }
    
    // Second pass: split clusters that violate negative edge constraints
    const finalClusters = new Map<string, number>()
    const finalClusterGroups = new Map<number, Set<string>>()
    let finalClusterId = 1
    
    for (const [clusterId, nodes] of initialClusterGroups) {
      const nodeArray = Array.from(nodes)
      const validSubclusters: Set<string>[] = []
      
      // Use a greedy approach to find valid subclusters
      for (const nodeId of nodeArray) {
        let addedToExisting = false
        
        // Try to add to existing valid subclusters
        for (const subcluster of validSubclusters) {
          let canAdd = true
          
          // Check if this node has negative edges to any node in this subcluster
          for (const existingNodeId of subcluster) {
            const hasNegativeEdge = edges.some(e => 
              e.type === 'negative' && 
              ((e.from === nodeId && e.to === existingNodeId) || 
               (e.from === existingNodeId && e.to === nodeId))
            )
            
            if (hasNegativeEdge) {
              canAdd = false
              break
            }
          }
          
          if (canAdd) {
            subcluster.add(nodeId)
            addedToExisting = true
            break
          }
        }
        
        // If couldn't add to existing subclusters, create a new one
        if (!addedToExisting) {
          validSubclusters.push(new Set([nodeId]))
        }
      }
      
      // Assign final cluster IDs to valid subclusters
      for (const subcluster of validSubclusters) {
        for (const nodeId of subcluster) {
          finalClusters.set(nodeId, finalClusterId)
        }
        finalClusterGroups.set(finalClusterId, subcluster)
        finalClusterId++
      }
    }
    
    return finalClusters
  }, [nodeData, edges])
  
  // Use the advanced clustering algorithm instead of the basic one
  const nodeClusters = advancedNodeClusters
  
  // Function to detect clustering constraint violations
  const detectConstraintViolations = useMemo(() => {
    const violations: Array<{
      node1: string,
      node2: string,
      cluster1: number,
      cluster2: number,
      negativeEdgeType: string
    }> = []
    
    if (!nodeClusters) return violations
    
    // Check all negative edges to see if they connect nodes in the same cluster
    for (const edge of edges) {
      if (edge.type === 'negative') {
        const cluster1 = nodeClusters.get(edge.from)
        const cluster2 = nodeClusters.get(edge.to)
        
        if (cluster1 !== undefined && cluster2 !== undefined && cluster1 === cluster2) {
          violations.push({
            node1: edge.from,
            node2: edge.to,
            cluster1: cluster1,
            cluster2: cluster2,
            negativeEdgeType: edge.nonMatchingFields.join(', ')
          })
        }
      }
    }
    
    return violations
  }, [nodeClusters, edges])
  
  // Function to calculate clustering quality metrics
  const clusteringQualityMetrics = useMemo(() => {
    if (!nodeClusters || nodeData.length === 0) return null
    
    const totalNodes = nodeData.length
    const totalEdges = edges.length
    const positiveEdges = edges.filter(e => e.type === 'positive')
    const negativeEdges = edges.filter(e => e.type === 'negative')
    
    // Count edges within clusters vs between clusters
    let positiveWithinCluster = 0
    let positiveBetweenClusters = 0
    let negativeWithinCluster = 0
    let negativeBetweenClusters = 0
    
    for (const edge of edges) {
      const cluster1 = nodeClusters.get(edge.from)
      const cluster2 = nodeClusters.get(edge.to)
      
      if (cluster1 !== undefined && cluster2 !== undefined) {
        if (cluster1 === cluster2) {
          // Edge within same cluster
          if (edge.type === 'positive') positiveWithinCluster++
          else if (edge.type === 'negative') negativeWithinCluster++
        } else {
          // Edge between different clusters
          if (edge.type === 'positive') positiveBetweenClusters++
          else if (edge.type === 'negative') negativeBetweenClusters++
        }
      }
    }
    
    // Calculate metrics
    const totalPositive = positiveEdges.length
    const totalNegative = negativeEdges.length
    const positiveIntraClusterRatio = totalPositive > 0 ? (positiveWithinCluster / totalPositive) * 100 : 0
    const negativeInterClusterRatio = totalNegative > 0 ? (negativeBetweenClusters / totalNegative) * 100 : 0
    
    return {
      totalNodes,
      totalClusters: new Set(Array.from(nodeClusters.values())).size,
      positiveIntraClusterRatio: Math.round(positiveIntraClusterRatio * 100) / 100,
      negativeInterClusterRatio: Math.round(negativeInterClusterRatio * 100) / 100,
      constraintViolations: detectConstraintViolations.length,
      positiveWithinCluster,
      positiveBetweenClusters,
      negativeWithinCluster,
      negativeBetweenClusters
    }
  }, [nodeClusters, nodeData, edges, detectConstraintViolations])
  
  // Create final node data with computed UUIDs based on clustering
  const finalNodeData = useMemo(() => {
    if (!nodeClusters || nodeData.length === 0) return nodeData
    
    return nodeData.map(node => {
      const clusterId = nodeClusters.get(node.recordId)
      return {
        ...node,
        uuid: clusterId !== undefined ? `cluster-${clusterId}` : `cluster-unknown`
      }
    })
  }, [nodeData, nodeClusters])
  
  // Get unique UUIDs for display purposes (now based on clustering)
  const uniqueUUIDs = useMemo(() => {
    return Array.from(new Set(finalNodeData.map((node) => node.uuid)))
  }, [finalNodeData])

  // Helper functions for dynamic data creation
  const addEmptyRecord = () => {
    const newId = `id-${String(dynamicRecords.length + 1).padStart(3, '0')}`
    setDynamicRecords([...dynamicRecords, {
      recordId: newId,
      salutation: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      party: ""
    }])
  }

  const addFullRecord = () => {
    const newId = `id-${String(dynamicRecords.length + 1).padStart(3, '0')}`
    const firstName = generateRandomFirstName()
    const lastName = generateRandomLastName()
    
    // Try to reuse some existing data to create denser connections
    const existingRecords = dynamicRecords.filter(r => r.salutation || r.firstName || r.lastName || r.email || r.phone || r.party)
    let reusedFields: any = {}
    
    if (existingRecords.length > 0) {
      const randomExisting = existingRecords[Math.floor(Math.random() * existingRecords.length)]
      
      // 50% chance to reuse salutation
      if (Math.random() < 0.5 && randomExisting.salutation) {
        reusedFields.salutation = randomExisting.salutation
      } else {
        reusedFields.salutation = generateRandomSalutation()
      }
      
      // 60% chance to reuse party (creates good clustering)
      if (Math.random() < 0.6 && randomExisting.party) {
        reusedFields.party = randomExisting.party
      } else {
        reusedFields.party = generateRandomParty()
      }
      
      // 40% chance to reuse phone (creates phone-based connections)
      if (Math.random() < 0.4 && randomExisting.phone) {
        reusedFields.phone = randomExisting.phone
      } else {
        reusedFields.phone = generateRandomPhone()
      }
    } else {
      reusedFields.salutation = generateRandomSalutation()
      reusedFields.party = generateRandomParty()
      reusedFields.phone = generateRandomPhone()
    }
    
    setDynamicRecords([...dynamicRecords, {
      recordId: newId,
      salutation: reusedFields.salutation,
      firstName: firstName,
      lastName: lastName,
      email: generateRandomEmail(firstName, lastName),
      phone: reusedFields.phone,
      party: reusedFields.party
    }])
  }

  const addPartialRecord = () => {
    const newId = `id-${String(dynamicRecords.length + 1).padStart(3, '0')}`
    const firstName = generateRandomFirstName()
    const lastName = generateRandomLastName()
    
    // Try to reuse some existing data to create denser connections
    const existingRecords = dynamicRecords.filter(r => r.salutation || r.firstName || r.lastName || r.email || r.phone || r.party)
    let reusedFields: any = {}
    
    if (existingRecords.length > 0) {
      const randomExisting = existingRecords[Math.floor(Math.random() * existingRecords.length)]
      
      // Higher chance to reuse party and phone for better clustering
      if (randomExisting.party && Math.random() < 0.7) {
        reusedFields.party = randomExisting.party
      }
      if (randomExisting.phone && Math.random() < 0.6) {
        reusedFields.phone = randomExisting.phone
      }
      if (randomExisting.salutation && Math.random() < 0.5) {
        reusedFields.salutation = randomExisting.salutation
      }
    }
    
    // Randomly fill some fields, leave others empty
    const fields = ['salutation', 'firstName', 'lastName', 'email', 'phone', 'party']
    const numFieldsToFill = Math.floor(Math.random() * 4) + 2 // Fill 2-5 fields
    
    const record: any = { recordId: newId }
    fields.forEach(field => {
      if (Math.random() < numFieldsToFill / fields.length) {
        switch(field) {
          case 'salutation':
            record.salutation = reusedFields.salutation || generateRandomSalutation()
            break
          case 'firstName':
            record.firstName = firstName
            break
          case 'lastName':
            record.lastName = lastName
            break
          case 'email':
            record.email = generateRandomEmail(firstName, lastName)
            break
          case 'phone':
            record.phone = reusedFields.phone || generateRandomPhone()
            break
          case 'party':
            record.party = reusedFields.party || generateRandomParty()
            break
        }
      } else {
        record[field] = ""
      }
    })
    
    setDynamicRecords([...dynamicRecords, record])
  }

  // Functions to add records to existing examples
  const addFullRecordToExample = () => {
    const newId = `R${String(editableData.length + 1)}`
    const firstName = generateRandomFirstName()
    const lastName = generateRandomLastName()
    
    // Try to reuse some existing data from the example to create denser connections
    const existingRecords = editableData.filter(r => r.salutation || r.firstName || r.lastName || r.email || r.phone || r.party)
    let reusedFields: any = {}
    
    if (existingRecords.length > 0) {
      const randomExisting = existingRecords[Math.floor(Math.random() * existingRecords.length)]
      
      // 50% chance to reuse salutation
      if (Math.random() < 0.5 && randomExisting.salutation) {
        reusedFields.salutation = randomExisting.salutation
      } else {
        reusedFields.salutation = generateRandomSalutation()
      }
      
      // 60% chance to reuse party (creates good clustering)
      if (Math.random() < 0.6 && randomExisting.party) {
        reusedFields.party = randomExisting.party
      } else {
        reusedFields.party = generateRandomParty()
      }
      
      // 40% chance to reuse phone (creates phone-based connections)
      if (Math.random() < 0.4 && randomExisting.phone) {
        reusedFields.phone = randomExisting.phone
      } else {
        reusedFields.phone = generateRandomPhone()
      }
    } else {
      reusedFields.salutation = generateRandomSalutation()
      reusedFields.party = generateRandomParty()
      reusedFields.phone = generateRandomPhone()
    }
    
    const newRecord = {
      recordId: newId,
      salutation: reusedFields.salutation,
      firstName: firstName,
      lastName: lastName,
      email: generateRandomEmail(firstName, lastName),
      phone: reusedFields.phone,
      party: reusedFields.party
    }
    
    setEditableData([...editableData, newRecord])
  }

  const addPartialRecordToExample = () => {
    const newId = `R${String(editableData.length + 1)}`
    const firstName = generateRandomFirstName()
    const lastName = generateRandomLastName()
    
    // Try to reuse some existing data from the example to create denser connections
    const existingRecords = editableData.filter(r => r.salutation || r.firstName || r.lastName || r.email || r.phone || r.party)
    let reusedFields: any = {}
    
    if (existingRecords.length > 0) {
      const randomExisting = existingRecords[Math.floor(Math.random() * existingRecords.length)]
      
      // Higher chance to reuse party and phone for better clustering
      if (randomExisting.party && Math.random() < 0.7) {
        reusedFields.party = randomExisting.party
      }
      if (randomExisting.phone && Math.random() < 0.6) {
        reusedFields.phone = randomExisting.phone
      }
      if (randomExisting.salutation && Math.random() < 0.5) {
        reusedFields.salutation = randomExisting.salutation
      }
    }
    
    // Randomly fill some fields, leave others empty
    const fields = ['salutation', 'firstName', 'lastName', 'email', 'phone', 'party']
    const numFieldsToFill = Math.floor(Math.random() * 4) + 2 // Fill 2-5 fields
    
    const record: any = { recordId: newId }
    fields.forEach(field => {
      if (Math.random() < numFieldsToFill / fields.length) {
        switch(field) {
          case 'salutation':
            record.salutation = reusedFields.salutation || generateRandomSalutation()
            break
          case 'firstName':
            record.firstName = firstName
            break
          case 'lastName':
            record.lastName = lastName
            break
          case 'email':
            record.email = generateRandomEmail(firstName, lastName)
            break
          case 'phone':
            record.phone = reusedFields.phone || generateRandomPhone()
            break
          case 'party':
            record.party = reusedFields.party || generateRandomParty()
            break
        }
      } else {
        record[field] = ""
      }
    })
    
    setEditableData([...editableData, record])
  }

  const addEmptyRecordToExample = () => {
    const newId = `R${String(editableData.length + 1)}`
    const newRecord = {
      recordId: newId,
      salutation: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      party: ""
    }
    
    setEditableData([...editableData, newRecord])
  }

  const removeExampleRecord = (index: number) => {
    if (editableData.length > 1) {
      setEditableData(editableData.filter((_, i) => i !== index))
    }
  }

  const removeDynamicRecord = (index: number) => {
    if (dynamicRecords.length > 1) {
      setDynamicRecords(dynamicRecords.filter((_, i) => i !== index))
    }
  }

  const updateDynamicRecord = (index: number, field: string, value: string) => {
    const updatedRecords = [...dynamicRecords]
    updatedRecords[index] = { ...updatedRecords[index], [field]: value }
    setDynamicRecords(updatedRecords)
  }

  const updateEditableData = (index: number, field: string, value: string) => {
    const updatedData = [...editableData]
    updatedData[index] = { ...updatedData[index], [field]: value }
    setEditableData(updatedData)
  }

  // Helper functions to generate random realistic data
  const generateRandomSalutation = () => {
    const salutations = ["Mr.", "Ms.", "Dr.", "Prof.", "Mrs.", "Miss"]
    return salutations[Math.floor(Math.random() * salutations.length)]
  }

  const generateRandomFirstName = () => {
    const firstNames = ["James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda", "David", "Elizabeth", "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Christopher", "Karen"]
    return firstNames[Math.floor(Math.random() * firstNames.length)]
  }

  const generateRandomLastName = () => {
    const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin"]
    return lastNames[Math.floor(Math.random() * lastNames.length)]
  }

  const generateRandomEmail = (firstName: string, lastName: string) => {
    const domains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "company.com", "business.org"]
    const domain = domains[Math.floor(Math.random() * domains.length)]
    const emailFormats = [
      `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`,
      `${firstName.toLowerCase()}${lastName.toLowerCase()}@${domain}`,
      `${firstName.toLowerCase()}_${lastName.toLowerCase()}@${domain}`,
      `${firstName.toLowerCase()}@${domain}`
    ]
    return emailFormats[Math.floor(Math.random() * emailFormats.length)]
  }

  const generateRandomPhone = () => {
    const areaCodes = ["555", "444", "333", "222", "111"]
    const areaCode = areaCodes[Math.floor(Math.random() * areaCodes.length)]
    const prefix = Math.floor(Math.random() * 900) + 100
    const line = Math.floor(Math.random() * 9000) + 1000
    return `(${areaCode}) ${prefix}-${line}`
  }

  const generateRandomParty = () => {
    const parties = ["Party-001", "Party-002", "Party-003", "Party-004", "Party-005", "Party-006", "Party-007", "Party-008", "Party-009", "Party-010"]
    return parties[Math.floor(Math.random() * parties.length)]
  }



  const getNodeColor = (recordId: string) => {
    // Use cluster-based coloring for meaningful node grouping
    if (!recordId || !nodeClusters) return "#6b7280"
    
    const clusterId = nodeClusters.get(recordId)
    if (clusterId === undefined) return "#6b7280"
    
    // Assign colors based on cluster membership
    const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1"]
    return colors[clusterId % colors.length]
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

  // Don't render until client-side to prevent hydration mismatch
  if (!isClient) {
    return (
      <div className="w-full h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Graph Explorer...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full min-h-screen bg-gray-50 flex">
      {/* Left Panel - Legend and Controls - Resizable */}
      <div 
        className="bg-white border-r border-gray-200 p-3 overflow-y-auto relative"
        style={{ width: leftPanelWidth }}
      >
        {/* Resize Handle */}
        <div 
          className="absolute right-0 top-0 bottom-0 w-1 bg-gray-300 hover:bg-blue-400 cursor-ew-resize transition-colors"
          onMouseDown={(e) => {
            e.preventDefault()
            const startX = e.clientX
            const startWidth = leftPanelWidth
            
            const handleMouseMove = (moveEvent: MouseEvent) => {
              const deltaX = moveEvent.clientX - startX
              const newWidth = Math.max(300, Math.min(600, startWidth + deltaX))
              setLeftPanelWidth(newWidth)
            }
            
            const handleMouseUp = () => {
              document.removeEventListener('mousemove', handleMouseMove)
              document.removeEventListener('mouseup', handleMouseUp)
            }
            
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
          }}
        />
        <div className="space-y-3">
          {/* Header */}
          <div>
            <h1 className="text-xl font-bold text-gray-800">Graph Explorer</h1>
            <p className="text-gray-600 mt-0.5 text-sm">Data Relationship Visualization & Clustering</p>
          </div>

          {/* Unified Edge Legend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Relationship Types</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-6 h-0.5 bg-green-500"></div>
                <div>
                  <div className="font-medium text-green-600">Positive Only</div>
                  <div className="text-sm text-gray-600">Only matching fields between nodes</div>
                  <div className="text-xs text-gray-500">
                    Count: {unifiedEdges.filter((e) => !e.hasBothTypes && e.positiveFields.length > 0).length}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-0.5 bg-red-500 border-dashed border border-red-500"></div>
                <div>
                  <div className="font-medium text-red-600">Negative Only</div>
                  <div className="text-sm text-gray-600">Only differing fields between nodes</div>
                  <div className="text-xs text-gray-500">
                    Count: {unifiedEdges.filter((e) => !e.hasBothTypes && e.negativeFields.length > 0).length}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-0.5 bg-gray-500 border-dashed border border-gray-500"></div>
                <div>
                  <div className="font-medium text-gray-600">Mixed Relationships</div>
                  <div className="text-sm text-gray-600">Some fields match, some differ (dominant type shown)</div>
                  <div className="text-xs text-gray-500">
                    Count: {unifiedEdges.filter((e) => e.positiveFields.length > 0 && e.negativeFields.length > 0).length}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Clustering Algorithm Info */}
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-blue-700">🔗 Advanced Clustering</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm text-blue-800">
                <p className="mb-2">
                  <strong>Constraint-Respecting Clustering:</strong> This algorithm prevents nodes with 
                  negative relationships from being placed in the same cluster, even if they're connected 
                  through positive transitive paths.
                </p>
                <p className="mb-2">
                  <strong>Two-Phase Approach:</strong>
                </p>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>Phase 1: Create initial clusters based on positive edges</li>
                  <li>Phase 2: Split clusters that violate negative edge constraints</li>
                </ul>
                <p className="mt-2 text-xs">
                  This ensures that negative relationships (dis-similarities) are properly respected 
                  and don't get ignored due to longer transitive paths.
                </p>
                {selectedDataExample === 1 && (
                  <div className="mt-3 p-2 bg-yellow-100 border border-yellow-300 rounded text-xs text-yellow-800">
                    <strong>Note:</strong> Data Example 2 has a different structure - record id-z002 has no salutation 
                    (empty string), while id-z001 has "Jr" and id-z003 has "Sr". This tests how the algorithm 
                    handles missing vs. conflicting data.
                  </div>
                )}
                {selectedDataExample === 2 && (
                  <div className="mt-3 p-2 bg-orange-100 border border-orange-300 rounded text-xs text-orange-800">
                    <strong>Note:</strong> Data Example 3 tests missing field handling - id-001 has no phone, 
                    id-002 has no salutation, and id-003 has no email. This demonstrates how the algorithm 
                    handles incomplete data and creates edges based on available fields.
                  </div>
                )}
                {selectedDataExample === 3 && (
                  <div className="mt-3 p-2 bg-purple-100 border border-purple-300 rounded text-xs text-purple-800">
                    <strong>Note:</strong> Data Example 4 tests extreme missing data scenarios - id-001 (Jr) and 
                    id-002 (Sr) have complete data, id-003 has no salutation, and id-004 has no salutation 
                    AND no email. This tests the algorithm's ability to handle varying levels of data completeness.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Node Clusters */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Node Clusters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                              {(() => {
                  // Group nodes by cluster
                  const clusterGroups = new Map<number, { nodes: NodeData[], color: string }>()
                  finalNodeData.forEach(node => {
                    const clusterId = nodeClusters.get(node.recordId)
                    if (clusterId !== undefined) {
                      if (!clusterGroups.has(clusterId)) {
                        clusterGroups.set(clusterId, { nodes: [], color: getNodeColor(node.recordId) })
                      }
                      clusterGroups.get(clusterId)!.nodes.push(node)
                    }
                  })
                
                return Array.from(clusterGroups.entries()).map(([clusterId, { nodes, color }]) => (
                  <div key={clusterId} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full" style={{ backgroundColor: color }}></div>
                    <div>
                      <div className="font-medium" style={{ color: color }}>
                        Cluster {clusterId + 1}
                      </div>
                      <div className="text-sm text-gray-600">
                        {nodes.length} records: {nodes.map(n => n.recordId).join(", ")}
                      </div>
                    </div>
                  </div>
                ))
              })()}
            </CardContent>
          </Card>

          {/* Constraint Violations */}
          {detectConstraintViolations.length > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-red-700">⚠️ Constraint Violations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm text-red-600 mb-3">
                  The following nodes have negative relationships but are in the same cluster. 
                  This indicates the clustering algorithm needs adjustment.
                </div>
                {detectConstraintViolations.map((violation, index) => (
                  <div key={index} className="p-3 bg-red-100 rounded border border-red-200">
                    <div className="text-sm font-medium text-red-800">
                      {violation.node1} ↔ {violation.node2}
                    </div>
                    <div className="text-xs text-red-600">
                      Both in Cluster {violation.cluster1 + 1} | 
                      Negative: {violation.negativeEdgeType}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Clustering Quality Metrics */}
          {clusteringQualityMetrics && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-green-700">📊 Clustering Quality</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-medium text-green-800">Nodes & Clusters</div>
                    <div className="text-green-700">
                      {clusteringQualityMetrics.totalNodes} nodes in {clusteringQualityMetrics.totalClusters} clusters
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-green-800">Constraint Violations</div>
                    <div className="text-green-700">
                      {clusteringQualityMetrics.constraintViolations} violations
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div>
                    <div className="font-medium text-green-800">Positive Edge Distribution</div>
                    <div className="text-green-700">
                      <div className="flex justify-between text-xs">
                        <span>Within clusters: {clusteringQualityMetrics.positiveWithinCluster}</span>
                        <span>Between clusters: {clusteringQualityMetrics.positiveBetweenClusters}</span>
                      </div>
                      <div className="text-xs text-green-600">
                        {clusteringQualityMetrics.positiveIntraClusterRatio}% positive edges within clusters
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="font-medium text-green-800">Negative Edge Distribution</div>
                    <div className="text-green-700">
                      <div className="flex justify-between text-xs">
                        <span>Within clusters: {clusteringQualityMetrics.negativeWithinCluster}</span>
                        <span>Between clusters: {clusteringQualityMetrics.negativeBetweenClusters}</span>
                      </div>
                      <div className="text-xs text-green-600">
                        {clusteringQualityMetrics.negativeInterClusterRatio}% negative edges between clusters
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Statistics */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Nodes:</span>
                <span className="font-medium">{nodeData.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Relationships:</span>
                <span className="font-medium">{unifiedEdges.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Possible Pairs:</span>
                <span className="font-medium">{(nodeData.length * (nodeData.length - 1)) / 2}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Positive Only:</span>
                <span className="font-medium text-green-600">{unifiedEdges.filter((e) => !e.hasBothTypes && e.positiveFields.length > 0).length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Negative Only:</span>
                <span className="font-medium text-red-600">{unifiedEdges.filter((e) => !e.hasBothTypes && e.negativeFields.length > 0).length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Mixed:</span>
                <span className="font-medium text-gray-600">{unifiedEdges.filter((e) => e.positiveFields.length > 0 && e.negativeFields.length > 0).length}</span>
              </div>
            </CardContent>
          </Card>

          {/* Field Information */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Comparison Fields</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-sm">
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

      {/* Center Panel - Graph Display - Resizable */}
      <div className="flex-1 relative flex flex-col h-full">
                {/* Graph Container */}
        <div 
          key={`graph-container-${selectedDataExample}`} 
          className="relative"
          style={{ 
            height: graphHeight, 
            minHeight: 300,
            maxHeight: '60vh'
          }}
        >
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            className="cursor-crosshair"
            suppressHydrationWarning
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
            {/* Render unified edges that combine positive and negative relationships */}
            {unifiedEdges.map((unifiedEdge, index) => {
              const fromNode = getNodeByRecordId(unifiedEdge.from)
              const toNode = getNodeByRecordId(unifiedEdge.to)

              if (!fromNode || !toNode) return null

              // Create a composite edge that represents the complete relationship
              const compositeEdge: Edge = {
                from: unifiedEdge.from,
                to: unifiedEdge.to,
                type: unifiedEdge.hasBothTypes ? "mixed" : (unifiedEdge.positiveFields.length > 0 ? "positive" : "negative") as "positive" | "negative" | "mixed",
                matchingFields: unifiedEdge.positiveFields,
                nonMatchingFields: unifiedEdge.negativeFields,
                rulesUsed: unifiedEdge.allRulesUsed
              }

              const isHovered = hoveredEdge && (hoveredEdge.from === unifiedEdge.from && hoveredEdge.to === unifiedEdge.to)
              const isSelected = selectedEdge && (selectedEdge.from === unifiedEdge.from && selectedEdge.to === unifiedEdge.to)
              const isConnectedToNode =
                (hoveredNode || selectedNode) &&
                (unifiedEdge.from === (hoveredNode || selectedNode)?.recordId || unifiedEdge.to === (hoveredNode || selectedNode)?.recordId)

              let edgeOpacity = 1
              if (isHovered || isSelected || isConnectedToNode) {
                edgeOpacity = 1
              } else if (selectedEdge) {
                edgeOpacity = 0.1
              } else if (hoveredNode || selectedNode) {
                edgeOpacity = 0.15
              } else {
                edgeOpacity = 0.7
              }

              // Determine edge styling based on actual relationship evaluation
              let strokeColor = "#6b7280" // default gray
              let strokeDasharray = "none"
              let strokeWidth = 2

              // Evaluate the actual relationship based on match rules
              if (unifiedEdge.positiveFields.length > 0 && unifiedEdge.negativeFields.length === 0) {
                // Pure positive relationship - all fields match
                strokeColor = "#10b981" // green
                strokeWidth = 2
              } else if (unifiedEdge.positiveFields.length === 0 && unifiedEdge.negativeFields.length > 0) {
                // Pure negative relationship - all fields differ
                strokeColor = "#ef4444" // red
                strokeDasharray = "5,5"
                strokeWidth = 2
              } else if (unifiedEdge.positiveFields.length > 0 && unifiedEdge.negativeFields.length > 0) {
                // Mixed relationship - some fields match, some differ
                // Use the dominant relationship type
                if (unifiedEdge.positiveFields.length >= unifiedEdge.negativeFields.length) {
                  strokeColor = "#10b981" // green (positive dominant)
                  strokeWidth = 2
                } else {
                  strokeColor = "#ef4444" // red (negative dominant)
                  strokeDasharray = "5,5"
                  strokeWidth = 2
                }
              }

              // Adjust stroke width for hover/selection states
              if (isSelected) strokeWidth = 6
              else if (isHovered || isConnectedToNode) strokeWidth = 4

              const pathData = drawStraightEdgeBetweenNodes(fromNode, toNode, "positive", nodeData, 30, false)

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
                  onMouseEnter={() => handleEdgeHover(compositeEdge)}
                  onMouseLeave={handleMouseLeave}
                  onClick={() => handleEdgeClick(compositeEdge)}
                />
              )
            })}

            {/* Render nodes */}
            {finalNodeData.map((node) => {
              const isHovered = hoveredNode === node
              const isSelected = selectedNode === node

              return (
                <g key={node.recordId}>
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={isHovered || isSelected ? 35 : 30}
                    fill={getNodeColor(node.recordId)}
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
                {/* Data Table Area */}
        <div 
          key={`data-table-${selectedDataExample}`} 
          className="w-full bg-white border-t border-gray-200 overflow-x-auto mt-4"
          style={{ 
            fontSize: '12px',
            height: dataTableHeight,
            minHeight: 150,
            maxHeight: '35vh'
          }}
        >
          {/* Compact Data Example Selector */}
          <div key={`data-selector-${selectedDataExample}`} className="p-2 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-gray-700">Example:</label>
              <select
                value={selectedDataExample}
                onChange={(e) => setSelectedDataExample(Number(e.target.value))}
                className="px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={-1} className="font-semibold text-blue-600">🆕 NEW - Custom Data</option>
                {rawData.map((example, index) => (
                  <option key={index} value={index}>
                    {example.name}
                  </option>
                ))}
              </select>
              <div className="text-xs text-gray-500">
                {currentData.length} records
              </div>
              <button
                onClick={() => {
                  setSelectedNode(null)
                  setSelectedEdge(null)
                  setHoveredNode(null)
                  setHoveredEdge(null)
                }}
                className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded transition-colors"
              >
                Reset
              </button>
            </div>
            <div className="mt-1 text-xs text-gray-600">
              <strong>Current:</strong> {selectedDataExample === -1 ? "NEW - Custom Data" : rawData[selectedDataExample]?.name}
              {selectedDataExample !== -1 && (
                <span className="ml-2">💡 Editable inline</span>
              )}
              {selectedDataExample === 5 && (
                <span className="ml-2 text-yellow-600">⚠️ R2 has email typo for testing</span>
              )}
            </div>
          </div>

          {/* Compact Add Record Buttons */}
          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
            <div className="flex items-center justify-between">
              <span className="text-blue-800">
                💡 <strong>Add rows:</strong> 
                {selectedDataExample === -1 ? " Custom data" : " Expand example"}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={selectedDataExample === -1 ? addFullRecord : addFullRecordToExample}
                  className="px-2 py-0.5 text-xs bg-green-500 hover:bg-green-600 text-white rounded transition-colors"
                  title={selectedDataExample === -1 
                    ? "Add a record with all fields filled with random realistic data"
                    : "Add a record with all fields filled to this example"
                  }
                >
                  +Full
                </button>
                <button
                  onClick={selectedDataExample === -1 ? addPartialRecord : addPartialRecordToExample}
                  className="px-2 py-0.5 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                  title={selectedDataExample === -1 
                    ? "Add a record with some fields randomly filled, others empty"
                    : "Add a record with some fields randomly filled to this example"
                  }
                >
                  +Partial
                </button>
                <button
                  onClick={selectedDataExample === -1 ? addEmptyRecord : addEmptyRecordToExample}
                  className="px-2 py-0.5 text-xs bg-gray-500 hover:bg-gray-600 text-white rounded transition-colors"
                  title={selectedDataExample === -1 
                    ? "Add a completely empty record"
                    : "Add a completely empty record to this example"
                  }
                >
                  +Empty
                </button>
              </div>
            </div>
          </div>
          
          <table className="min-w-full text-[10px] text-left">
            <thead className="bg-gray-100">
              <tr>
                {selectedDataExample === -1 && <th className="px-1 py-0.5 border w-6"></th>}
                <th className="px-1 py-0.5 border text-gray-600" title="Not editable">Record ID</th>
                <th className="px-1 py-0.5 border text-gray-600" title="Not editable">UUID</th>
                <th className="px-1 py-0.5 border text-green-700" title="Editable">Salutation</th>
                <th className="px-1 py-0.5 border text-green-700" title="Editable">First Name</th>
                <th className="px-1 py-0.5 border text-green-700" title="Editable">Last Name</th>
                <th className="px-1 py-0.5 border text-green-700" title="Editable">Email</th>
                <th className="px-1 py-0.5 border text-green-700" title="Editable">Phone</th>
                <th className="px-1 py-0.5 border text-green-700" title="Editable">Party</th>
              </tr>
            </thead>
                                            <tbody>
                    {finalNodeData.map((node, index) => {
                      const isCustomData = selectedDataExample === -1
                      const dynamicRecord = isCustomData ? dynamicRecords[index] : null
                      const editableRecord = selectedDataExample !== -1 ? editableData[index] : null
                      
                      return (
                        <tr
                          key={node.recordId}
                          className="hover:bg-gray-50"
                          onMouseEnter={() => setHoveredNode(node)}
                          onMouseLeave={() => setHoveredNode(null)}
                        >
                          {(isCustomData && dynamicRecords.length > 1) || (!isCustomData && editableData.length > 1) ? (
                            <td className="px-1 py-0.5 border w-6">
                              <button
                                onClick={() => isCustomData ? removeDynamicRecord(index) : removeExampleRecord(index)}
                                className="w-3 h-3 text-red-500 hover:text-red-700 hover:bg-red-50 rounded text-[8px]"
                                title="Remove record"
                              >
                                ×
                              </button>
                            </td>
                          ) : null}
                          <td className="px-1 py-0.5 border font-mono bg-gray-100 text-gray-600">{node.recordId}</td>
                          <td className="px-1 py-0.5 border font-mono bg-gray-100 text-gray-600">{node.uuid || "—"}</td>
                          <td className="px-1 py-0.5 border">
                            {isCustomData ? (
                              <input
                                type="text"
                                value={dynamicRecord?.salutation || ""}
                                onChange={(e) => updateDynamicRecord(index, 'salutation', e.target.value)}
                                className="w-full px-0.5 py-0 text-[10px] border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded truncate"
                                title={dynamicRecord?.salutation || ""}
                              />
                            ) : (
                              <input
                                type="text"
                                value={editableRecord?.salutation || ""}
                                onChange={(e) => updateEditableData(index, 'salutation', e.target.value)}
                                className="w-full px-0.5 py-0 text-[10px] border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded truncate"
                                title={editableRecord?.salutation || ""}
                              />
                            )}
                          </td>
                          <td className="px-1 py-0.5 border">
                            {isCustomData ? (
                              <input
                                type="text"
                                value={dynamicRecord?.firstName || ""}
                                onChange={(e) => updateDynamicRecord(index, 'firstName', e.target.value)}
                                className="w-full px-0.5 py-0 text-[10px] border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded truncate"
                                title={dynamicRecord?.firstName || ""}
                              />
                            ) : (
                              <input
                                type="text"
                                value={editableRecord?.firstName || ""}
                                onChange={(e) => updateEditableData(index, 'firstName', e.target.value)}
                                className="w-full px-0.5 py-0 text-[10px] border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded truncate"
                                title={editableRecord?.firstName || ""}
                              />
                            )}
                          </td>
                          <td className="px-1 py-0.5 border">
                            {isCustomData ? (
                              <input
                                type="text"
                                value={dynamicRecord?.lastName || ""}
                                onChange={(e) => updateDynamicRecord(index, 'lastName', e.target.value)}
                                className="w-full px-0.5 py-0 text-[10px] border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded truncate"
                                title={dynamicRecord?.lastName || ""}
                              />
                            ) : (
                              <input
                                type="text"
                                value={editableRecord?.lastName || ""}
                                onChange={(e) => updateEditableData(index, 'lastName', e.target.value)}
                                className="w-full px-0.5 py-0 text-[10px] border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded truncate"
                                title={editableRecord?.lastName || ""}
                              />
                            )}
                          </td>
                          <td className="px-1 py-0.5 border">
                            {isCustomData ? (
                              <input
                                type="text"
                                value={dynamicRecord?.email || ""}
                                onChange={(e) => updateDynamicRecord(index, 'email', e.target.value)}
                                className="w-full px-0.5 py-0 text-[10px] border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded truncate"
                                title={dynamicRecord?.email || ""}
                              />
                            ) : (
                              <input
                                type="text"
                                value={editableRecord?.email || ""}
                                onChange={(e) => updateEditableData(index, 'email', e.target.value)}
                                className="w-full px-0.5 py-0 text-[10px] border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded truncate"
                                title={editableRecord?.email || ""}
                              />
                            )}
                          </td>
                          <td className="px-1 py-0.5 border">
                            {isCustomData ? (
                              <input
                                type="text"
                                value={dynamicRecord?.phone || ""}
                                onChange={(e) => updateDynamicRecord(index, 'phone', e.target.value)}
                                className="w-full px-0.5 py-0 text-[10px] border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded truncate"
                                title={dynamicRecord?.phone || ""}
                              />
                            ) : (
                              <input
                                type="text"
                                value={editableRecord?.phone || ""}
                                onChange={(e) => updateEditableData(index, 'phone', e.target.value)}
                                className="w-full px-0.5 py-0 text-[10px] border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded truncate"
                                title={editableRecord?.phone || ""}
                              />
                            )}
                          </td>
                          <td className="px-1 py-0.5 border">
                            {isCustomData ? (
                              <input
                                type="text"
                                value={dynamicRecord?.party || ""}
                                onChange={(e) => updateDynamicRecord(index, 'party', e.target.value)}
                                className="w-full px-0.5 py-0 text-[10px] border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
                                title={dynamicRecord?.party || ""}
                              />
                            ) : (
                              <input
                                type="text"
                                value={editableRecord?.party || ""}
                                onChange={(e) => updateEditableData(index, 'party', e.target.value)}
                                className="w-full px-0.5 py-0 text-[10px] border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded truncate"
                                title={editableRecord?.party || ""}
                              />
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
          </table>
        </div>
      </div>

      {/* Right Panel - Match Details - Resizable */}
      <div 
        className="bg-white border-l border-gray-200 p-3 overflow-y-auto relative"
        style={{ width: rightPanelWidth }}
      >
        {/* Resize Handle */}
        <div 
          className="absolute left-0 top-0 bottom-0 w-1 bg-gray-300 hover:bg-blue-400 cursor-ew-resize transition-colors"
          onMouseDown={(e) => {
            e.preventDefault()
            const startX = e.clientX
            const startWidth = rightPanelWidth
            
            const handleMouseMove = (moveEvent: MouseEvent) => {
              const deltaX = startX - moveEvent.clientX
              const newWidth = Math.max(300, Math.min(600, startWidth + deltaX))
              setRightPanelWidth(newWidth)
            }
            
            const handleMouseUp = () => {
              document.removeEventListener('mousemove', handleMouseMove)
              document.removeEventListener('mouseup', handleMouseUp)
            }
            
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
          }}
        />
        <div className="space-y-3">
          {/* Header */}
          <div>
            <h2 className="text-lg font-bold text-gray-800">Match Details</h2>
            <p className="text-gray-500 mt-0.5 text-xs">
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
                    <span className="font-medium text-gray-600">Last Name:</span>
                    <span className="col-span-2">{(selectedNode || hoveredNode)!.lastName || "—"}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="font-medium text-gray-600">Email:</span>
                    <span className="col-span-2 break-all">{(selectedNode || hoveredNode)!.email || "—"}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="font-medium text-gray-600">Phone:</span>
                    <span className="col-span-2">{(selectedNode || hoveredNode)!.phone || "—"}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="font-medium text-gray-600">Party:</span>
                    <span className="col-span-2">{(selectedNode || hoveredNode)!.party || "—"}</span>
                  </div>
                </div>

                {/* Unified Edge Summary Section */}
                <hr className="my-2" />
                <div className="text-xs text-gray-700">
                  <div className="font-semibold mb-1">Unified Edge Summary</div>
                  {(() => {
                    const node = selectedNode || hoveredNode
                    if (!node) return null
                    
                    // Get all edges connected to this node
                    const allEdges = edges.filter(e => e.from === node.recordId || e.to === node.recordId)
                    const getOther = (e: Edge) => e.from === node.recordId ? e.to : e.from
                    
                    // Group edges by target node to create unified relationships
                    const edgeGroups = new Map<string, any>()
                    allEdges.forEach(edge => {
                      const otherNode = getOther(edge)
                      if (!edgeGroups.has(otherNode)) {
                        edgeGroups.set(otherNode, {
                          target: otherNode,
                          positiveRules: [],
                          negativeRules: [],
                          hasBothTypes: false
                        })
                      }
                      const group = edgeGroups.get(otherNode)
                      if (edge.type === "positive") {
                        group.positiveRules.push(...edge.rulesUsed)
                      } else {
                        group.negativeRules.push(...edge.rulesUsed)
                      }
                    })
                    
                    // Determine relationship type for each group
                    edgeGroups.forEach(group => {
                      group.hasBothTypes = group.positiveRules.length > 0 && group.negativeRules.length > 0
                      group.relationshipType = group.hasBothTypes 
                        ? (group.positiveRules.length >= group.negativeRules.length ? 'positive' : 'negative')
                        : (group.positiveRules.length > 0 ? 'positive' : 'negative')
                    })
                    
                    // Helper to render rule paths with proper coloring
                    const renderRulePath = (rulePath: string[], status: string) => (
                      <div className="flex flex-row flex-wrap items-center space-x-1 break-all whitespace-normal w-full">
                        {rulePath.map((rule, i) => {
                          const isLast = i === rulePath.length - 1
                          let className = 'px-1.5 py-0.5 rounded font-semibold text-[9px]'
                          
                          if (status === 'positive') {
                            className += isLast ? ' bg-green-100 text-green-700' : ' bg-gray-100 text-gray-600'
                          } else if (status === 'negative') {
                            className += isLast ? ' bg-red-100 text-red-700' : ' bg-gray-100 text-gray-600'
                          } else {
                            className += ' bg-gray-200 text-gray-500'
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
                      <div className="space-y-2">
                        {Array.from(edgeGroups.values()).map((group, idx) => (
                          <div key={group.target + '-' + idx} className="border-l-2 pl-2" style={{
                            borderLeftColor: group.relationshipType === 'positive' ? '#10b981' : '#ef4444'
                          }}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-xs">{group.target}</span>
                              <span className={`px-2 py-0.5 rounded text-[8px] font-semibold ${
                                group.relationshipType === 'positive' 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-red-100 text-red-700'
                              }`}>
                                {group.relationshipType === 'positive' ? 'POSITIVE' : 'NEGATIVE'}
                              </span>
                              {group.hasBothTypes && (
                                <span className="px-2 py-0.5 rounded text-[8px] font-semibold bg-gray-100 text-gray-600">
                                  MIXED
                                </span>
                              )}
                            </div>
                            
                            {/* Positive Rules */}
                            {group.positiveRules.length > 0 && (
                              <div className="ml-2 mb-1">
                                <span className="text-[8px] text-green-600 font-medium">✓ Matching Rules:</span>
                                {group.positiveRules.map((rulePath: string[], ruleIdx: number) => (
                                  <div key={'pos-' + ruleIdx} className="ml-2 mt-1">
                                    {renderRulePath(rulePath, 'positive')}
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {/* Negative Rules */}
                            {group.negativeRules.length > 0 && (
                              <div className="ml-2">
                                <span className="text-[8px] text-red-600 font-medium">✗ Differing Rules:</span>
                                {group.negativeRules.map((rulePath: string[], ruleIdx: number) => (
                                  <div key={'neg-' + ruleIdx} className="ml-2 mt-1">
                                    {renderRulePath(rulePath, 'negative')}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
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
                    {['salutation', 'firstName', 'lastName', 'email', 'phone', 'party'].map((field) => {
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
            <>
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
                  <p>• Node colors represent different relationship clusters</p>
                </CardContent>
              </Card>

              {/* Enhanced Match Rules Panel */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-gray-700">Match Rules Overview</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2 text-xs">
                    {/* Rule-1: Salutation+First+Last+Email */}
                    <div className="border-l-4 border-blue-500 pl-3">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        <span className="font-semibold text-blue-700">Rule-1: Salutation+First+Last+Email</span>
                      </div>
                      <div className="ml-4 space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                          <span className="text-blue-600 font-medium">Rule-4: First+Last+Email</span>
                        </div>
                        <div className="ml-4 space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-300"></div>
                            <span className="text-blue-500">Rule-5: First+Email</span>
                          </div>
                          <div className="ml-4">
                            <div className="flex items-center gap-2">
                              <div className="w-1 h-1 rounded-full bg-blue-200"></div>
                              <span className="text-blue-400">Rule-7: Email only</span>
                            </div>
                          </div>
                        </div>
                        <div className="ml-4 space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-300"></div>
                            <span className="text-blue-500">Rule-6: Last+Email</span>
                          </div>
                          <div className="ml-4">
                            <div className="flex items-center gap-2">
                              <div className="w-1 h-1 rounded-full bg-blue-200"></div>
                              <span className="text-blue-400">Rule-7: Email only</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Rule-2: Salutation+First+Last+Phone */}
                    <div className="border-l-4 border-green-500 pl-3">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="font-semibold text-green-700">Rule-2: Salutation+First+Last+Phone</span>
                      </div>
                      <div className="ml-4 space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-400"></div>
                          <span className="text-green-600 font-medium">Rule-8: First+Last+Phone</span>
                        </div>
                        <div className="ml-4 space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-300"></div>
                            <span className="text-green-500">Rule-9: First+Phone</span>
                          </div>
                          <div className="ml-4">
                            <div className="flex items-center gap-2">
                              <div className="w-1 h-1 rounded-full bg-green-200"></div>
                              <span className="text-green-400">Rule-11: Phone only</span>
                            </div>
                          </div>
                        </div>
                        <div className="ml-4 space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-300"></div>
                            <span className="text-green-500">Rule-10: Last+Phone</span>
                          </div>
                          <div className="ml-4">
                            <div className="flex items-center gap-2">
                              <div className="w-1 h-1 rounded-full bg-green-200"></div>
                              <span className="text-green-400">Rule-11: Phone only</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Rule-3: Salutation+First+Last+Address */}
                    <div className="border-l-4 border-purple-500 pl-3">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                        <span className="font-semibold text-purple-700">Rule-3: Salutation+First+Last+Address</span>
                      </div>
                      <div className="ml-4 space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-purple-400"></div>
                          <span className="text-purple-600 font-medium">Rule-12: First+Last+Address</span>
                        </div>
                        <div className="ml-4 space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-300"></div>
                            <span className="text-purple-500">Rule-13: First+Address</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Rule-14: Party+Phone-based matching */}
                    <div className="border-l-4 border-orange-500 pl-3">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                        <span className="font-semibold text-orange-700">Rule-14: Party+Phone</span>
                      </div>
                      <div className="ml-4 space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-orange-300"></div>
                          <span className="text-orange-500">Rule-15: Phone only</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  )
}


