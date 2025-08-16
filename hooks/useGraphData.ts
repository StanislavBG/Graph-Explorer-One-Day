// Hook for graph data management
import { useState, useMemo, useEffect } from 'react'
import { NodeData, DataRecord, DataExample } from '@/types/common'
import { GraphLayout } from '@/types/graph'

export function useGraphData(
  currentData: DataRecord[],
  selectedDataExample: number,
  graphHeight: number,
  leftPanelWidth: number,
  rightPanelWidth: number
) {
  // State for responsive layout
  const [windowSize, setWindowSize] = useState({ width: 1200, height: 800 }) // More reasonable default

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
      addressLine1: record["Address Line 1"] || "",
      city: record["City"] || "",
      country: record["Country"] || "",
      x: 0, // Will be calculated based on clustering
      y: 0, // Will be calculated based on clustering
    }))
    
    return basicNodes
  }, [currentData]) // Only recalculate when data changes, not when window size changes

  // Calculate layout separately to avoid recalculating nodeData
  const layout = useMemo(() => {
    const availableWidth = Math.max(800, windowSize.width - leftPanelWidth - rightPanelWidth - 40)
    const availableHeight = Math.max(600, graphHeight || 600)
    const centerX = availableWidth / 2
    const centerY = availableHeight * 0.5
    const radius = Math.min(availableWidth, availableHeight) * 0.35
    
    return {
      width: availableWidth,
      height: availableHeight,
      centerX,
      centerY,
      radius
    }
  }, [graphHeight, leftPanelWidth, rightPanelWidth, windowSize])

  // Apply layout to nodes without recalculating the base data
  const positionedNodeData = useMemo(() => {
    if (nodeData.length === 0) return []
    
    // Use conservative dimensions to ensure nodes are always visible
    const availableWidth = Math.max(600, Math.min(1200, windowSize.width - leftPanelWidth - rightPanelWidth - 40))
    const availableHeight = Math.max(400, Math.min(800, graphHeight || 600))
    const centerX = availableWidth / 2
    const centerY = availableHeight / 2
    const radius = Math.min(availableWidth, availableHeight) * 0.25 // Very conservative radius
    
    const positioned = nodeData.map((node, index) => {
      const angle = (index / nodeData.length) * 2 * Math.PI
      return {
        ...node,
        x: Math.cos(angle) * radius + centerX,
        y: Math.sin(angle) * radius + centerY
      }
    })
    
    // Debug: Log the first few node positions
    if (positioned.length > 0) {
      console.log('🔍 Node positioning debug:')
      console.log('  Available space:', { width: availableWidth, height: availableHeight })
      console.log('  Center:', { x: centerX, y: centerY })
      console.log('  Radius:', radius)
      console.log('  First 3 nodes:', positioned.slice(0, 3).map(n => ({ id: n.recordId, x: n.x, y: n.y })))
    }
    
    return positioned
  }, [nodeData, graphHeight, leftPanelWidth, rightPanelWidth, windowSize])

  return {
    nodeData,
    finalNodeData: positionedNodeData,
    layout
  }
} 