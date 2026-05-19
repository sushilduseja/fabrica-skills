---
name: fab-retro
description: Score the run 0-10, compare output against spec, and identify process improvements for the next run.
category: prototype
phase: 2
---

## Job

Produce a retrospective document once a run is complete, abandoned, or stopped.

## Trigger

Run is complete, abandoned, or intentionally stopped.

## Prerequisites

- Run complete, abandoned, or stopped
- `fabrica.run.json` exists

## Input

- `fabrica.run.json`
- Eval reports (`docs/eval/*.md`)
- Handoff document (`docs/handoff.md`) if present

## Output

- `docs/retro.md` — retrospective report

## Behavior

1. Score the run 0-10 with one-sentence rationale.
2. Compare built output against original spec.
3. List blockers, root causes, and fixes applied.
4. Identify the highest known or estimated cost area.
5. Write three concrete process changes for the next run.
6. Estimate how long the same toy run would take manually.
7. Write `docs/retro.md`.
8. Validate the run object against `schemas/run-object.schema.json` before writing.

## Error Handling

- `invalid_state`: Run not complete/abandoned → halt, show current status.

## Gate

**Default:** auto
**Overridable:** yes

## Run Object Updates

- `current_step = "fab-retro"`
- `updated_at`
