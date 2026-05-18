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
5. If operator does not respond within a reasonable window, keep decision pending (do not auto-decide).

## Gate

**Default:** full
**Overridable:** no

## Run Object Updates

- `human_decisions[]`
- `current_step = "fab-signal"`
- `updated_at`
