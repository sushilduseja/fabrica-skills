---
name: fab-intake
description: Convert a rough idea into a spec and initialize the run object.
category: core
phase: 0
disable-model-invocation: true
default_gate: checkpoint
overridable: true
---

## Job

Turn a raw, unstructured product idea into `docs/spec.md` and an initialized `fabrica.run.json`.

## Trigger

Start of a new run, or a raw idea without a spec.

## Prerequisites

None (entry point).

## Input

- Freeform idea or partial brief from the operator (required)
- Existing `fabrica.run.json` (optional; created if missing)

## Output

- `docs/spec.md` — structured product spec
- Updated `fabrica.run.json`

## Behavior

1. Ask 5-7 targeted questions covering: user, problem, core job, input, output, AI role, success metric, non-goals.
2. Refuse vague user or core job answers; push until the app can be tested by a stranger.
3. If the operator skips or refuses a question, proceed with a partial spec: mark the unanswered section as `INCOMPLETE: <section>` in the spec, and add a warning note at the top of `docs/spec.md` listing missing areas.
4. Write `docs/spec.md` with sections: Overview, Users, Jobs, Inputs, Outputs, AI Role, Success Criteria, Non-Goals.
5. Create `fabrica.run.json` if missing with all required schema fields (see reference: `skills/shared/run-object-schema.md`).
6. Validate the candidate (tight — see CLAUDE.md).
7. Show the spec before writing. Operator approves or requests changes.

Done.

## Error Handling

- `invalid_state`: Run object already exists → load existing run, show status, offer to continue or start fresh.

