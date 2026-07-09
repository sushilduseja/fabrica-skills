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
31/31 tests passed
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
| `test/validate-run.test.mjs` | 15 | Schema validation, semantic invariants, status×phase matrix |
| `test/sync-manifest.test.mjs` | 5 | Manifest check and --write mode, generated-file drift |
| `test/link-skills.test.mjs` | 9 | Local and global install, symlink safety, path traversal |
| `test/docs.test.mjs` | 2 | Skill guardrails, error metadata, example doc layout |

All 31 tests:

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
- duplicate link ids, source symlinks, global file targets, and custom skill preservation.

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

## Manifest validation

`scripts/sync-manifest.mjs` validates:

- manifest shape, ids, categories, phases, gates, read-only flags, paths, and uniqueness;
- path traversal, absolute paths, backslashes, and unsafe layout variants;
- skill directory existence and symlink/junction rejection;
- frontmatter consistency with manifest `name`, `description`, `category`, `phase`, `default_gate`, and `overridable`;
- prerequisite and block references;
- adjacent `errors.json` metadata and error taxonomy;
- field ownership coverage;
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
- unrelated skills are preserved.

## Documentation validation

The test suite asserts that:

- every manifest skill has `## Execution Guardrails` and `## Error Handling`;
- every `errors.json` entry uses a canonical error type and has actionable metadata;
- full-stack container requirements are documented in the relevant skill files.

Additional validations:
- checked-in examples live under `docs/examples/` and live run paths are ignored;
- `fab-frame` documents run-state relocation into the generated app directory;
- `fab-frame` documents stack-agnostic single-service and multi-service scaffolding;
- `fab-frame` documents service-local config boundaries to prevent parent-project config bleed;
- `fab-launch` distinguishes actual container runtime verification from static container analysis;
- README, state-machine docs, and shared schema docs stay linked and synchronized.

The workflow diagrams and command pathways are maintained in `docs/STATE_MACHINE.md` and linked from `README.md`.
