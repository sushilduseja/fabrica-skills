---
name: fab-weave
description: Connect completed stages into an end-to-end flow.
category: prototype
phase: 2
disable-model-invocation: true
default_gate: checkpoint
overridable: true
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
4. If integration fails, set `last_error = { "type": "external_failure", "message": "Integration test failed" }`, set `next_action = "/fab-trace integration"`, and stop. Wiring is done; routing to the diagnostic skill is complete.
5. Write `docs/integration.md` describing the wired flow and how to run it.
6. Update `status = verifying`, `next_action = "/fab-launch"`.
7. Advance `experiment_phase = "phase_2_pipeline"` if currently `phase_1_slice`.
8. Validate the candidate (tight — see CLAUDE.md).
9. Show wiring plan before mutation. Operator approves or requests changes.

Done.

## Error Handling

- `prerequisite_missing`: Required stages not done → list missing stages.
