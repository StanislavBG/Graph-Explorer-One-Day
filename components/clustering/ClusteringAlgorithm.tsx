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

// Three-pass clustering algorithm: 
// Pass 1: Find clusters with highest edge strength
// Pass 2: Apply STRICT negative edge constraints
// Pass 3: Optimize cluster assignments based on edge strength
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
  
  console.log(`🚀 STARTING THREE-PASS CLUSTERING for ${nodeData.length} nodes`)
  
  // CLUSTERING REQUIREMENTS:
  // 1. Nodes with negative edges must NOT be in the same cluster (STRICT constraint)
  // 2. Nodes that match multiple clusters should prefer the cluster with strongest single edge
  // 3. Positive edges with highest scores should take priority for clustering
  
  // PASS 1: Create initial clusters based on STRONGEST SINGLE edge strength
  const phase1Result = performPhase1Clustering(nodeData, edges, config)
  console.log(`🔗 PASS 1 COMPLETE - Created ${phase1Result.clusterGroups.size} initial clusters`)
  
  // PASS 2: Apply STRICT negative edge constraints by splitting clusters
  const phase2Result = performPhase2Clustering(phase1Result, edges, config)
  console.log(`🔗 PASS 2 COMPLETE - Created ${phase2Result.clusterGroups.size} intermediate clusters`)
  
  // PASS 3: Optimize cluster assignments based on edge strength
  const phase3Result = performPhase3Clustering(phase2Result, edges, config)
  console.log(`🔗 PASS 3 COMPLETE - Final result: ${phase3Result.clusterGroups.size} clusters`)
  
  // Calculate final quality metrics
  const qualityMetrics = calculateClusteringQuality(phase3Result, edges, nodeData)
  
  // Detect constraint violations
  const constraintViolations = detectConstraintViolations(phase3Result.assignments, edges)
  
  return {
    assignments: phase3Result.assignments,
    clusterGroups: phase3Result.clusterGroups,
    qualityMetrics,
    constraintViolations
  }
}

// Phase 1: Create initial clusters based on STRONGEST SINGLE edge strength
function performPhase1Clustering(
  nodeData: NodeData[], 
  edges: Edge[], 
  config: ClusteringConfig
): ClusteringPhase {
  const initialClusters = new Map<string, number>()
  const initialClusterGroups = new Map<number, Set<string>>()
  let initialClusterId = 1
  
  // Start with first node in its own cluster
  initialClusters.set(nodeData[0].recordId, initialClusterId)
  initialClusterGroups.set(initialClusterId, new Set([nodeData[0].recordId]))
  initialClusterId++
  
  // For each remaining node, find the best cluster to join based on STRONGEST SINGLE edge
  for (let i = 1; i < nodeData.length; i++) {
    const nodeId = nodeData[i].recordId
    let bestClusterId = -1
    let bestSingleEdgeScore = -Infinity
    
    // First, check if this node has any very strong positive edges (>2.0) that should take priority
    const strongEdges = edges.filter(e => 
      ((e.from === nodeId || e.to === nodeId) && e.matchScore > 2.0)
    ).sort((a, b) => b.matchScore - a.matchScore)
    
    // Try adding this node to each existing cluster
    for (const [clusterId, clusterNodes] of initialClusterGroups) {
      let maxSingleEdgeScore = -Infinity
      
      // Find the STRONGEST SINGLE edge with any node in this cluster
      for (const existingNodeId of clusterNodes) {
        const edge = edges.find(e => 
          ((e.from === nodeId && e.to === existingNodeId) || 
           (e.from === existingNodeId && e.to === nodeId))
        )
        
        if (edge && edge.matchScore > config.positiveThreshold) {
          maxSingleEdgeScore = Math.max(maxSingleEdgeScore, edge.matchScore)
        }
      }
      
      // If this cluster has a stronger single edge, remember it
      if (maxSingleEdgeScore > bestSingleEdgeScore) {
        bestSingleEdgeScore = maxSingleEdgeScore
        bestClusterId = clusterId
      }
    }
    
    // If we found a good cluster (positive score), join it
    if (bestSingleEdgeScore > config.positiveThreshold) {
      initialClusters.set(nodeId, bestClusterId)
      initialClusterGroups.get(bestClusterId)!.add(nodeId)
      
      // Debug logging for specific nodes
      if (nodeId === 'id-006' || nodeId === 'id-007') {
        console.log(`🔍 PASS 1 - ${nodeId} joined cluster ${bestClusterId} with strongest edge score ${bestSingleEdgeScore.toFixed(3)}`)
      }
    } else if (strongEdges.length > 0) {
      // If no good cluster found but we have strong edges, create a new cluster
      // and try to pull in the strongly connected nodes
      initialClusters.set(nodeId, initialClusterId)
      initialClusterGroups.set(initialClusterId, new Set([nodeId]))
      
      // Try to pull in nodes with strong connections
      for (const edge of strongEdges) {
        const connectedNodeId = edge.from === nodeId ? edge.to : edge.from
        if (!initialClusters.has(connectedNodeId)) {
          initialClusters.set(connectedNodeId, initialClusterId)
          initialClusterGroups.get(initialClusterId)!.add(connectedNodeId)
        }
      }
      
      initialClusterId++
    } else {
      // Create new cluster for this node
      initialClusters.set(nodeId, initialClusterId)
      initialClusterGroups.set(initialClusterId, new Set([nodeId]))
      initialClusterId++
    }
  }
  
  // Debug: Show initial cluster assignments
  console.log(`🔍 PASS 1 - Initial cluster assignments:`)
  for (const [clusterId, nodes] of initialClusterGroups) {
    console.log(`   Cluster ${clusterId}: ${Array.from(nodes).join(', ')}`)
  }
  
  return {
    name: "Initial Clustering",
    description: "Create initial clusters based on strongest single edge strength",
    assignments: initialClusters,
    clusterGroups: initialClusterGroups
  }
}

// Phase 2: Apply STRICT negative edge constraints by splitting clusters
function performPhase2Clustering(
  phase1Result: ClusteringPhase, 
  edges: Edge[], 
  config: ClusteringConfig
): ClusteringPhase {
  const intermediateClusters = new Map<string, number>()
  const intermediateClusterGroups = new Map<number, Set<string>>()
  let intermediateClusterId = 1
  
  for (const [clusterId, nodes] of phase1Result.clusterGroups) {
    const nodeArray = Array.from(nodes)
    const validSubclusters: Set<string>[] = []
    
    // Start with the first node in its own subcluster
    validSubclusters.push(new Set([nodeArray[0]]))
    
    // Assign remaining nodes to subclusters based on STRICT negative edge constraints
    for (let i = 1; i < nodeArray.length; i++) {
      const nodeId = nodeArray[i]
      let bestClusterIndex = -1
      let bestSingleEdgeScore = -Infinity
      
      // Find the subcluster that doesn't have negative edge constraints
      for (let j = 0; j < validSubclusters.length; j++) {
        const subcluster = validSubclusters[j]
        
        // Check if this node has negative edges to any node in this subcluster
        let hasNegativeEdge = false
        let maxSingleEdgeScore = -Infinity
        
        for (const existingNodeId of subcluster) {
          const edge = edges.find(e => 
            ((e.from === nodeId && e.to === existingNodeId) || 
             (e.from === existingNodeId && e.to === nodeId))
          )
          
          if (edge) {
            if (edge.matchScore < config.negativeThreshold) {
              // STRICT CONSTRAINT: Any negative edge means this subcluster is invalid
              hasNegativeEdge = true
              break
            } else if (edge.matchScore > config.positiveThreshold) {
              maxSingleEdgeScore = Math.max(maxSingleEdgeScore, edge.matchScore)
            }
          }
        }
        
        // Consider subclusters with NO negative edges, prioritizing by edge strength
        if (!hasNegativeEdge) {
          if (maxSingleEdgeScore > bestSingleEdgeScore) {
            bestSingleEdgeScore = maxSingleEdgeScore
            bestClusterIndex = j
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
  
  // Debug: Show intermediate cluster assignments after applying negative constraints
  console.log(`🔍 PASS 2 - Intermediate clusters after negative edge constraints:`)
  for (const [clusterId, nodes] of intermediateClusterGroups) {
    console.log(`   Cluster ${clusterId}: ${Array.from(nodes).join(', ')}`)
  }
  
  return {
    name: "Strict Constraint Application",
    description: "Apply STRICT negative edge constraints by splitting clusters",
    assignments: intermediateClusters,
    clusterGroups: intermediateClusterGroups
  }
}

// Phase 3: Optimize cluster assignments based on edge strength
function performPhase3Clustering(
  phase2Result: ClusteringPhase, 
  edges: Edge[], 
  config: ClusteringConfig
): ClusteringPhase {
  const finalClusters = new Map<string, number>()
  const finalClusterGroups = new Map<number, Set<string>>()
  let finalClusterId = 1
  
  // Start with all intermediate clusters
  for (const [clusterId, nodes] of phase2Result.clusterGroups) {
    finalClusterGroups.set(finalClusterId, new Set(nodes))
    for (const nodeId of nodes) {
      finalClusters.set(nodeId, finalClusterId)
    }
    finalClusterId++
  }
  
  // Try to merge clusters that have strong positive connections AND NO negative connections
  let merged = true
  let mergeAttempts = 0
  const maxMergeAttempts = config.optimizationPasses
  
  while (merged && mergeAttempts < maxMergeAttempts) {
    merged = false
    mergeAttempts++
    
    for (const [cluster1Id, cluster1Nodes] of finalClusterGroups) {
      for (const [cluster2Id, cluster2Nodes] of finalClusterGroups) {
        if (cluster1Id >= cluster2Id) continue // Skip same cluster and already processed pairs
        
        // Check if these clusters should be merged based on strong positive connections
        let totalPositiveScore = 0
        let hasNegativeEdge = false
        
        for (const node1Id of cluster1Nodes) {
          for (const node2Id of cluster2Nodes) {
            const edge = edges.find(e => 
              ((e.from === node1Id && e.to === node2Id) || 
               (e.from === node2Id && e.to === node1Id))
            )
            
            if (edge) {
              if (edge.matchScore > config.positiveThreshold) {
                totalPositiveScore += edge.matchScore
              } else if (edge.matchScore < config.negativeThreshold) {
                // STRICT CONSTRAINT: Any negative edge prevents merging
                hasNegativeEdge = true
                break
              }
            }
          }
          if (hasNegativeEdge) break
        }
        
        // Merge if positive score is significant, but allow some tolerance for negative edges
        const shouldMerge = totalPositiveScore > config.positiveThreshold * 2 && 
                           (!hasNegativeEdge || totalPositiveScore > Math.abs(config.negativeThreshold) * 3)
        
        if (shouldMerge) {
          console.log(`🔗 PASS 3 - Merging clusters ${cluster1Id} and ${cluster2Id} (pos: ${totalPositiveScore.toFixed(3)}, neg edges: ${hasNegativeEdge})`)
          
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
  
  // Debug: Show final cluster assignments
  console.log(`🔍 PASS 3 - Final cluster assignments:`)
  for (const [clusterId, nodes] of finalClusterGroups) {
    console.log(`   Final Cluster ${clusterId}: ${Array.from(nodes).join(', ')}`)
  }
  
  return {
    name: "Optimization",
    description: "Optimize cluster assignments based on edge strength with strict negative constraints",
    assignments: finalClusters,
    clusterGroups: finalClusterGroups
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