---
name: fab-blueprint
description: Convert a product spec into app architecture, app stages, and a build order.
category: core
phase: 0
---

## Job

Derive minimal app architecture from the spec and define the app stages in build order.

## Trigger

Confirmed spec exists.

## Input

- `docs/spec.md` (required)
- `fabrica.run.json` (required)

## Output

- `docs/blueprint.md` — architecture blueprint with data flow, stack, app stages

## Behavior

1. Derive minimal app components from first principles: input boundary, transformation core, output boundary, persistence only if necessary.
2. Pick one stack for the toy app, preferring boring local defaults unless the spec proves another choice is needed.
3. Define model requirements by capability, context, latency, and cost class; name example providers only as replaceable defaults.
4. Define app stages in build order. Each stage must have purpose, inputs, outputs, files expected, and test shape.
5. Write `docs/blueprint.md` with a small ASCII data-flow diagram.
6. Update `blueprint_path`, `app_stages`, `status = framing`, `next_action = "/fab-frame"`.

## Gate

**Default:** checkpoint
**Overridable:** yes
Show architecture summary before writing.

## Run Object Updates

- `blueprint_path`, `app_stages`, `status`, `next_action`
- `current_step = "fab-blueprint"`
- `updated_at`
