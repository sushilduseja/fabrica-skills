# Changelog

## 1.1.2 (2026-09-06)

### Changed
- README and QUICKSTART lead with the zero-dependency install: `npx fabrica-skills@latest install`. No `package.json` changes, no local dependency. The `npm install -D` flow is documented as the pinned-version option for teams that want lockfile-held reproducibility.
- README documents that `--global` copies skills only and does not add a `fabrica-skills` command to PATH; all CLI calls stay on `npx`.
- All consumer-facing commands in README and QUICKSTART use the canonical `npx fabrica-skills@latest <command>` form.
- Troubleshooting gains rows for the first-run npx approval prompt and for refreshing stale installed skills via `update`.

### Fixed
- Harden path handling for Windows usernames containing spaces: added `assertWithinRoot` write-boundary guard (link/install targets), regression tests for space-containing home directories, and a repo self-scan forbidding shell-string path interpolation (the 8.3 short-name bug class). Audit found zero existing occurrences — all paths already use `path.join` and array-arg subprocess calls.

## 1.1.1 (2026-09-06)

### Fixed
- `--auto` mode: skills resolve gates from `fabrica.run.json` `gate_levels` first; invocation `--auto` is equivalent, not required when levels are already auto
- `fab-spec` does not re-prompt continue-vs-fresh when auto mode already applies (`gate_levels.fab-spec` auto and `next_action` `/fab-spec`)
- README and QUICKSTART document that `--auto` also skips `fab-integrate`
- `init-run --auto` prints next-step text that mentions verify/decide still stop

## 1.1.0 (2026-09-06)

### Added
- Sequential frontend/backend/database stack prompting in fab-spec, with fast pinned defaults (React + Vite, FastAPI, SQLite) when left blank
- preferred_stack field in run object schema, respected per-slot by fab-plan

## 1.0.1 (2026-09-05)

Docs-only patch. No behavior changes.

### Fixed
- Stale "forge/check" wording in README
- Removed outdated pre-publish disclaimer
- Clarified pre-1.0 skill ids in CONTEXT.md
- Corrected skill-attribution cells in docs/STATE_MACHINE.md

### Changed
- README rewritten in Simplified Technical English with a three-step Quickstart
- Historical design docs moved to docs/archive/ with an index
- docs/VALIDATION.md now points at npm run check instead of mirroring its output
- Quickstart tutorial moved to examples/ and linked from First run
- CI release workflow validates only; publish is a manual maintainer step

## 1.0.0 (2026-09-05)

First stable public release.

### Added
- npm registry as primary distribution channel
- Version-consistency enforcement across package.json, manifest.json, plugin.json
- Lifecycle-script guard in CI release pipeline

### Fixed
- Removed prepack script that triggered EALLOWSCRIPTS on git-dep installs
- Version drift between package.json, skills/manifest.json, .claude-plugin/plugin.json

## 0.3.0

### Breaking
- Skill ids renamed (fab-intake → fab-spec, ...). Canonical ids are in `skills/manifest.json`.
- Consumer install path is now harness skill directories via CLI.

### Added
- `fabrica-skills` CLI: install, update, uninstall, status, validate
- Project and global install scopes
- Managed-skill markers to protect foreign skills

### Fixed
- Fresh Windows clones no longer fail `npm run setup`: frontmatter parsing tolerates CRLF and `.gitattributes` pins LF line endings.
- Bumped `fast-uri` past 3.1.5 to close GHSA SSRF/host-confusion advisories (`npm audit` clean).

### Notes
- Historical docs may still use pre-0.3 ids; canonical ids are in `skills/manifest.json`.
