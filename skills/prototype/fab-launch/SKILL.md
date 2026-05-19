---
name: fab-launch
description: Verify the integrated app locally with a pre-launch checklist. External deploy is deferred.
category: prototype
phase: 2
---

## Job

Run a pre-launch checklist and local verification. No external deploy in MVP.

## Trigger

Integrated app ready for MVP verification (`status = verifying`, `docs/integration.md` exists).

## Prerequisites

- `fab-weave` complete
- `docs/integration.md` exists
- `fabrica.run.json` exists

## Input

- `docs/blueprint.md`
- `fabrica.run.json`
- Local launch command

## Output

- Pre-launch checklist result
- Local verification result (`kind = local_launch`)

## Behavior

1. Run pre-launch checklist:
   - Package installed in editable mode (`pip install -e .` ran)
   - Tests pass
   - Env vars documented in `.env.example`
   - No committed secrets
   - Integration verified
2. Show checklist and require explicit approval before running any external, destructive, or network deploy action.
3. For MVP, verify locally via `python -m invoice_parser.cli` with a test invoice.
4. Check expected output: valid JSON, non-zero confidence, no errors.
5. Record verification with `kind = local_launch` and set `status = complete` only if verified.
6. Verify `.env.example` documents all required vars. Verify `.env` is in `.gitignore`. Scan for committed secrets.
7. Missing required env vars produce: "Missing required env var: X. See .env.example".
8. If pre-launch checklist fails, set `last_error = { type: "gate_blocked", message: "Pre-launch checklist failed: <details>" }` and halt.
9. Validate the run object against `schemas/run-object.schema.json` before writing.

## Error Handling

- `gate_blocked`: Pre-launch checklist fails → show checklist failures.
- `gate_blocked`: External deploy without approval → halt, require explicit approval.

## Gate

**Default:** review
**Overridable:** no for external deploy approval
Local checks may run automatically; external launch requires explicit approval.

## Run Object Updates

- `status`, `verifications[]`, `next_action`
- `last_error` (on failure)
- `current_step = "fab-launch"`
- `updated_at`
