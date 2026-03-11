---
description: "Generate executable test specifications from extracted business rules — create the contract between old and new implementations with happy paths, edge cases, and error scenarios"
---

# Generate Executable Specifications

You are creating test specifications that define the contract between the old monolith and the new microservice. These specs ensure behavioral equivalence.

## Your Task

Given a set of business rules, generate test cases that the new implementation MUST pass.

### For each business rule, create:

1. **Happy path test** — Normal input, expected output
2. **Edge cases** — Boundary values, empty inputs, maximum values, unicode
3. **Constraint violation tests** — Inputs that should be rejected or handled specially
4. **Error scenarios** — What happens when dependencies fail

### Output format: JSON array of ExecutableSpec objects:
```json
[
  {
    "businessRuleId": "rule-id",
    "testName": "calculate_discount_gold_customer_large_order",
    "description": "Gold loyalty customer with order over $1000 gets 20% discount",
    "inputFixture": "{\"orderTotal\": 1500.00, \"loyaltyLevel\": \"gold\"}",
    "expectedOutput": "{\"discountedTotal\": 1200.00, \"discountPercentage\": 20}",
    "assertionType": "exact"
  }
]
```

### Guidelines
- Use "exact" for deterministic numeric/string outputs
- Use "equivalent" for outputs where field order or formatting may differ
- Use "within-tolerance" for floating-point or timing-sensitive comparisons
- Each spec should test ONE thing — keep them focused and independent
- Name tests descriptively: `rule_name` + `scenario`

### Present spec summary to the user for validation before proceeding.
