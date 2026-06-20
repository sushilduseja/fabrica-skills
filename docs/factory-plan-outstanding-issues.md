# Factory Plan Outstanding Issues

Reviewed commits: `808ea88`, `8603ca4`.
Baseline spec: `docs/factory-plan.md`.

`cmd /c npm run validate` currently exits 0, but the gate is too weak and misses the issues below.

## P0 - `gate_levels` Accepts Removed And Unknown Skills

Evidence:
- `test/fixtures/valid-run.json:38` and `test/fixtures/invalid-run.json:38` still contain `fab-ledger`.
- `schemas/run-object.schema.json:370-402` requires the 12 active skills but uses `additionalProperties` to allow any other skill key.
- An injected `gate_levels["not-a-skill"] = "auto"` validates successfully.

Fix:
- Generate an exact `gate_levels` key set from `skills/manifest.json`.
- Use `propertyNames.enum` with active manifest ids, or generate explicit properties for every active skill and set `additionalProperties: false`.
- Remove `fab-ledger` from both fixtures.
- Add a negative validation case proving unknown gate keys fail.

Acceptance:
- `node scripts/validate-run.mjs test/fixtures/valid-run.json` passes without `fab-ledger`.
- A run object containing `gate_levels.not-a-skill` fails validation.
- `cmd /c npm run validate` passes.

## P0 - Run-Object Validation Does Not Validate Candidate Writes

Evidence:
- `CLAUDE.md:17` says to validate `<path-to-fabrica.run.json>` before every write.
- Writer skills call `node <fabrica-skills>/scripts/validate-run.mjs` without the run-object path:
  - `skills/core/fab-intake/SKILL.md:47`
  - `skills/core/fab-blueprint/SKILL.md:39`
  - `skills/core/fab-frame/SKILL.md:50`
  - `skills/core/fab-forge/SKILL.md:46`
  - `skills/core/fab-check/SKILL.md:49`
  - `skills/prototype/fab-weave/SKILL.md:43`
  - `skills/prototype/fab-launch/SKILL.md:48`
  - `skills/prototype/fab-signal/SKILL.md:39`
  - `skills/prototype/fab-retro/SKILL.md:40`
  - `skills/prototype/fab-trace/SKILL.md:44`
- Validating the canonical file before writing only validates stale state. It does not validate the proposed mutation.

Fix:
- Define one write protocol:
  1. Build the full candidate run object in memory.
  2. Set `current_step` and `updated_at` on the candidate.
  3. Validate the candidate via stdin support or a temporary file.
  4. Replace `fabrica.run.json` only after validation passes.
- Update `CLAUDE.md` and every writer skill with the exact command, including the target path.
- Remove all bare `validate-run.mjs` invocations from skill docs.

Acceptance:
- No writer skill contains `validate-run.mjs` without a run-object or candidate path.
- The documented flow cannot validate stale state.
- A malformed candidate is rejected before replacing `fabrica.run.json`.

## P1 - Negative Fixture Does Not Test The Promised Contract

Evidence:
- `docs/factory-plan.md` requires `invalid-run.json` to contain one invalid `status` and one invalid `quality_score`.
- `test/fixtures/invalid-run.json:15` has `app_stages: []`, so no invalid `quality_score` is tested.
- `package.json:11` treats any validator failure as success. It does not assert the expected failures.

Fix:
- Make `invalid-run.json` minimal and targeted: one invalid top-level `status`, one `app_stages[0].quality_score` outside `0..10`.
- Remove unrelated invalid fields unless they are moved to separate fixtures.
- Replace `validate:run-fail` with a small assertion script that verifies both expected error paths appear.

Acceptance:
- Invalid fixture output includes `/status`.
- Invalid fixture output includes `/app_stages/0/quality_score`.
- A validator crash, missing file, or unrelated failure does not satisfy the expected-failure test.

## P1 - Manifest Validation Does Not Enforce Its Own Canonical Contracts

Evidence:
- `scripts/sync-manifest.mjs:61-84` validates `errors.json` only when `error_metadata_path` is present.
- `scripts/sync-manifest.mjs:74` hardcodes error types instead of reading `schemas/run-object.schema.json`.
- `scripts/sync-manifest.mjs:101-134` mutates the existing schema instead of generating gate constraints entirely from the manifest.

Fix:
- Require `error_metadata_path` for every manifest skill.
- Read allowed error types from `schemas/run-object.schema.json` and validate `errors.json` against that enum.
- Validate unique skill ids, unique paths, frontmatter `name` matching manifest `id`, and `prerequisites`/`blocks` referencing only active manifest ids.
- Generate `gate_levels.required`, allowed gate keys, and non-overridable constants directly from manifest data.

Acceptance:
- Removing `error_metadata_path` from any skill fails `node scripts/sync-manifest.mjs --check`.
- A typo in an error type fails against the schema enum.
- A bad prerequisite or duplicate skill id fails validation.
- `schemas/run-object.schema.json` no longer preserves stale gate properties from its previous contents.

## P1 - Active Docs Contradict The Implemented Contract

Evidence:
- `CLAUDE.md:44-47` allows legacy string `last_error`, but the schema allows only `null` or `{ type, message }`.
- `docs/fabrica-skills-PRD.md:154` says `last_error: string | null`.
- `docs/fabrica-skills-PRD.md:228` says the schema is created during `fab-frame` and validation is advisory until then. The repo now ships `schemas/run-object.schema.json` and executable validation.
- `docs/fabrica-skills-PRD.md:766` still says the plugin manifest registers all 13 skills.

Fix:
- Make `last_error` object-only plus `null` everywhere, or explicitly add string support to the schema. Prefer object-only.
- Replace advisory validation language with the executable validator command and candidate-write protocol.
- Replace "all 13" with "active manifest skills" or "12 active skills".
- Keep obsolete references only in clearly marked historical sections.

Acceptance:
- `rg "last_error: string|legacy format|created during fab-frame|all 13" CLAUDE.md docs/fabrica-skills-PRD.md` returns no active-contract contradictions.

## P2 - `fab-weave` Drops The Trace Target On Integration Failure

Evidence:
- `docs/factory-plan.md` requires `next_action = "/fab-trace <stage-or-flow>"`.
- `skills/prototype/fab-weave/SKILL.md:39` sets `next_action = "/fab-trace"`.
- `skills/prototype/fab-trace/SKILL.md` requires an app stage name or failing context as input.

Fix:
- Set `next_action` to a concrete target, e.g. `/fab-trace integration` or `/fab-trace <stage-or-flow>`.
- Mirror the same target in `skills/prototype/fab-weave/errors.json`.

Acceptance:
- `rg 'next_action = "/fab-trace"' skills/prototype/fab-weave/SKILL.md skills/prototype/fab-weave/errors.json` returns no bare trace command.

## P2 - Diff Hygiene Fails

Evidence:
- `git diff --check a99d64f..8603ca4` reports trailing whitespace in `docs/fabrica-skills-PRD.md:450-461`.

Fix:
- Remove trailing whitespace from the struck-through `fab-ledger` block.
- Add a whitespace check to `npm run validate` or CI if this repo wants formatting hygiene enforced.

Acceptance:
- `git diff --check a99d64f..HEAD` exits 0.
