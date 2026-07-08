# Factory Plan

> Historical design record. Current implementation source of truth is `skills/manifest.json`, `schemas/run-object.schema.json`, `scripts/validate-run.mjs`, `docs/STATE_MACHINE.md`, and `docs/VALIDATION.md`. Do not treat this document as active workflow instructions.

### 1. Executive Summary

This plan turns `fabrica-skills` from a readable post-MVP skill set into a deterministic open source AI factory. The core move is one machine-readable manifest that owns skill inventory, dependency order, gates, and generated discovery artifacts. The second move is making run-state validation and error rescue executable instead of advisory markdown. After this plan, a contributor can add or change a skill by editing one canonical record, running one validation command, and getting CI feedback before merge.

### 2. Architectural Principles

- One source of truth owns every structural fact: skill id, path, phase, dependency, gate, and version.
- Markdown explains behavior; JSON and scripts enforce contracts.
- Every run-object write validates before mutation and fails with a typed error.
- Skills stay independently testable; no full pipeline run required for static validation.
- Generated artifacts are checked in only when reproducibly regenerated from source.
- Error handling is data-driven: `fab-trace` reads metadata, not hardcoded rescue tables.
- The repo remains skills-only: no runtime, SaaS, queues, database, or hidden orchestration.

### 3. Implementation Tracks

#### Track 1: Central Skill Manifest

**Why:** Skill inventory, dependency order, gate defaults, and plugin discovery are duplicated across `scripts/link-skills.mjs`, `.claude-plugin/plugin.json`, `schemas/run-object.schema.json`, and `skills/core/fab-intake/SKILL.md`. A manifest makes the factory self-describing and removes synchronized hand edits.

**Files:**

- CREATE `skills/manifest.json`
- CREATE `scripts/sync-manifest.mjs`
- MODIFY `scripts/link-skills.mjs`
- MODIFY `.claude-plugin/plugin.json`
- MODIFY `schemas/run-object.schema.json`
- MODIFY `skills/core/fab-intake/SKILL.md`
- MODIFY `README.md`
- MODIFY `docs/fabrica-skills-PRD.md`

**Steps:**

1. Create `skills/manifest.json` with `schema_version`, `repo_version`, and `skills[]`.
2. For each active skill, record `id`, `path`, `category`, `phase`, `description`, `default_gate`, `overridable`, `prerequisites`, `blocks`, and `read_only`.
3. Create `scripts/sync-manifest.mjs` using Node built-ins only.
4. Make `scripts/sync-manifest.mjs` validate that every `skills[].path` exists and contains `SKILL.md`.
5. Make `scripts/sync-manifest.mjs` generate `.claude-plugin/plugin.json` skill entries from `skills/manifest.json`.
6. Make `scripts/sync-manifest.mjs` update `schemas/run-object.schema.json` `gate_levels.required` from manifest skill ids.
7. Add `--check` mode to `scripts/sync-manifest.mjs`; it exits nonzero if generated files differ.
8. Modify `scripts/link-skills.mjs` to read skill paths from `skills/manifest.json` instead of `SKILL_DIRS`.
9. Modify `skills/core/fab-intake/SKILL.md` to derive `gate_levels` from `skills/manifest.json` instead of listing all defaults inline.
10. Modify `README.md` and `docs/fabrica-skills-PRD.md` to state that `skills/manifest.json` is canonical for inventory, gates, and dependencies.

**Verify:**

- `node scripts/sync-manifest.mjs --check` exits 0.
- `node scripts/link-skills.mjs` creates one `.skills/<skill-id>` entry per manifest skill.
- `.claude-plugin/plugin.json` skill names and paths match `skills/manifest.json`.
- `schemas/run-object.schema.json` `gate_levels.required` matches manifest skill ids.
- `rg "gate_levels with all 13|SKILL_DIRS" skills scripts` returns no active source-of-truth duplication.

**Effort:** Medium (~2.5h)

#### Track 2: Executable Run Validation

**Why:** "Validate against schema" appears in writer skills but has no command behind it. A real validator makes run-object corruption observable, reproducible, and CI-checkable.

**Files:**

- CREATE `package.json`
- CREATE `package-lock.json`
- CREATE `scripts/validate-run.mjs`
- CREATE `test/fixtures/valid-run.json`
- CREATE `test/fixtures/invalid-run.json`
- MODIFY `CLAUDE.md`
- MODIFY `skills/core/fab-intake/SKILL.md`
- MODIFY `skills/core/fab-blueprint/SKILL.md`
- MODIFY `skills/core/fab-frame/SKILL.md`
- MODIFY `skills/core/fab-forge/SKILL.md`
- MODIFY `skills/core/fab-check/SKILL.md`
- MODIFY `skills/prototype/fab-trace/SKILL.md`
- MODIFY `skills/prototype/fab-weave/SKILL.md`
- MODIFY `skills/prototype/fab-launch/SKILL.md`
- MODIFY `skills/prototype/fab-signal/SKILL.md`
- MODIFY `skills/prototype/fab-retro/SKILL.md`

**Steps:**

1. Create `package.json` with `"type": "module"` and scripts `validate:run`, `validate:manifest`, and `validate`.
2. Add dev dependencies `ajv` and `ajv-formats`; commit the generated `package-lock.json`.
3. Create `scripts/validate-run.mjs` that loads `schemas/run-object.schema.json`, registers formats, validates a provided run-object path, prints all schema errors, and exits 1 on failure.
4. Add `test/fixtures/valid-run.json` covering the complete current run-object contract.
5. Add `test/fixtures/invalid-run.json` with one invalid `status` and one invalid `quality_score`.
6. Modify `CLAUDE.md` validation rule to require `node <fabrica-skills>/scripts/validate-run.mjs <path-to-fabrica.run.json>` before any run-object write.
7. In each writer skill, replace advisory validation wording with the exact validator command and the rule: update `current_step` and `updated_at` before validation, write only after validation passes.
8. Keep read-only skills free of validation boilerplate unless they mutate `fabrica.run.json`.

**Verify:**

- `npm ci` succeeds from a clean clone.
- `npm run validate:run -- test/fixtures/valid-run.json` exits 0.
- `npm run validate:run -- test/fixtures/invalid-run.json` exits 1 and prints both schema failures.
- `rg "Validate the run object against" skills` shows only command-based validation text, not advisory text.

**Effort:** Medium (~2h)

#### Track 3: Remove Shallow And Circular Skill Behavior

**Why:** `fab-ledger` is a thin cost view already covered by `fab-pulse`, and `fab-weave` inlines `fab-trace` behavior. Folding cost detail into `fab-pulse` and delegating integration failures to `fab-trace` reduces concepts a new contributor must learn.

**Files:**

- MODIFY `skills/core/fab-pulse/SKILL.md`
- MODIFY `skills/prototype/fab-weave/SKILL.md`
- MODIFY `skills/manifest.json`
- MODIFY `README.md`
- MODIFY `docs/fabrica-skills-PRD.md`
- MODIFY `docs/VALIDATION.md`
- DELETE `skills/prototype/fab-ledger/SKILL.md`

**Steps:**

1. Add a `cost detail` mode to `skills/core/fab-pulse/SKILL.md`.
2. Move `fab-ledger` behaviors into `fab-pulse`: show precision, totals, per-step breakdown, >20% spend concentration, missing cost data, and one reduction suggestion only when spend is known.
3. Remove `fab-ledger` from `skills/manifest.json`.
4. Delete `skills/prototype/fab-ledger/SKILL.md`.
5. Modify `skills/prototype/fab-weave/SKILL.md`: on integration failure, set `last_error = { "type": "external_failure", "message": "Integration test failed" }`, set `next_action = "/fab-trace <stage-or-flow>"`, and stop.
6. Update `README.md`, `docs/fabrica-skills-PRD.md`, and `docs/VALIDATION.md` from "13 skills" to active manifest count after the delete.
7. Run `node scripts/sync-manifest.mjs` to regenerate `.claude-plugin/plugin.json` and schema gate requirements.

**Verify:**

- `rg "fab-ledger" skills .claude-plugin schemas README.md docs/fabrica-skills-PRD.md docs/VALIDATION.md` returns only deferred/history notes, not active workflow instructions.
- `node scripts/link-skills.mjs` creates no `.skills/fab-ledger` entry.
- `skills/core/fab-pulse/SKILL.md` includes the former cost concentration behavior.
- `skills/prototype/fab-weave/SKILL.md` contains no inline trace/fix/retry instruction.

**Effort:** Medium (~1.5h)

#### Track 4: Data-Driven Error Rescue

**Why:** `fab-trace` hardcodes error-type dispatch, while the error registry is scattered through the PRD and skill docs. Per-skill error metadata lets agents diagnose failures from structured data.

**Files:**

- CREATE `skills/core/fab-intake/errors.json`
- CREATE `skills/core/fab-blueprint/errors.json`
- CREATE `skills/core/fab-frame/errors.json`
- CREATE `skills/core/fab-forge/errors.json`
- CREATE `skills/core/fab-check/errors.json`
- CREATE `skills/core/fab-pulse/errors.json`
- CREATE `skills/core/fab-passport/errors.json`
- CREATE `skills/prototype/fab-trace/errors.json`
- CREATE `skills/prototype/fab-weave/errors.json`
- CREATE `skills/prototype/fab-launch/errors.json`
- CREATE `skills/prototype/fab-signal/errors.json`
- CREATE `skills/prototype/fab-retro/errors.json`
- MODIFY `skills/manifest.json`
- MODIFY `scripts/sync-manifest.mjs`
- MODIFY `skills/prototype/fab-trace/SKILL.md`
- MODIFY `docs/fabrica-skills-PRD.md`

**Steps:**

1. For each active skill, create `errors.json` with `skill_id`, `errors[]`, `type`, `trigger`, `diagnosis`, `rescue_action`, and `user_message`.
2. Populate each file from `docs/fabrica-skills-PRD.md` Section 8 Error & Rescue Registry.
3. Add `error_metadata_path` to each skill record in `skills/manifest.json`.
4. Update `scripts/sync-manifest.mjs` to verify every `error_metadata_path` exists, parses as JSON, and uses only schema-approved error types.
5. Modify `skills/prototype/fab-trace/SKILL.md` so its diagnosis order is: read `last_error.type`, load the failing skill's `errors.json`, pick matching rescue metadata, then apply the smallest fix.
6. Replace the hardcoded error-type bullet table in `skills/prototype/fab-trace/SKILL.md` with the metadata lookup rule.
7. Modify `docs/fabrica-skills-PRD.md` Section 8 to say the checked-in `errors.json` files are canonical and the PRD table is historical context.

**Verify:**

- `node scripts/sync-manifest.mjs --check` exits 0 and validates all error metadata.
- `rg "missing_input.*check file paths|invalid_state.*corrective skill|gate_blocked.*re-present" skills/prototype/fab-trace/SKILL.md` returns no hardcoded dispatch table.
- Every manifest skill has one adjacent `errors.json`.
- Every `errors.json` error type is present in `schemas/run-object.schema.json` `last_error.properties.type.enum`.

**Effort:** Medium (~2h)

#### Track 5: Contributor-Grade Validation Gate

**Why:** Open source contributors need one obvious command and PR feedback. Static validation is enough for this skills-only repo and avoids pretending there is a runtime test suite.

**Files:**

- CREATE `.github/workflows/validate.yml`
- CREATE `CONTRIBUTING.md`
- MODIFY `package.json`
- MODIFY `README.md`
- MODIFY `docs/VALIDATION.md`

**Steps:**

1. Add `npm run validate` to run Node syntax checks, `scripts/sync-manifest.mjs --check`, `scripts/validate-run.mjs test/fixtures/valid-run.json`, and the expected-failure check for `test/fixtures/invalid-run.json`.
2. Add `npm run setup` as `npm run validate && node scripts/link-skills.mjs`.
3. Create `.github/workflows/validate.yml` with `pull_request` and `push` triggers, Node LTS, `npm ci`, and `npm run validate`.
4. Create `CONTRIBUTING.md` with the skill-author workflow: edit `skills/manifest.json`, add or modify `SKILL.md`, add adjacent `errors.json`, run `npm run validate`, run `node scripts/link-skills.mjs`, open PR.
5. Update `README.md` Quick Start so a fresh clone can verify and link the repo with `npm ci` and `npm run setup`.
6. Update `docs/VALIDATION.md` to replace manual-only evidence with the new static validation gate plus retained sample-run evidence.

**Verify:**

- `npm run validate` exits 0 locally.
- GitHub Actions shows one required `validate` job on PRs.
- `CONTRIBUTING.md` contains the exact add-skill checklist and no unstated setup.
- Fresh clone setup after `git clone` is two commands: `npm ci`, `npm run setup`.

**Effort:** Medium (~1.5h)

### 4. Acceptance Gates

- `npm ci` succeeds on a fresh clone.
- `npm run validate` exits 0 and includes manifest sync check, run-object schema validation, and expected invalid-fixture failure.
- `npm run setup` validates the repo and creates local `.skills/` entries.
- `node scripts/link-skills.mjs` creates one `.skills/<skill-id>` entry per active manifest skill.
- `.claude-plugin/plugin.json`, schema gate requirements, and `.skills/` discovery are reproducible from `skills/manifest.json`.
- A new skill PR can be reviewed by checking only `skills/manifest.json`, the new `SKILL.md`, the adjacent `errors.json`, and CI output.

### 5. Deferred

- `scripts/score-quality.mjs`: low leverage; `fab-check` rubric is readable and not duplicated enough to justify code.
- Automated skill execution tests: ADR-006 keeps markdown-skill testing manual until usage proves demand.
- Skill version negotiation: defer until multiple released skill versions exist.
- Formal abandonment flow: schema already supports `abandoned`; no current skill needs it.
- CSO hardening artifacts: no runtime, dependencies, secrets, endpoints, or CI secrets after this plan.
- `costs.by_step.usd` rename: valid cleanup, not a downstream blocker.

### 6. Open Questions

None. Decisions fixed: manifest lives at `skills/manifest.json`; error metadata lives beside each skill as `errors.json`; CI runs static validation only.



