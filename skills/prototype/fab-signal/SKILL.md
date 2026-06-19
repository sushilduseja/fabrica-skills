---
name: fab-signal
description: Capture a human decision with options, rationale, and timestamp.
category: prototype
phase: 2
---

## Job

Present a decision to the operator and record the outcome in `human_decisions`.

## Trigger

A human decision is needed.

## Prerequisites

- Decision context available
- `fabrica.run.json` exists

## Input

- Decision context (required)
- Available options (required)
- `fabrica.run.json`

## Output

- Decision recorded in `human_decisions` array

## Behavior

1. State the decision needed in one sentence.
2. Present two or three meaningful options with concrete tradeoffs.
3. Wait for operator input.
4. Record decision, rationale, timestamp (both triggered_at and resolved_at), and resumed next action.
5. Update `next_action` to reflect the decision outcome.
6. If operator does not respond within a reasonable window, keep decision pending (do not auto-decide).
7. Run `node <fabrica-skills>/scripts/validate-run.mjs` (convention — see CLAUDE.md).

## Error Handling

- `gate_blocked`: Decision timeout → keep decision pending, show next action.

## Gate

**Default:** full
**Overridable:** no

## Run Object Updates

- `human_decisions[]`
- `next_action` (updated to reflect decision outcome)
- `current_step = "fab-signal"`
- `updated_at`
