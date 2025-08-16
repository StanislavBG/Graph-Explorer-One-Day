// Hook for match score calculations
import { useMemo } from 'react'
import { NodeData, Edge, UnifiedEdge } from '@/types/common'
import { calculateEdges, createUnifiedEdges } from '@/components/match-score/MatchScoreCalculator'

export function useMatchScore(nodeData: NodeData[]) {
  // Generate overall edges based on rule evaluation precedence
  const edges = useMemo(() => {
    try {
      return calculateEdges(nodeData)
    } catch (error) {
      console.error('Error generating edges:', error)
      return []
    }
  }, [nodeData])

  // Create unified edges that combine positive and negative relationships
  const unifiedEdges = useMemo(() => {
    try {
      return createUnifiedEdges(edges, nodeData)
    } catch (error) {
      console.error('Error creating unified edges:', error)
      return []
    }
  }, [edges, nodeData])

  return {
    edges,
    unifiedEdges
  }
} 