// Types specific to clustering algorithms

export interface ClusteringConfig {
  respectNegativeEdges: boolean
  positiveThreshold: number
  negativeThreshold: number
  maxClusterSize: number
  optimizationPasses: number
}

export interface ClusterNode {
  id: string
  clusterId: number
  positiveConnections: string[]
  negativeConnections: string[]
  totalPositiveScore: number
  totalNegativeScore: number
}

export interface ClusterGroup {
  id: number
  nodes: Set<string>
  totalPositiveScore: number
  totalNegativeScore: number
  canMerge: boolean
}

export interface ClusteringPhase {
  name: string
  description: string
  assignments: Map<string, number>
  clusterGroups: Map<number, Set<string>>
}

export interface ClusteringPhaseResult {
  phase: ClusteringPhase
  success: boolean
  message: string
  metrics: Partial<ClusteringQualityMetrics>
}

export interface ClusterMergeCandidate {
  cluster1Id: number
  cluster2Id: number
  positiveScore: number
  negativeScore: number
  mergeScore: number
  canMerge: boolean
} 