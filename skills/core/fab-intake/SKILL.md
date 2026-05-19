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
5. Create `fabrica.run.json` if missing with ALL required schema fields:
   - `schema_version: "0.2"`, `id` (UUID), `name` (app name), `experiment_phase: "phase_0_spec"`
   - `created_at` and `updated_at` (ISO 8601 timestamps)
   - `status: "designing"`, `current_step: "fab-intake"`, `current_app_stage: null`
   - `next_action: "/fab-blueprint"`, `last_error: null`
   - `spec_path: "docs/spec.md"`, `blueprint_path: null`
   - `app_stages: []` (empty array, populated by fab-blueprint)
   - `costs: { precision: "unknown", tokens_in: "unknown", tokens_out: "unknown", api_calls: "unknown", estimated_usd: "unknown", budget_usd: null, by_step: {} }`
   - `verifications: []` (empty array)
   - `human_decisions: []` (empty array)
   - `gate_levels` with all 13 skill defaults (see Run Object Updates)
6. Validate the run object against `schemas/run-object.schema.json` before writing. If validation fails, stop with `validation_failed` error.

## Error Handling

- `missing_input`: Operator gives vague answers → re-ask with specific prompts.
- `invalid_state`: Run object already exists → load existing run, show status, offer to continue or start fresh.

## Gate

**Default:** checkpoint
**Overridable:** yes
Show the spec before writing. Operator approves or requests changes.

## Run Object Updates

- `experiment_phase`, `status`, `spec_path`, `next_action`
- `gate_levels` (all 13 skills):
  ```
  fab-intake: checkpoint, fab-blueprint: checkpoint, fab-frame: auto,
  fab-forge: auto, fab-check: auto, fab-pulse: auto, fab-passport: auto,
  fab-trace: auto, fab-weave: checkpoint, fab-launch: review,
  fab-ledger: auto, fab-signal: full, fab-retro: auto
  ```
- `current_step`, `updated_at`
- All required fields initialized (see Behavior step 5)
