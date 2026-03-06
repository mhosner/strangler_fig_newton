# Strangler Fig Newton

A Claude Code plugin for systematically migrating legacy monoliths to microservices, inspired by Martin Fowler's Strangler Fig pattern and the awesome Obra Superpowers approach and architecture. 

## Overview

Strangler Fig Newton guides you through a 5-phase workflow for decomposing legacy systems into microservices. Inspired by the [Strangler Fig pattern](https://martinfowler.com/bliki/StranglerFigApplication.html), it combines discovery, planning, scaffolding, migration, and cutover into executable workflows — avoiding common pitfalls like the Feature Parity Trap.

The plugin works alongside Claude Code to read your codebase, understand business logic, design transitional architectures, and execute migrations safely.

## Key Features

- **5-Phase Workflow**: Discovery → Planning → Scaffolding → Migration → Cutover
- **Avoid Feature Parity Trap**: Intelligent slice ranking to pick the "second riskiest" slice first
- **Multiple Migration Strategies**: Strangler Fig, Event Interception, Legacy Mimic, Branch by Abstraction, Parallel Run
- **Language Agnostic**: Built-in profiles for Node.js, Python, Java Spring, .NET
- **Transitional Architecture Patterns**: Event Interception, Legacy Mimic, Revert to Source
- **Reverse & Forward Engineering**: Extract business rules, generate executable specs, TDD your new services
- **Safe Cutover**: Parallel run test, gradual traffic diversion, monitoring & alerting setup, automated rollback
- **Audit Trail**: Full state persistence tracking every decision and migration step

## Architecture

### Phase 1: Discovery (`sfn-discover`)
Investigate your monolith before planning anything. The plugin:
- **Chunks the codebase** into semantic units
- **Extracts entities** (models, services, repositories, API endpoints)
- **Traces data flows** to understand coupling
- **Profiles the language** to apply language-specific rules

### Phase 2: Planning (`sfn-plan`)
Slice the monolith intelligently. The plugin:
- **Extracts product lines and value streams** to identify candidate services
- **Checks feature parity** requirements
- **Ranks slices** by complexity and risk (avoiding the Feature Parity Trap)
- **Generates a modernization plan** with sequenced slices

### Phase 3: Scaffolding (`sfn-scaffold`)
Design the transitional architecture. The plugin:
- **Recommends migration patterns** (Strangler Fig, Event Interception, Legacy Mimic, etc.)
- **Designs seams** in the monolith for interception points
- **Configures pattern parameters** (topic names, transformation rules, etc.)

### Phase 4: Migration (`sfn-migrate`)
Execute the migration for a single slice. The plugin:
- **Reverse engineers** business rules from legacy code
- **Generates executable specifications** (contracts, state machines, event schemas)
- **TDD forward engineers** the new service (scaffolding tests first)
- **Orchestrates the workflow** across multiple strategies and iterations

### Phase 5: Cutover (`sfn-cutover`)
Deploy safely and validate. The plugin:
- **Runs the new service in parallel** with the legacy system
- **Diverts traffic gradually** from legacy to new (shadow, canary, or blue-green)
- **Generates monitoring and alerting** rules
- **Manages rollback** if issues arise
- **Maintains an audit trail** of all cutover events

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- Claude Code

### Installation

Clone the repository:
```bash
git clone <repo-url>
cd strangler_fig_newton
npm install
```

Build the project:
```bash
npm run build
```

### Quick Start

1. **Open the target monolith project** in your IDE
2. **Run `/sfn-discover`** to analyze your codebase
3. **Run `/sfn-plan`** to identify candidate slices
4. **Run `/sfn-scaffold`** to design the transitional architecture
5. **Run `/sfn-migrate`** to execute the migration for a slice
6. **Run `/sfn-cutover`** to deploy and gradually shift traffic

State is persisted in `.sfn/` within your project, so you can pause and resume at any time.

## Usage

### Slash Commands

- **`/sfn-discover`** — Analyze the monolith, chunk code, extract entities, trace data flows
- **`/sfn-plan`** — Identify slices, rank by complexity/risk, generate a modernization plan
- **`/sfn-scaffold`** — Design transitional architecture, configure patterns, define seams
- **`/sfn-migrate`** — Reverse engineer, generate specs, TDD forward engineer, orchestrate migration
- **`/sfn-cutover`** — Run in parallel, divert traffic, monitor, validate, rollback if needed
- **`/sfn-status`** — View current migration progress and state
- **`/sfn-rollback`** — Revert a migration to the previous state

### Subagents (Discovery)

Lightweight subagents run in parallel on Sonnet for fast, read-only analysis:
- **Codebase Chunker** — Segments code into semantic modules
- **Entity Relationship Extractor** — Identifies DB tables, queues, and their relationships
- **Data Flow Tracer** — Maps upstream sources and downstream consumers

### Skills (Migration)

Context-heavy skills run in the main conversation for deep reasoning and user interaction:
- **Reverse Engineer** — Extracts business rules from legacy code (not the code itself)
- **Spec Generator** — Creates executable test specifications as the contract between old and new
- **Forward Engineer** — TDD builds the new service (RED-GREEN-REFACTOR per spec)

## Project Structure

```
strangler_fig_newton/
├── src/
│   ├── index.ts                   # Entry point
│   ├── core/                      # Shared types, config, state, errors
│   │   ├── types.ts               # Core interfaces and enums
│   │   ├── events.ts              # Event definitions
│   │   ├── state.ts               # State persistence
│   │   ├── config.ts              # Configuration management
│   │   ├── errors.ts              # Custom error classes
│   │   └── utils.ts               # Utilities
│   ├── discovery/                 # Phase 1: Discovery
│   │   ├── codebase-chunker.ts
│   │   ├── entity-extractor.ts
│   │   ├── data-flow-tracer.ts
│   │   ├── language-profiles/     # Node, Python, Java Spring, .NET
│   │   └── index.ts
│   ├── planning/                  # Phase 2: Planning
│   │   ├── product-line-extractor.ts
│   │   ├── value-stream-extractor.ts
│   │   ├── feature-parity-checker.ts
│   │   ├── slice-ranker.ts
│   │   ├── modernization-plan.ts
│   │   └── index.ts
│   ├── scaffolding/               # Phase 3: Scaffolding
│   │   ├── pattern-recommender.ts
│   │   ├── seam-designer.ts
│   │   ├── patterns/              # Event Interception, Legacy Mimic, Revert to Source
│   │   └── index.ts
│   ├── migration/                 # Phase 4: Migration
│   │   ├── strategy.interface.ts  # Strategy contract
│   │   ├── strategy-registry.ts
│   │   ├── reverse-engineer.ts
│   │   ├── spec-generator.ts
│   │   ├── forward-engineer.ts
│   │   ├── plan-generator.ts
│   │   ├── progress-tracker.ts
│   │   ├── workflow-orchestrator.ts
│   │   ├── strategies/            # Strangler Fig, Branch by Abstraction,
│   │   │                          # Event Interception, Parallel Run
│   │   └── index.ts
│   └── verification/              # Phase 5: Cutover
│       ├── parallel-runner.ts
│       ├── traffic-diverter.ts
│       ├── monitoring-generator.ts
│       ├── rollback-manager.ts
│       ├── audit-trail.ts
│       └── index.ts
├── commands/                      # Slash command definitions (markdown)
├── agents/                        # Discovery subagent definitions (markdown)
├── skills/                        # Migration skill definitions (markdown)
├── package.json
├── tsconfig.json
├── CLAUDE.md                      # Plugin development guide
└── README.md
```

## Build & Test

### Build
```bash
npm run build
```
Compiles TypeScript to JavaScript in the `dist/` directory.

### Type Check
```bash
npm run typecheck
```
Validates types without emitting code.

### Test
```bash
npm test
```
Runs the full test suite across all phases.

### Test a Specific Phase
```bash
npm test -- --filter discovery
npm test -- --filter planning
npm test -- --filter scaffolding
npm test -- --filter migration
npm test -- --filter verification
```

## Technical Conventions

- **Language**: TypeScript with strict mode enabled
- **Module System**: Node16 ESM (`*.js` extensions in imports)
- **Dependencies**: No runtime dependencies—only devDependencies for tooling
- **IDs**: UUIDs from `crypto.randomUUID()`
- **Timestamps**: ISO 8601 strings
- **State**: JSON persisted in `.sfn/` within the target project
- **Errors**: Custom error classes with context inheritance

## Common Workflows

### Migrate a Single Slice
```
1. /sfn-discover           # Understand the monolith
2. /sfn-plan               # Identify and rank slices
3. /sfn-scaffold [slice]   # Design transitional architecture
4. /sfn-migrate [slice]    # Execute the migration
5. /sfn-cutover [slice]    # Deploy and validate
```

### Resume After Interruption
```
1. /sfn-status             # Check current state
2. [pick up from last completed phase]
```

### Rollback a Migration
```
1. /sfn-rollback [slice]   # Revert to previous state
2. Debug and fix
3. /sfn-migrate [slice]    # Try again
```

## Design Principles

1. **Avoid Feature Parity Trap**: Instead of trying to achieve 100% feature parity before cutover, slice strategically (pick the second riskiest first) to learn and iterate.
2. **Transitional Architecture**: Use patterns like Event Interception, Legacy Mimic, and Revert to Source to run old and new systems side-by-side safely.
3. **Reverse Then Forward**: Extract business rules from legacy code via reverse engineering, then TDD your new service.
4. **Safe Defaults**: Parallel run testing, gradual traffic diversion, and automated rollback reduce risk.
5. **Full Transparency**: State and audit trails let you understand every decision and revert if needed.

## Contributing

This project is structured to be extended. To add a new migration strategy:

1. Create a new file in `src/migration/strategies/`
2. Implement the interface from `src/migration/strategy.interface.ts`
3. Register it in `src/migration/strategy-registry.ts`
4. Add tests
5. Document it in the slash command definitions

## License

MIT

## Resources

- [Strangler Fig Pattern](https://martinfowler.com/bliki/StranglerFigApplication.html) — Martin Fowler
- [Microservices Patterns](https://microservices.io/patterns/index.html) — Chris Richardson
- [Building Microservices](https://www.oreilly.com/library/view/building-microservices-2nd/9781492034018/) — Sam Newman
- [Value Stream Mapping](https://en.wikipedia.org/wiki/Value_stream_mapping) — Lean methodology

## Support

For issues, questions, or ideas, please open a GitHub issue or contact the maintainers.

---

**Strangler Fig Newton** — Safely migrate your monolith. In phases. With confidence.
