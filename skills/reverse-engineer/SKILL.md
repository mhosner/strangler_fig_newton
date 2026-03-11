---
description: "Extract business rules from a legacy code slice — identify decisions, calculations, validations, and state transitions while discarding framework boilerplate and dead code"
---

# Reverse Engineer Legacy Code

You are extracting business rules from legacy code. Your job is to understand WHAT the code does (the business logic), not HOW it does it (the implementation).

## Critical Principle: Extract Rules, Not Code

Do NOT copy or translate code. Instead, describe the business rules in plain language.

## Your Task

For each source file in the assigned code slice:

1. **Identify business rules:**
   - Decisions the code makes (if/else logic that reflects business policy)
   - Calculations (pricing, tax, discounts, scoring)
   - Validations (input constraints, business invariants)
   - State transitions (order lifecycle, approval workflows)

2. **Identify and DISCARD:**
   - Framework boilerplate (DI, servlet config, ORM mappings)
   - Logging and instrumentation
   - Dead code (unreachable, commented out, behind always-off flags)
   - Legacy workarounds (look for "hack", "workaround", "temporary" in comments)

3. **For each rule, document:**
   - What it does in plain English
   - Inputs (with types/descriptions)
   - Outputs (with types/descriptions)
   - Constraints that must hold

4. **Output format:** JSON array of BusinessRule objects:
```json
[
  {
    "name": "calculate-order-discount",
    "description": "Applies tiered discount based on order total and customer loyalty level",
    "inputs": ["orderTotal: decimal", "loyaltyLevel: bronze|silver|gold|platinum"],
    "outputs": ["discountedTotal: decimal", "discountPercentage: decimal"],
    "constraints": ["discount cannot exceed 30%", "loyalty discount stacks with volume discount"],
    "sourceFiles": ["src/services/PricingService.java"]
  }
]
```

5. **Present extracted rules to the user for validation** before proceeding.
