---
description: "Phase 5: Divert the Flow — Parallel run, gradual traffic diversion, and monitoring setup for safe cutover"
---

# Divert the Flow

You are managing the safe transition of production traffic from the monolith to the new
microservice. This is NOT a big-bang cutover. Traffic is diverted gradually with monitoring
at every stage and instant rollback capability.

## Prerequisites
- Migration must be complete (all TDD specs passing)
- Check `.sfn/migration/` for completed plan

## Workflow

### Step 1: Configure Parallel Run
Set up both systems to run simultaneously:
- Configure traffic mirroring at the load balancer
- New service processes requests in SHADOW MODE (results not served to users)
- Log all response pairs for comparison

### Step 2: Run Divergence Analysis
Compare monolith and new service responses:
- Match requests by ID
- Categorize divergences: data-mismatch, error, timing, missing-field
- Calculate divergence rate
- Target: < 0.1% divergence

If divergence is too high, fix issues and re-run. Do NOT proceed to traffic diversion
until divergence is acceptable.

### Step 3: Generate Traffic Diversion Plan
Create a staged diversion plan:
- Stage 1: 1% traffic (canary)
- Stage 2: 5% traffic
- Stage 3: 25% traffic
- Stage 4: 50% traffic
- Stage 5: 100% traffic

Each stage has:
- Duration (how long to observe before advancing)
- Rollback thresholds (error rate, p99 latency)

Generate load balancer configuration snippets.

### Step 4: Generate Monitoring & Alerting
Create monitoring configuration for the new service:
- Health check endpoints
- Error rate alerts
- Latency alerts (p50, p95, p99)
- Divergence detection alerts
- SLO targets

Generate platform-specific configs (Prometheus, Datadog, CloudWatch).

### Step 5: Execute Diversion (with user confirmation at each stage)
Walk through each stage:
1. Update traffic split configuration
2. Wait for observation period
3. Check metrics against rollback thresholds
4. Ask user for confirmation before advancing to next stage

### Step 6: Decommission
Once at 100% and stable:
- Remove monolith code for this slice
- Remove traffic mirroring infrastructure
- Remove temporary scaffolding artifacts
- Update documentation

Record completion in audit trail.
