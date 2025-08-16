// Rule Evaluator - Pure rule evaluation logic, no visualization
import { MatchRule, RuleEvalResult, RuleEvaluationResult } from '@/types/match-rules'
import { NodeData } from '@/types/common'
import { matchRules } from './MatchRules'

// ============================================================================
// SINGLE RULE EVALUATION - Pure logic for evaluating one individual rule
// ============================================================================

// Evaluate a single rule in isolation - no children, no scoring, just rule status
export function evaluateSingleRule(rule: MatchRule, node1: NodeData, node2: NodeData): RuleEvalResult {
  const matchingFields: string[] = []
  const nonMatchingFields: string[] = []
  const missing: string[] = []
  
  // Single loop to evaluate all fields
  for (const f of rule.fields) {
    const val1 = (node1 as any)[f]
    const val2 = (node2 as any)[f]
    
    // Check if field is missing (null, undefined, or empty string)
    if (val1 == null || val2 == null || val1 === undefined || val2 === undefined || val1 === "" || val2 === "") {
      missing.push(f)
    } else {
      // Field is present - check for match or conflict
      if (val1 === val2) {
        matchingFields.push(f)
      } else {
        nonMatchingFields.push(f)
      }
    }
  }
  
  // Determine result based on field status
  if (missing.length > 0) {
    // Any field missing → NEUTRAL
    return { 
      status: "neutral", 
      matchingFields, 
      nonMatchingFields, 
      missingFields: missing,
      rulesUsed: [[rule.name]]
    }
  } else if (nonMatchingFields.length > 0) {
    // All fields present but some conflict → NEGATIVE
    return { 
      status: "negative", 
      matchingFields, 
      nonMatchingFields, 
      missingFields: [], 
      rulesUsed: [[rule.name]] 
    }
  } else {
    // All fields present and match → POSITIVE
    return { 
      status: "positive", 
      matchingFields, 
      nonMatchingFields: [], 
      missingFields: [], 
      rulesUsed: [[rule.name]] 
    }
  }
}

// ============================================================================
// RULESET EVALUATION - Logic for combining multiple rules and their children
// ============================================================================

// Evaluate a ruleset with hierarchical logic (OR logic for children)
export function evaluateRuleset(rule: MatchRule, node1: NodeData, node2: NodeData, path: string[] = []): RuleEvalResult[] {
  // First, evaluate this single rule in isolation
  const singleRuleResult = evaluateSingleRule(rule, node1, node2)
  
  // Build the complete rule path for this rule
  const currentPath = [...path, rule.name]
  
  // If rule is positive or negative, return it with the complete path
  if (singleRuleResult.status === "positive" || singleRuleResult.status === "negative") {
    return [{
      ...singleRuleResult,
      rulesUsed: [currentPath],
      // Store individual rule status for this rule
      individualRuleStatuses: [{ ruleName: rule.name, status: singleRuleResult.status }]
    }]
  }
  
  // Rule is neutral - evaluate children (OR logic)
  let results: RuleEvalResult[] = []
  
  for (const child of rule.children || []) {
    const childResults = evaluateRuleset(child, node1, node2, currentPath)
    results = results.concat(childResults)
  }
  
  if (results.length > 0) {
    // For neutral parents with child results, we need to store the individual rule statuses
    // so the UI can color each rule correctly
    return results.map(childResult => ({
      ...childResult,
      // Store the individual rule statuses in the path for UI coloring
      individualRuleStatuses: [
        { ruleName: rule.name, status: singleRuleResult.status }, // Parent rule status
        ...(childResult.individualRuleStatuses || []) // Child rule statuses
      ]
    }))
  }
  
  // No children or all children neutral - return neutral with complete path
  return [{
    ...singleRuleResult,
    rulesUsed: [currentPath],
    // Store individual rule status for this rule
    individualRuleStatuses: [{ ruleName: rule.name, status: singleRuleResult.status }]
  }]
}

// Evaluate all rules for a node pair and return comprehensive results
export function evaluateAllRules(node1: NodeData, node2: NodeData): RuleEvaluationResult {
  const allResults: RuleEvalResult[] = []
  
  for (const rule of matchRules) {
    try {
      const ruleResults = evaluateRuleset(rule, node1, node2)
      allResults.push(...ruleResults)
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