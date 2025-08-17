"use client"

import React from "react"
import { useState, useMemo, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import rawData from '../data.json'

// Import our refactored components and hooks
import { GraphVisualization } from '@/components/graph/GraphVisualization'
import { useProcessedGraphData } from '@/hooks/useProcessedGraphData'
import { GraphRenderConfig } from '@/types/graph'
import { DataRecord, DataExample } from '@/types/common'
import { matchRules } from '@/components/match-score/MatchRules'

// Recursive component to render all match rules and their children
function RenderMatchRules({ rules, level = 0 }: { rules: typeof matchRules; level?: number }) {
  return (
    <div className="space-y-1">
      {rules.map((rule) => (
        <div key={rule.name} className="group">
          {/* Rule Header */}
          <div 
            className={`flex items-center gap-2 p-1 rounded text-sm ${
              level === 0 
                ? 'bg-blue-50 text-blue-700 font-medium' 
                : level === 1 
                ? 'bg-indigo-50 text-indigo-600'
                : level === 2 
                ? 'bg-purple-50 text-purple-600'
                : level === 3 
                ? 'bg-pink-50 text-pink-600'
                : 'bg-gray-50 text-gray-600'
            }`}
            style={{ marginLeft: level * 16 }}
          >
            {/* Rule Fields */}
            <span className="text-xs">
              {rule.name}: {rule.fields.join(' + ')}
            </span>
          </div>
          
          {/* Children Rules */}
          {rule.children && rule.children.length > 0 && (
            <div className="ml-2">
              <RenderMatchRules rules={rule.children} level={level + 1} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function GraphExplorerRefactored() {
  const [hoveredNode, setHoveredNode] = useState<any>(null)
  const [hoveredEdge, setHoveredEdge] = useState<any>(null)
  const [selectedNode, setSelectedNode] = useState<any>(null)
  const [selectedEdge, setSelectedEdge] = useState<any>(null)
  const [selectedDataExample, setSelectedDataExample] = useState(0)
  const [graphHeight, setGraphHeight] = useState(600)
  const [leftPanelWidth, setLeftPanelWidth] = useState(320)
  const [rightPanelWidth, setRightPanelWidth] = useState(320)
  const [isClient, setIsClient] = useState(false)

  // Dynamic data creation state
  const [showDynamicForm, setShowDynamicForm] = useState(false)
  const [dynamicRecords, setDynamicRecords] = useState<Array<DataRecord>>([
    { "Record-Id": "id-001", "Salutation": "Mr.", "First Name": "John", "Last Name": "Smith", "Email": "john.smith@email.com", "Phone": "(555) 123-4567", "Party": "Party-001" },
    { "Record-Id": "id-002", "Salutation": "Ms.", "First Name": "Sarah", "Last Name": "Johnson", "Email": "sarah.j@email.com", "Phone": "(555) 987-6543", "Party": "Party-002" }
  ])

  // Editable data state for all examples
  const [editableData, setEditableData] = useState<Array<DataRecord>>([])

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

  // Row addition functions
  const addEmptyRecord = () => {
    const newId = `id-${String(dynamicRecords.length + 1).padStart(3, '0')}`
    setDynamicRecords([...dynamicRecords, {
      "Record-Id": newId,
      "Salutation": "",
      "First Name": "",
      "Last Name": "",
      "Email": "",
      "Phone": "",
      "Party": ""
    }])
  }

  const addFullRecord = () => {
    const newId = `id-${String(dynamicRecords.length + 1).padStart(3, '0')}`
    const firstName = generateRandomFirstName()
    const lastName = generateRandomLastName()
    
    // Try to reuse some existing data to create denser connections
    const existingRecords = dynamicRecords.filter(r => r["Salutation"] || r["First Name"] || r["Last Name"] || r["Email"] || r["Phone"] || r["Party"])
    let reusedFields: any = {}
    
    if (existingRecords.length > 0) {
      const randomExisting = existingRecords[Math.floor(Math.random() * existingRecords.length)]
      
      // 50% chance to reuse salutation
      if (Math.random() < 0.5 && randomExisting["Salutation"]) {
        reusedFields.salutation = randomExisting["Salutation"]
      } else {
        reusedFields.salutation = generateRandomSalutation()
      }
      
      // 60% chance to reuse party (creates good clustering)
      if (Math.random() < 0.6 && randomExisting["Party"]) {
        reusedFields.party = randomExisting["Party"]
      } else {
        reusedFields.party = generateRandomParty()
      }
      
      // 40% chance to reuse phone (creates phone-based connections)
      if (Math.random() < 0.4 && randomExisting["Phone"]) {
        reusedFields.phone = randomExisting["Phone"]
      } else {
        reusedFields.phone = generateRandomPhone()
      }
    } else {
      reusedFields.salutation = generateRandomSalutation()
      reusedFields.party = generateRandomParty()
      reusedFields.phone = generateRandomPhone()
    }
    
    setDynamicRecords([...dynamicRecords, {
      "Record-Id": newId,
      "Salutation": reusedFields.salutation,
      "First Name": firstName,
      "Last Name": lastName,
      "Email": generateRandomEmail(firstName, lastName),
      "Phone": reusedFields.phone,
      "Party": reusedFields.party
    }])
  }

  const addPartialRecord = () => {
    const newId = `id-${String(dynamicRecords.length + 1).padStart(3, '0')}`
    const firstName = generateRandomFirstName()
    const lastName = generateRandomLastName()
    
    // Try to reuse some existing data to create denser connections
    const existingRecords = dynamicRecords.filter(r => r["Salutation"] || r["First Name"] || r["Last Name"] || r["Email"] || r["Phone"] || r["Party"])
    let reusedFields: any = {}
    
    if (existingRecords.length > 0) {
      const randomExisting = existingRecords[Math.floor(Math.random() * existingRecords.length)]
      
      // Higher chance to reuse party and phone for better clustering
      if (randomExisting["Party"] && Math.random() < 0.7) {
        reusedFields.party = randomExisting["Party"]
      }
      if (randomExisting["Phone"] && Math.random() < 0.6) {
        reusedFields.phone = randomExisting["Phone"]
      }
      if (randomExisting["Salutation"] && Math.random() < 0.5) {
        reusedFields.salutation = randomExisting["Salutation"]
      }
    }
    
    // Randomly fill some fields, leave others empty
    const fields = ['salutation', 'firstName', 'lastName', 'email', 'phone', 'party']
    const numFieldsToFill = Math.floor(Math.random() * 4) + 2 // Fill 2-5 fields
    
    const record: any = { "Record-Id": newId }
    fields.forEach(field => {
      if (Math.random() < numFieldsToFill / fields.length) {
        switch(field) {
          case 'salutation':
            record["Salutation"] = reusedFields.salutation || generateRandomSalutation()
            break
          case 'firstName':
            record["First Name"] = firstName
            break
          case 'lastName':
            record["Last Name"] = lastName
            break
          case 'email':
            record["Email"] = generateRandomEmail(firstName, lastName)
            break
          case 'phone':
            record["Phone"] = reusedFields.phone || generateRandomPhone()
            break
          case 'party':
            record["Party"] = reusedFields.party || generateRandomParty()
            break
        }
      } else {
        record[field === 'salutation' ? "Salutation" : 
               field === 'firstName' ? "First Name" : 
               field === 'lastName' ? "Last Name" : 
               field === 'email' ? "Email" : 
               field === 'phone' ? "Phone" : "Party"] = ""
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
    const existingRecords = editableData.filter(r => r["Salutation"] || r["First Name"] || r["Last Name"] || r["Email"] || r["Phone"] || r["Party"])
    let reusedFields: any = {}
    
    if (existingRecords.length > 0) {
      const randomExisting = existingRecords[Math.floor(Math.random() * existingRecords.length)]
      
      // 50% chance to reuse salutation
      if (Math.random() < 0.5 && randomExisting["Salutation"]) {
        reusedFields.salutation = randomExisting["Salutation"]
      } else {
        reusedFields.salutation = generateRandomSalutation()
      }
      
      // 60% chance to reuse party (creates good clustering)
      if (Math.random() < 0.6 && randomExisting["Party"]) {
        reusedFields.party = randomExisting["Party"]
      } else {
        reusedFields.party = generateRandomParty()
      }
      
      // 40% chance to reuse phone (creates phone-based connections)
      if (Math.random() < 0.4 && randomExisting["Phone"]) {
        reusedFields.phone = randomExisting["Phone"]
      } else {
        reusedFields.phone = generateRandomPhone()
      }
    } else {
      reusedFields.salutation = generateRandomSalutation()
      reusedFields.party = generateRandomParty()
      reusedFields.phone = generateRandomPhone()
    }
    
    const newRecord = {
      "Record-Id": newId,
      "Salutation": reusedFields.salutation,
      "First Name": firstName,
      "Last Name": lastName,
      "Email": generateRandomEmail(firstName, lastName),
      "Phone": reusedFields.phone,
      "Party": reusedFields.party
    }
    
    setEditableData([...editableData, newRecord])
  }

  const addPartialRecordToExample = () => {
    const newId = `R${String(editableData.length + 1)}`
    const firstName = generateRandomFirstName()
    const lastName = generateRandomLastName()
    
    // Try to reuse some existing data from the example to create denser connections
    const existingRecords = editableData.filter(r => r["Salutation"] || r["First Name"] || r["Last Name"] || r["Email"] || r["Phone"] || r["Party"])
    let reusedFields: any = {}
    
    if (existingRecords.length > 0) {
      const randomExisting = existingRecords[Math.floor(Math.random() * existingRecords.length)]
      
      // Higher chance to reuse party and phone for better clustering
      if (randomExisting["Party"] && Math.random() < 0.7) {
        reusedFields.party = randomExisting["Party"]
      }
      if (randomExisting["Phone"] && Math.random() < 0.6) {
        reusedFields.phone = randomExisting["Phone"]
      }
      if (randomExisting["Salutation"] && Math.random() < 0.5) {
        reusedFields.salutation = randomExisting["Salutation"]
      }
    }
    
    // Randomly fill some fields, leave others empty
    const fields = ['salutation', 'firstName', 'lastName', 'email', 'phone', 'party']
    const numFieldsToFill = Math.floor(Math.random() * 4) + 2 // Fill 2-5 fields
    
    const record: any = { "Record-Id": newId }
    fields.forEach(field => {
      if (Math.random() < numFieldsToFill / fields.length) {
        switch(field) {
          case 'salutation':
            record["Salutation"] = reusedFields.salutation || generateRandomSalutation()
            break
          case 'firstName':
            record["First Name"] = firstName
            break
          case 'lastName':
            record["Last Name"] = lastName
            break
          case 'email':
            record["Email"] = reusedFields.phone || generateRandomEmail(firstName, lastName)
            break
          case 'phone':
            record["Phone"] = reusedFields.phone || generateRandomPhone()
            break
          case 'party':
            record["Party"] = reusedFields.party || generateRandomParty()
            break
        }
      } else {
        record[field === 'salutation' ? "Salutation" : 
               field === 'firstName' ? "First Name" : 
               field === 'lastName' ? "Last Name" : 
               field === 'email' ? "Email" : 
               field === 'phone' ? "Phone" : "Party"] = ""
      }
    })
    
    setEditableData([...editableData, record])
  }

  const addEmptyRecordToExample = () => {
    const newId = `R${String(editableData.length + 1)}`
    setEditableData([...editableData, {
      "Record-Id": newId,
      "Salutation": "",
      "First Name": "",
      "Last Name": "",
      "Email": "",
      "Phone": "",
      "Party": ""
    }])
  }

  useEffect(() => {
    setIsClient(true)
  }, [])

  // Initialize editable data when example is selected
  useEffect(() => {
    if (selectedDataExample !== -1 && rawData[selectedDataExample]) {
      const exampleData = rawData[selectedDataExample].data
      const editableRecords = exampleData.map((record: any) => ({
        "Record-Id": record["Record-Id"] || "",
        "Salutation": record["Salutation"] || "",
        "First Name": record["First Name"] || "",
        "Last Name": record["Last Name"] || "",
        "Email": record["Email"] || "",
        "Phone": record["Phone"] || "",
        "Party": record["Party"] || "",
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
  }, [selectedDataExample, rawData])

  // Initialize with first example data on component mount
  useEffect(() => {
    if (selectedDataExample === 0 && rawData[0] && editableData.length === 0) {
      const exampleData = rawData[0].data
      const editableRecords = exampleData.map((record: any) => ({
        "Record-Id": record["Record-Id"] || "",
        "Salutation": record["Salutation"] || "",
        "First Name": record["First Name"] || "",
        "Last Name": record["Last Name"] || "",
        "Email": record["Email"] || "",
        "Phone": record["Phone"] || "",
        "Party": record["Party"] || "",
      }))
      setEditableData(editableRecords)
    }
  }, [selectedDataExample, rawData, editableData.length])

  // Get the currently selected data set
  const currentData = useMemo(() => {
    if (selectedDataExample === -1) {
      return dynamicRecords
    } else {
      // If an example is selected, use editableData if it has content, otherwise fall back to raw data
      if (editableData.length > 0) {
        return editableData
      } else if (rawData[selectedDataExample]?.data) {
        return rawData[selectedDataExample].data
      } else {
        return []
      }
    }
  }, [selectedDataExample, dynamicRecords, editableData, rawData])

  // Use our unified hook that manages the complete data flow
  const { 
    nodes: finalNodeData, 
    edges, 
    unifiedEdges, 
    layout,
    clusteringResult,
    uniqueClusterIds,
    getNodeColor,
    nodeClusters,
    detectConstraintViolations
  } = useProcessedGraphData(
    currentData, 
    selectedDataExample, 
    graphHeight, 
    leftPanelWidth, 
    rightPanelWidth
  )

  // Helper function to get node data by record ID
  const getNodeByRecordId = (recordId: string) => {
    return finalNodeData.find(node => node.recordId === recordId)
  }

  // Helper function to format node name
  const formatName = (node: any) => {
    const parts = [node.salutation, node.firstName, node.lastName].filter(Boolean)
    return parts.length > 0 ? parts.join(" ") : "No name"
  }

  // Graph render configuration
  const graphConfig: GraphRenderConfig = {
    nodeRadius: 30,
            edgeStrokeWidth: 3, // Reduced from 6 to 3 for thinner default edges
    hoverScale: 1.17,
    selectionScale: 1.17,
    animationDuration: 200
  }

  // Event handlers
  const handleNodeHover = (node: any) => {
    setHoveredNode(node)
    // Don't clear hoveredEdge - let edges maintain their hover state
    // This allows edges to show hover effects when connected to hovered nodes
    // Both node hover and edge hover can work simultaneously for better UX
  }

  const handleNodeClick = (node: any) => {
    setSelectedNode(node)
    setSelectedEdge(null)
  }

  const handleEdgeHover = (edge: any) => {
    setHoveredEdge(edge)
    // Don't clear hoveredNode - let nodes maintain their hover state
    // This allows both node and edge hover effects to work together
    // Users can hover over nodes to see connected edges, then hover over edges for details
  }

  const handleEdgeClick = (edge: any) => {
    // Set the selected edge
    setSelectedEdge(edge)
    
    // Clear selected node
    setSelectedNode(null)
  }

  const handleMouseLeave = () => {
    setHoveredNode(null)
    setHoveredEdge(null)
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
      {/* Left Panel - Legend and Controls */}
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
            <h1 className="text-xl font-bold text-gray-800">Graph Explorer (Refactored)</h1>
            <p className="text-gray-600 mt-0.5 text-sm">Clean Architecture - Separated Concerns</p>
          </div>

          {/* Match Rules Hierarchy - Always Visible */}
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-1">
              <div className="bg-white rounded border border-blue-200">
                <RenderMatchRules rules={matchRules} />
              </div>
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Nodes:</span>
                <span className="font-medium">{finalNodeData.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Edges:</span>
                <span className="font-medium">{unifiedEdges.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Clusters:</span>
                <span className="font-medium">{uniqueClusterIds.length}</span>
              </div>
            </CardContent>
          </Card>

          {/* Clustering Results */}
          <Card className="border-green-200 bg-green-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-green-700">🎯 Clustering Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-center">
                  <div className="font-bold text-lg text-green-600">{uniqueClusterIds.length}</div>
                  <div className="text-green-700">Clusters</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg text-green-600">{finalNodeData.length}</div>
                  <div className="text-green-700">Nodes</div>
                </div>
              </div>
              
              <div className="text-xs text-green-600">
                <div className="font-medium mb-1">Cluster Distribution:</div>
                <div className="space-y-1">
                  {(() => {
                    const clusterCounts: Record<number, number> = {}
                    finalNodeData.forEach((node) => {
                      clusterCounts[node.clusterId] = (clusterCounts[node.clusterId] || 0) + 1
                    })
                    return Object.entries(clusterCounts).map(([clusterId, count]) => (
                      <div key={clusterId} className="flex justify-between">
                        <span>Cluster {clusterId}:</span>
                        <span className="font-medium">{count} nodes</span>
                      </div>
                    ))
                  })()}
                </div>
              </div>
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
                </div>
                {detectConstraintViolations.map((violation, index) => (
                  <div key={index} className="p-3 bg-red-100 rounded border border-red-200">
                    <div className="text-sm font-medium text-red-800">
                      {violation.node1} ↔ {violation.node2}
                    </div>
                    <div className="text-xs text-red-600">
                      Both in Cluster {violation.cluster1} | 
                      Negative: {violation.negativeEdgeType}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Center Panel - Graph Display */}
      <div className="flex-1 relative flex flex-col h-full">
        {/* Graph Container */}
        <div 
          key={`graph-container-${selectedDataExample}`} 
          className="relative w-full"
          style={{ 
            height: '70vh',
            minHeight: '600px'
          }}
        >

          
          <GraphVisualization
            nodes={finalNodeData}
            edges={unifiedEdges}
            unifiedEdges={unifiedEdges}
            layout={layout}
            config={graphConfig}
            onNodeHover={handleNodeHover}
            onNodeClick={handleNodeClick}
            onEdgeHover={handleEdgeHover}
            onEdgeClick={handleEdgeClick}
            onMouseLeave={handleMouseLeave}
            onEmptyAreaClick={() => {
              setSelectedEdge(null)
              setHoveredEdge(null)
              setSelectedNode(null)
              setHoveredNode(null)
            }}
            hoveredNode={hoveredNode}
            selectedNode={selectedNode}
            hoveredEdge={hoveredEdge}
            selectedEdge={selectedEdge}
            getNodeColor={getNodeColor}
          />
        </div>

        {/* Data Table Area */}
        <div 
          key={`data-table-${selectedDataExample}`} 
          className="w-full bg-white border-t border-gray-200 overflow-x-auto mt-2 pb-2"
          style={{ fontSize: '11px', lineHeight: '1.2' }}
        >
          {/* Data Example Selector */}
          <div key={`data-selector-${selectedDataExample}`} className="p-1.5 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              {/* Left side: Example selector and record count */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-gray-700">Example:</label>
                <select
                  value={selectedDataExample}
                  onChange={(e) => {
                    const newExample = Number(e.target.value)
                    setSelectedDataExample(newExample)
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
              </div>
              
              {/* Right side: Add row buttons and Reset All */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-blue-700 font-medium">
                  💡 Add:
                </span>
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
                    ? "Add an empty record for manual entry"
                    : "Add an empty record to this example"
                  }
                >
                  +Empty
                </button>
                <span className="text-xs text-gray-500 mx-1">|</span>
                <button
                  onClick={() => {
                    // Reset all edited data to original
                    setEditableData([...currentData])
                    setDynamicRecords([...currentData])
                  }}
                  className="px-2 py-0.5 text-xs bg-gray-500 hover:bg-gray-600 text-white rounded transition-colors"
                  title="Reset all changes to original data"
                >
                  🔄 Reset All
                </button>
              </div>
            </div>
          </div>

          {/* Data Table */}
          
          <table className="min-w-full text-[10px] text-left">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-1 border text-gray-600 text-center">Record ID</th>
                <th className="px-3 py-1 border text-blue-700 text-center">Cluster ID</th>
                <th className="px-3 py-1 border text-green-700 text-center">Salutation</th>
                <th className="px-3 py-1 border text-green-700 text-center">First Name</th>
                <th className="px-3 py-1 border text-green-700 text-center">Last Name</th>
                <th className="px-3 py-1 border text-blue-700 text-center">Email</th>
                <th className="px-3 py-1 border text-blue-700 text-center">Phone</th>
                <th className="px-3 py-1 border text-purple-700 text-center">Party</th>
              </tr>
            </thead>
            <tbody>
              {editableData.map((node, index) => (
                <tr
                  key={node["Record-Id"]}
                  className={`hover:bg-gray-50 transition-all duration-200 cursor-pointer ${
                    (hoveredEdge && (hoveredEdge.from === node["Record-Id"] || hoveredEdge.to === node["Record-Id"])) ||
                    (selectedEdge && (selectedEdge.from === node["Record-Id"] || selectedEdge.to === node["Record-Id"])) ||
                    (hoveredNode === node["Record-Id"])
                      ? 'bg-blue-100 border-l-4 border-l-blue-500 shadow-sm'
                      : ''
                  }`}
                  onMouseEnter={() => setHoveredNode(node["Record-Id"])}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  <td className="px-3 py-1 border font-mono bg-gray-100 text-gray-600 text-center">{node["Record-Id"]}</td>
                  <td className="px-3 py-1 border font-mono bg-blue-50 text-blue-700 text-center">
                    {(() => {
                      const clusterId = nodeClusters.get(node["Record-Id"])
                      return clusterId !== undefined ? clusterId : "—"
                    })()}
                  </td>
                  
                  {/* Editable Salutation */}
                  <td className="px-3 py-1 border text-center">
                    <input
                      type="text"
                      value={node["Salutation"] || ""}
                      onChange={(e) => {
                        const newData = [...editableData]
                        newData[index] = { ...newData[index], "Salutation": e.target.value }
                        setEditableData(newData)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          // Save changes and update pipeline
                          const newData = [...editableData]
                          newData[index] = { ...newData[index], "Salutation": e.currentTarget.value }
                          setEditableData(newData)
                          setDynamicRecords(newData)
                        }
                      }}
                      className="w-full text-center text-[10px] border-0 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-transparent"
                      placeholder="—"
                    />
                  </td>
                  
                  {/* Editable First Name */}
                  <td className="px-3 py-1 border text-center">
                    <input
                      type="text"
                      value={node["First Name"] || ""}
                      onChange={(e) => {
                        const newData = [...editableData]
                        newData[index] = { ...newData[index], "First Name": e.target.value }
                        setEditableData(newData)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const newData = [...editableData]
                          newData[index] = { ...newData[index], "First Name": e.currentTarget.value }
                          setEditableData(newData)
                          setDynamicRecords(newData)
                        }
                      }}
                      className="w-full text-center text-[10px] border-0 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-transparent"
                      placeholder="—"
                    />
                  </td>
                  
                  {/* Editable Last Name */}
                  <td className="px-3 py-1 border text-center">
                    <input
                      type="text"
                      value={node["Last Name"] || ""}
                      onChange={(e) => {
                        const newData = [...editableData]
                        newData[index] = { ...newData[index], "Last Name": e.target.value }
                        setEditableData(newData)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const newData = [...editableData]
                          newData[index] = { ...newData[index], "Last Name": e.currentTarget.value }
                          setEditableData(newData)
                          setDynamicRecords(newData)
                        }
                      }}
                      className="w-full text-center text-[10px] border-0 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-transparent"
                      placeholder="—"
                    />
                  </td>
                  
                  {/* Editable Email */}
                  <td className="px-3 py-1 border text-center">
                    <input
                      type="email"
                      value={node["Email"] || ""}
                      onChange={(e) => {
                        const newData = [...editableData]
                        newData[index] = { ...newData[index], "Email": e.target.value }
                        setEditableData(newData)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const newData = [...editableData]
                          newData[index] = { ...newData[index], "Email": e.currentTarget.value }
                          setEditableData(newData)
                          setDynamicRecords(newData)
                        }
                      }}
                      className="w-full text-center text-[10px] border-0 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-transparent"
                      placeholder="—"
                    />
                  </td>
                  
                  {/* Editable Phone */}
                  <td className="px-3 py-1 border text-center">
                    <input
                      type="tel"
                      value={node["Phone"] || ""}
                      onChange={(e) => {
                        const newData = [...editableData]
                        newData[index] = { ...newData[index], "Phone": e.target.value }
                        setEditableData(newData)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const newData = [...editableData]
                          newData[index] = { ...newData[index], "Phone": e.currentTarget.value }
                          setEditableData(newData)
                          setDynamicRecords(newData)
                        }
                      }}
                      className="w-full text-center text-[10px] border-0 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-transparent"
                      placeholder="—"
                    />
                  </td>
                  
                  {/* Editable Party */}
                  <td className="px-3 py-1 border text-center">
                    <input
                      type="text"
                      value={node["Party"] || ""}
                      onChange={(e) => {
                        const newData = [...editableData]
                        newData[index] = { ...newData[index], "Party": e.target.value }
                        setEditableData(newData)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const newData = [...editableData]
                          newData[index] = { ...newData[index], "Party": e.currentTarget.value }
                          setEditableData(newData)
                          setDynamicRecords(newData)
                        }
                      }}
                      className="w-full text-center text-[10px] border-0 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-transparent"
                      placeholder="—"
                    />
                  </td>
                  
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right Panel - Match Details */}
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
                    style={{ backgroundColor: getNodeColor((selectedNode || hoveredNode)!.recordId) }}
                  />
                  {(selectedNode || hoveredNode)!.recordId}
                  {selectedNode && <span className="text-sm font-normal text-gray-500">(Selected)</span>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <span className="font-medium text-gray-600">Cluster ID:</span>
                  <span className="col-span-2 font-mono text-xs text-blue-700">{(selectedNode || hoveredNode)!.clusterId !== undefined && (selectedNode || hoveredNode)!.clusterId !== -1 ? (selectedNode || hoveredNode)!.clusterId : "—"}</span>
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
                  {(() => {
                    const currentEdge = selectedEdge || hoveredEdge
                    if (!currentEdge) return "—"
                    return (
                      <div className="flex flex-col">
                        <div className="text-sm text-gray-500 mb-1">
                          {selectedDataExample >= 0 ? `Example-${String(selectedDataExample + 1).padStart(2, '0')} (Data)` : 'Dynamic Data'}
                        </div>
                        <div>{currentEdge.from} ↔ {currentEdge.to}</div>
                      </div>
                    )
                  })()}
                  {selectedEdge && <span className="text-sm font-normal text-gray-400">(Selected)</span>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Enhanced Match Score Display */}
                <div className="text-sm space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-600">Match Score:</span>
                    <span className={`font-bold text-lg ${
                      (() => {
                        const currentEdge = selectedEdge || hoveredEdge
                        if (!currentEdge) return 'text-gray-600'
                        return currentEdge.matchScore > 0 ? 'text-green-600' : 
                               currentEdge.matchScore < 0 ? 'text-red-600' : 'text-gray-600'
                      })()
                    }`}>
                      {(() => {
                        const currentEdge = selectedEdge || hoveredEdge
                        if (!currentEdge) return "—"
                        return currentEdge.matchScore.toFixed(3)
                      })()}
                    </span>
                  </div>
                  

                </div>

                {/* Level-based Scoring Header - Shows weights that align with rules below */}
                {(() => {
                  const currentEdge = selectedEdge || hoveredEdge
                  if (!currentEdge || !currentEdge.results || currentEdge.results.length === 0) return null
                  
                  // Get unique rule levels from the results
                  const ruleLevels = new Set<number>()
                  currentEdge.results.forEach((result: any) => {
                    if (result.individualRuleScores) {
                      result.individualRuleScores.forEach((irs: any) => {
                        ruleLevels.add(irs.level)
                      })
                    }
                  })
                  
                  if (ruleLevels.size === 0) return null
                  
                  return (
                    <div className="mb-2 p-2 bg-gray-50 rounded border border-gray-200">
                      <div className="text-xs font-medium text-gray-700 mb-1">⚖️ Rule Level Weights:</div>
                      <div className="flex items-center space-x-3 text-xs">
                        {Array.from(ruleLevels).sort().map(level => {
                          const multiplier = level === 1 ? 1.0 : 
                                           level === 2 ? 0.75 : 
                                           level === 3 ? 0.5 : 
                                           level === 4 ? 0.25 : 0.1
                          return (
                            <div key={level} className="flex items-center space-x-1">
                              <span className="text-gray-500">L{level}:</span>
                              <span className="font-mono text-blue-600">{multiplier}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                {/* Rule Evaluation Tree - WHY the score is what it is */}
                {(() => {
                  const currentEdge = selectedEdge || hoveredEdge
                  if (!currentEdge || !currentEdge.results || currentEdge.results.length === 0) return null
                  
                  return (
                    <div className="p-2 bg-blue-50 rounded border border-blue-200">
                      {currentEdge.results.map((result: any, resultIdx: number) => {
                        if (!result.rulesUsed || result.rulesUsed.length === 0) return null
                        
                        const rulePath = result.rulesUsed[0]
                        
                        return (
                          <div key={resultIdx} className="flex items-center space-x-1 mb-1 flex-wrap">
                            {rulePath.map((rule: string, ruleIdx: number) => {
                              // Find the individual status for this specific rule
                              const individualStatus = result.individualRuleStatuses?.find(
                                (ruleStatus: any) => ruleStatus.ruleName === rule
                              )?.status || result.status
                              
                              return (
                                <div key={ruleIdx} className="flex items-center">
                                  {/* Rule Box */}
                                  <div 
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                      individualStatus === 'positive' ? 'bg-green-100 text-green-700' :
                                      individualStatus === 'negative' ? 'bg-red-100 text-red-700' :
                                      'bg-gray-100 text-gray-600'
                                    }`}
                                  >
                                    {rule}
                                  </div>
                                  {ruleIdx < rulePath.length - 1 && (
                                    <div className="mx-0.5 text-blue-400 text-[10px]">→</div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}

                {/* Individual Rule Scores */}
                {(() => {
                  const currentEdge = selectedEdge || hoveredEdge
                  if (!currentEdge || !currentEdge.results || currentEdge.results.length === 0) return null
                  
                  // Group results by leaf rules (the ones that actually get evaluated) - each rule should only appear once
                  const ruleScores = new Map<string, { positive: number; negative: number; total: number; multiplier: number; baseScore: number }>()
                  
                  currentEdge.results.forEach((result: any) => {
                    // Get the leaf rule (last rule in the path) - this is the one that actually gets evaluated
                    const rulePath = result.rulesUsed?.[0] || []
                    const leafRule = rulePath[rulePath.length - 1] || 'Unknown'
                    
                    if (!ruleScores.has(leafRule)) {
                      ruleScores.set(leafRule, { positive: 0, negative: 0, total: 0, multiplier: 1, baseScore: 0 })
                    }
                    
                    const ruleScore = ruleScores.get(leafRule)!
                    
                    // Each rule should only contribute once - use the first result we encounter
                    if (ruleScore.total === 0) {
                      if (result.status === 'positive') {
                        ruleScore.positive = result.score || 0
                      } else if (result.status === 'negative') {
                        ruleScore.negative = result.score || 0
                      }
                      ruleScore.total = ruleScore.positive + ruleScore.negative
                      
                      // Get multiplier and base score from individualRuleScores if available
                      if (result.individualRuleScores && result.individualRuleScores.length > 0) {
                        const leafRuleScore = result.individualRuleScores.find((irs: any) => irs.ruleName === leafRule)
                        if (leafRuleScore) {
                          ruleScore.multiplier = leafRuleScore.multiplier
                          ruleScore.baseScore = leafRuleScore.baseScore
                        }
                      }
                      
                      // Debug logging to see what's happening
                      console.log(`Leaf Rule ${leafRule}: status=${result.status}, score=${result.score}, multiplier=${ruleScore.multiplier}, baseScore=${ruleScore.baseScore}`)
                    }
                  })
                  
                  return (
                    <div className="mt-2 p-3 bg-blue-50 rounded border border-blue-200 text-xs">
                      <div className="font-medium text-blue-800 mb-2">📊 Pipeline Rule Scores:</div>
                      <div className="space-y-2">
                        {Array.from(ruleScores.entries()).map(([ruleName, scores]) => (
                          <div key={ruleName} className="flex items-center justify-between p-2 bg-white rounded border border-blue-100">
                            <div className="flex-1">
                              <span className="font-medium text-blue-700">{ruleName}</span>
                            </div>
                            <div className="flex items-center space-x-3">
                              {/* Show multiplier × base score for each rule */}
                              <span className="text-xs text-gray-500">
                                {scores.multiplier} × {scores.baseScore.toFixed(2)}
                              </span>
                              {/* Show the final score for each rule */}
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                scores.total > 0 ? 'bg-green-200 text-green-800' : 
                                scores.total < 0 ? 'bg-red-200 text-red-800' : 
                                'bg-gray-200 text-gray-800'
                              }`}>
                                {scores.total > 0 ? '+' : ''}{scores.total.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Pipeline final score */}
                      <div className="mt-3 pt-2 border-t border-blue-200">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-blue-800">Pipeline Final Score:</span>
                          <span className={`px-3 py-1 rounded font-bold ${
                            currentEdge.matchScore > 0 ? 'bg-green-200 text-green-800' : 
                            currentEdge.matchScore < 0 ? 'bg-red-200 text-red-800' : 
                            'bg-gray-200 text-gray-800'
                          }`}>
                            {currentEdge.matchScore > 0 ? '+' : ''}{currentEdge.matchScore.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })()}

                <hr className="my-3" />

                {/* Removed redundant panels - user can see this information elsewhere */}


              </CardContent>
            </Card>
          )}

          {/* Instructions Panel */}
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
                  • <strong>Green edges</strong> show positive relationships
                </p>
                <p>
                  • <strong>Red dashed edges</strong> show negative relationships
                </p>
                <p>
                  • <strong>Gray edges</strong> show neutral relationships
                </p>
                <p>• Node colors represent different relationship clusters</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}