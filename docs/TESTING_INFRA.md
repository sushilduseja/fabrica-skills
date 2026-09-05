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
Run consumer steps in a disposable temp project, never in the source checkout.

1. "Install" (project):
   ```bash
   npm install -D fabrica-skills
   npx fabrica-skills install
   ```
   Expected: `.agents/skills/fab-spec/SKILL.md` exists with a
   `.fabrica-managed.json` marker.

2. "First run": send `/fab-spec` plus a raw idea. Expected: `docs/spec.md`
   and `fabrica.run.json` are created and both validate
   (`npx fabrica-skills validate fabrica.run.json` exits 0).

3. "Upgrade":
   ```bash
   npx fabrica-skills@latest update
   ```
   Expected: exit 0; any foreign skill dirs under the harness roots are untouched.

4. "Uninstall":
   ```bash
   npx fabrica-skills uninstall
   ```
   Expected: managed `fab-*` dirs are removed; foreign skill dirs remain.

5. "Full regression suite" (source checkout):
   ```bash
   git clone https://github.com/sushilduseja/fabrica-skills.git
   cd fabrica-skills
   npm ci
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