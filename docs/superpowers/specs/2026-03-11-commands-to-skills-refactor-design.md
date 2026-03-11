# Design: Extract Phase Workflow Logic into Skills

**Date:** 2026-03-11
**Status:** Approved

## Problem

The 5 SFN phase commands (`sfn-discover`, `sfn-plan`, `sfn-scaffold`, `sfn-migrate`, `sfn-cutover`) embed their entire workflow logic inside the command file. This means:

1. Claude cannot invoke a phase programmatically — attempting `Skill tool` with `sfn-discover` fails because it is registered as a command, not a skill.
2. The pattern is inconsistent: `sfn-migrate` already delegates to 3 sub-skills (`reverse-engineer`, `spec-generator`, `forward-engineer`), but the other phases do not.
3. A future `/sfn-run` orchestrator command cannot reuse phase logic without duplication.

## Approach: Thin Commands + Full Skills (Option A)

All workflow logic moves from command files into corresponding skill files. Commands become thin stubs that accept user arguments and invoke the skill.

### File Changes

**New skills (4 files):**
- `skills/sfn-discover.md` — full workflow from `commands/sfn-discover.md`
- `skills/sfn-plan.md` — full workflow from `commands/sfn-plan.md`
- `skills/sfn-scaffold.md` — full workflow from `commands/sfn-scaffold.md`
- `skills/sfn-cutover.md` — full workflow from `commands/sfn-cutover.md`

**Thinned commands (4 files):**
- `commands/sfn-discover.md` — stub only
- `commands/sfn-plan.md` — stub only
- `commands/sfn-scaffold.md` — stub only
- `commands/sfn-cutover.md` — stub only

**Unchanged (5 files):**
- `commands/sfn-migrate.md` — already delegates to sub-skills
- `commands/sfn-status.md` — no workflow logic to extract
- `commands/sfn-rollback.md` — no workflow logic to extract
- `skills/reverse-engineer.md` — unchanged
- `skills/spec-generator.md` — unchanged
- `skills/forward-engineer.md` — unchanged

### Skill Format

Matches existing `reverse-engineer.md` pattern:
- Frontmatter: `description` only — no `tools` list (tools belong to commands/agents)
- Body: full workflow steps, unchanged from the current command content

### Thin Command Stub Format

```markdown
---
description: "Phase N: <original description>"
argument-hint: "<original hint>"
allowed-tools: [<original tools>]
---

Use the `sfn-<phase>` skill to run <phase> on $ARGUMENTS.
```

Commands retain: `description`, `argument-hint`, `allowed-tools` frontmatter.
Commands lose: all workflow body content (moves to skill).

## Outcome

- User invokes `/sfn-discover [path]` as before — no change to UX
- Claude can invoke `Skill tool` with `sfn-discover` programmatically
- Single source of truth for each phase's workflow logic
- Consistent with the pattern established by `sfn-migrate`
- Enables a future `/sfn-run` orchestrator without duplication
