# Contributing

## Adding or modifying a skill

1. Edit `skills/manifest.json` to add, remove, or update the skill record.
2. Create or modify the `SKILL.md` file in the skill's directory.
3. Create or update the adjacent `errors.json` with the skill's error conditions.
4. Run `npm run validate` — this checks manifest integrity, schema validation, and error metadata.
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
