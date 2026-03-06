# Strangler Fig Newton

A Claude Code plugin for legacy displacement: systematically migrating monoliths to microservices.

## Architecture

5-phase workflow modeled as Claude Code skills, inspired by the Superpowers framework:

1. **Discovery** (`/sfn-discover`) — Investigate before planning. Chunk codebase, extract entities, trace data flows.
2. **Planning** (`/sfn-plan`) — Slice the monolith. Avoid Feature Parity Trap. Pick the "second riskiest" slice.
3. **Scaffolding** (`/sfn-scaffold`) — Design transitional architecture (Event Interception, Legacy Mimic, Revert to Source).
4. **Migration** (`/sfn-migrate`) — Reverse engineer business rules, generate executable specs, TDD forward engineer.
5. **Cutover** (`/sfn-cutover`) — Parallel run, gradual traffic diversion, monitoring/alerting.

## Conventions

- TypeScript strict mode, Node16 module resolution
- No runtime dependencies — only devDependencies for build tooling
- All imports use `.js` extensions (Node16 ESM)
- Plugin guides Claude through workflows; Claude does the actual code reading/writing
- State persisted as JSON in `.sfn/` within the target project
- All IDs are UUIDs from `crypto.randomUUID()`
- Timestamps are ISO strings

## Project Structure

- `src/core/` — Types, events, config, state persistence, errors, utils
- `src/discovery/` — Phase 1: codebase chunker, entity extractor, data flow tracer, language profiles
- `src/planning/` — Phase 2: product line/value stream extraction, feature parity checker, slice ranker
- `src/scaffolding/` — Phase 3: transitional pattern registry, pattern recommender, seam designer
- `src/migration/` — Phase 4: strategy registry, 4 strategies, reverse/forward engineer, spec generator, orchestrator
- `src/verification/` — Phase 5: parallel runner, traffic diverter, monitoring generator, rollback manager, audit trail
- `commands/` — Slash command definitions (markdown)
- `agents/` — Subagent definitions (markdown)

## Build & Test

```bash
npm run build      # TypeScript compilation
npm run typecheck   # Type checking without emit
npm test           # Run tests
```
