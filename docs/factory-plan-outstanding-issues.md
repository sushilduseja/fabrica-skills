# Historical outstanding issues

> Historical design record. The issues originally tracked in this document have been superseded by the current implementation and validation suite.

Current source of truth:

- Skill inventory and gates: `skills/manifest.json`
- Run-object schema: `schemas/run-object.schema.json`
- Semantic validation: `scripts/validate-run.mjs`
- Workflow diagrams: `docs/STATE_MACHINE.md`
- Current validation evidence: `docs/VALIDATION.md`

To check the current repository state, run:

```bash
npm ci
npm test
npm run validate
npm run setup
```

Expected current result:

```text
38/38 tests passed
[sync-manifest] CHECK OK — all generated files match manifest
[link-skills] DONE — 12 skills installed
```
