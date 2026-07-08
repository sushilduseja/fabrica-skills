# Run Object Schema (`fabrica.run.json`)

Every fab run has one run object. Created by `fab-intake`, updated by every writer skill.

## Required fields (creation by fab-intake)

| Field | Type | Default / Notes |
|---|---|---|
| `schema_version` | string | `"0.2"` |
| `id` | string | UUID |
| `name` | string | App name |
| `experiment_phase` | string | `"phase_0_spec"` on creation |
| `created_at` | string | ISO 8601 |
| `updated_at` | string | ISO 8601 |
| `status` | string | `"designing"` on creation |
| `current_step` | string | `"fab-intake"` on creation |
| `current_app_stage` | null | Always null on creation |
| `next_action` | string | `"/fab-blueprint"` on creation |
| `last_error` | null | Always null on creation |
| `spec_path` | string | `"docs/spec.md"` on creation |
| `blueprint_path` | null | Always null on creation |
| `app_stages` | array | Empty on creation |
| `costs` | object | `{ precision: "unknown", tokens_in: "unknown", tokens_out: "unknown", api_calls: "unknown", estimated_usd: "unknown", budget_usd: null, by_step: {} }` |
| `verifications` | array | Empty on creation |
| `human_decisions` | array | Empty on creation |
| `gate_levels` | object | Derived from `skills/manifest.json`: for each active skill, use its `default_gate` value |

## Fields updated by downstream skills

- `experiment_phase` — advanced by `fab-weave` to `phase_2_pipeline`
- `status` — updated by most skills
- `current_step` — set to the running skill name
- `current_app_stage` — set by `fab-frame` to the active stage name
- `next_action` — set by every writer skill
- `last_error` — set on failure by any writer skill
- `spec_path` — set by `fab-intake`
- `blueprint_path` — set by `fab-blueprint`
- `app_stages` — populated by `fab-blueprint`, updated by `fab-forge` and `fab-check`
- `costs` — updated per skill step by the factory runtime
- `verifications` — appended by `fab-forge`, `fab-weave`, `fab-launch`
- `human_decisions` — appended by `fab-signal`

## Validation

Full JSON Schema: `schemas/run-object.schema.json`
