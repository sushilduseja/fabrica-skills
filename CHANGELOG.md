# Changelog

## 0.3.0

### Breaking
- Skill ids renamed (fab-intake → fab-spec, ...). See README mapping table.
- Consumer install path is now harness skill directories via CLI.

### Added
- `fabrica-skills` CLI: install, update, uninstall, status, validate
- Project and global install scopes
- Managed-skill markers to protect foreign skills

### Fixed
- Fresh Windows clones no longer fail `npm run setup`: frontmatter parsing tolerates CRLF and `.gitattributes` pins LF line endings.
