# Changelog

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
