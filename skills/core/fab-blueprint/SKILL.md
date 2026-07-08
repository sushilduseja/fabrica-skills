---
name: fab-blueprint
description: Convert a spec into app architecture and a build order.
category: core
phase: 0
disable-model-invocation: true
default_gate: checkpoint
overridable: true
---

## Job

Derive minimal app architecture from the spec and define the app stages in build order.

## Trigger

Confirmed spec exists (`docs/spec.md` present, `status = designing` in run object).

## Prerequisites

- `fab-intake` complete
- `docs/spec.md` exists
- `fabrica.run.json` exists

## Input

- `docs/spec.md` (required)
- `fabrica.run.json` (required)

## Output

- `docs/blueprint.md` — architecture blueprint with data flow, stack, app stages

## Behavior

1. Derive minimal app components from first principles: input boundary, transformation core, output boundary, persistence only if necessary.
2. Pick one stack for the toy app, preferring boring local defaults unless the spec proves another choice is needed.
3. Define model requirements by capability, context, latency, and cost class; name example providers only as replaceable defaults.
4. Define app stages as tracer bullets: small end-to-end vertical slices in build order. Each must fire from raw input to visible output before the next begins.
5. Write `docs/blueprint.md` with a small ASCII data-flow diagram.
6. Update `blueprint_path`, `app_stages`, `status = framing`, `next_action = "/fab-frame"`.
7. Validate the candidate (tight — see CLAUDE.md).
8. Show architecture summary before writing. Operator approves or requests changes.

Done.

## Error Handling

- `invalid_state`: Blueprint conflicts with spec → show conflict, suggest spec revision.

