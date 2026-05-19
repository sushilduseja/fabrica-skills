---
name: fab-weave
description: Connect completed app stages into one local end-to-end flow with integration test.
category: prototype
phase: 2
---

## Job

Wire completed app stages into a working end-to-end pipeline and write `docs/integration.md`.

## Trigger

Required app stages are done and checked (`status = done` for all required stages).

## Prerequisites

- All required app stages done and checked
- `docs/blueprint.md` exists
- `fabrica.run.json` exists

## Input

- App artifacts
- `docs/blueprint.md`
- `fabrica.run.json`

## Output

- Local end-to-end flow wired
- `docs/integration.md` — integration documentation
- Integration test result

## Behavior

1. Wire only the app stages needed for the canonical happy path.
2. Add one integration test from raw input to expected output.
3. Run the integration test and record result.
4. If integration fails, use `fab-trace` behavior inline (diagnose, fix, re-run). Set `last_error = { type: "external_failure", message: "Integration test failed" }` and retry.
5. Write `docs/integration.md` describing the wired flow and how to run it.
6. Update `status = verifying`, `next_action = "/fab-launch"`.
7. Advance `experiment_phase = "phase_2_pipeline"` if currently `phase_1_slice`.
8. Validate the run object against `schemas/run-object.schema.json` before writing.

## Error Handling

- `prerequisite_missing`: Required stages not done → list missing stages.
- `external_failure`: Integration test fails → set `status = failed`, set `last_error`, suggest `/fab-trace`.

## Gate

**Default:** checkpoint
**Overridable:** yes
Show wiring plan before mutation.

## Run Object Updates

- `status`, `verifications[]`, `next_action`
- `experiment_phase` (advance to `phase_2_pipeline`)
- `last_error` (on failure)
- `current_step = "fab-weave"`
- `updated_at`
