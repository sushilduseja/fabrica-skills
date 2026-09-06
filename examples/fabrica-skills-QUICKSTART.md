# fabrica-skills: Quickstart

From zero to a running local app in one sitting. fabrica-skills gives your AI coding agent a set of markdown skills that take a rough idea all the way to a tested, locally-running prototype. You send short prompts; the agent does the work. With `--auto`, the agent skips the spec/plan checkpoints and stops only where approval is mandatory.

## What you need

- Git and Node.js 16.7+
- An AI coding agent that can read local markdown files (Claude Code, Cursor, Codex, OpenCode, …)
- ~10 minutes of your attention per stage in default mode. In `--auto` mode, no attention until verification.

The example below builds **TaskFlow**, a local team task board, a small but complete full-stack app (API + database + web UI). Swap in your own idea at Step 1 and everything else works the same.

## 1. Install (one time)

```bash
mkdir taskflow && cd taskflow
npm init -y
npm install -D fabrica-skills
npx fabrica-skills install
```

**Expected outcome**

```text
[fabrica-skills] installed 14 skills × 5 harness roots (project)
```

Optional sanity check that your agent can see the skills:

```bash
npx fabrica-skills status
```

**Expected outcome:** `agents 14/14`, `claude 14/14`, `cursor 14/14`, `codex 14/14`, `opencode 14/14` listed under `harness`.

## 2. Open the project in your AI agent

Open the `taskflow/` folder in your agent of choice. Use the `/fab-*` names below, or point the agent at the matching skill file directly, e.g.:

```text
Follow .agents/skills/fab-spec/SKILL.md
```

## 3. Run the pipeline

Send these prompts one at a time. In default mode, approve each checkpoint when you like what you see. Add `--auto` to `init-run` or to a skill prompt to skip that skill's approval checkpoint: the agent then proceeds through `auto` gates without stopping and halts only at `review`/`full` gates.

The full pipeline:

```text
/fab-spec → /fab-plan → /fab-scaffold → (/fab-build → /fab-eval) per stage
          → /fab-integrate → /fab-verify → /fab-handoff → /fab-retro
```

**Golden rule:** after every step, check `next_action` in `fabrica.run.json`. It always names the exact next command. Lost? Run `/fab-status` for a live dashboard.

---

### Step 1: Spec

```text
/fab-spec
Idea: TaskFlow, a local-first team task board. Tasks live in three columns
(todo / doing / done) with a move action, title + notes, a text search box,
and a small live stats panel. One local server, web UI, no external services.
```

**Expected outcome:** the agent asks a few clarifying questions, then stack preferences one slot at a time (frontend, backend, database). Leave any blank for the fixed defaults (React + Vite, FastAPI, SQLite). In `--auto` mode it prints an assumption summary instead of waiting. After you approve (or immediately in `--auto`): `docs/spec.md` is written, `fabrica.run.json` is created with `preferred_stack`, and `next_action` points to `/fab-plan`.

### Step 2: Blueprint

```text
/fab-plan
```

**Expected outcome:** architecture, stack choice, and 3 build stages (e.g. `task-crud-api`, `search-stats`, `web-dashboard`) written to `docs/blueprint.md`, with each stack slot labeled operator-specified or default. Approve when the plan feels small and testable. `next_action` points to `/fab-scaffold`.

### Step 3: Scaffold

```text
/fab-scaffold
```

**Expected outcome:** a project skeleton in your current folder: source directories, a tests folder, dependency files, one root `README.md`, and `.env.example` when the app needs environment variables. The run object now tracks the stages.

### Step 4: Build and score each stage

Repeat this pair once per stage from your blueprint, using the exact stage names:

```text
/fab-build task-crud-api
```

```text
/fab-eval task-crud-api
```

**Expected outcome:** `/fab-build` implements just that stage with focused tests and runs them. `/fab-eval` scores it 0 to 10 on five axes (spec fit, contract fit, tests, clarity, safety) and writes `docs/eval/<stage-name>.md`.

If any axis scores below 6, the stage is blocked and `next_action` will point to the fix loop:

```text
/fab-fix task-crud-api
```

…then re-run `/fab-eval`. Continue with the remaining stages (`search-stats`, `web-dashboard`, or whatever your blueprint defined).

### Step 5: Integrate

```text
/fab-integrate
```

**Expected outcome:** all stages wired into one end-to-end flow, the full test suite green in a single command, and integration evidence recorded in the run object.

### Step 6: Verify local launch

```text
/fab-verify
```

**Expected outcome:** the app starts locally (e.g. `npm start` → http://127.0.0.1:3000) and the agent smokes it over loopback (real process boot, HTTP checks) before declaring the launch verified. Anything external or destructive requires your explicit approval first. In `--auto` mode the agent still stops here: the stop message has three parts (Done, Waiting on, If hold).

### Step 7: Wrap up

```text
/fab-handoff
```

```text
/fab-retro
```

**Expected outcome:** resumable session notes in `docs/handoff.md`, a retrospective with run scores and process improvements in `docs/retro.md`, and `status: "complete"` in `fabrica.run.json`.

---

## If something goes wrong

| Situation | Do this |
|---|---|
| A stage is blocked (score < 6) | `/fab-fix <stage-name>`: paste the failing output with it |
| Not sure where you are | `/fab-status`, or read `next_action` in `fabrica.run.json` |
| Need to pause / resume later | `/fab-handoff`, then resume from `docs/handoff.md` next session |
| Agent doesn't recognize `/fab-*` | Tell it: `Follow .agents/skills/<skill-name>/SKILL.md` |

## Clean up (optional)

```bash
npx fabrica-skills uninstall
```

Removes only the skill directories it installed. Your app code stays untouched.
