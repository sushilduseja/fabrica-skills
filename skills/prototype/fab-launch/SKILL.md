---
name: fab-launch
description: Verify the integrated app locally with a pre-launch checklist. External deploy is deferred.
category: prototype
phase: 2
---

## Job

Run a pre-launch checklist and local verification. No external deploy in MVP.

## Trigger

Integrated app is ready for MVP verification.

## Input

- `docs/blueprint.md`
- `fabrica.run.json`
- Local launch command

## Output

- Pre-launch checklist result
- Local verification result (`kind = local_launch`)

## Behavior

1. Run pre-launch checklist: tests pass, env vars documented, no committed secrets, integration verified.
2. Show checklist and require explicit approval before running any external, destructive, or network deploy action.
3. For MVP, verify locally via `python -m invoice_parser` with a test invoice.
4. Check expected output: valid JSON, non-zero confidence, no errors.
5. Record verification with `kind = local_launch` and set `status = complete` only if verified.
6. Verify `.env.example` documents all required vars. Verify `.env` is in `.gitignore`. Scan for committed secrets.
7. Missing required env vars produce: "Missing required env var: X. See .env.example".

## Gate

**Default:** review
**Overridable:** no for external deploy approval
Local checks may run automatically; external launch requires explicit approval.

## Run Object Updates

- `status`, `verifications[]`, `next_action`
- `current_step = "fab-launch"`
- `updated_at`
