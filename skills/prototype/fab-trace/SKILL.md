---
name: fab-trace
description: Diagnose a failing app stage, state root cause, apply minimal fix, and add regression test.
category: prototype
phase: 2
---

## Job

Fix a failing app stage by identifying root cause, applying the smallest viable fix, and preventing recurrence.

## Trigger

A stage is blocked, failing, or has a supplied error.

## Input

- App stage name (required)
- Failing output or error message (required)
- Relevant implementation and test files
- `fabrica.run.json`

## Output

- Root cause stated in one sentence
- Minimal fix applied
- Regression test added if reproducible locally
- Updated verification result

## Behavior

1. State root cause in one sentence before proposing changes.
2. Use error type from `last_error` to prioritize: missing_input → check paths, invalid_state → check run object, external_failure → re-run and capture output.
3. Apply the smallest fix that addresses the root cause.
4. Add or update a regression test if the failure can be reproduced locally.
5. Run the narrowest relevant test command.
6. If fix resolves: update stage `status = done`, clear `last_error`, set `next_action` to resume.
7. If fix does not resolve: re-analyze root cause, try once more. If still failing, set `next_action = "/fab-signal"` to request operator help.

## Gate

**Default:** auto
**Overridable:** yes

## Run Object Updates

- `app_stages[].status`, `last_error`, `verifications[]`
- `next_action`
- `current_step = "fab-trace"`
- `updated_at`
