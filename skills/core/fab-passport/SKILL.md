---
name: fab-passport
description: Write a resumable handoff document with state, artifacts, and next command.
category: core
phase: 1
---

## Job

Produce `docs/handoff.md` so a fresh session can resume without asking what happened before.

## Trigger

End of session or transfer to another agent/session.

## Prerequisites

- `fabrica.run.json` exists

## Input

- `fabrica.run.json` (required)
- Recent context and artifacts

## Output

- `docs/handoff.md` — resumable handoff document

## Behavior

1. State current run status in one line.
2. List completed steps, app stages, artifacts, verifications, decisions, and blockers.
3. Include the exact next command from `next_action`.
4. Include any important context not captured in the run object.
5. Overwrite `docs/handoff.md`; do not append.
6. If handoff context is incomplete (e.g., missing artifacts), note gaps in the document rather than blocking.

## Error Handling

- `missing_input`: Handoff context incomplete → include available context, note gaps.

## Gate

**Default:** auto
**Overridable:** yes

## Run Object Updates

None (no state change — handoff is a snapshot).
