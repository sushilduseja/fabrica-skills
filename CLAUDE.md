# fabrica-skills — Agent Rules

## Skill Discovery

Skills live under `skills/core/` (Phase 1) and `skills/prototype/` (Phase 2). Each skill is a `SKILL.md` file with frontmatter name, description, category, and phase.

Invoke skills as `/fab-<name>`. The frontmatter name excludes the slash.

## Run Object

`fabrica.run.json` is the durable state file for one run. It lives at the app project root (e.g., `../<app-name>/fabrica.run.json`). Skills read it on entry and update only the fields they own.

## Validation

Before writing to `fabrica.run.json`, every skill validates the updated object against `schemas/run-object.schema.json`. If validation fails, the skill stops with a `validation_failed` error and does not write the corrupted state.

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

Skills use a standardized error taxonomy in `last_error`. The value can be:
- `null` (no error)
- A string (legacy format)
- An object: `{ "type": "<error_type>", "message": "<human-readable detail>" }`

Error types: `missing_input`, `invalid_state`, `gate_blocked`, `validation_failed`, `prerequisite_missing`, `external_failure`.
