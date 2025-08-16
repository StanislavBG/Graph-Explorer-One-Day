"use client"

import React from "react"
import { useState, useMemo, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// Import data directly - Next.js will handle this for static export
import rawData from './data.json';

interface NodeData {
  recordId: string
  clusterId?: number
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
  matchScore: number
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
  status: 'positive' | 'negative' | 'neutral' | 'unknown' | 'partial'
  matchingFields: string[]
  nonMatchingFields: string[]
  missingFields: string[]
  rulesUsed: string[][]
  partialScore?: number // Score between 0 and 1 for partial matches
}

// --- Rule Evaluation (OR logic for all children, returns all paths) ---
function evaluateRuleAll(rule: MatchRule, node1: any, node2: any, path: string[] = []): RuleEvalResult[] {
  // Debug logging for specific node pairs that are known to have empty vs populated data issues
  if ((node1.recordId === 'id-006' && node2.recordId === 'id-007') || 
      (node1.recordId === 'id-007' && node2.recordId === 'id-006')) {
    console.log(`🔍 EVALUATING RULE: ${rule.name} for nodes ${node1.recordId} vs ${node2.recordId}`)
    console.log(`   Node1 data:`, { salutation: node1.salutation, firstName: node1.firstName, lastName: node1.lastName, email: node1.email })
    console.log(`   Node2 data:`, { salutation: node2.salutation, firstName: node2.firstName, lastName: node2.lastName, email: node2.email })
  }
  
  // Check if all fields are present in both nodes (handle null and undefined, but allow empty strings)
  const missing = rule.fields.filter(f => {
    const val1 = node1[f]
    const val2 = node2[f]
    // Field is missing only if it's null or undefined (empty strings are valid for comparison)
    return val1 == null || val2 == null || val1 === undefined || val2 === undefined
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
        nonMatchingFields: [],
        missingFields: missing
      }))
    }
    return [{ 
      status: "unknown", 
      rulesUsed: [[...path, rule.name]],
      matchingFields: [],
      nonMatchingFields: [],
      missingFields: missing
    }]
  }
  
  // All fields present, compare
  const matchingFields = []
  const nonMatchingFields = []
  const neutralFields = [] // Track fields that are neutral (empty vs populated, both empty, etc.)
  
  for (const f of rule.fields) {
    try {
      const val1 = node1[f]
      const val2 = node2[f]
      
      // Simple field comparison logic:
      // 1. Both empty → NEUTRAL
      // 2. Both filled and identical → MATCH (positive)
      // 3. Both filled but different → NO MATCH (negative)
      // 4. One empty, one filled → NEUTRAL
      
      if (val1 === "" && val2 === "") {
        // Both empty → NEUTRAL
        neutralFields.push(f)
        console.log(`🔍 FIELD COMPARISON: ${f} - Both empty: NEUTRAL`)
      } else if (val1 !== "" && val2 !== "" && val1 != null && val2 != null && 
                 val1 !== undefined && val2 !== undefined) {
        // Both filled - compare them exactly
        if (val1 === val2) {
          // Both filled and identical → MATCH (positive)
          matchingFields.push(f)
          console.log(`🔍 FIELD COMPARISON: ${f} - Both filled and identical: MATCH`)
        } else {
          // Both filled but different → NO MATCH (negative)
          nonMatchingFields.push(f)
          console.log(`🔍 FIELD COMPARISON: ${f} - Both filled but different: NO MATCH`)
        }
      } else if (val1 == null && val2 == null) {
        // Both null/undefined → NEUTRAL (missing data)
        neutralFields.push(f)
        console.log(`🔍 FIELD COMPARISON: ${f} - Both null/undefined: NEUTRAL`)
      } else {
        // One empty, one filled → Check if this field should create conflicts
        // For salutation: empty vs filled is NEUTRAL (like id-001 vs id-002)
        // For firstName, lastName: empty vs filled creates a conflict (different people)
        if (f === 'firstName' || f === 'lastName') {
          // These fields represent identity - empty vs filled creates a conflict
          nonMatchingFields.push(f)
          console.log(`🔍 FIELD COMPARISON: ${f} - One empty, one filled: CONFLICT (identity field)`)
        } else {
          // Salutation and other fields - empty vs filled is neutral
          neutralFields.push(f)
          console.log(`🔍 FIELD COMPARISON: ${f} - One empty, one filled: NEUTRAL`)
        }
      }
    } catch (error) {
      console.warn(`Error comparing field ${f}:`, error)
      nonMatchingFields.push(f)
    }
  }
  
  // Check if we have any missing fields (from the original missing check)
  const hasMissingFields = rule.fields.some(f => {
    const val1 = node1[f]
    const val2 = node2[f]
    return val1 == null || val2 == null || val1 === undefined || val2 === undefined
  })
  
  // Debug logging for rule evaluation results
  if (rule.name === "Rule-1" || rule.name === "Rule-2" || rule.name === "Rule-3") {
    console.log(`🔍 RULE EVALUATION: ${rule.name} for nodes comparison:`)
    console.log(`   Fields: ${rule.fields.join(', ')}`)
    console.log(`   Matching: ${matchingFields.join(', ')}`)
    console.log(`   Non-matching: ${nonMatchingFields.join(', ')}`)
    console.log(`   Neutral: ${neutralFields.join(', ')}`)
    console.log(`   Missing: ${missing.join(', ')}`)
    
    // Determine result: only negative if there are actual conflicts (filled vs. filled but different)
    let result = "positive"
    if (nonMatchingFields.length > 0) {
      result = "negative"
    } else if (matchingFields.length === 0 && neutralFields.length > 0) {
      result = "neutral"
    }
    console.log(`   Result: ${result}`)
  }
  
  // Rule evaluation logic:
  // - POSITIVE: has matching fields and no conflicts AND no neutral fields (definitive match)
  // - NEGATIVE: has actual conflicts (filled vs. filled but different)
  // - NEUTRAL: has matching fields but also neutral fields (ambiguous - not enough info)
  
  if (nonMatchingFields.length > 0) {
    // Has actual conflicts → NEGATIVE
    return [{ status: "negative", matchingFields, nonMatchingFields, missingFields: [], rulesUsed: [[...path, rule.name]] }]
  } else if (matchingFields.length > 0 && neutralFields.length === 0) {
    // Has matching fields, no conflicts, and no neutral fields → POSITIVE (definitive match)
    return [{ status: "positive", matchingFields, nonMatchingFields, missingFields: [], rulesUsed: [[...path, rule.name]] }]
  } else if (matchingFields.length > 0 && neutralFields.length > 0) {
    // Has matching fields but also neutral fields → NEUTRAL (ambiguous - not enough info)
    return [{ status: "neutral", matchingFields, nonMatchingFields, missingFields: [], rulesUsed: [[...path, rule.name]] }]
  } else {
    // No matching fields and no conflicts → NEUTRAL
    return [{ status: "neutral", matchingFields, nonMatchingFields, missingFields: [], rulesUsed: [[...path, rule.name]] }]
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
      const [graphHeight, setGraphHeight] = useState(600) // Resizable graph height - increased to prevent clipping
    const [leftPanelWidth, setLeftPanelWidth] = useState(320) // Resizable left panel width
    const [rightPanelWidth, setRightPanelWidth] = useState(320) // Resizable right panel width

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
  const [svgSize, setSvgSize] = useState({ width: 1000, height: 800 }) // Better initial dimensions

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
  }, [graphHeight, leftPanelWidth, rightPanelWidth]) // Update when resizable areas change

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
        party: record["Party"] || "",

      }))
      setEditableData(editableRecords)
    } else {
      setEditableData([])
    }
    
    // Clear edge states when switching examples to prevent data mismatch
    setSelectedEdge(null)
    setHoveredEdge(null)
    setSelectedNode(null)
    setHoveredNode(null)
  }, [selectedDataExample])

  // Calculate center and radius dynamically for the graph area only
  // Use actual container dimensions or fallback to reasonable defaults
  const containerWidth = svgSize.width || 800
  const containerHeight = svgSize.height || 600
  const centerX = containerWidth / 2
  const centerY = containerHeight * 0.4 // Move center higher (40% from top instead of 50%)
  const radius = Math.min(containerWidth, containerHeight) * 0.3 // Reduced to 30% to prevent clipping

  // Get the currently selected data set
  const currentData = useMemo(() => {
    return selectedDataExample === -1 
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
  }, [selectedDataExample, dynamicRecords, editableData, rawData])
  
  // Process the selected data into the format expected by the app
  const nodeData = useMemo(() => {
    if (!currentData || currentData.length === 0) return []
    
    // Create nodes with basic data
    const basicNodes = currentData.map((record: any, index: number) => ({
      recordId: record["Record-Id"] || `record-${index}`,
      salutation: record["Salutation"] || "",
      firstName: record["First Name"] || "",
      lastName: record["Last Name"] || "",
      email: record["Email"] || "",
      phone: record["Phone"] || "",
      party: record["Party"] || "",
      x: 0, // Will be calculated based on clustering
      y: 0, // Will be calculated based on clustering
    }))
    
    // Simple circle positioning for all nodes
    basicNodes.forEach((node, index) => {
      const angle = (index / basicNodes.length) * 2 * Math.PI
      const nodeRadius = Math.min(containerWidth, containerHeight) * 0.25
      node.x = Math.cos(angle) * nodeRadius + centerX
      node.y = Math.sin(angle) * nodeRadius + centerY
    })
    
    return basicNodes
  }, [currentData, centerX, centerY, containerWidth, containerHeight])

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
            let overallStatus: 'positive' | 'negative' | 'neutral' | 'partial' = 'neutral'
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
            const ruleResultsByPrecedence: { ruleName: string; status: 'positive' | 'negative' | 'neutral' | 'partial'; result: RuleEvalResult }[] = []
            
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
                if (highestPrecedenceResult.status === 'positive' || highestPrecedenceResult.status === 'negative' || highestPrecedenceResult.status === 'partial') {
                  ruleResultsByPrecedence.push({
                    ruleName: rule.name,
                    status: highestPrecedenceResult.status,
                    result: highestPrecedenceResult
                  })
                }
              }
            }

            // Calculate Match Score based on rule hierarchy
            let matchScore = 0
            let positiveScore = 0
            let negativeScore = 0
            let uniquePositiveRules = new Set<string>() // Track unique rules, not instances
            
            for (const ruleResult of ruleResultsByPrecedence) {
              const ruleLevel = ruleResult.result.rulesUsed[0].length
              // Use correct scoring weights: L1=1.0, L2=0.75, L3=0.5, L4=0.25, L5=0.1
              let ruleWeight: number
              switch (ruleLevel) {
                case 1: ruleWeight = 1.0; break
                case 2: ruleWeight = 0.75; break
                case 3: ruleWeight = 0.5; break
                case 4: ruleWeight = 0.25; break
                case 5: ruleWeight = 0.1; break
                default: ruleWeight = 0.1; break
              }
              
              if (ruleResult.status === 'positive') {
                positiveScore += ruleWeight
                // Add the rule name to unique rules set (use the first rule in the path)
                const ruleName = ruleResult.result.rulesUsed[0][0]
                uniquePositiveRules.add(ruleName)
              } else if (ruleResult.status === 'negative') {
                negativeScore += ruleWeight
              } else if (ruleResult.status === 'partial') {
                // Partial status: add a fraction of the rule weight based on partialScore
                const partialWeight = ruleWeight * (ruleResult.result.partialScore || 0)
                positiveScore += partialWeight
                // Add the rule name to unique rules set (use the first rule in the path)
                const ruleName = ruleResult.result.rulesUsed[0][0]
                uniquePositiveRules.add(ruleName)
              }
            }
            
            // Apply multiplicative bonus for multiple UNIQUE positive rules
            // 1.1x for 2+ unique rules, 1.2x for 3+ unique rules, 1.3x for 4+ unique rules, etc.
            const uniquePositiveRuleCount = uniquePositiveRules.size
            const multiplier = uniquePositiveRuleCount > 1 ? 1 + (uniquePositiveRuleCount - 1) * 0.1 : 1
            const adjustedPositiveScore = positiveScore * multiplier
            
            // Final match score: adjusted positive - negative (can be negative)
            matchScore = adjustedPositiveScore - negativeScore
            
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
                                    // If no positive results, check for partial results
                                    const hasPartialResult = ruleResultsByPrecedence.some(r => r.status === 'partial')
                                    
                                    if (hasPartialResult) {
                                      overallStatus = 'partial'
                                      // Find the first partial result to get its details
                                      const partialResult = ruleResultsByPrecedence.find(r => r.status === 'partial')
                                      if (partialResult) {
                                        matchingFields = (partialResult.result as any).matchingFields || []
                                        nonMatchingFields = (partialResult.result as any).nonMatchingFields || []
                                        rulesUsed = partialResult.result.rulesUsed || []
                                      }
                                    } else {
                                      // If no partial results, check for negative results
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
                                }
            
            // Create edges whenever there are rule evaluations, even if score is 0
            // This ensures all relationships are visible for exploration
            if (ruleResultsByPrecedence.length > 0) {
              // Determine edge type based on match score and overall status
              let edgeType: "positive" | "negative" | "mixed"
              if (overallStatus === 'partial') {
                edgeType = "mixed"
                console.log(`PARTIAL EDGE: ${node1.recordId} <-> ${node2.recordId} (Score: ${matchScore.toFixed(3)}, Fields: ${matchingFields.join(', ')}, Missing: ${(ruleResultsByPrecedence.find(r => r.status === 'partial')?.result as any)?.missingFields?.join(', ') || 'none'})`)
              } else if (matchScore > 0.001) {
                edgeType = "positive"
                console.log(`POSITIVE EDGE: ${node1.recordId} <-> ${node2.recordId} (Score: ${matchScore.toFixed(3)}, Fields: ${matchingFields.join(', ')})`)
              } else if (matchScore < -0.001) {
                edgeType = "negative"
                console.log(`NEGATIVE EDGE: ${node1.recordId} <-> ${node2.recordId} (Score: ${matchScore.toFixed(3)}, Fields: ${nonMatchingFields.join(', ')})`)
              } else {
                // Score is 0 or very close to 0 - show as neutral edge
                edgeType = "mixed"
                console.log(`NEUTRAL EDGE: ${node1.recordId} <-> ${node2.recordId} (Score: ${matchScore.toFixed(3)}, Fields: ${matchingFields.join(', ')})`)
              }
              
              // Special debug logging for nodes 006 and 007
              if ((node1.recordId === 'id-006' && node2.recordId === 'id-007') || 
                  (node1.recordId === 'id-007' && node2.recordId === 'id-006')) {
                console.log(`🚨 EDGE DEBUG - ${node1.recordId} <-> ${node2.recordId}:`)
                console.log(`   Match Score: ${matchScore.toFixed(3)}`)
                console.log(`   Overall Status: ${overallStatus}`)
                console.log(`   Edge Type: ${edgeType}`)
                console.log(`   Matching Fields: ${matchingFields.join(', ')}`)
                console.log(`   Non-Matching Fields: ${nonMatchingFields.join(', ')}`)
                console.log(`   Rules Used: ${rulesUsed.map(r => r.join(' -> ')).join(' | ')}`)
                console.log(`   POSITIVE SCORE: ${positiveScore.toFixed(3)}`)
                console.log(`   NEGATIVE SCORE: ${negativeScore.toFixed(3)}`)
                console.log(`   MULTIPLIER: ${multiplier.toFixed(3)}`)
              }
              
              edgeMap.set(
                node1.recordId + '-' + node2.recordId,
                {
                  from: node1.recordId,
                  to: node2.recordId,
                  type: edgeType,
                  matchingFields,
                  nonMatchingFields,
                  rulesUsed,
                  matchScore: parseFloat(matchScore.toFixed(3)), // Round to 3 decimal places
                }
              )
              console.log(`EDGE CREATED: ${node1.recordId} <-> ${node2.recordId} | Type: ${edgeType} | Score: ${matchScore.toFixed(3)}`)
              
              // Debug all edges for example 5
              if (selectedDataExample === 4) { // Data Example 5 is at index 4
                console.log(`📊 EDGE SUMMARY: ${node1.recordId} <-> ${node2.recordId}`)
                console.log(`   Score: ${matchScore.toFixed(3)}`)
                console.log(`   Type: ${edgeType}`)
                console.log(`   Matching: ${matchingFields.join(', ')}`)
                console.log(`   Non-Matching: ${nonMatchingFields.join(', ')}`)
              }
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

  // Create unified edges that combine positive and negative relationships
  const unifiedEdges = useMemo(() => {
    const edgeMap = new Map<string, any>()
    
    // Group edges by node pairs and recalculate scores with multiplicative bonus
    edges.forEach((edge) => {
      const key = [edge.from, edge.to].sort().join('-')
      
              if (!edgeMap.has(key)) {
          // Recalculate the actual score with multiplicative bonus for this node pair
          const node1 = nodeData.find(n => n.recordId === edge.from)
          const node2 = nodeData.find(n => n.recordId === edge.to)
          
          let actualScore = 0
          let positiveFields: string[] = []
          let negativeFields: string[] = []
          let allRulesUsed: string[][] = []
          
          if (node1 && node2) {
            // Evaluate all rules to get current score
            let allResults: RuleEvalResult[] = []
            for (const rule of matchRules) {
              allResults = allResults.concat(evaluateRuleAll(rule, node1, node2))
            }
            
            // Calculate current score with multiplicative bonus
            let positiveScore = 0
            let negativeScore = 0
            let uniquePositiveRules = new Set<string>() // Track unique rules, not instances
            
            allResults.forEach(result => {
              if (result.status === 'positive' || result.status === 'negative') {
                const ruleLevel = result.rulesUsed[0].length
                let ruleWeight: number
                switch (ruleLevel) {
                  case 1: ruleWeight = 1.0; break
                  case 2: ruleWeight = 0.75; break
                  case 3: ruleWeight = 0.5; break
                  case 4: ruleWeight = 0.25; break
                  case 5: ruleWeight = 0.1; break
                  default: ruleWeight = 0.1; break
                }
                
                if (result.status === 'positive') {
                  positiveScore += ruleWeight
                  // Add the rule name to unique rules set (use the first rule in the path)
                  const ruleName = result.rulesUsed[0][0]
                  uniquePositiveRules.add(ruleName)
                  positiveFields.push(...result.matchingFields)
                } else {
                  negativeScore += ruleWeight
                  negativeFields.push(...result.nonMatchingFields)
                }
                allRulesUsed.push(...result.rulesUsed)
              }
            })
            
            // Apply multiplicative bonus for multiple UNIQUE positive rules
            const uniquePositiveRuleCount = uniquePositiveRules.size
            const multiplier = uniquePositiveRuleCount > 1 ? 1 + (uniquePositiveRuleCount - 1) * 0.1 : 1
            const adjustedPositiveScore = positiveScore * multiplier
            actualScore = adjustedPositiveScore - negativeScore
          }
          
          edgeMap.set(key, {
            from: edge.from,
            to: edge.to,
            positiveFields: positiveFields,
            negativeFields: negativeFields,
            allRulesUsed: allRulesUsed,
            hasBothTypes: false,
            matchScore: actualScore
          })
        }
    })
    
    // Mark edges that have both positive and negative aspects
    edgeMap.forEach((unified) => {
      unified.hasBothTypes = unified.positiveFields.length > 0 && unified.negativeFields.length > 0
    })
    
    const result = Array.from(edgeMap.values())
    return result
  }, [edges, nodeData, matchRules]) // Depend on edges, nodeData, and matchRules

  // Helper function to check if a node pair has both positive and negative edges
  const hasCounterpartEdge = (fromId: string, toId: string, currentType: "positive" | "negative"): boolean => {
    const oppositeType = currentType === "positive" ? "negative" : "positive"
    return edges.some(
      (edge) =>
        ((edge.from === fromId && edge.to === toId) || (edge.from === toId && edge.to === fromId)) &&
        edge.type === oppositeType,
    )
  }

  // Three-pass clustering algorithm: 
  // Pass 1: Find clusters with highest edge strength
  // Pass 2: Apply negative edge constraints
  // Pass 3: Optimize cluster assignments based on edge strength
  const advancedNodeClusters = useMemo(() => {
    if (nodeData.length === 0) return new Map<string, number>()
    
    console.log(`🚀 STARTING THREE-PASS CLUSTERING for ${nodeData.length} nodes`)
    
    // PASS 1: Create initial clusters based on MAXIMUM edge strength
    // For each node, find the cluster that gives it the highest total positive edge score
    const initialClusters = new Map<string, number>()
    const initialClusterGroups = new Map<number, Set<string>>()
    let initialClusterId = 1
    
    // Start with first node in its own cluster
    initialClusters.set(nodeData[0].recordId, initialClusterId)
    initialClusterGroups.set(initialClusterId, new Set([nodeData[0].recordId]))
    initialClusterId++
    
    // For each remaining node, find the best cluster to join
    for (let i = 1; i < nodeData.length; i++) {
      const nodeId = nodeData[i].recordId
      let bestClusterId = -1
      let bestTotalScore = -Infinity
      
      // Try adding this node to each existing cluster
      for (const [clusterId, clusterNodes] of initialClusterGroups) {
        let totalScore = 0
        
        // Calculate total edge score with all nodes in this cluster
        for (const existingNodeId of clusterNodes) {
          const edge = edges.find(e => 
            ((e.from === nodeId && e.to === existingNodeId) || 
             (e.from === existingNodeId && e.to === nodeId))
          )
          
          if (edge && edge.matchScore > 0.001) {
            totalScore += edge.matchScore
          }
        }
        
        // If this cluster gives a better score, remember it
        if (totalScore > bestTotalScore) {
          bestTotalScore = totalScore
          bestClusterId = clusterId
        }
      }
      
      // If we found a good cluster (positive score), join it
      if (bestTotalScore > 0.001) {
        initialClusters.set(nodeId, bestClusterId)
        initialClusterGroups.get(bestClusterId)!.add(nodeId)
        
        // Debug logging for specific nodes
        if (nodeId === 'id-006' || nodeId === 'id-007') {
          console.log(`🔍 PASS 1 - ${nodeId} joined cluster ${bestClusterId} with score ${bestTotalScore.toFixed(3)}`)
        }
      } else {
        // Create new cluster for this node
        initialClusters.set(nodeId, initialClusterId)
        initialClusterGroups.set(initialClusterId, new Set([nodeId]))
        initialClusterId++
      }
    }
    
    // Debug initial clusters
    console.log(`🔗 PASS 1 COMPLETE - Created ${initialClusterGroups.size} initial clusters`)
    for (const [clusterId, nodes] of initialClusterGroups) {
      if (Array.from(nodes).some(n => ['id-005', 'id-006', 'id-007', 'id-008'].includes(n))) {
        console.log(`   Cluster ${clusterId}: ${Array.from(nodes).join(', ')}`)
      }
    }
    
    // Debug edge scores for Example 5 nodes (check by looking for the specific pattern)
    if (nodeData.some(n => n.recordId === 'id-005') && nodeData.some(n => n.recordId === 'id-006')) {
      console.log(`🔍 EXAMPLE 5 EDGE SCORES:`)
      for (const node1 of ['id-005', 'id-006', 'id-007', 'id-008']) {
        for (const node2 of ['id-005', 'id-006', 'id-007', 'id-008']) {
          if (node1 < node2) {
            const edge = edges.find(e => 
              (e.from === node1 && e.to === node2) || 
              (e.from === node2 && e.to === node1)
            )
            if (edge) {
              console.log(`   ${node1} <-> ${node2}: ${edge.matchScore.toFixed(3)} (${edge.type})`)
            }
          }
        }
      }
    }
    
    // PASS 2: Apply negative edge constraints by splitting clusters
    const intermediateClusters = new Map<string, number>()
    const intermediateClusterGroups = new Map<number, Set<string>>()
    let intermediateClusterId = 1
    
    for (const [clusterId, nodes] of initialClusterGroups) {
      const nodeArray = Array.from(nodes)
      const validSubclusters: Set<string>[] = []
      
      // Start with the first node in its own subcluster
      validSubclusters.push(new Set([nodeArray[0]]))
      
      // Assign remaining nodes to subclusters based on negative edge constraints
      for (let i = 1; i < nodeArray.length; i++) {
        const nodeId = nodeArray[i]
        let bestClusterIndex = -1
        
        // Find the subcluster that doesn't have negative edge constraints
        for (let j = 0; j < validSubclusters.length; j++) {
          const subcluster = validSubclusters[j]
          
          // Check if this node has negative edges to any node in this subcluster
          let totalNegativeScore = 0
          let totalPositiveScore = 0
          
          for (const existingNodeId of subcluster) {
            const edge = edges.find(e => 
              ((e.from === nodeId && e.to === existingNodeId) || 
               (e.from === existingNodeId && e.to === nodeId))
            )
            
            if (edge) {
              if (edge.matchScore < -0.001) {
                totalNegativeScore += Math.abs(edge.matchScore)
              } else if (edge.matchScore > 0.001) {
                totalPositiveScore += edge.matchScore
              }
            }
          }
          
          // Check if this node can be added to this subcluster
          if (totalNegativeScore === 0) {
            // No negative constraints at all - safe to add
            bestClusterIndex = j
            break
          } else if (totalPositiveScore > 0 && totalNegativeScore > 0) {
            // Both positive and negative scores exist - need to evaluate carefully
            // Only allow if positive score is significantly stronger (3x stronger)
            if (totalPositiveScore > totalNegativeScore * 3) {
              bestClusterIndex = j
              break
            }
          }
        }
        
        // Add node to best subcluster or create new one if no good fit
        if (bestClusterIndex >= 0) {
          validSubclusters[bestClusterIndex].add(nodeId)
        } else {
          validSubclusters.push(new Set([nodeId]))
        }
      }
      
      // Assign intermediate cluster IDs to valid subclusters
      for (const subcluster of validSubclusters) {
        for (const nodeId of subcluster) {
          intermediateClusters.set(nodeId, intermediateClusterId)
        }
        intermediateClusterGroups.set(intermediateClusterId, subcluster)
        intermediateClusterId++
      }
    }
    
    console.log(`🔗 PASS 2 COMPLETE - Created ${intermediateClusterGroups.size} intermediate clusters`)
    
    // PASS 3: Optimize cluster assignments based on edge strength
    // Try to merge clusters that have strong positive connections
    const finalClusters = new Map<string, number>()
    const finalClusterGroups = new Map<number, Set<string>>()
    let finalClusterId = 1
    
    // Start with all intermediate clusters
    for (const [clusterId, nodes] of intermediateClusterGroups) {
      finalClusterGroups.set(finalClusterId, new Set(nodes))
      for (const nodeId of nodes) {
        finalClusters.set(nodeId, finalClusterId)
      }
      finalClusterId++
    }
    
    // Try to merge clusters that have strong positive connections
    let merged = true
    while (merged) {
      merged = false
      
      for (const [cluster1Id, cluster1Nodes] of finalClusterGroups) {
        for (const [cluster2Id, cluster2Nodes] of finalClusterGroups) {
          if (cluster1Id >= cluster2Id) continue // Skip same cluster and already processed pairs
          
          // Check if these clusters should be merged based on strong positive connections
          let totalPositiveScore = 0
          let totalNegativeScore = 0
          
          for (const node1Id of cluster1Nodes) {
            for (const node2Id of cluster2Nodes) {
              const edge = edges.find(e => 
                ((e.from === node1Id && e.to === node2Id) || 
                 (e.from === node2Id && e.to === node1Id))
              )
              
              if (edge) {
                if (edge.matchScore > 0.001) {
                  totalPositiveScore += edge.matchScore
                } else if (edge.matchScore < -0.001) {
                  totalNegativeScore += Math.abs(edge.matchScore)
                }
              }
            }
          }
          
          // Merge if positive score is significantly stronger than negative
          if (totalPositiveScore > 0 && totalPositiveScore > totalNegativeScore * 2) {
            console.log(`🔗 PASS 3 - Merging clusters ${cluster1Id} and ${cluster2Id} (pos: ${totalPositiveScore.toFixed(3)}, neg: ${totalNegativeScore.toFixed(3)})`)
            
            // Merge cluster2 into cluster1
            for (const nodeId of cluster2Nodes) {
              finalClusters.set(nodeId, cluster1Id)
              cluster1Nodes.add(nodeId)
            }
            
            // Remove cluster2
            finalClusterGroups.delete(cluster2Id)
            merged = true
            break
          }
        }
        if (merged) break
      }
    }
    
    console.log(`🔗 PASS 3 COMPLETE - Final result: ${finalClusterGroups.size} clusters`)
    for (const [clusterId, nodes] of finalClusterGroups) {
      if (Array.from(nodes).some(n => ['id-005', 'id-006', 'id-007', 'id-008'].includes(n))) {
        console.log(`   Final Cluster ${clusterId}: ${Array.from(nodes).join(', ')}`)
      }
    }
    
    return finalClusters
  }, [nodeData, edges])
  
  // Use the advanced clustering algorithm instead of the basic one
  const nodeClusters = advancedNodeClusters
  

  
  // Debug final clustering results for examples
  if (nodeClusters) {
    console.log(`🏁 FINAL CLUSTERING RESULTS for Example ${selectedDataExample + 1}:`)
    for (const [nodeId, clusterId] of nodeClusters.entries()) {
      console.log(`   ${nodeId} -> Cluster ${clusterId}`)
    }
    
    // Check clustering for specific examples
    if (selectedDataExample === 4) { // Example 5
      // Check if 006 and 007 are in the same cluster
      const cluster006 = nodeClusters.get('id-006')
      const cluster007 = nodeClusters.get('id-007')
      if (cluster006 !== undefined && cluster007 !== undefined) {
        console.log(`🔍 Example 5 - 006 vs 007 Clustering:`)
        console.log(`   id-006: Cluster ${cluster006}`)
        console.log(`   id-007: Cluster ${cluster007}`)
        console.log(`   Same Cluster: ${cluster006 === cluster007}`)
      }
    } else if (selectedDataExample === 0) { // Example 1
      // Check if 007 and 008 are in the same cluster
      const cluster007 = nodeClusters.get('id-007')
      const cluster008 = nodeClusters.get('id-008')
      if (cluster007 !== undefined && cluster008 !== undefined) {
        console.log(`🔍 Example 1 - 007 vs 008 Clustering:`)
        console.log(`   id-007: Cluster ${cluster007}`)
        console.log(`   id-008: Cluster ${cluster008}`)
        console.log(`   Same Cluster: ${cluster007 === cluster008}`)
        
        // Also check the edge between them
        const edge = edges.find(e => 
          (e.from === 'id-007' && e.to === 'id-008') || 
          (e.from === 'id-008' && e.to === 'id-007')
        )
        if (edge) {
          console.log(`🔍 Example 1 - Edge 007-008:`)
          console.log(`   Type: ${edge.type}`)
          console.log(`   Score: ${edge.matchScore}`)
          console.log(`   Non-matching fields: ${edge.nonMatchingFields.join(', ')}`)
        }
      }
    }
  }
  
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
  
  // Create final node data with computed cluster assignments
  const finalNodeData = useMemo(() => {
    if (!clusteringResult.assignments || nodeData.length === 0) return nodeData
    
    return nodeData.map(node => {
      const clusterId = clusteringResult.assignments.get(node.recordId)
      return {
        ...node,
        clusterId: clusterId !== undefined ? clusterId : -1
      }
    })
  }, [nodeData, clusteringResult.assignments])

  // Get unique cluster IDs for display purposes
  const uniqueClusterIds = useMemo(() => {
    return Array.from(new Set(finalNodeData.map((node) => node.clusterId).filter(id => id !== -1)))
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
    <div className="w-full h-screen bg-gray-50 flex">
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
                <p className="mb-2">
                  <strong>Highest Edge Score Assignment:</strong> Nodes are assigned to clusters based on 
                  their highest individual edge score to any node in that cluster, using the final calculated 
                  match scores from the existing edge calculations. Ties are broken by selecting the cluster 
                  containing the node with the lowest alphanumeric ID.
                </p>
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
          className="relative flex-1"
          style={{ 
            minHeight: 400,
            maxHeight: '70vh'
          }}
        >
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            className="cursor-crosshair w-full h-full"
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

              if (!fromNode || !toNode) {
                console.log(`Missing node for edge: ${unifiedEdge.from} -> ${unifiedEdge.to}`)
                return null
              }



              // Edge rendering - purely visual, no evaluation logic interference

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
              

              const isConnectedToNode =
                (hoveredNode || selectedNode) &&
                (unifiedEdge.from === (hoveredNode || selectedNode)?.recordId || unifiedEdge.to === (hoveredNode || selectedNode)?.recordId)

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
              let strokeWidth = 4 // Increased from 2 to make edges easier to click

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
              if (isSelected) strokeWidth = 6
              else if (isHovered) strokeWidth = 5
              else strokeWidth = 4

              // Pass the actual stroke width to collision detection for more accurate results
              const effectiveNodeRadius = isSelected ? Math.max(30, strokeWidth + 5) : 30
              const pathData = drawStraightEdgeBetweenNodes(fromNode, toNode, renderEdgeType, nodeData, effectiveNodeRadius, false)

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
          className="w-full bg-white border-t border-gray-200 overflow-x-auto mt-4 pb-4"
          style={{ 
            fontSize: '12px'
          }}
        >
          {/* Compact Data Example Selector */}
          <div key={`data-selector-${selectedDataExample}`} className="p-1.5 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-gray-700">Example:</label>
              <select
                value={selectedDataExample}
                onChange={(e) => {
                  const newExample = Number(e.target.value)
                  setSelectedDataExample(newExample)
                  // Clear edge states when switching examples to prevent data mismatch
                  setSelectedEdge(null)
                  setHoveredEdge(null)
                  setSelectedNode(null)
                  setHoveredNode(null)
                }}
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

            </div>
          </div>

          {/* Compact Add Record Buttons */}
          <div className="mt-1 p-1.5 bg-blue-50 border border-blue-200 rounded text-xs">
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
          
                                      {/* Edge Highlighting Indicator */}
                            {(hoveredEdge || selectedEdge) && (
                              <div className="px-2 py-1 bg-blue-50 border-b border-blue-200 text-xs text-blue-700 mb-2 rounded-t">
                                🔗 Highlighting nodes connected by edge: <strong>{(hoveredEdge || selectedEdge)!.from} ↔ {(hoveredEdge || selectedEdge)!.to}</strong>
                                {hoveredEdge && <span className="text-blue-500"> (Hovered)</span>}
                                {selectedEdge && <span className="text-blue-500"> (Selected)</span>}
                              </div>
                            )}
                            <table className="min-w-full text-[10px] text-left">
                              <thead className="bg-gray-100">
              <tr>
                <th className="px-1 py-0.5 border w-6" title="Actions"></th>
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
                          className={`hover:bg-gray-50 transition-all duration-200 ${
                            (hoveredEdge && (hoveredEdge.from === node.recordId || hoveredEdge.to === node.recordId)) ||
                            (selectedEdge && (selectedEdge.from === node.recordId || selectedEdge.to === node.recordId))
                              ? 'bg-blue-100 border-l-4 border-l-blue-500 shadow-sm'
                              : ''
                          }`}
                          onMouseEnter={() => setHoveredNode(node)}
                          onMouseLeave={() => setHoveredNode(null)}
                        >
                          <td className="px-1 py-0.5 border w-6">
                            {((isCustomData && dynamicRecords.length > 1) || (!isCustomData && editableData.length > 1)) ? (
                              <button
                                onClick={() => isCustomData ? removeDynamicRecord(index) : removeExampleRecord(index)}
                                className="w-3 h-3 text-red-500 hover:text-red-700 hover:bg-red-50 rounded text-[8px]"
                                title="Remove record"
                              >
                                ×
                              </button>
                            ) : null}
                            </td>
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
                {/* Match Score Display */}
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-blue-800">Match Score:</span>
                    {(() => {
                      const edge = selectedEdge || hoveredEdge
                      if (!edge) return <span className="text-sm font-bold px-2 py-1 rounded bg-gray-100 text-gray-600">0.000</span>
                      
                      // Re-evaluate to get the current score with multiplicative bonus
                      const node1 = getNodeByRecordId(edge.from)
                      const node2 = getNodeByRecordId(edge.to)
                      if (!node1 || !node2) return <span className="text-sm font-bold px-2 py-1 rounded bg-gray-100 text-gray-600">0.000</span>
                      
                      let allResults: RuleEvalResult[] = []
                      for (const rule of matchRules) {
                        allResults = allResults.concat(evaluateRuleAll(rule, node1, node2))
                      }
                      
                      // Calculate current score with multiplicative bonus
                      let positiveScore = 0
                      let negativeScore = 0
                      let positiveRuleCount = 0
                      
                      allResults.forEach(result => {
                        if (result.status === 'positive' || result.status === 'negative') {
                          const ruleLevel = result.rulesUsed[0].length
                          let ruleWeight: number
                          switch (ruleLevel) {
                            case 1: ruleWeight = 1.0; break
                            case 2: ruleWeight = 0.75; break
                            case 3: ruleWeight = 0.5; break
                            case 4: ruleWeight = 0.25; break
                            case 5: ruleWeight = 0.1; break
                            default: ruleWeight = 0.1; break
                          }
                          
                          if (result.status === 'positive') {
                            positiveScore += ruleWeight
                            positiveRuleCount++
                          } else {
                            negativeScore += ruleWeight
                          }
                        }
                      })
                      
                      const multiplier = positiveRuleCount > 1 ? 1 + (positiveRuleCount - 1) * 0.1 : 1
                      const adjustedPositiveScore = positiveScore * multiplier
                      const currentScore = adjustedPositiveScore - negativeScore
                      
                      const isPositive = currentScore > 0
                      const isNegative = currentScore < 0
                      const bgClass = isPositive ? 'bg-green-100 text-green-700' : isNegative ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                      
                      return (
                        <span className={`text-sm font-bold px-2 py-1 rounded ${bgClass}`}>
                          {currentScore.toFixed(3)}
                        </span>
                      )
                    })()}
                  </div>
                  <div className="text-xs text-blue-600 mt-1">
                    <strong>Formula:</strong> L1 rules × 1.0 + L2 rules × 0.75 + L3 rules × 0.5 + L4 rules × 0.25 + L5 rules × 0.1
                  </div>
                  <div className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                    <span className="font-bold">(!)</span>
                    <span><strong>Multiplicative Bonus:</strong> Multiple positive rules get 10% bonus per additional rule (1.1x for 2 rules, 1.2x for 3 rules, etc.)</span>
                  </div>
                </div>
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
                    
                    // Calculate detailed scoring for display
                    let positiveScore = 0
                    let negativeScore = 0
                    let positiveRuleCount = 0
                    let positiveRules: Array<{rule: string, level: number, weight: number}> = []
                    let negativeRules: Array<{rule: string, level: number, weight: number}> = []
                    
                    allResults.forEach(result => {
                      if (result.status === 'positive' || result.status === 'negative') {
                        const ruleLevel = result.rulesUsed[0].length
                        let ruleWeight: number
                        switch (ruleLevel) {
                          case 1: ruleWeight = 1.0; break
                          case 2: ruleWeight = 0.75; break
                          case 3: ruleWeight = 0.5; break
                          case 4: ruleWeight = 0.25; break
                          case 5: ruleWeight = 0.1; break
                          default: ruleWeight = 0.1; break
                        }
                        
                        if (result.status === 'positive') {
                          positiveScore += ruleWeight
                          positiveRuleCount++
                          positiveRules.push({
                            rule: result.rulesUsed[0].join(' → '),
                            level: ruleLevel,
                            weight: ruleWeight
                          })
                        } else {
                          negativeScore += ruleWeight
                          negativeRules.push({
                            rule: result.rulesUsed[0].join(' → '),
                            level: ruleLevel,
                            weight: ruleWeight
                          })
                        }
                      }
                    })
                    
                    const multiplier = positiveRuleCount > 1 ? 1 + (positiveRuleCount - 1) * 0.1 : 1
                    const adjustedPositiveScore = positiveScore * multiplier
                    const finalScore = adjustedPositiveScore - negativeScore
                    
                    return (
                      <>
                        {/* Scoring Breakdown */}
                        <div className="mb-2 p-2 bg-gray-50 border border-gray-200 rounded">
                          <div className="text-xs font-semibold text-gray-700 mb-1">Scoring Breakdown:</div>
                          
                          {/* Positive Rules */}
                          {positiveRules.length > 0 && (
                            <div className="mb-1">
                              <div className="text-xs text-green-700 font-medium">Positive Rules:</div>
                              {positiveRules.map((rule, idx) => (
                                <div key={idx} className="text-xs text-green-600 ml-2">
                                  {rule.rule}: L{rule.level} × {rule.weight} = {rule.weight.toFixed(2)}
                                </div>
                              ))}
                              <div className="text-xs text-green-700 font-medium ml-2">
                                Subtotal: {positiveScore.toFixed(3)}
                              </div>
                            </div>
                          )}
                          
                          {/* Multiplicative Bonus */}
                          {positiveRuleCount > 1 && (
                            <div className="mb-1">
                              <div className="text-xs text-orange-700 font-medium">Multiplicative Bonus:</div>
                              <div className="text-xs text-orange-600 ml-2">
                                {positiveRuleCount} rules × 10% bonus = {(multiplier - 1) * 100}% → {multiplier.toFixed(1)}x
                              </div>
                              <div className="text-xs text-orange-700 font-medium ml-2">
                                Adjusted: {positiveScore.toFixed(3)} × {multiplier.toFixed(1)} = {adjustedPositiveScore.toFixed(3)}
                              </div>
                            </div>
                          )}
                          
                          {/* Negative Rules */}
                          {negativeRules.length > 0 && (
                            <div className="mb-1">
                              <div className="text-xs text-red-700 font-medium">Negative Rules:</div>
                              {negativeRules.map((rule, idx) => (
                                <div key={idx} className="text-xs text-red-600 ml-2">
                                  {rule.rule}: L{rule.level} × {rule.weight} = {rule.weight.toFixed(2)}
                                </div>
                              ))}
                              <div className="text-xs text-red-700 font-medium ml-2">
                                Subtotal: {negativeScore.toFixed(3)}
                              </div>
                            </div>
                          )}
                          
                          {/* Final Calculation */}
                          <div className="text-xs font-semibold text-gray-700 mt-1 pt-1 border-t border-gray-300">
                            Final Score: {adjustedPositiveScore.toFixed(3)} - {negativeScore.toFixed(3)} = {finalScore.toFixed(3)}
                          </div>
                        </div>
                        
                        {/* Rule Paths */}
                        <div className="text-xs font-semibold text-gray-700 mb-1">Rule Paths:</div>
                        {allResults.map((result, idx) => (
                          <div key={result.rulesUsed[0].join('-') + '-' + idx} className="flex flex-row items-center space-x-1">
                            {result.rulesUsed[0].map((rule: string, i: number) => {
                              // Consistent path styling: all segments gray for unknown, else only last colored
                              const isLast = i === result.rulesUsed[0].length - 1
                              let className = 'px-1.5 py-0.5 rounded font-semibold'
                              if (result.status === 'unknown') {
                                className += ' bg-gray-200 text-gray-500'
                              } else if (isLast) {
                                if (result.status === 'positive') {
                                  className += ' bg-green-100 text-green-700'
                                } else if (result.status === 'negative') {
                                  className += ' bg-red-100 text-red-700'
                                } else if (result.status === 'partial') {
                                  className += ' bg-yellow-100 text-yellow-700'
                                } else {
                                  className += ' bg-gray-100 text-gray-600'
                                }
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
                        ))}
                      </>
                    )
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
                              <span className="text-blue-400">Rule-7: Email</span>
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
                              <span className="text-blue-400">Rule-7: Email</span>
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
                              <span className="text-green-400">Rule-11: Phone</span>
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
                              <span className="text-green-400">Rule-11: Phone</span>
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
                          <span className="text-orange-500">Rule-15: Phone</span>
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


