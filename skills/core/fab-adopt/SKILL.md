---
name: fab-adopt
description: Adopt a discovered repository for change work without scaffolding.
category: core
phase: 1
disable-model-invocation: true
default_gate: checkpoint
overridable: true
---

# fab-adopt

## Job

Adopt a discovered existing repository for planned change work. Replaces scaffolding only in existing-project mode; never scaffolds, never replaces project infrastructure.

## Trigger

Change blueprint confirmed for an existing-project run (`project_context.origin = "existing"`, `docs/fabrica/blueprint.md` exists, stages defined with allowed paths and approved commands).

## Prerequisites

- `project_context.origin = "existing"`
- `docs/fabrica/project-profile.md` exists
- `docs/fabrica/spec.md` exists
- `docs/fabrica/blueprint.md` exists with stages carrying explicit allowed change paths and approved literal commands
- `fabrica.run.json` exists and validates

## Input

- `docs/fabrica/blueprint.md` (required)
- `fabrica.run.json` (required)

## Output

- Activated first planned stage in `fabrica.run.json`
- Updated `fabrica.run.json` (stage activation fields only)

## Execution Guardrails

1. Before adopting, verify `project_context.origin = "existing"`, the profile/spec/blueprint exist, the run object validates, and every stage has explicit allowed change paths plus approved literal commands. Halt with `prerequisite_missing` otherwise; if the run is new-project shaped, halt and route to `/fab-scaffold` instead — never adopt a new-project run.
2. Recheck the adoption baseline: repository root still matches `project_context.project_root`, and Git HEAD/branch/worktree state still match `project_context.baseline`. If the baseline materially changed, halt with `invalid_state`. If the worktree is dirty without an explicit recorded human decision, halt with `gate_blocked`.
3. Reject path traversal, absolute paths outside the repository, and any stage path outside the repository root. Reject unapproved or interpolated commands.
4. Do not scaffold, replace manifests, replace CI, create `.env.example`, overwrite existing project documentation, or modify application source during adoption. Adoption writes run state only.
5. Validate the full candidate run object with `node <fabrica-skills>/scripts/validate-run.mjs --stdin` before replacing `fabrica.run.json`.

## Behavior

1. Read the validated run object and `docs/fabrica/blueprint.md`.
2. Verify every precondition in guardrail 1 and every baseline invariant in guardrail 2.
3. Activate the first planned stage: set that stage `status = "active"`, `current_app_stage` to its name.
4. Set `current_step = "fab-adopt"`, bump `updated_at`, `next_action = "/fab-build <first-stage-name>"`.
5. Validate the candidate run object before writing.

Done.

## Error Handling

- `prerequisite_missing`: profile, spec, blueprint, stages, or allowed paths missing → list the missing items and stop.
- `invalid_state`: baseline drift (root, HEAD, branch mismatch) → halt and report the drift; never adopt against a moved baseline.
- `gate_blocked`: dirty worktree without a recorded human decision → halt and require an explicit decision.
- `validation_failed`: candidate run object fails schema validation → show validator output and do not write.
