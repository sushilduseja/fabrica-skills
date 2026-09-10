---
name: fab-adopt
description: Adopt a discovered repository for change work without scaffolding.
category: core
phase: 1
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
6. Resolve the effective gate from `fabrica.run.json` → `gate_levels.fab-adopt` first (the run object exists by this phase, so the key is present). An invocation flag `--auto` is equivalent to `gate_levels` already being `auto`; it never overrides a resolved `checkpoint`. Non-auto turn protocol (resolved gate `checkpoint`):
   - **Presentation turn**: show the adoption plan — the first stage to activate, its allowed change paths and approved literal commands, and the compact run-state diff (stage → `active`, `current_app_stage`, `next_action`). **STOP — end the agent turn here.** No run-state mutation in the same message.
   - **Approval turn**: only an unambiguous, artifact-bound `approve adoption` authorizes the state change. Print the operator command `npx -y fabrica-skills@latest approve adoption --file <ABSOLUTE path to fabrica.run.json>` and ask the operator to run it in their own terminal, then tell me `done`. **STOP — end the agent turn here.** A bare `yes`, questions, edits, or silence are non-approval and change nothing. If the reply is ambiguous (for example a bare `yes`, `ok`, or `go ahead`), do not interpret it yourself: ask one short clarifying question — `Run the terminal approve command above to activate the stage, or tell me what to change.` — and end the turn. A `revise` or `reject` verdict exists only when the operator selects it in the terminal `fabrica-skills approve adoption` prompt; the agent never appends checkpoint verdict records. A chat `revise` or `reject` reply changes nothing. the only permitted run-object mutation in that non-approval turn is the CLI audit append; the agent performs no such append. Stage fields, `current_step`, `status`, and `next_action` stay untouched.
   - **Write turn (approval only)**: the CLI-minted approval record from the operator terminal is already present in `human_decisions` — `{ "step": "fab-adopt", "decision_needed": "Approve adoption of the blueprint into execution", "options": ["approve", "revise", "reject"], "decision": "approve", "rationale": "<one line>", "triggered_at": "<now>", "resolved_at": "<now>" }` — re-read and validate the run file first, then apply Behavior steps 3–5. Rejection or revision loops back to the presentation turn and changes nothing until approval.

Approval is human-minted under SD-6: the agent never writes checkpoint verdict records for this skill. After presenting the plan, print the exact operator command `npx -y fabrica-skills@latest approve adoption --file <ABSOLUTE path to fabrica.run.json>`, ask the operator to run it in their own terminal, and end the turn. Chat text, including the exact token or `done`, authorizes nothing. The write turn must re-read and validate the run file and proceed only when the minted record satisfies the gate.

## Behavior

1. Read the validated run object and `docs/fabrica/blueprint.md`.
2. Verify every precondition in guardrail 1 and every baseline invariant in guardrail 2.
3. Write turn: under a resolved `checkpoint` gate, steps 3–5 of this list run only after an explicit `approve adoption` (guardrail 6), with the CLI-minted approval record from the operator terminal already present in `human_decisions`; under `auto`, they run immediately. Activate the first planned stage: set that stage `status = "active"`, `current_app_stage` to its name.
4. Set `current_step = "fab-adopt"`, bump `updated_at`, `next_action = "/fab-build <first-stage-name>"`.
5. Validate the candidate run object before writing.

Done.

## Error Handling

- `prerequisite_missing`: profile, spec, blueprint, stages, or allowed paths missing → list the missing items and stop.
- `invalid_state`: baseline drift (root, HEAD, branch mismatch) → halt and report the drift; never adopt against a moved baseline.
- `gate_blocked`: dirty worktree without a recorded human decision → halt and require an explicit decision.
- `validation_failed`: candidate run object fails schema validation → show validator output and do not write.
