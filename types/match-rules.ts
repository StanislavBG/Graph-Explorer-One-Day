// Types specific to match rules and rule evaluation

export type MatchRule = {
  name: string
  fields: string[]
  children: MatchRule[]
}

export type RuleEvalResult = {
  status: 'positive' | 'negative' | 'neutral'
  matchingFields: string[]
  nonMatchingFields: string[]
  missingFields: string[]
  rulesUsed: string[][]
  score: number
  individualRuleStatuses?: Array<{
    ruleName: string
    status: 'positive' | 'negative' | 'neutral'
  }>
  // Add individual rule scores with multipliers for UI display
  individualRuleScores?: Array<{
    ruleName: string
    baseScore: number
    multiplier: number
    finalScore: number
    level: number
  }>
}

export interface RuleEvaluationContext {
  node1: any
  node2: any
  rule: MatchRule
  path: string[]
}

export interface RuleEvaluationResult {
  results: RuleEvalResult[]
  totalScore: number
  positiveScore: number
  negativeScore: number
  uniquePositiveRules: Set<string>
  multiplier: number
}

export interface MatchScoreCalculation {
  from: string
  to: string
  matchScore: number
  edgeType: "positive" | "negative" | "mixed"
  matchingFields: string[]
  nonMatchingFields: string[]
  rulesUsed: string[][]
  positiveScore: number
  negativeScore: number
  multiplier: number
} 