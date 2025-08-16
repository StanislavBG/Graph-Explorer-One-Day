// Hook for clustering state management
import { useMemo } from 'react'
import { NodeData, Edge, ClusteringResult, ClusteringQualityMetrics, ConstraintViolation } from '@/types/common'
import { performAdvancedClustering, defaultClusteringConfig } from '@/components/clustering/ClusteringAlgorithm'

export function useClustering(nodeData: NodeData[], edges: Edge[]) {
  // Perform clustering algorithm
  const clusteringResult = useMemo(() => {
    try {
      return performAdvancedClustering(nodeData, edges, defaultClusteringConfig)
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
  }, [nodeData, edges])

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

  // Get node color based on cluster ID
  const getNodeColor = (recordId: string) => {
    if (!recordId) return "#6b7280"
    const node = finalNodeData.find(n => n.recordId === recordId)
    if (!node || node.clusterId === undefined || node.clusterId === -1) return "#6b7280"
    const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1"]
    return colors[node.clusterId % colors.length]
  }

  return {
    clusteringResult,
    finalNodeData,
    uniqueClusterIds,
    getNodeColor,
    nodeClusters: clusteringResult.assignments,
    clusteringQualityMetrics: clusteringResult.qualityMetrics,
    detectConstraintViolations: clusteringResult.constraintViolations
  }
} 