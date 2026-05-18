---
name: fab-intake
description: Convert a rough product idea into a bounded spec and initialize or update the run object.
category: core
phase: 0
---

## Job

Turn a raw, unstructured product idea into `docs/spec.md` and an initialized `fabrica.run.json`.

## Trigger

Start of a new run, or a raw idea without a spec.

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
5. Create `fabrica.run.json` if missing. Set `experiment_phase = phase_0_spec`, `status = designing`, `spec_path = "docs/spec.md"`, `next_action = "/fab-blueprint"`.
6. Write gate_levels for all 13 skills with their default values.

## Gate

**Default:** checkpoint
**Overridable:** yes
Show the spec before writing. Operator approves or requests changes.

## Run Object Updates

- `experiment_phase`, `status`, `spec_path`, `next_action`
- `gate_levels` (all skills)
- `updated_at`
- `current_step = "fab-intake"`
