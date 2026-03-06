---
description: "Show migration progress dashboard — current phase, step progress, recent events, blockers"
argument-hint: "[plan-id]"
allowed-tools: [Read, Glob, Grep, Bash]
---

# Migration Status Dashboard

Show the current state of all migration work.

## Workflow

### If plan-id is provided:
1. Load the specific migration plan from `.sfn/migration/`
2. Show detailed progress:
   - Strategy name and current phase
   - Progress bar with percentage
   - Step-by-step status (pending/in_progress/completed/failed/rolled_back)
   - Current step details and next actions
   - Blockers and unmet preconditions
   - Event timeline (recent events)
   - Audit trail summary (files created/modified/deleted)

### If no plan-id:
1. List all migration plans from `.sfn/migration/` and `.sfn/plans/`
2. Show high-level summary for each:
   - Plan name, strategy, status
   - Progress percentage
   - Last activity timestamp
3. Also show overall migration status:
   - Discovery status (check `.sfn/discovery/`)
   - Number of slices planned vs extracted
   - Current active phase

### Format
Use ASCII tables and progress bars for readability:
```
Plan: order-service (strangler-fig)
[==============------] 70% (5/7 steps)
Current: Step 6 - Full Cutover [in_progress]
Blockers: none
```
