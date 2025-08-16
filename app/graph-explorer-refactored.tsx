"use client"

import React from "react"
import { useState, useMemo, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import rawData from '../data.json'

// Import our refactored components and hooks
import { GraphVisualization } from '@/components/graph/GraphVisualization'
import { useGraphData } from '@/hooks/useGraphData'
import { useMatchScore } from '@/hooks/useMatchScore'
import { useClustering } from '@/hooks/useClustering'
import { GraphRenderConfig } from '@/types/graph'
import { DataRecord, DataExample } from '@/types/common'
import { matchRules } from '@/components/match-score/MatchRules'

// Recursive component to render all match rules and their children
function RenderMatchRules({ rules, level = 0 }: { rules: typeof matchRules; level?: number }) {
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
  }, [selectedDataExample])

  // Get the currently selected data set
  const currentData = useMemo(() => {
    return selectedDataExample === -1 
    ? dynamicRecords
      : (editableData.length > 0 ? editableData : rawData[selectedDataExample]?.data || [])
  }, [selectedDataExample, dynamicRecords, editableData, rawData])

  // Use our refactored hooks
  const { nodeData, finalNodeData, layout } = useGraphData(
    currentData, 
    selectedDataExample, 
    graphHeight, 
    leftPanelWidth, 
    rightPanelWidth
  )

  const { edges, unifiedEdges } = useMatchScore(nodeData)

  const { 
    clusteringResult, 
    finalNodeData: clusteredNodeData, 
    uniqueUUIDs, 
    getNodeColor, 
    nodeClusters, 
    clusteringQualityMetrics, 
    detectConstraintViolations 
  } = useClustering(nodeData, edges)

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
    edgeStrokeWidth: 4,
    hoverScale: 1.17,
    selectionScale: 1.17,
    animationDuration: 200
  }

  // Event handlers
  const handleNodeHover = (node: any) => {
    setHoveredNode(node)
    setHoveredEdge(null)
  }

  const handleNodeClick = (node: any) => {
    setSelectedNode(node)
    setSelectedEdge(null)
  }

  const handleEdgeHover = (edge: any) => {
    setHoveredEdge(edge)
    setHoveredNode(null)
  }

  const handleEdgeClick = (edge: any) => {
    setSelectedEdge(edge)
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
                <span className="text-gray-600">Total Edges:</span>
                <span className="font-medium">{edges.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Clusters:</span>
                <span className="font-medium">{clusteringResult.clusterGroups.size}</span>
              </div>
            </CardContent>
          </Card>

          {/* Clustering Quality */}
          {clusteringQualityMetrics && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-green-700">📊 Clustering Quality</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm text-green-800">
                  <div className="flex justify-between">
                    <span>Positive within clusters:</span>
                    <span>{clusteringQualityMetrics.positiveWithinCluster}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Negative between clusters:</span>
                    <span>{clusteringQualityMetrics.negativeBetweenClusters}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Constraint violations:</span>
                    <span>{clusteringQualityMetrics.constraintViolations}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

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
                      Both in Cluster {violation.cluster1 + 1} | 
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
            nodes={clusteredNodeData}
            edges={edges}
            unifiedEdges={unifiedEdges}
            layout={layout}
            config={graphConfig}
            onNodeHover={handleNodeHover}
            onNodeClick={handleNodeClick}
            onEdgeHover={handleEdgeHover}
            onEdgeClick={handleEdgeClick}
            onMouseLeave={handleMouseLeave}
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
          className="w-full bg-white border-t border-gray-200 overflow-x-auto mt-4 pb-4"
          style={{ fontSize: '12px' }}
        >
          {/* Data Example Selector */}
          <div key={`data-selector-${selectedDataExample}`} className="p-1.5 border-b border-gray-200 bg-gray-50">
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
          </div>

          {/* Data Table */}
          <table className="min-w-full text-[10px] text-left">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-1 py-0.5 border text-gray-600">Record ID</th>
                <th className="px-1 py-0.5 border text-gray-600">UUID</th>
                <th className="px-1 py-0.5 border text-blue-700">Cluster ID</th>
                <th className="px-1 py-0.5 border text-green-700">Salutation</th>
                <th className="px-1 py-0.5 border text-green-700">First Name</th>
                <th className="px-1 py-0.5 border text-green-700">Last Name</th>
                <th className="px-1 py-0.5 border text-green-700">Email</th>
                <th className="px-1 py-0.5 border text-green-700">Phone</th>
                <th className="px-1 py-0.5 border text-green-700">Party</th>
              </tr>
            </thead>
            <tbody>
              {clusteredNodeData.map((node, index) => (
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
                  <td className="px-1 py-0.5 border font-mono bg-gray-100 text-gray-600">{node.recordId}</td>
                  <td className="px-1 py-0.5 border font-mono bg-gray-100 text-gray-600">{node.uuid || "—"}</td>
                  <td className="px-1 py-0.5 border font-mono bg-blue-50 text-blue-700">{node.clusterId !== undefined && node.clusterId !== -1 ? node.clusterId : "—"}</td>
                  <td className="px-1 py-0.5 border">{node.salutation || "—"}</td>
                  <td className="px-1 py-0.5 border">{node.firstName || "—"}</td>
                  <td className="px-1 py-0.5 border">{node.lastName || "—"}</td>
                  <td className="px-1 py-0.5 border break-all">{node.email || "—"}</td>
                  <td className="px-1 py-0.5 border">{node.phone || "—"}</td>
                  <td className="px-1 py-0.5 border">{node.party || "—"}</td>
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
                  <span className="font-medium text-gray-600">UUID:</span>
                  <span className="col-span-2 font-mono text-xs">{(selectedNode || hoveredNode)!.uuid}</span>
                </div>

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
                  {(selectedEdge || hoveredEdge)!.from} ↔ {(selectedEdge || hoveredEdge)!.to}
                  {selectedEdge && <span className="text-sm font-normal text-gray-400">(Selected)</span>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600">Match Score:</span>
                    <span className={`font-bold ${
                      (selectedEdge || hoveredEdge)!.matchScore > 0 ? 'text-green-600' : 
                      (selectedEdge || hoveredEdge)!.matchScore < 0 ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {(selectedEdge || hoveredEdge)!.matchScore.toFixed(3)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600">Edge Type:</span>
                    <span className={`font-bold ${
                      (selectedEdge || hoveredEdge)!.type === 'positive' ? 'text-green-600' : 
                      (selectedEdge || hoveredEdge)!.type === 'negative' ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {(selectedEdge || hoveredEdge)!.type.toUpperCase()}
                    </span>
                  </div>
                </div>

                <hr className="my-3" />

                {/* Rule Evaluation Results */}
                {(selectedEdge || hoveredEdge)!.rulesUsed && (selectedEdge || hoveredEdge)!.rulesUsed.length > 0 && (
                  <>
                    <div className="text-xs font-semibold text-gray-700 mb-2">Rule Evaluation Paths:</div>
                    {(selectedEdge || hoveredEdge)!.rulesUsed.map((rulePath: string[], idx: number) => (
                      <div key={idx} className="flex flex-row items-center space-x-1 mb-2">
                        {rulePath.map((rule: string, i: number) => {
                          const isLast = i === rulePath.length - 1
                          let className = 'px-1.5 py-0.5 rounded font-semibold text-xs'
                          
                          // Color coding based on rule level and evaluation
                          if (isLast) {
                            if ((selectedEdge || hoveredEdge)!.type === 'positive') {
                              className += ' bg-green-100 text-green-700'
                            } else if ((selectedEdge || hoveredEdge)!.type === 'negative') {
                              className += ' bg-red-100 text-red-700'
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
                                title={`Rule: ${rule} - Level ${i + 1}`}
                              >
                                {rule}
                              </span>
                              {i < rulePath.length - 1 && (
                                <span className="text-gray-400 text-[10px] font-bold mx-0.5">→</span>
                              )}
                            </React.Fragment>
                          )
                        })}
                      </div>
                    ))}
                  </>
                )}

                {/* Matching and Non-Matching Fields */}
                <div className="text-xs">
                  {(selectedEdge || hoveredEdge)!.matchingFields && (selectedEdge || hoveredEdge)!.matchingFields.length > 0 && (
                    <div className="mb-2">
                      <div className="font-medium text-green-600 mb-1">✓ Matching Fields:</div>
                      <div className="flex flex-wrap gap-1">
                        {(selectedEdge || hoveredEdge)!.matchingFields.map((field: string, idx: number) => (
                          <span key={idx} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                            {field}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {(selectedEdge || hoveredEdge)!.nonMatchingFields && (selectedEdge || hoveredEdge)!.nonMatchingFields.length > 0 && (
                    <div className="mb-2">
                      <div className="font-medium text-red-600 mb-1">✗ Non-Matching Fields:</div>
                      <div className="flex flex-wrap gap-1">
                        {(selectedEdge || hoveredEdge)!.nonMatchingFields.map((field: string, idx: number) => (
                          <span key={idx} className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                            {field}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <hr className="my-3" />

                {/* Show the actual values being compared */}
                <div className="text-xs text-gray-400">
                  <div className="font-medium mb-2">Field Comparison:</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="font-semibold">Field</div>
                    <div className="font-semibold">Value 1</div>
                    <div className="font-semibold">Value 2</div>
                    {['salutation', 'firstName', 'lastName', 'email', 'phone', 'party'].map((field) => {
                      const fromNode = getNodeByRecordId((selectedEdge || hoveredEdge)!.from)
                      const toNode = getNodeByRecordId((selectedEdge || hoveredEdge)!.to)
                      const fromValue = fromNode?.[field as keyof typeof fromNode] || "—"
                      const toValue = toNode?.[field as keyof typeof toNode] || "—"
                      
                      // Use match API data instead of calculating
                      const isInMatchingFields = (selectedEdge || hoveredEdge)!.matchingFields.includes(field)
                      const isInNonMatchingFields = (selectedEdge || hoveredEdge)!.nonMatchingFields.includes(field)
                      
                      let textColor = 'text-gray-300' // Default for empty/missing
                      if (fromValue !== "—" && toValue !== "—") {
                        if (isInMatchingFields) {
                          textColor = 'text-green-400'
                        } else if (isInNonMatchingFields) {
                          textColor = 'text-red-400'
                        } else {
                          textColor = 'text-gray-400' // Neutral (not evaluated)
                        }
                      }
                      
                      return (
                        <div key={field} className="contents">
                          <div className="capitalize py-1">{field}:</div>
                          <div className={`py-1 ${textColor}`}>{fromValue}</div>
                          <div className={`py-1 ${textColor}`}>{toValue}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Match Rules Tree Visualization */}
          {(selectedEdge || hoveredEdge) && (
            <Card className="mb-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-gray-700">Match Rules Hierarchy</CardTitle>
              </CardHeader>
              <CardContent className="text-xs">
                <RenderMatchRules rules={matchRules} />
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