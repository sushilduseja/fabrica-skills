# Infrastructure-Only Test Runbook

Items from the 36-point test plan that cannot be unit-tested inside the repo.

They need a CI matrix entry or a human-executable runbook. This file is that runbook.
Run these on a disposable clone or branch, never on your working checkout.

## 1. Node 16.7 floor (plan item 3)

`package.json` declares `engines.node >= 16.7`. CI only exercises `lts/*` (Node 20/22).

```bash
nvm install 16.7.0
nvm use 16.7.0
node -v                      # expect v16.7.0
git clone https://github.com/sushilduseja/fabrica-skills.git
cd fabrica-skills
npm ci
npm run check
```

Expected: `npm run check` completes with the same pass counts as the CI run:
validate sub-steps OK, all 82 tests ok, eslint 0 errors, prettier clean.

Record: terminal output of `node -v` and the final `npm run check` tail.

## 2. Concurrent install race (plan item 22)

`link-skills.mjs` is synchronous and is not documented as lock-protected.

```bash
git clone https://github.com/sushilduseja/fabrica-skills.git
cd fabrica-skills
npm ci
```

Open two terminals in the same checkout and run near-simultaneously:

```bash
# terminal A
node scripts/link-skills.mjs

# terminal B
node scripts/link-skills.mjs
```

Then run once more sequentially:

```bash
node scripts/link-skills.mjs
```

Expected: no partial/corrupt `.skills/`, every managed skill resolves to a valid
entry, and the sequential rerun exits `DONE` (idempotent). If a race is observed,
record the failure mode here before deciding whether to add a lockfile.

## 3. README command-by-command execution (plan item 26)

Copy each README fenced block verbatim and run it in order. Do not paraphrase.

1. "Clone and install":
   ```bash
   git clone https://github.com/sushilduseja/fabrica-skills.git
   cd fabrica-skills
   npm ci
   ```
   Expected: install succeeds; `npm ls` shows no high-severity audit findings
   (`npm audit --audit-level=high` exits 0).

2. "Validate and link":
   ```bash
   npm run setup
   ```
   Expected: validation passes, `.skills/` contains one entry per active skill.
   Any failure prints a `[validate-run]`, `[assert-invalid]`, `[sync-manifest]`,
   or `[link-skills]` error with a fix.

3. "Open this repo in your AI coding agent": point the agent at `.skills/` and
   confirm it can read `.skills/fab-intake/SKILL.md`.

4. "Run intake": send `/fab-intake` plus a raw idea. Expected: `docs/spec.md`
   and `fabrica.run.json` are created and both validate
   (`node scripts/validate-run.mjs fabrica.run.json` exits 0).

5. "Full regression suite":
   ```bash
   npm run check
   ```
   Expected: same pass counts as CI.

Record: each step's exit code and any deviation from the expected outcome.

## Status

- [ ] Node 16.7 run complete
- [ ] Concurrency run complete
- [ ] README run complete

## Execution Tracking

Do **not** mark the overall test suite "complete" in any summary doc until every row
below has at least one dated execution with a recorded result.

| Item | Last executed | Result |
|---|---|---|
| Node 16.7 floor pin | — (pending) | pending |
| Concurrent install race | — (pending) | pending |
| Windows junction install run | — (pending) | pending |
| macOS/Linux symlink install run | — (pending) | pending |