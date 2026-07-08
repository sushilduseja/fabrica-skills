---
name: fab-forge
description: Implement one named app stage against the blueprint.
category: core
phase: 1
disable-model-invocation: true
default_gate: auto
overridable: true
---

## Job

Build working implementation and focused tests for one named app stage.

## Trigger

One named app stage is ready to implement (`status = active` or `status = pending` in run object).

## Prerequisites

- `fab-frame` complete
- Named app stage exists in `app_stages`
- `docs/blueprint.md` exists
- `fabrica.run.json` exists

## Input

- App stage name (required, from run object `app_stages`)
- `docs/blueprint.md` (required)
- `fabrica.run.json` (required)
- Existing stubs and shared contracts

## Output

- Working implementation for the named app stage
- Focused tests covering happy path, one failure, one edge case
- Verification result recorded in run object

## Behavior

1. Read blueprint.md to understand the current tracer bullet's purpose, expected files, and test shape. Build exactly the end-to-end slice it requires.
2. Implement only the named app stage plus shared contracts required by that stage.
3. Keep behavior aligned with the spec and blueprint; do not add speculative features.
4. Write tests covering: happy path, one realistic failure, one edge case.
5. Run the narrowest available test command for the stage.
6. If tests fail, fix until they pass. If cannot fix in 3 attempts, set stage `status = failed`, set `last_error = { type: "external_failure", message: "Tests failed after 3 attempts" }`, and set `next_action` to `/fab-trace <stage>`.
7. If tests pass, update stage `status = done`, add artifacts to the stage record, add verification result.
8. Set `next_action = "/fab-check <stage>"`.
9. Validate the candidate (tight — see CLAUDE.md).

Done.

## Error Handling

- `missing_input`: App stage name invalid → list valid stages from blueprint.
- `invalid_state`: Stubs don't match blueprint → regenerate stubs from blueprint.
