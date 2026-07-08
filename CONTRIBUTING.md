# Contributing

## Adding or modifying a skill

1. Edit `skills/manifest.json` to add, remove, or update the skill record. Required fields:
   - `id`, `path`, `category`, `phase`, `description`
   - `default_gate`, `overridable` — must match `SKILL.md` frontmatter (validated by `--check`)
   - `prerequisites` — array of skill ids that must complete first
   - `blocks` — array of skill ids that wait for this skill to complete
   - `read_only` — `true` means the skill never writes run object fields
   - `writes_fields` — array of run object fields the skill mutates (empty for read-only skills)
   - `error_metadata_path` — path to the skill's `errors.json`
2. Create or modify the `SKILL.md` file in the skill's directory. Frontmatter `default_gate` and `overridable` must match the manifest (validated automatically).
3. Create or update the adjacent `errors.json` with the skill's error conditions. Each error must have a valid type from the schema enum.
4. Run `npm run validate` — this checks manifest integrity, schema validation, error metadata, and frontmatter/manifest consistency.
5. Run `node scripts/link-skills.mjs` to update the local `.skills/` index.
6. Open a pull request. CI runs `npm run validate` automatically.

## Setup from a fresh clone

```bash
npm ci
npm run setup
```

## Validation commands

| Command | What it does |
|---------|-------------|
| `npm run validate:run` | Validate a run object against the schema |
| `npm run validate:manifest` | Check manifest integrity and generated files |
| `npm run validate` | Full validation suite (run + manifest) |
| `npm run setup` | Validate + create `.skills/` index |
