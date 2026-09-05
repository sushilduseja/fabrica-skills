# Local fullstack MVP pattern

Docs-only reference for the demo shape behind `/fab-spec` first runs. No app code lives here.

1. Idea: paste invoice text → normalized JSON.
2. Stages: `parse-invoice` → `api-server` → `web-ui`.
3. Stack: Node ESM, built-in `http`, `public/`, `node:test`.
4. Commands: `npm test`, `npm start` on port 3847.
5. Reminder: validate `fabrica.run.json` after each skill with:

```bash
npx fabrica-skills validate fabrica.run.json
```
