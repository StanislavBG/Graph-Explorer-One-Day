// Common types shared across all components

export interface NodeData {
  recordId: string
  uuid: string
  clusterId?: number
  salutation?: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  party?: string
  addressLine1?: string
  city?: string
  country?: string
  x: number
  y: number
}

export interface Edge {
  from: string
  to: string
  type: "positive" | "negative" | "mixed"
  matchingFields: string[]
  nonMatchingFields: string[]
  rulesUsed: string[][]
  matchScore: number
}

export interface UnifiedEdge {
  from: string
  to: string
  positiveFields: string[]
  negativeFields: string[]
  allRulesUsed: string[][]
  hasBothTypes: boolean
  matchScore: number
}

export interface ClusterAssignment {
  nodeId: string
  clusterId: number
}

export interface ClusteringResult {
  assignments: Map<string, number>
  clusterGroups: Map<number, Set<string>>
  qualityMetrics: ClusteringQualityMetrics
  constraintViolations: ConstraintViolation[]
}

export interface ClusteringQualityMetrics {
  totalNodes: number
  totalClusters: number
  positiveIntraClusterRatio: number
  negativeInterClusterRatio: number
  constraintViolations: number
  positiveWithinCluster: number
  positiveBetweenClusters: number
  negativeWithinCluster: number
  negativeBetweenClusters: number
}

export interface ConstraintViolation {
  node1: string
  node2: string
  cluster1: number
  cluster2: number
  negativeEdgeType: string
}

export interface DataRecord {
  "Record-Id": string
  "Salutation": string
  "First Name": string
  "Last Name": string
  "Email": string
  "Phone": string
  "Party": string
}

export interface DataExample {
  name: string
  data: DataRecord[]
} 