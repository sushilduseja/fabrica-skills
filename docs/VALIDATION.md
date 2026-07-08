# Validation evidence

This document records the current validation surface for the repository. It is intentionally concise; the executable source of truth is `test/run-tests.mjs` plus the npm scripts in `package.json`.

## Commands

Run from the repository root:

```bash
npm ci
npm test
npm run validate
npm run setup
```

Expected current result:

```text
32/32 tests passed
[sync-manifest] CHECK OK — all generated files match manifest
[link-skills] DONE — 12 skills installed
```

`npm run setup` creates `.skills/` for local source-checkout use. Generated `.skills/` and `node_modules/` are not repository source artifacts.

## Npm scripts

| Script | Purpose |
|---|---|
| `npm test` | Full positive, negative, edge, install-safety, and security regression suite. |
| `npm run validate:run-pass` | Validates `test/fixtures/valid-run.json`. |
| `npm run validate:run-fail` | Asserts `test/fixtures/invalid-run.json` fails at expected paths. |
| `npm run validate:run-gate-fail` | Asserts invalid gate keys fail validation. |
| `npm run validate:manifest` | Checks manifest, frontmatter, error metadata, generated plugin, and generated schema sections. |
| `npm run validate` | Runs run fixture checks plus manifest check. |
| `npm run setup` | Runs validation and then local skill linking. |

## Current test coverage

`test/run-tests.mjs` currently covers 31 cases:

- valid fixture acceptance;
- malformed JSON error handling without stack traces;
- missing file error handling without stack traces;
- every missing required top-level run-object field;
- invalid values for every run-object field family;
- status × phase compatibility;
- committed manifest/plugin/schema sync;
- manifest path traversal rejection;
- unsafe error metadata path rejection;
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
- duplicate manifest ids, category drift, write-field drift, and generated-file drift;
- malformed errors metadata and unsafe sync invocation args;
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

`scripts/sync-manifest.mjs --check` validates:

- manifest shape, ids, categories, phases, gates, read-only flags, paths, and uniqueness;
- path traversal, absolute paths, backslashes, and unsafe layout variants;
- skill directory existence and symlink/junction rejection;
- frontmatter consistency with manifest `name`, `description`, `category`, `phase`, `default_gate`, and `overridable`;
- prerequisite and block references;
- adjacent `errors.json` metadata and error taxonomy;
- field ownership coverage;
- generated `.claude-plugin/plugin.json` drift;
- generated schema section drift.

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

The workflow diagrams and command pathways are maintained in `docs/STATE_MACHINE.md` and linked from `README.md`.
