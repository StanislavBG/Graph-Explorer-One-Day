// Match Rules Definitions - Pure data structure, no logic
import { MatchRule } from '@/types/match-rules'

// Each rule has: name, fields, children (for nested rules)
export const matchRules: MatchRule[] = [
  {
    name: "Rule-1",
    fields: ["salutation", "firstName", "lastName", "email"],
    children: [
      {
        name: "Rule-4",
        fields: ["firstName", "lastName", "email"],
        children: [
          {
            name: "Rule-5",
            fields: ["firstName", "email"],
            children: [
              { name: "Rule-7", fields: ["email"], children: [] },
            ],
          },
          {
            name: "Rule-6",
            fields: ["lastName", "email"],
            children: [
              { name: "Rule-7", fields: ["email"], children: [] },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "Rule-2",
    fields: ["salutation", "firstName", "lastName", "phone"],
    children: [
      {
        name: "Rule-8",
        fields: ["firstName", "lastName", "phone"],
        children: [
          {
            name: "Rule-9",
            fields: ["firstName", "phone"],
            children: [
              { name: "Rule-11", fields: ["phone"], children: [] },
            ],
          },
          {
            name: "Rule-10",
            fields: ["lastName", "phone"],
            children: [
              { name: "Rule-11", fields: ["phone"], children: [] },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "Rule-3",
    fields: ["salutation", "firstName", "lastName", "addressLine1", "city", "country"],
    children: [
      {
        name: "Rule-12",
        fields: ["firstName", "lastName", "addressLine1", "city", "country"],
        children: [
          {
            name: "Rule-13",
            fields: ["firstName", "addressLine1", "city", "country"],
            children: [],
          },
        ],
      },
    ],
  },
  {
    name: "Rule-14",
    fields: ["party", "phone"],
    children: [
      {
        name: "Rule-15",
        fields: ["phone"],
        children: [],
      },
    ],
  },
]

// Helper function to get rule fields by rule name
export function getRuleFields(ruleName: string): string[] {
  function findRule(rules: MatchRule[]): string[] | null {
    for (const rule of rules) {
      if (rule.name === ruleName) return rule.fields
      if (rule.children && rule.children.length > 0) {
        const found = findRule(rule.children)
        if (found) return found
      }
    }
    return null
  }
  return findRule(matchRules) || []
}

// Rule precedence order (highest to lowest)
export const rulePrecedence = [
  "Rule-1", // Salutation+First+Last+Email
  "Rule-2", // Salutation+First+Last+Phone
  "Rule-3", // Salutation+First+Last+Address
  "Rule-14" // Party+Phone
]

// Rule weights by level
export const ruleWeights = {
  1: 1.0,    // Level 1 rules
  2: 0.75,   // Level 2 rules
  3: 0.5,    // Level 3 rules
  4: 0.25,   // Level 4 rules
  5: 0.1     // Level 5 rules
} 