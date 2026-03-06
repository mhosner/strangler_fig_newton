---
description: "Phase 4: Subagent Migration — Reverse engineer business rules, generate specs, and TDD forward engineer the new microservice"
argument-hint: "[plan-id] [--strategy strangler-fig|branch-by-abstraction|event-interception|parallel-run]"
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write, Agent]
---

# Subagent Migration

You are orchestrating the actual extraction of code from the monolith to a new microservice.
This follows a strict discipline: reverse engineer → executable specs → TDD forward engineer.
NEVER blindly translate legacy code.

## Prerequisites
- Modernization plan and transitional design must exist
- Check `.sfn/plans/` and `.sfn/scaffolding/`

## Workflow

### Step 1: Select Migration Strategy
If not specified, query the strategy registry for applicable strategies and present options:
- **Strangler Fig** (default) — Route traffic through a facade
- **Branch by Abstraction** — Introduce abstraction, swap implementation
- **Event Interception** — Intercept message-based communication
- **Parallel Run** — Shadow traffic for high-risk slices

Generate the migration plan with ordered steps.

### Step 2: Reverse Engineering (Subagent)
Launch the **reverse-engineer** agent on the target slice:
- Extract business rules (NOT code)
- Separate core algorithms from boilerplate
- Identify and discard dead code and legacy workarounds
- Output structured BusinessRule objects

Present extracted rules to user for validation.

### Step 3: Generate Executable Specs (Subagent)
Launch the **spec-generator** agent:
- Create test cases for each business rule
- Cover happy paths, edge cases, constraint violations, error scenarios
- These specs become the contract between old and new

Present spec summary to user for validation.

### Step 4: TDD Forward Engineering (Subagent)
Launch the **forward-engineer** agent:
- Execute RED-GREEN-REFACTOR for each spec
- NEVER look at or copy legacy code
- Build the minimum implementation that passes all specs
- Report progress after each cycle

### Step 5: Track Progress
Use the WorkflowOrchestrator to:
- Check preconditions before each step
- Mark steps as in_progress → completed
- Persist state after each step
- Emit events for the audit trail

### Step 6: Present Results
Show migration progress dashboard.
Recommend next step: `/sfn-cutover`
