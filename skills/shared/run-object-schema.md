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

## Field Ownership

Canonical source: `skills/manifest.json` (`writes_fields` per skill). Each field is owned by at least one skill. Read-only skills (e.g., `fab-pulse`, `fab-passport`) must not write any fields.

| Field | Owning Skills |
|---|---|
| `schema_version`, `id`, `name`, `created_at`, `spec_path`, `costs`, `gate_levels` | `fab-intake` (creation only) |
| `experiment_phase` | `fab-intake`, `fab-weave` |
| `updated_at`, `current_step`, `next_action` | All writer skills |
| `status` | `fab-intake`, `fab-blueprint`, `fab-frame`, `fab-weave`, `fab-launch` |
| `current_app_stage` | `fab-intake`, `fab-frame`, `fab-forge` |
| `last_error` | `fab-intake`, `fab-forge`, `fab-check`, `fab-trace`, `fab-weave`, `fab-launch` |
| `blueprint_path` | `fab-intake`, `fab-blueprint` |
| `app_stages` | `fab-intake`, `fab-blueprint`, `fab-forge`, `fab-check`, `fab-trace` |
| `verifications` | `fab-forge`, `fab-weave`, `fab-launch`, `fab-trace` |
| `human_decisions` | `fab-intake`, `fab-signal` |

## State Machine

### Run-level status transitions

```
designing → framing → forging (→ verifying → complete)
  Any state → blocked | abandoned
```

### experiment_phase transitions

```
phase_0_spec → phase_1_slice → phase_2_pipeline
```

### Status × Phase compatibility

| status | valid experiment_phase values |
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

Validated by `scripts/validate-run.mjs` (post-schema check).

## Validation

Full JSON Schema: `schemas/run-object.schema.json`
