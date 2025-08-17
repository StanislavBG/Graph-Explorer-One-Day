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
  
  // Calculate the score based on your exact specification:
  const totalFieldsWithValues = matchingFields.length + nonMatchingFields.length
  
  if (totalFieldsWithValues === 0) {
    // All fields are missing (all partial) - NEUTRAL
    return { 
      status: "neutral", 
      matchingFields, 
      nonMatchingFields, 
      missingFields: missing,
      rulesUsed: [[rule.name]],
      score: 0 // Neutral rules have score 0
    }
  }
  
  // Determine status based on your exact specification:
  let status: 'positive' | 'negative' | 'neutral'
  let score = 0
  
  if (nonMatchingFields.length === 0 && missing.length === 0) {
    // All fields matching the rule - +1 POSITIVE
    status = "positive"
    score = 1.0
  } else if (nonMatchingFields.length > 0) {
    // Some fields not matching but present - NEGATIVE with score -(fields no match)/(total fields with values)
    status = "negative"
    score = -(nonMatchingFields.length / totalFieldsWithValues)
  } else if (matchingFields.length > 0 && missing.length > 0) {
    // Some fields matching and some are partial - NEUTRAL
    status = "neutral"
    score = 0
  } else {
    // All partial (missing) - NEUTRAL
    status = "neutral"
    score = 0
  }
  
  // Store the calculated score in the result
  return { 
    status, 
    matchingFields, 
    nonMatchingFields, 
    missingFields: missing,
    rulesUsed: [[rule.name]],
    score: score // Add the calculated score
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
    score: 0, // Neutral rules have score 0
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
  
  // Calculate scores based on individual rule scores from evaluateSingleRule
  let positiveScore = 0
  let negativeScore = 0
  let uniquePositiveRules = new Set<string>()
  
  for (const result of allResults) {
    if (result.status === 'positive' || result.status === 'negative') {
      // Use the actual score from evaluateSingleRule
      const ruleScore = result.score || 0
      
      if (result.status === 'positive') {
        positiveScore += ruleScore
        const ruleName = result.rulesUsed[0][0]
        uniquePositiveRules.add(ruleName)
      } else {
        negativeScore += ruleScore
      }
    }
  }
  
  // Final total score: sum of all individual rule scores
  const totalScore = positiveScore + negativeScore
  
  return {
    results: allResults,
    totalScore,
    positiveScore,
    negativeScore,
    uniquePositiveRules,
    multiplier: 1 // No multiplier needed with individual rule scores
  }
} 