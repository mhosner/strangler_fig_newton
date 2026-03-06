---
description: "Phase 1: AI-Assisted Discovery — Scan and analyze a monolith codebase before any modernization planning begins"
argument-hint: "[path-to-monolith]"
allowed-tools: [Read, Glob, Grep, Bash, Agent]
---

# Legacy Discovery

You are an investigative architect. Do NOT try to rewrite or modernize anything yet.
Your job is to deeply understand this monolith before any plans are made.

## Workflow

### Step 1: Detect Languages and Frameworks
Use file-existence heuristics to detect:
- Languages: Java/Spring, Node.js, Python, .NET
- Frameworks: Spring Boot, Express, NestJS, Django, Flask, FastAPI, ASP.NET
- Build tools: Maven, Gradle, npm, pip, dotnet

### Step 2: Launch Discovery Subagents (in parallel)
Launch these 3 agents simultaneously:
1. **codebase-chunker** — Break the monolith into manageable modules
2. **entity-relationship-extractor** — Find DB tables, queues, transactions, and their relationships
3. **data-flow-tracer** — Map upstream sources and downstream consumers

### Step 3: Compile Results
Combine subagent results into a unified MonolithProfile:
- Languages and frameworks detected
- Module/chunk map with file counts and complexity
- Entity relationship diagram
- System context diagram (upstream/downstream flows)

### Step 4: Persist State
Save all results to `.sfn/discovery/` as JSON files:
- `.sfn/discovery/profile.json`
- `.sfn/discovery/entities.json`
- `.sfn/discovery/data-flows.json`

### Step 5: Present Findings
Show the user a summary of:
- Detected tech stack
- Module breakdown (table with name, path, file count, complexity)
- Key entities and their relationships
- System context diagram (ASCII art showing upstream → system → downstream)

Ask the user to validate and correct the findings before proceeding to `/sfn-plan`.
