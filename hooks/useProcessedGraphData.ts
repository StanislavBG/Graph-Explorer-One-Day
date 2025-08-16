// Unified hook that manages the complete data flow: Raw Data → Match → Clustering → Final Display
import { useMemo, useState, useEffect } from 'react'
import { NodeData, Edge, DataRecord, DataExample } from '@/types/common'
import { calculateEdges } from '@/components/match-score/MatchScoreCalculator'
import { performAdvancedClustering, defaultClusteringConfig } from '@/components/clustering/ClusteringAlgorithm'

export function useProcessedGraphData(
  currentData: DataRecord[],
  selectedDataExample: number,
  graphHeight: number,
  leftPanelWidth: number,
  rightPanelWidth: number
) {
  // State for responsive layout
  const [windowSize, setWindowSize] = useState({ width: 1200, height: 800 })

  // Handle window resize
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleResize = () => {
        setWindowSize({
          width: window.innerWidth,
          height: window.innerHeight
        })
      }
      
      // Set initial size immediately
      handleResize()
      
      // Add event listener
      window.addEventListener('resize', handleResize)
      
      // Cleanup
      return () => window.removeEventListener('resize', handleResize)
    }
  }, [])

  // Step 1: Create basic nodes from raw data
  const basicNodes = useMemo(() => {
    if (!currentData || currentData.length === 0) return []
    
    const transformedNodes = currentData.map((record: any, index: number) => ({
      recordId: record["Record-Id"] || `record-${index}`,
      salutation: record["Salutation"] || "",
      firstName: record["First Name"] || "",
      lastName: record["Last Name"] || "",
      email: record["Email"] || "",
      phone: record["Phone"] || "",
      party: record["Party"] || "",
      addressLine1: record["Address Line 1"] || "",
      city: record["City"] || "",
      country: record["Country"] || "",
      x: 0, // Will be calculated in final step
      y: 0, // Will be calculated in final step
    }))
    

    
    return transformedNodes
  }, [currentData])

  // Step 2: Calculate layout dimensions
  const layout = useMemo(() => {
    const availableWidth = Math.max(600, Math.min(1200, windowSize.width - leftPanelWidth - rightPanelWidth - 40))
    const availableHeight = Math.max(400, Math.min(800, graphHeight || 600))
    const centerX = availableWidth / 2
    const centerY = availableHeight / 2
    const radius = Math.min(availableWidth, availableHeight) * 0.45 // Increased to 0.45 for even longer edges
    
    return {
      width: availableWidth,
      height: availableHeight,
      centerX,
      centerY,
      radius
    }
  }, [graphHeight, leftPanelWidth, rightPanelWidth, windowSize])

  // Step 3: Evaluate matches and create edges
  const { edges, unifiedEdges } = useMemo(() => {
    if (basicNodes.length === 0) return { edges: [], unifiedEdges: [] }
    
    try {
      const calculatedEdges = calculateEdges(basicNodes)
      // For now, unifiedEdges is the same as edges (can be enhanced later)
      return { edges: calculatedEdges, unifiedEdges: calculatedEdges }
    } catch (error) {
      console.error('Error calculating edges:', error)
      return { edges: [], unifiedEdges: [] }
    }
  }, [basicNodes])

  // Step 4: Perform clustering
  const clusteringResult = useMemo(() => {
    if (basicNodes.length === 0 || edges.length === 0) {
      return {
        assignments: new Map<string, number>(),
        clusterGroups: new Map<number, Set<string>>(),
        qualityMetrics: {
          totalNodes: 0,
          totalClusters: 0,
          positiveIntraClusterRatio: 0,
          negativeInterClusterRatio: 0,
          constraintViolations: 0,
          positiveWithinCluster: 0,
          positiveBetweenClusters: 0,
          negativeWithinCluster: 0,
          negativeBetweenClusters: 0
        },
        constraintViolations: []
      }
    }
    
    try {
      return performAdvancedClustering(basicNodes, edges, defaultClusteringConfig)
    } catch (error) {
      console.error('Error performing clustering:', error)
      return {
        assignments: new Map<string, number>(),
        clusterGroups: new Map<number, Set<string>>(),
        qualityMetrics: {
          totalNodes: 0,
          totalClusters: 0,
          positiveIntraClusterRatio: 0,
          negativeInterClusterRatio: 0,
          constraintViolations: 0,
          positiveWithinCluster: 0,
          positiveBetweenClusters: 0,
          negativeWithinCluster: 0,
          negativeBetweenClusters: 0
        },
        constraintViolations: []
      }
    }
  }, [basicNodes, edges])

  // Step 5: Create final display nodes with positions, clusters, and colors
  const finalDisplayNodes = useMemo(() => {
    if (basicNodes.length === 0) return []
    
    const { centerX, centerY, radius } = layout
    
    console.log('🎯 Positioning nodes:', { centerX, centerY, radius, nodeCount: basicNodes.length })
    
    // Track used coordinates to prevent duplicates
    const usedX = new Set<number>()
    const usedY = new Set<number>()
    
    return basicNodes.map((node, index) => {
      // Get cluster assignment
      const clusterId = clusteringResult.assignments.get(node.recordId)
      
      // Enhanced positioning logic for better edge visualization
      let x, y
      let angle = (index / basicNodes.length) * 2 * Math.PI
      let jitter = 0
      let nodeRadius = radius * 0.8
      
      if (basicNodes.length <= 3) {
        // For small datasets, use triangular layout
        const baseX = Math.cos(angle) * radius * 0.6 + centerX
        const baseY = Math.sin(angle) * radius * 0.6 + centerY
        
        // Prevent perfectly horizontal/vertical alignments by adjusting angles
        let adjustedAngle = angle
        if (Math.abs(Math.sin(angle)) < 0.1) {
          // Near horizontal - shift angle slightly
          adjustedAngle = angle + 0.1
        } else if (Math.abs(Math.cos(angle)) < 0.1) {
          // Near vertical - shift angle slightly
          adjustedAngle = angle + 0.1
        }
        
        x = Math.cos(adjustedAngle) * radius * 0.6 + centerX
        y = Math.sin(adjustedAngle) * radius * 0.6 + centerY
      } else if (basicNodes.length <= 6) {
        // For medium datasets, use hexagonal layout with deterministic jitter
        jitter = (index % 2 === 0 ? 1 : -1) * radius * 0.1 // Deterministic jitter based on index
        const baseX = Math.cos(angle) * radius * 0.75 + centerX + jitter
        const baseY = Math.sin(angle) * radius * 0.75 + centerY + jitter
        
        // Prevent perfectly horizontal/vertical alignments by adjusting angles
        let adjustedAngle = angle
        if (Math.abs(Math.sin(angle)) < 0.1) {
          // Near horizontal - shift angle slightly
          adjustedAngle = angle + 0.1
        } else if (Math.abs(Math.cos(angle)) < 0.1) {
          // Near vertical - shift angle slightly
          adjustedAngle = angle + 0.1
        }
        
        x = Math.cos(adjustedAngle) * radius * 0.75 + centerX + jitter
        y = Math.sin(adjustedAngle) * radius * 0.75 + centerY + jitter
      } else {
        // For larger datasets, use consistent circular layout - no cluster-based positioning
        // Use consistent radius for all nodes to maintain circular formation
        
        // Prevent perfectly horizontal/vertical alignments by adjusting angles
        let adjustedAngle = angle
        if (Math.abs(Math.sin(angle)) < 0.1) {
          // Near horizontal - shift angle slightly
          adjustedAngle = angle + 0.1
        } else if (Math.abs(Math.cos(angle)) < 0.1) {
          // Near vertical - shift angle slightly
          adjustedAngle = angle + 0.1
        }
        
        x = Math.cos(adjustedAngle) * nodeRadius + centerX
        y = Math.sin(adjustedAngle) * nodeRadius + centerY
      }
      
      // Ensure no duplicate X or Y coordinates by applying micro-adjustments
      let attempts = 0
      const maxAttempts = 10
      let adjustmentStep = 2 // pixels
      
      while ((usedX.has(Math.round(x)) || usedY.has(Math.round(y))) && attempts < maxAttempts) {
        attempts++
        
        // Try different adjustment strategies
        if (attempts % 2 === 0) {
          // Even attempts: adjust X
          x += adjustmentStep * (attempts % 4 === 0 ? 1 : -1)
        } else {
          // Odd attempts: adjust Y
          y += adjustmentStep * (attempts % 4 === 0 ? 1 : -1)
        }
        
        // Ensure we stay within reasonable bounds
        const distanceFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2)
        if (distanceFromCenter > radius * 1.2) {
          // Reset to base position and try smaller adjustments
          if (basicNodes.length <= 3) {
            x = Math.cos(angle + 0.1) * (radius * 0.6) + centerX
            y = Math.sin(angle + 0.1) * (radius * 0.6) + centerY
          } else if (basicNodes.length <= 6) {
            x = Math.cos(angle + 0.1) * (radius * 0.75) + centerX + jitter
            y = Math.sin(angle + 0.1) * (radius * 0.75) + centerY + jitter
          } else {
            x = Math.cos(angle + 0.1) * (radius * 0.8) + centerX
            y = Math.sin(angle + 0.1) * (radius * 0.8) + centerY
          }
          adjustmentStep = 1
        }
      }
      
      // Round coordinates and add to used sets
      x = Math.round(x)
      y = Math.round(y)
      usedX.add(x)
      usedY.add(y)
      
      // Debug logging for Node-009
      if (node.recordId === 'id-009') {
        console.log('📍 Node-009 positioning:', { 
          index, 
          angle: (index / basicNodes.length) * 2 * Math.PI,
          clusterId,
          x: x.toFixed(2), 
          y: y.toFixed(2),
          layout: { centerX, centerY, radius },
          positioningType: basicNodes.length <= 3 ? 'triangular' : basicNodes.length <= 6 ? 'hexagonal' : 'circular'
        })
      }
      
      // Debug logging for first few nodes to verify positioning
      if (index < 3) {
        console.log(`📍 Node ${node.recordId} (${index}):`, { 
          angle: (index / basicNodes.length) * 2 * Math.PI,
          x: x.toFixed(2), 
          y: y.toFixed(2),
          positioningType: basicNodes.length <= 3 ? 'triangular' : basicNodes.length <= 6 ? 'hexagonal' : 'circular'
        })
      }
      
      return {
        ...node,
        x,
        y,
        clusterId: clusterId !== undefined ? clusterId : -1
      }
    })
  }, [basicNodes, clusteringResult.assignments, layout])

  // Debug logging for clustering
  useEffect(() => {
    if (basicNodes.length > 0) {
      const node009 = basicNodes.find(n => n.recordId === 'id-009')
      if (node009) {
        const clusterId = clusteringResult.assignments.get('id-009')
        console.log('🔍 Node-009 clustering:', { 
          recordId: node009.recordId, 
          clusterId,
          totalClusters: new Set(clusteringResult.assignments.values()).size
        })
      }
    }
  }, [basicNodes, clusteringResult.assignments])

  // Step 6: Create utility functions for the UI
  const getNodeColor = useMemo(() => {
    return (recordId: string) => {
      if (!recordId) return "#6b7280"
      const node = finalDisplayNodes.find(n => n.recordId === recordId)
      if (!node || node.clusterId === undefined || node.clusterId === -1) return "#6b7280"
      const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1"]
      return colors[node.clusterId % colors.length]
    }
  }, [finalDisplayNodes])

  const uniqueClusterIds = useMemo(() => {
    return Array.from(new Set(finalDisplayNodes.map((node) => node.clusterId).filter(id => id !== -1)))
  }, [finalDisplayNodes])

  // Debug logging
  useEffect(() => {
    if (finalDisplayNodes.length > 0) {
      console.log('🔍 Unified Data Flow Debug:')
      console.log('  Basic nodes:', basicNodes.length)
      console.log('  Edges created:', edges.length)
      console.log('  Clusters:', clusteringResult.assignments.size)
      console.log('  Final display nodes:', finalDisplayNodes.length)
      console.log('  First node position:', { 
        id: finalDisplayNodes[0].recordId, 
        x: finalDisplayNodes[0].x, 
        y: finalDisplayNodes[0].y,
        cluster: finalDisplayNodes[0].clusterId 
      })
    }
  }, [basicNodes.length, edges.length, clusteringResult.assignments.size, finalDisplayNodes])

  return {
    // Final display data (what the graph actually renders)
    nodes: finalDisplayNodes,
    edges,
    unifiedEdges,
    layout,
    
    // Clustering results (for UI panels)
    clusteringResult,
    uniqueClusterIds,
    getNodeColor,
    
    // Raw data (for debugging/development)
    basicNodes,
    nodeClusters: clusteringResult.assignments,
    detectConstraintViolations: clusteringResult.constraintViolations
  }
} 