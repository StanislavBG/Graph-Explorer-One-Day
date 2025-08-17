// Clustering Algorithm - Pure clustering logic, no visualization
import { NodeData, Edge, ClusteringResult, ClusteringQualityMetrics, ConstraintViolation } from '@/types/common'
import { ClusteringConfig, ClusterNode, ClusterGroup, ClusteringPhase, ClusteringPhaseResult } from '@/types/clustering'

// Default clustering configuration
export const defaultClusteringConfig: ClusteringConfig = {
  respectNegativeEdges: true,
  positiveThreshold: 0.001,
  negativeThreshold: -0.001,
  maxClusterSize: 10,
  optimizationPasses: 3
}

// Improved clustering algorithm that respects highest edge scores:
// 1. Negative edges are ALWAYS respected - nodes with negative edges never in same cluster
// 2. When a node matches multiple clusters, prefer the cluster with highest edge score
// 3. Allow nodes to re-evaluate cluster assignments when better options become available
export function performAdvancedClustering(
  nodeData: NodeData[], 
  edges: Edge[], 
  config: ClusteringConfig = defaultClusteringConfig
): ClusteringResult {
  if (nodeData.length === 0) {
    return {
      assignments: new Map<string, number>(),
      clusterGroups: new Map<number, Set<string>>(),
      qualityMetrics: createEmptyQualityMetrics(),
      constraintViolations: []
    }
  }
  
  console.log(`🚀 STARTING IMPROVED CLUSTERING for ${nodeData.length} nodes`)
  
  const assignments = new Map<string, number>()
  const clusterGroups = new Map<number, Set<string>>()
  let nextClusterId = 1
  
  // Start with first node in its own cluster
  assignments.set(nodeData[0].recordId, nextClusterId)
  clusterGroups.set(nextClusterId, new Set([nodeData[0].recordId]))
  nextClusterId++
  
  // For each remaining node, find the best cluster to join
  for (let i = 1; i < nodeData.length; i++) {
    const nodeId = nodeData[i].recordId
    let bestClusterId = -1
    let bestEdgeScore = -Infinity
    let bestClusterLowestNodeId = "" // Track the lowest alphanumeric node ID for tie-breaking
    
    // Check all existing clusters to find the best match
    for (const [clusterId, clusterNodes] of clusterGroups) {
      let maxEdgeScore = -Infinity
      let hasNegativeEdge = false
      
      // Check edges to all nodes in this cluster
      for (const clusterNodeId of clusterNodes) {
        const edge = edges.find(e => 
          ((e.from === nodeId && e.to === clusterNodeId) || 
           (e.from === clusterNodeId && e.to === nodeId))
        )
        
        if (edge) {
          if (edge.matchScore < config.negativeThreshold) {
            // STRICT CONSTRAINT: Negative edge means this cluster is invalid
            hasNegativeEdge = true
            break
          } else if (edge.matchScore > config.positiveThreshold) {
            maxEdgeScore = Math.max(maxEdgeScore, edge.matchScore)
          }
        }
      }
      
      // If no negative edges and this cluster has a better or equal score, consider it
      if (!hasNegativeEdge && maxEdgeScore >= bestEdgeScore) {
        // Find the lowest alphanumeric node ID in this cluster for tie-breaking
        const lowestNodeId = Array.from(clusterNodes).sort()[0]
        
        // If this cluster has a better score, or same score with lower alphanumeric node ID
        if (maxEdgeScore > bestEdgeScore || 
            (maxEdgeScore === bestEdgeScore && lowestNodeId < bestClusterLowestNodeId)) {
          bestEdgeScore = maxEdgeScore
          bestClusterId = clusterId
          bestClusterLowestNodeId = lowestNodeId
        }
      }
    }
    
    // If we found a good cluster, join it
    if (bestClusterId !== -1) {
      assignments.set(nodeId, bestClusterId)
      clusterGroups.get(bestClusterId)!.add(nodeId)
      console.log(`🔗 Node ${nodeId} joined cluster ${bestClusterId} with edge score ${bestEdgeScore.toFixed(3)}`)
    } else {
      // No good cluster found, create a new one
      assignments.set(nodeId, nextClusterId)
      clusterGroups.set(nextClusterId, new Set([nodeId]))
      console.log(`🔗 Node ${nodeId} created new cluster ${nextClusterId}`)
      nextClusterId++
    }
  }
  
  // OPTIMIZATION PASS: Re-evaluate cluster assignments to respect highest edge scores
  console.log(`🔄 OPTIMIZATION PASS: Re-evaluating cluster assignments for highest edge scores`)
  let optimizationMade = true
  let optimizationPass = 0
  
  while (optimizationMade && optimizationPass < 3) {
    optimizationMade = false
    optimizationPass++
    console.log(`🔄 Optimization pass ${optimizationPass}`)
    
    // Check each node to see if it can join a better cluster
    for (const nodeId of Array.from(assignments.keys())) {
      const currentClusterId = assignments.get(nodeId)!
      let bestClusterId = currentClusterId
      let bestEdgeScore = -Infinity
      let bestClusterLowestNodeId = "" // Track the lowest alphanumeric node ID for tie-breaking
      
      // Find the strongest edge for this node
      for (const edge of edges) {
        if (edge.from === nodeId || edge.to === nodeId) {
          const otherNodeId = edge.from === nodeId ? edge.to : edge.from
          const otherClusterId = assignments.get(otherNodeId)
          
          if (otherClusterId !== undefined && edge.matchScore > config.positiveThreshold) {
            // Check if this cluster is valid (no negative edges)
            let hasNegativeEdge = false
            const targetCluster = clusterGroups.get(otherClusterId)!
            
            for (const clusterNodeId of targetCluster) {
              if (clusterNodeId !== otherNodeId) {
                const clusterEdge = edges.find(e => 
                  ((e.from === nodeId && e.to === clusterNodeId) || 
                   (e.from === clusterNodeId && e.to === nodeId))
                )
                if (clusterEdge && clusterEdge.matchScore < config.negativeThreshold) {
                  hasNegativeEdge = true
                  break
                }
              }
            }
            
            // If no negative edges and this edge is stronger or equal, consider this cluster
            if (!hasNegativeEdge && edge.matchScore >= bestEdgeScore) {
              // Find the lowest alphanumeric node ID in this cluster for tie-breaking
              const lowestNodeId = Array.from(targetCluster).sort()[0]
              
              // If this cluster has a better score, or same score with lower alphanumeric node ID
              if (edge.matchScore > bestEdgeScore || 
                  (edge.matchScore === bestEdgeScore && lowestNodeId < bestClusterLowestNodeId)) {
                bestEdgeScore = edge.matchScore
                bestClusterId = otherClusterId
                bestClusterLowestNodeId = lowestNodeId
              }
            }
          }
        }
      }
      
      // If we found a better cluster, move the node
      if (bestClusterId !== currentClusterId) {
        // Remove from current cluster
        const currentCluster = clusterGroups.get(currentClusterId)!
        currentCluster.delete(nodeId)
        
        // Add to better cluster
        const betterCluster = clusterGroups.get(bestClusterId)!
        betterCluster.add(nodeId)
        assignments.set(nodeId, bestClusterId)
        
        console.log(`🔄 Node ${nodeId} moved from cluster ${currentClusterId} to cluster ${bestClusterId} (edge score: ${bestEdgeScore.toFixed(3)})`)
        optimizationMade = true
        
        // Clean up empty clusters
        if (currentCluster.size === 0) {
          clusterGroups.delete(currentClusterId)
        }
      }
    }
  }
  
  // Log final cluster assignments
  console.log(`🔗 CLUSTERING COMPLETE - Final result: ${clusterGroups.size} clusters`)
  for (const [clusterId, nodes] of clusterGroups) {
    console.log(`   Cluster ${clusterId}: ${Array.from(nodes).join(', ')}`)
  }
  
  // Calculate final quality metrics
  const finalPhase: ClusteringPhase = {
    name: "Final Clustering",
    description: "Improved clustering with optimization passes for highest edge scores",
    assignments,
    clusterGroups
  }
  const qualityMetrics = calculateClusteringQuality(finalPhase, edges, nodeData)
  
  // Detect constraint violations
  const constraintViolations = detectConstraintViolations(assignments, edges)
  
  return {
    assignments,
    clusterGroups,
    qualityMetrics,
    constraintViolations
  }
}





// Calculate clustering quality metrics
function calculateClusteringQuality(
  clusteringResult: ClusteringPhase, 
  edges: Edge[], 
  nodeData: NodeData[]
): ClusteringQualityMetrics {
  if (!clusteringResult.assignments || nodeData.length === 0) {
    return createEmptyQualityMetrics()
  }
  
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
    const cluster1 = clusteringResult.assignments.get(edge.from)
    const cluster2 = clusteringResult.assignments.get(edge.to)
    
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
    totalClusters: new Set(Array.from(clusteringResult.assignments.values())).size,
    positiveIntraClusterRatio: Math.round(positiveIntraClusterRatio * 100) / 100,
    negativeInterClusterRatio: Math.round(negativeInterClusterRatio * 100) / 100,
    constraintViolations: 0, // Will be calculated separately
    positiveWithinCluster,
    positiveBetweenClusters,
    negativeWithinCluster,
    negativeBetweenClusters
  }
}

// Detect clustering constraint violations
function detectConstraintViolations(
  assignments: Map<string, number>, 
  edges: Edge[]
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = []
  
  if (!assignments) return violations
  
  // Check all negative edges to see if they connect nodes in the same cluster
  for (const edge of edges) {
    if (edge.type === 'negative') {
      const cluster1 = assignments.get(edge.from)
      const cluster2 = assignments.get(edge.to)
      
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
}

// Create empty quality metrics
function createEmptyQualityMetrics(): ClusteringQualityMetrics {
  return {
    totalNodes: 0,
    totalClusters: 0,
    positiveIntraClusterRatio: 0,
    negativeInterClusterRatio: 0,
    constraintViolations: 0,
    positiveWithinCluster: 0,
    positiveBetweenClusters: 0,
    negativeWithinCluster: 0,
    negativeBetweenClusters: 0
  }
} 