// Match Score Calculator - Pure edge calculation logic, no visualization
import { NodeData, Edge, UnifiedEdge } from '@/types/common'
import { evaluateAllRules } from './RuleEvaluator'
import { RuleEvaluationResult } from '@/types/match-rules'
import { matchRules, rulePrecedence } from './MatchRules'

// Generate overall edges based on rule evaluation precedence
export function calculateEdges(nodeData: NodeData[]): Edge[] {
  try {
    const edgeMap = new Map<string, Edge>()
    
    for (let i = 0; i < nodeData.length; i++) {
      for (let j = i + 1; j < nodeData.length; j++) {
        try {
          const node1 = nodeData[i]
          const node2 = nodeData[j]
          if (!node1 || !node2) continue
          
          // Evaluate all rules to get comprehensive results
          const evaluationResult = evaluateAllRules(node1, node2)
          const allResults = evaluationResult.results
          

          
          // Determine overall edge status based on rule precedence
          let overallStatus: 'positive' | 'negative' | 'neutral' = 'neutral'
          let matchingFields: string[] = []
          let nonMatchingFields: string[] = []
          let rulesUsed: string[][] = []
          
          // Group results by top-level rule
          const ruleResults: { [ruleName: string]: any[] } = {}
          for (const result of allResults) {
            const topRule = result.rulesUsed[0][0]
            if (!ruleResults[topRule]) {
              ruleResults[topRule] = []
            }
            ruleResults[topRule].push(result)
          }
          
          // Check each rule in order of precedence and collect results
          const ruleResultsByPrecedence: { ruleName: string; status: 'positive' | 'negative' | 'neutral'; result: any }[] = []
          
          for (const rule of matchRules) {
            const resultsForThisRule = ruleResults[rule.name] || []
            
            if (resultsForThisRule.length > 0) {
              // Find the highest precedence result for this rule (shortest path)
              let highestPrecedenceResult = resultsForThisRule[0]
              for (const result of resultsForThisRule) {
                if (result.rulesUsed[0].length < highestPrecedenceResult.rulesUsed[0].length) {
                  highestPrecedenceResult = result
                }
              }
              
              // Record the result for this rule
              ruleResultsByPrecedence.push({
                ruleName: rule.name,
                status: highestPrecedenceResult.status,
                result: highestPrecedenceResult
              })
            }
          }

          // Calculate Match Score based on ALL results (including child rules)
          let matchScore = 0
          let positiveScore = 0
          let negativeScore = 0
          let uniquePositiveRules = new Set<string>()
          
          for (const result of allResults) {
            const ruleLevel = result.rulesUsed[0].length
            // Use correct scoring weights: L1=1.0, L2=0.75, L3=0.5, L4=0.25, L5=0.1
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
            } else if (result.status === 'negative') {
              negativeScore += ruleWeight
            }
            // Neutral status contributes 0 to the score
          }
          
          // Apply multiplicative bonus for multiple UNIQUE positive rules
          const uniquePositiveRuleCount = uniquePositiveRules.size
          const multiplier = uniquePositiveRuleCount > 1 ? 1 + (uniquePositiveRuleCount - 1) * 0.1 : 1
          const adjustedPositiveScore = positiveScore * multiplier
          
          // Final match score: adjusted positive - negative
          matchScore = adjustedPositiveScore - negativeScore
          
          // Determine overall status based on OR logic across all rule chains
          if (ruleResultsByPrecedence.length > 0) {
            // Check if ANY rule chain resulted in positive (OR logic)
            const hasPositiveResult = ruleResultsByPrecedence.some(r => r.status === 'positive')
            
            if (hasPositiveResult) {
              // If any rule chain is positive, overall is positive
              overallStatus = 'positive'
              // Find the first positive result to get its details
              const positiveResult = ruleResultsByPrecedence.find(r => r.status === 'positive')
              if (positiveResult) {
                matchingFields = positiveResult.result.matchingFields || []
                nonMatchingFields = positiveResult.result.nonMatchingFields || []
                rulesUsed = positiveResult.result.rulesUsed || []
              }
            } else {
              // If no positive results, check for negative results
              const hasNegativeResult = ruleResultsByPrecedence.some(r => r.status === 'negative')
              
              if (hasNegativeResult) {
                overallStatus = 'negative'
                // Find the first negative result to get its details
                const negativeResult = ruleResultsByPrecedence.find(r => r.status === 'negative')
                if (negativeResult) {
                  matchingFields = []
                  nonMatchingFields = negativeResult.result.nonMatchingFields || []
                  rulesUsed = negativeResult.result.rulesUsed || []
                }
              } else {
                // Only neutral results
                overallStatus = 'neutral'
                const neutralResult = ruleResultsByPrecedence[0]
                if (neutralResult) {
                  matchingFields = neutralResult.result.matchingFields || []
                  nonMatchingFields = neutralResult.result.nonMatchingFields || []
                  rulesUsed = neutralResult.result.rulesUsed || []
                }
              }
            }
          }
          
          // IMPORTANT: Create edges ONLY when there are positive OR negative rule evaluations
          // This follows the user specification: "An edge should be drawn even if the score is 0 
          // as long one of the sub-trees has a positive or negative match rule evaluated"
          // Check ALL results (including child rules) for positive/negative status
          const hasPositiveOrNegativeRules = allResults.some((r: any) => 
            r.status === 'positive' || r.status === 'negative'
          )
          
          if (hasPositiveOrNegativeRules) {
            // Determine edge type based on match score sign
            let edgeType: "positive" | "negative" | "mixed"
            if (matchScore > 0.001) {
              edgeType = "positive"
            } else if (matchScore < -0.001) {
              edgeType = "negative"
            } else {
              // Score is 0 but has positive/negative rules - show as mixed edge
              edgeType = "mixed"
            }
            

            

            
            edgeMap.set(
              node1.recordId + '-' + node2.recordId,
              {
                from: node1.recordId,
                to: node2.recordId,
                type: edgeType,
                matchingFields,
                nonMatchingFields,
                rulesUsed,
                matchScore: parseFloat(matchScore.toFixed(3)), // Round to 3 decimal places
                results: allResults, // Store complete rule evaluation results including child rules
              }
            )
            console.log(`EDGE CREATED: ${node1.recordId} <-> ${node2.recordId} | Type: ${edgeType} | Score: ${matchScore.toFixed(3)}`)
          }
        } catch (error) {
          console.warn(`Error processing node pair ${i}-${j}:`, error)
          continue
        }
      }
    }
    return Array.from(edgeMap.values())
  } catch (error) {
    console.error('Error generating edges:', error)
    return []
  }
}

// Create unified edges that combine positive and negative relationships
export function createUnifiedEdges(edges: Edge[], nodeData: NodeData[]): UnifiedEdge[] {
  const edgeMap = new Map<string, any>()
  
  // Group edges by node pairs and recalculate scores with multiplicative bonus
  edges.forEach((edge) => {
    const key = [edge.from, edge.to].sort().join('-')
    
    if (!edgeMap.has(key)) {
      // Recalculate the actual score with multiplicative bonus for this node pair
      const node1 = nodeData.find(n => n.recordId === edge.from)
      const node2 = nodeData.find(n => n.recordId === edge.to)
      
      let actualScore = 0
      let positiveFields: string[] = []
      let negativeFields: string[] = []
      let allRulesUsed: string[][] = []
      
      if (node1 && node2) {
        // Evaluate all rules to get current score
        const evaluationResult = evaluateAllRules(node1, node2)
        actualScore = evaluationResult.totalScore
        positiveFields = evaluationResult.results
          .filter(r => r.status === 'positive')
          .flatMap(r => r.matchingFields)
        negativeFields = evaluationResult.results
          .filter(r => r.status === 'negative')
          .flatMap(r => r.nonMatchingFields)
        allRulesUsed = evaluationResult.results.flatMap(r => r.rulesUsed)
      }
      
      edgeMap.set(key, {
        from: edge.from,
        to: edge.to,
        positiveFields: positiveFields,
        negativeFields: negativeFields,
        allRulesUsed: allRulesUsed,
        hasBothTypes: false,
        matchScore: actualScore
      })
    }
  })
  
  // Mark edges that have both positive and negative aspects
  edgeMap.forEach((unified) => {
    unified.hasBothTypes = unified.positiveFields.length > 0 && unified.negativeFields.length > 0
  })
  
  return Array.from(edgeMap.values())
} 