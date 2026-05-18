---
name: fab-check
description: Score one app stage 0-10 on spec fit, contract fit, tests, code clarity, and safety.
category: core
phase: 1
---

## Job

Evaluate one app stage against quality criteria and produce an eval report.

## Trigger

One app stage has implementation and tests.

## Input

- App stage name (required)
- Implementation files
- Test files
- `docs/spec.md`, `docs/blueprint.md`
- `fabrica.run.json`

## Output

- `docs/eval/<app-stage>.md` — quality evaluation report
- Updated `quality_score` in run object

## Behavior

1. Score each axis 0-10 (10 = perfect):
   - **Spec fit** (weighted double) — does the implementation match the spec?
   - **Contract fit** (weighted double) — do signatures match the blueprint?
   - **Tests** — coverage, quality, edge cases
   - **Code clarity** — readability, naming, structure
   - **Safety** — error handling, input validation, no secrets
2. Compute weighted average: spec fit × 2, contract fit × 2, tests × 1, clarity × 1, safety × 1. Divide by 7.
3. Mark stage `blocked` if any axis is below 6.
4. List blocking fixes separately from optional improvements.
5. Write `docs/eval/<app-stage>.md` with: scores per axis, weighted average, blocking items, optional improvements.
6. Update `quality_score` in app_stages entry (the weighted average, 0-10).
7. Set `next_action`: if blocked, `/fab-trace <stage>`; if passed, next forge or weave command.

## Gate

**Default:** auto
**Overridable:** yes

## Run Object Updates

- `app_stages[].quality_score`, `app_stages[].status`
- `current_step = "fab-check"`
- `next_action`
- `updated_at`
