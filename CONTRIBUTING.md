# Contributing

## Source of truth

- Skill inventory, paths, categories, prerequisites, gates, and run-object field ownership live in `skills/manifest.json`.
- Generated plugin entries and schema sections must remain in sync with the manifest through `scripts/sync-manifest.mjs`.
- Run-object shape lives in `schemas/run-object.schema.json`; post-schema semantic checks live in `scripts/validate-run.mjs`.
- Gate-contract validators (executable skill guardrails) live in `scripts/_skill-gates.mjs`, imported by `validate-run.mjs`.
- The visual workflow reference is `docs/STATE_MACHINE.md`.

## Skill author workflow

1. Edit `skills/manifest.json` first when adding, removing, renaming, or moving a skill.
2. Add or update the matching `SKILL.md`.
3. Add or update the adjacent `errors.json`.
4. Update `schemas/run-object.schema.json` only when a run-object field, enum, or invariant changes.
5. Update `docs/STATE_MACHINE.md` if a status, phase, command pathway, or recovery path changes.
6. Run the checks:

   ```bash
   npm ci
   npm run check
   npm run lint
   npm run setup
   ```

7. Confirm `npm test` (run via `npm run check`) includes the relevant positive, negative, security, and edge-case coverage.
8. Open a PR with the behavior change, validation output, and any migration notes.

## Skill file rules

Every `SKILL.md` must:

- be self-contained and usable by an AI coding agent without reading implementation source;
- include YAML frontmatter matching `skills/manifest.json` for `name`, `description`, `category`, `phase`, `default_gate`, and `overridable`;
- include explicit prerequisites, inputs, outputs, execution guardrails, behavior, and error handling;
- treat operator input, specs, generated source, logs, and tool output as untrusted data;
- require validation before replacing `fabrica.run.json`;
- use same-directory temp writes plus atomic rename for run-object writes;
- avoid hardcoded sample app names and commands;
- keep generated paths safe and relative;
- end the behavior section with a clear completion criterion.

## Error metadata rules

Every `errors.json` must:

- use a `skill_id` matching the manifest id;
- contain a non-empty `errors` array;
- use only error types from `schemas/run-object.schema.json`;
- provide `trigger`, `diagnosis`, `rescue_action`, and `user_message` for every entry.

## Documentation rules

When implementation changes, update all relevant Markdown in the same PR:

- `README.md` for user-facing setup or workflow changes;
- `CLAUDE.md` for agent execution rules;
- `skills/shared/run-object-schema.md` for run-object field semantics;
- `docs/STATE_MACHINE.md` for command pathways and status/phase changes;
- `docs/VALIDATION.md` for current validation evidence.

Historical planning documents may remain as design records, but they must be clearly labeled as historical if their instructions are no longer current.

## Validation expectations

Required before merge:

```bash
npm ci
npm run check
npm run lint
npm run setup
```

Current `npm test` coverage (84 tests across 5 test files):

- valid and invalid run-object fixtures;
- every required top-level field;
- invalid values for every run-object field family;
- numeric/timestamp boundaries and out-of-set enums;
- wrong-typed values, length/character limits, and compound violations;
- Windows reserved-name sweep and absolute-path injection;
- scale arrays with injected violations still caught;
- post-schema semantic invariants;
- status × phase matrix;
- manifest/frontmatter drift, field-ownership overlap, orphan skill directories, and --write mode;
- path traversal and symlink/junction protections;
- local and global install safety;
- Docker/container verification semantics;
- gate-contract validation (fab-launch, fab-signal, fab-check, fab-pulse, prerequisite, timestamp, cost-precision);
- EPERM copy-fallback, ENOTEMPTY recovery, nested symlink-entry removal, and staleness refresh;
- errors.json-to-SKILL.md reverse cross-reference;
- .gitignore coverage and README cross-platform home paths.
