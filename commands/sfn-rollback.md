---
description: "Safety rollback — revert the last completed migration step(s) with guided procedures"
argument-hint: "[plan-id] [--steps N]"
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write]
---

# Migration Rollback

Safely revert migration work when something goes wrong.

## Workflow

### Step 1: Load Plan State
Read the migration plan and identify:
- Last completed step(s)
- Any in-progress or failed steps
- The rollback sequence (reverse order)

### Step 2: Present Rollback Options
Show the user:
- Which steps can be rolled back
- The rollback procedure for each step
- Whether each rollback is automated or requires manual verification
- Estimated impact of the rollback

### Step 3: Confirm with User
Before proceeding, explicitly confirm:
- "This will roll back step N: [step name]. This involves: [summary]. Proceed?"

### Step 4: Execute Rollback
Walk through rollback procedures in REVERSE order:
1. Follow the step's rollback instructions
2. Verify the monolith is functioning correctly after each step
3. Run the test suite to confirm no regressions
4. Mark each step as "rolled_back" in the plan

### Step 5: Update State
- Save the updated plan status
- Record the rollback in the event history and audit trail
- Show confirmation to the user

### Safety Rules
- ALWAYS confirm before each rollback step
- ALWAYS run tests after rollback
- NEVER skip verification steps
- If rollback fails, STOP and ask the user for guidance
