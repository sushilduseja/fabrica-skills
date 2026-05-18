---
name: fab-weave
description: Connect completed app stages into one local end-to-end flow with integration test.
category: prototype
phase: 2
---

## Job

Wire completed app stages into a working end-to-end pipeline and write `docs/integration.md`.

## Trigger

Required app stages are done and checked.

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
4. If integration fails, use `fab-trace` behavior inline (diagnose, fix, re-run).
5. Write `docs/integration.md` describing the wired flow and how to run it.
6. Update `status = verifying`, `next_action = "/fab-launch"`.

## Gate

**Default:** checkpoint
**Overridable:** yes
Show wiring plan before mutation.

## Run Object Updates

- `status`, `verifications[]`, `next_action`
- `current_step = "fab-weave"`
- `updated_at`
