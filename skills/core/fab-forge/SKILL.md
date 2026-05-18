---
name: fab-forge
description: Implement one named app stage against the blueprint with tests.
category: core
phase: 1
---

## Job

Build working implementation and focused tests for one named app stage.

## Trigger

One named app stage is ready to implement.

## Input

- App stage name (required, from run object `app_stages`)
- `docs/blueprint.md` (required)
- Existing stubs and shared contracts

## Output

- Working implementation for the named app stage
- Focused tests covering happy path, one failure, one edge case
- Verification result recorded in run object

## Behavior

1. Read blueprint.md to understand the stage purpose, expected files, and test shape.
2. Implement only the named app stage plus shared contracts required by that stage.
3. Keep behavior aligned with the spec and blueprint; do not add speculative features.
4. Write tests covering: happy path, one realistic failure, one edge case.
5. Run the narrowest available test command for the stage.
6. If tests fail, fix until they pass. If cannot fix in 3 attempts, set stage `status = failed` and set `next_action` to `/fab-trace <stage>`.
7. If tests pass, update stage `status = done`, add artifacts to the stage record, add verification result.
8. Set `next_action = "/fab-check <stage>"`.

## Gate

**Default:** auto
**Overridable:** yes

## Run Object Updates

- `app_stages[].status`, `app_stages[].artifacts`, `verifications[]`
- `next_action`
- `current_step = "fab-forge"`
- `updated_at`
