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
  const [windowSize, setWindowSize] = useState({ width: 800, height: 600 })

  // Handle window resize
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleResize = () => {
        setWindowSize({
          width: window.innerWidth,
          height: window.innerHeight
        })
      }
      
      // Set initial size
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
      uuid: `cluster-${index}`,
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
    
    // Calculate available space for the graph (with SSR safety)
    const availableWidth = Math.max(800, windowSize.width - leftPanelWidth - rightPanelWidth - 40) // Account for margins/padding
    const availableHeight = Math.max(600, graphHeight || 600)
    const centerX = availableWidth / 2
    const centerY = availableHeight * 0.5 // Center vertically in the available space
    const radius = Math.min(availableWidth, availableHeight) * 0.35 // Increased radius to use more space
    
    basicNodes.forEach((node, index) => {
      const angle = (index / basicNodes.length) * 2 * Math.PI
      const nodeRadius = Math.min(availableWidth, availableHeight) * 0.35
      node.x = Math.cos(angle) * nodeRadius + centerX
      node.y = Math.sin(angle) * nodeRadius + centerY
    })
    
    return basicNodes
  }, [currentData, graphHeight, leftPanelWidth, rightPanelWidth, windowSize])

  // Calculate center and radius dynamically for the graph area only
  const layout = useMemo(() => {
    const availableWidth = Math.max(800, windowSize.width - leftPanelWidth - rightPanelWidth - 40) // Account for margins/padding
    const availableHeight = Math.max(600, graphHeight || 600)
    const centerX = availableWidth / 2
    const centerY = availableHeight * 0.5 // Center vertically in the available space
    const radius = Math.min(availableWidth, availableHeight) * 0.35 // Increased radius to use more space
    
    return {
      width: availableWidth,
      height: availableHeight,
      centerX,
      centerY,
      radius
    }
  }, [graphHeight, leftPanelWidth, rightPanelWidth, windowSize])

  // Create final node data with computed UUIDs based on clustering
  const finalNodeData = useMemo(() => {
    return nodeData
  }, [nodeData])

  return {
    nodeData,
    finalNodeData,
    layout
  }
} 