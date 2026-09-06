# Run Object Schema (`fabrica.run.json`)

Every fab run has one run object. It is created by `fab-spec` and updated only by writer skills according to `skills/manifest.json`.

Canonical machine-readable schema: `schemas/run-object.schema.json`

Visual state machine and command pathways: `docs/STATE_MACHINE.md`

## Required fields created by `fab-spec`

| Field | Type | Default / Notes |
|---|---|---|
| `schema_version` | string | `"0.2"` |
| `id` | string | UUID |
| `name` | string | App name slug. Must be safe on Windows/macOS/Linux: lowercase, no path separators, no trailing punctuation, no reserved names such as `con`, `aux`, `nul`, `com1`, or `lpt1`. Never raw idea text. |
| `experiment_phase` | string | `"phase_0_spec"` on creation |
| `created_at` | string | ISO 8601 date-time |
| `updated_at` | string | ISO 8601 date-time |
| `status` | string | `"designing"` on creation |
| `current_step` | string | `"fab-spec"` on creation; must be a manifest skill id or `null` |
| `current_app_stage` | string or null | Null on creation; if set, must match an `app_stages[].name` value |
| `next_action` | string or null | `"/fab-plan"` on creation; skill id must exist in the manifest |
| `last_error` | object or null | Always null on creation. If set, contains only `type` and `message`. |
| `spec_path` | string or null | `"docs/spec.md"` on creation; must be safe `docs/*.md` path |
| `blueprint_path` | string or null | Null on creation; normally `"docs/blueprint.md"` after `/fab-plan` |
| `app_stages` | array | Empty on creation; names must be unique safe slugs |
| `costs` | object | `{ precision: "unknown", tokens_in: "unknown", tokens_out: "unknown", api_calls: "unknown", estimated_usd: "unknown", budget_usd: null, by_step: {} }` |
| `verifications` | array | Empty on creation |
| `human_decisions` | array | Empty on creation |
| `gate_levels` | object | Derived from `skills/manifest.json`: each active skill id maps to its `default_gate`, except `init-run --auto` resolves overridable `checkpoint` gates to `auto` |
| `preferred_stack` | object | `{ frontend: null, backend: null, database: null }` on creation unless operator specifies a slot |

## Fields updated by downstream skills

- `experiment_phase` — advanced by `fab-integrate` to `phase_2_pipeline`.
- `status` — updated by writer skills according to the state machine.
- `current_step` — set to the running skill name.
- `current_app_stage` — set to an existing app stage when stage work is active.
- `next_action` — set by every writer skill and used as the primary workflow pointer.
- `last_error` — set on failure by writer skills that own the field.
- `spec_path` — set by `fab-spec`.
- `preferred_stack` — set by `fab-spec`; read (never modified) by `fab-plan`.
- `blueprint_path` — set by `fab-plan`.
- `app_stages` — populated by `fab-plan`; updated by `fab-scaffold`, `fab-build`, `fab-eval`, and `fab-fix`.
- `costs` — initialized by `fab-spec`; values remain `unknown` unless measured or estimated evidence exists.
- `verifications` — appended by `fab-build`, `fab-integrate`, `fab-verify`, and `fab-fix`.
- `human_decisions` — appended by `fab-decide`.

## Verification kinds

`verifications[].kind` may be:

| Kind | Meaning |
|---|---|
| `unit` | Narrow unit or stage-level test. |
| `integration` | Multi-stage or end-to-end local test. |
| `local_launch` | Local app launch or smoke check. |
| `container_build` | Actual Docker/container build or runtime check ran. |
| `static_analysis` | Static checks, including Dockerfile/Compose checks when Docker is unavailable. |
| `external_deploy` | Explicitly approved external deployment check. |

Do not record `container_build` if Docker did not actually run. Use `static_analysis` and, when needed, a `human_decisions` record accepting the limitation.

## Field ownership

Canonical source: `skills/manifest.json` (`writes_fields` per skill). Each field is owned by at least one skill. Read-only skills such as `fab-status`, `fab-handoff`, and `fab-retro` must not write run-object fields.

| Field | Owning skills |
|---|---|
| `schema_version`, `id`, `name`, `created_at`, `spec_path`, `costs`, `gate_levels`, `preferred_stack` | `fab-spec` (creation only) |
| `experiment_phase` | `fab-spec`, `fab-integrate` |
| `updated_at`, `current_step`, `next_action` | Writer skills |
| `status` | `fab-spec`, `fab-plan`, `fab-scaffold`, `fab-integrate`, `fab-verify` |
| `current_app_stage` | `fab-spec`, `fab-scaffold`, `fab-build` |
| `last_error` | `fab-spec`, `fab-build`, `fab-eval`, `fab-fix`, `fab-integrate`, `fab-verify` |
| `blueprint_path` | `fab-spec`, `fab-plan` |
| `app_stages` | `fab-spec`, `fab-plan`, `fab-scaffold`, `fab-build`, `fab-eval`, `fab-fix` |
| `verifications` | `fab-build`, `fab-integrate`, `fab-verify`, `fab-fix` |
| `human_decisions` | `fab-spec`, `fab-decide` |

## State machine summary

Detailed diagrams and common pathways are in `docs/STATE_MACHINE.md`.

### Status × phase compatibility

| `status` | Valid `experiment_phase` values |
|---|---|
| `designing` | `phase_0_spec` |
| `framing` | `phase_0_spec` |
| `forging` | `phase_1_slice`, `phase_2_pipeline` |
| `checking` | `phase_1_slice`, `phase_2_pipeline` |
| `weaving` | `phase_2_pipeline` |
| `verifying` | `phase_2_pipeline` |
| `complete` | `phase_2_pipeline` |
| `blocked` | any phase |
| `abandoned` | any phase |

## Post-schema semantic validation

`scripts/validate-run.mjs` validates these invariants after JSON Schema validation:

- status × phase compatibility;
- unique app-stage names;
- lifecycle statuses after framing require at least one app stage;
- `complete` requires all stages to be `done`;
- `current_app_stage` must match an existing stage when non-null;
- `next_action` skill must exist in `skills/manifest.json`;
- `/fab-build <stage>` and `/fab-eval <stage>` must reference existing stages;
- `/fab-fix <target>` must reference an existing stage or the special target `integration`.

## Validation command

```bash
node scripts/validate-run.mjs path/to/fabrica.run.json
```

For candidate writes:

```bash
node scripts/validate-run.mjs --stdin < candidate.json
```

To validate and atomically replace the run file in one step (temp file +
rename in the target directory; nothing is written unless validation
succeeds):

```bash
node scripts/validate-run.mjs --stdin --commit path/to/fabrica.run.json < candidate.json
```
