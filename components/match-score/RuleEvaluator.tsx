// Rule Evaluator - Pure rule evaluation logic, no visualization
import { MatchRule, RuleEvalResult, RuleEvaluationContext, RuleEvaluationResult } from '@/types/match-rules'
import { NodeData } from '@/types/common'
import { matchRules } from './MatchRules'

// Helper function to check for conflicts between two nodes
export function checkForConflicts(node1: any, node2: any): boolean {
  // Check for firstName conflicts (only defined vs defined conflicts)
  const hasFirstNameConflict = (node1.firstName !== undefined && node1.firstName !== "" && 
                               node2.firstName !== undefined && node2.firstName !== "" && 
                               node1.firstName !== node2.firstName)
  
  // Check for lastName conflicts (only defined vs defined conflicts)
  const hasLastNameConflict = (node1.lastName !== undefined && node1.lastName !== "" && 
                              node2.lastName !== undefined && node2.lastName !== "" && 
                              node1.lastName !== node2.lastName)
  
  return hasFirstNameConflict || hasLastNameConflict
}

// Helper function to find conflicting fields between two nodes
export function findConflictingFields(node1: any, node2: any): string[] {
  const conflicts: string[] = []
  
  // Check firstName conflicts
  if (node1.firstName !== undefined && node1.firstName !== "" && 
      node2.firstName !== undefined && node2.firstName !== "" && 
      node1.firstName !== node2.firstName) {
    conflicts.push("firstName")
  }
  
  // Check lastName conflicts
  if (node1.lastName !== undefined && node1.lastName !== "" && 
      node2.lastName !== undefined && node2.lastName !== "" && 
      node1.lastName !== node2.lastName) {
    conflicts.push("lastName")
  }
  
  return conflicts
}

// SIMPLIFIED Rule Evaluation - following user specifications exactly
export function evaluateRuleAll(
  rule: MatchRule, 
  node1: any, 
  node2: any, 
  path: string[] = []
): RuleEvalResult[] {
  // Check if all fields are present in both nodes
  const missing = rule.fields.filter(f => {
    const val1 = node1[f]
    const val2 = node2[f]
    // Field is missing if it's null, undefined, or empty string
    return val1 == null || val2 == null || val1 === undefined || val2 === undefined || val1 === "" || val2 === ""
  })
  
  // If any field is missing, rule evaluates to NEUTRAL (0)
  if (missing.length > 0) {
    // Try children rules (OR logic)
    let results: RuleEvalResult[] = []
    for (const child of rule.children || []) {
      const childResults = evaluateRuleAll(child, node1, node2, [...path, rule.name])
      results = results.concat(childResults)
    }
    
    if (results.length > 0) {
      return results
    }
    
    // No children or all children neutral - return neutral
    return [{ 
      status: "neutral", 
      matchingFields: [],
      nonMatchingFields: [],
      missingFields: missing,
      rulesUsed: [[...path, rule.name]]
    }]
  }
  
  // All fields present - now check for conflicts
  const matchingFields: string[] = []
  const nonMatchingFields: string[] = []
  
  for (const f of rule.fields) {
    const val1 = node1[f]
    const val2 = node2[f]
    
    if (val1 === val2) {
      matchingFields.push(f)
    } else {
      nonMatchingFields.push(f)
    }
  }
  
  // Determine result based on user specifications:
  // - All fields match → POSITIVE (1)
  // - Any field conflicts → NEGATIVE (-1)
  // - Any field missing → NEUTRAL (0) - handled above
  
  if (nonMatchingFields.length > 0) {
    // Has conflicts → NEGATIVE
    return [{ 
      status: "negative", 
      matchingFields, 
      nonMatchingFields, 
      missingFields: [], 
      rulesUsed: [[...path, rule.name]] 
    }]
  } else {
    // All fields match → POSITIVE
    return [{ 
      status: "positive", 
      matchingFields, 
      nonMatchingFields: [], 
      missingFields: [], 
      rulesUsed: [[...path, rule.name]] 
    }]
  }
}

// Evaluate all rules for a node pair and return comprehensive results
export function evaluateAllRules(node1: NodeData, node2: NodeData): RuleEvaluationResult {
  const allResults: RuleEvalResult[] = []
  
  // Import matchRules here to avoid circular dependency
  // const { matchRules } = require('./MatchRules') // This line is removed
  
  for (const rule of matchRules) {
    try {
      allResults.push(...evaluateRuleAll(rule, node1, node2))
    } catch (error) {
      console.warn(`Error evaluating rule ${rule.name}:`, error)
      continue
    }
  }
  
  // Calculate scores based on user specifications:
  // L1 rules × 1.0, L2 rules × 0.75, L3 rules × 0.5, L4 rules × 0.25, L5 rules × 0.1
  let positiveScore = 0
  let negativeScore = 0
  let uniquePositiveRules = new Set<string>()
  
  for (const result of allResults) {
    if (result.status === 'positive' || result.status === 'negative') {
      const ruleLevel = result.rulesUsed[0].length
      let ruleWeight: number
      
      switch (ruleLevel) {
        case 1: ruleWeight = 1.0; break
        case 2: ruleWeight = 0.75; break
        case 3: ruleWeight = 0.5; break
        case 4: ruleWeight = 0.25; break
        case 5: ruleWeight = 0.1; break
        default: ruleWeight = 0.1; break
      }
      
      if (result.status === 'positive') {
        positiveScore += ruleWeight
        const ruleName = result.rulesUsed[0][0]
        uniquePositiveRules.add(ruleName)
      } else {
        negativeScore += ruleWeight
      }
    }
  }
  
  // Apply multiplicative bonus for multiple UNIQUE positive rules
  // 1.1x for 2+ unique rules, 1.2x for 3+ unique rules, 1.3x for 4+ unique rules, etc.
  const uniquePositiveRuleCount = uniquePositiveRules.size
  const multiplier = uniquePositiveRuleCount > 1 ? 1 + (uniquePositiveRuleCount - 1) * 0.1 : 1
  const adjustedPositiveScore = positiveScore * multiplier
  
  // Final total score: adjusted positive - negative
  const totalScore = adjustedPositiveScore - negativeScore
  
  return {
    results: allResults,
    totalScore,
    positiveScore,
    negativeScore,
    uniquePositiveRules,
    multiplier
  }
} 