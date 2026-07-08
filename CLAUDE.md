# fabrica-skills — Agent Rules

## Skill Discovery

Skills live under `skills/core/` (Phase 1) and `skills/prototype/` (Phase 2). Each skill is a `SKILL.md` file with frontmatter: name, description, category, phase, disable-model-invocation, default_gate, overridable.

Invoke skills as `/fab-<name>`. The frontmatter name excludes the slash.

## Run Object

`fabrica.run.json` is the durable state file for one run. It lives at the app project root (e.g., `../<app-name>/fabrica.run.json`). Skills read it on entry and update only the fields they own.

## Field Ownership

Each skill declares which run object fields it writes (`writes_fields` in `skills/manifest.json`). Read-only skills (`fab-pulse`, `fab-passport`) must not write any fields. The canonical ownership table is in `skills/shared/run-object-schema.md`.

## State Machine

Run-level `status` transitions follow: `designing → framing → forging (→ verifying → complete)`. Any state may transition to `blocked` or `abandoned`. The `experiment_phase` progresses: `phase_0_spec → phase_1_slice → phase_2_pipeline`.

The `--stdin` validator in `scripts/validate-run.mjs` checks status × phase compatibility after schema validation.

## Validation

### Candidate-write protocol

Before replacing `fabrica.run.json`:

1. Build the full candidate run object in memory with all mutations applied.
2. Set `current_step` and `updated_at` on the candidate to reflect this skill's change.
3. Pipe the candidate through the validator:
   ```bash
   echo '<candidate-json>' | node <fabrica-skills>/scripts/validate-run.mjs --stdin
   ```
4. Only if validation passes (exit 0), write the candidate to `fabrica.run.json`.
5. If validation fails, stop with a `validation_failed` error. Do not write corrupted state.

## Conventions

- **`current_step`:** After every state change, set `current_step` to the current skill's id (e.g., `"fab-frame"`).
- **`updated_at`:** After every state change, bump `updated_at` to the current ISO-8601 timestamp.
- **Gate defaults:** Defined in `skills/manifest.json` (canonical source) and `SKILL.md` frontmatter (`default_gate`, `overridable`) for agent readability. Keep them in sync.

## Gate Model

| Level | Behavior |
|---|---|
| `auto` | No pause |
| `checkpoint` | Approval before file mutation |
| `review` | Local checks may run; external/deploy requires approval |
| `full` | Approval before start and confirmation after completion |

Gate levels are defined in `fabrica.run.json` under `gate_levels`.

## Naming Convention

All skills use the `fab-` prefix to avoid collision with generic skill names. The slash form (`/fab-intake`) is the invocation convention; the frontmatter name excludes the slash (`fab-intake`).

## Error Handling

Skills use a standardized error taxonomy in `last_error`:
- `null` (no error)
- An object: `{ "type": "<error_type>", "message": "<human-readable detail>" }`

Error types (canonical source: `schemas/run-object.schema.json`):
- `missing_input` — Required input not provided
- `invalid_state` — Run object in unexpected state
- `gate_blocked` — Operator did not approve gate
- `validation_failed` — Run object write failed schema validation
- `prerequisite_missing` — Skill prerequisite not satisfied
- `external_failure` — External service or command failed
