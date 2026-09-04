# Validation evidence

This document records the current validation surface for the repository. It is intentionally concise; the executable source of truth is `test/*.test.mjs` plus the npm scripts in `package.json`.

## Commands

Run from the repository root:

```bash
npm ci
npm run check
```

`npm run check` runs both validation (`npm run validate`) and all tests (`npm test`). Individual commands are also available:

```bash
npm test                        # full test suite
npm run validate                # run-object and manifest validation
npm run lint                    # format and lint check
npm run setup                   # validate then local skill linking
```

Expected current result:

```text
[validate-run] OK — run object from test/fixtures/valid-run.json is valid
[assert-invalid] OK — test/fixtures/invalid-run.json fails as expected (/status, /app_stages/0/quality_score)
[assert-invalid] OK — test/fixtures/invalid-gate-keys.json fails as expected (/gate_levels)
[sync-manifest] CHECK OK — all generated files match manifest
89/89 tests passed
```

`npm run setup` additionally creates `.skills/` for local source-checkout use. Generated `.skills/` and `node_modules/` are not repository source artifacts.

## Npm scripts

| Script | Purpose |
|---|---|
| `npm run check` | Runs validation and all tests (CI entry point). |
| `npm test` | Full positive, negative, edge, install-safety, and security regression suite. |
| `npm run validate:run-pass` | Validates `test/fixtures/valid-run.json`. |
| `npm run validate:run-fail` | Asserts `test/fixtures/invalid-run.json` fails at expected paths. |
| `npm run validate:run-gate-fail` | Asserts invalid gate keys fail validation. |
| `npm run validate:manifest` | Checks manifest, frontmatter, error metadata, generated plugin, and generated schema sections. |
| `npm run validate` | Runs run fixture checks plus manifest check. |
| `npm run lint` | Runs eslint + prettier --check on scripts/ and test/. |
| `npm run lint:fix` | Applies eslint --fix and prettier --write to scripts/ and test/. |
| `npm run setup` | Runs validation and then local skill linking. |

## Current test coverage

Tests are split by module under `test/`:

| File | Tests | Focus |
|---|---|---|
| `test/validate-run.test.mjs` | 25 | Schema validation, semantic invariants, status×phase matrix (incl. schema/matrix completeness), boundary/enum/type/length edges, reserved-name and path-injection sweep, scale |
| `test/sync-manifest.test.mjs` | 14 | Manifest check and --write mode, generated-file drift, frontmatter drift, errors.json cross-reference, field-ownership overlap, MULTI_WRITER_FIELDS whitelist sync, orphan skill directories |
| `test/link-skills.test.mjs` | 15 | Local and global install, symlink safety, path traversal, EPERM copy-fallback, staleness refresh, nested symlink-entry removal, ENOTEMPTY recovery |
| `test/skill-gates.test.mjs` | 29 | Gate-contract validators for all 7 gate checks (incl. gate↔SKILL.md guardrail cross-check) |
| `test/verification-kind.test.mjs` | 2 | Verification-kind classification table (Docker invocation, container build) |
| `test/docs.test.mjs` | 4 | Skill guardrails, error metadata, example doc layout, .gitignore coverage, README cross-platform home paths |

All 89 tests:

- valid fixture acceptance;
- malformed JSON error handling without stack traces;
- missing file error handling without stack traces;
- every missing required top-level run-object field;
- invalid values for every run-object field family;
- status × phase compatibility;
- committed manifest/plugin/schema sync;
- manifest path traversal rejection;
- extra manifest entry detection;
- local link success and idempotence;
- preflight failure with no partial install;
- link path traversal rejection;
- local `.skills` symlink/junction refusal;
- global install symlink/junction refusal;
- skill guardrails and actionable error metadata;
- fully populated valid run objects;
- exhaustive status × phase matrix;
- empty stdin, mixed validator args, and malformed file input;
- quiet negative assertion script behavior;
- --write mode and idempotency;
- global install happy path;
- unrelated `fab-*` and non-`fab-*` skill preservation during linking;
- regular-file `.skills`, malformed manifest, and bad link args;
- container verification kinds (`container_build`, `static_analysis`);
- full-stack container guidance in core skills;
- semantic run-state invariants beyond JSON Schema;
- Windows-hostile and trailing-punctuation slug rejection;
- nested additional-property rejection;
- valid `/fab-trace integration` and terminal `complete` states;
- symlinked skill directory rejection;
- duplicate link ids, source symlinks, global file targets, and custom skill preservation;
- frontmatter drift detection (name, description, category, phase, default_gate, overridability);
- next-action rule enforcement (fab-weave requires all stages done, fab-launch requires verifying status);
- errors.json-to-SKILL.md reverse cross-reference (every error type documented in the skill);
- cost precision integrity (valid enum values: unknown/estimated/measured);
- human_decisions timestamp ordering (resolved_at after triggered_at);
- .gitignore coverage for all generated and transient paths;
- EPERM copy-fallback on Windows when junctions are blocked;
- staleness refresh for copied skills after source update;
- gate-contract validators (fab-launch, fab-signal, fab-check, fab-pulse, next-action, timestamp, cost-precision);
- numeric and timestamp boundaries (quality_score 0/6/10/10.5, epoch and far-future timestamps);
- out-of-set enum values in verification kinds, stage status, gate_levels keys, and by-step cost precision;
- wrong-typed field values (string-for-number, array-for-object, null-for-required);
- length and character limits (63-char names, 1000-char notes, emoji/space/uppercase/non-ASCII rejection);
- compound multi-violation reporting;
- full Windows reserved-name sweep (con, prn, aux, nul, com1-9, lpt1-9) across every name-bearing field;
- absolute-path and traversal injection rejection;
- scale: 150 app stages and 200 decisions + 100 verifications validate, injected violations still caught;
- `writes_fields` ownership-overlap detection against an explicit multi-writer whitelist;
- orphan skill directory detection (directory on disk with no manifest entry);
- nested symlink-entry removal without touching the symlink target;
- ENOTEMPTY recovery when clearing a managed skill entry;
- README cross-platform global-install home paths.

## Schema validation

`schemas/run-object.schema.json` validates:

- required top-level fields;
- safe slug/path constraints;
- status, phase, error, gate, verification, and quality-score enums/ranges;
- nested object `additionalProperties: false` where state must be closed;
- manifest-derived `current_step` enum and `gate_levels` properties.

## Post-schema semantic validation

`scripts/validate-run.mjs` additionally rejects:

- invalid `status × experiment_phase` combinations;
- duplicate app-stage names;
- lifecycle statuses after framing with no app stages;
- `complete` with any non-`done` app stage;
- `current_app_stage` not matching an app stage;
- `next_action` skill ids not present in the manifest-derived schema;
- `/fab-forge <stage>` or `/fab-check <stage>` references to unknown stages;
- `/fab-trace <target>` references to unknown targets except `integration`.

## Gate-contract validation

`scripts/_skill-gates.mjs` implements executable gate contracts derived from each `SKILL.md`'s **Execution Guardrails** and **Behavior** sections. Wired into `validate-run.mjs` via `validateAllGates()`:

| Validator | Gate | What it enforces |
|---|---|---|
| `validateFabLaunchGate` | review | `external_deploy` kind requires prior human approval; `container_build` must invoke Docker; `complete` status requires a launch verification entry |
| `validateFabSignalGate` | full | Every non-null decision must have a `resolved_at` timestamp — no auto-populated decisions |
| `validateFabCheckGate` | auto | A stage with `quality_score < 6` must not be `done` (any sub-threshold axis blocks) |
| `validateFabPulseGate` | auto | When `costs.precision` is `unknown`, all numeric cost fields must also be `unknown` (no invented display values) |
| `validateNextActionGate` | (next_action) | `fab-weave` requires all `app_stages` done; `fab-launch` requires `status === "verifying"` |
| `validateTimestampOrderGate` | (integrity) | `human_decisions[i].resolved_at` must not be earlier than `triggered_at` |
| `validateCostPrecisionGate` | (integrity) | `costs.precision` must be one of: `unknown`, `estimated`, `measured` |

## Manifest validation

`scripts/sync-manifest.mjs` validates:

- manifest shape, ids, categories, phases, gates, read-only flags, paths, and uniqueness;
- path traversal, absolute paths, backslashes, and unsafe layout variants;
- skill directory existence and symlink/junction rejection;
- frontmatter consistency with manifest `name`, `description`, `category`, `phase`, `default_gate`, and `overridable`;
- prerequisite and block references;
- adjacent `errors.json` metadata and error taxonomy;
- field ownership coverage;
- field-ownership overlap rejection for any run-object field not on the explicit multi-writer whitelist;
- orphan skill directory detection (a `SKILL.md` directory on disk with no manifest entry);
- generated `.claude-plugin/plugin.json` drift;
- generated schema section drift.
- `--write` mode repairs drift by regenerating plugin.json and schema, then exits clean.

## Install validation

`scripts/link-skills.mjs` validates:

- manifest JSON can be parsed;
- all skill sources exist before mutation;
- source skill directories are real directories, not symlinks/junctions;
- local and global install targets are real directories, not symlinks/junctions;
- duplicate ids are rejected;
- only manifest-managed skill entries are refreshed;
- unrelated skills are preserved;
- global symlink installation and verification-kind consistency testing;
- EPERM copy-fallback on Windows when junctions are blocked (copies instead, warns);
- staleness refresh: after source updates, copied skills are re-copied on re-link.

## Documentation validation

The test suite asserts that:

- every manifest skill has `## Execution Guardrails` and `## Error Handling`;
- every `errors.json` entry uses a canonical error type and has actionable metadata;
- every error type in `errors.json` is cross-referenced in the skill's Error Handling section (reverse check);
- full-stack container requirements are documented in the relevant skill files;
- `.gitignore` covers all generated and transient paths (`.skills/`, `docs/spec.md`, `docs/blueprint.md`, `docs/handoff.md`, `docs/retro.md`, `fabrica.run.json`).

Additional validations:
- checked-in examples live under `docs/examples/` and live run paths are ignored;
- `fab-frame` documents run-state relocation into the generated app directory;
- `fab-frame` documents stack-agnostic single-service and multi-service scaffolding;
- `fab-frame` documents service-local config boundaries to prevent parent-project config bleed;
- `fab-launch` distinguishes actual container runtime verification from static container analysis;
- README, state-machine docs, and shared schema docs stay linked and synchronized.

The workflow diagrams and command pathways are maintained in `docs/STATE_MACHINE.md` and linked from `README.md`.
