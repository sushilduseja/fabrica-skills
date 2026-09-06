# fabrica-skills: Quickstart

Build a small, working local app from a rough idea in one sitting. Your AI coding agent does the work. You send short prompts and approve the key decisions, or skip approval with one flag.

The example below builds **TaskFlow**, a local team task board (API + database + web UI). Swap in your own idea at Step 1. Everything else stays the same.

## What you need

- Git.
- Node.js 16.7 or newer.
- An AI coding agent that reads local markdown files (Claude Code, Cursor, Codex, OpenCode, …).
- About 10 minutes of your attention per stage in default mode. No attention until verification in `--auto` mode.

## 1. Install (one time)

Create a folder for your app.

```
mkdir taskflow
```

Move into it.

```
cd taskflow
```

Install the package.

```
npm install -D fabrica-skills
```

Install the skills.

```
npx fabrica-skills install
```

Expected outcome:

```
[fabrica-skills] installed 14 skills × 5 harness roots (project)
```

Optional check that your agent sees the skills:

```
npx fabrica-skills status
```

Expected outcome: `agents 14/14`, `claude 14/14`, `cursor 14/14`, `codex 14/14`, `opencode 14/14` under `harness`.

## 2. Open the project in your agent

Open the `taskflow` folder in your agent. Use the `/fab-*` names below, or point the agent at the skill file directly:

```
Follow .agents/skills/fab-spec/SKILL.md
```

## 3. Run the pipeline

```
/fab-spec → /fab-plan → /fab-scaffold → (/fab-build → /fab-eval) per stage → /fab-integrate → /fab-verify → /fab-handoff → /fab-retro
```

After each step, read `next_action` in `fabrica.run.json`. Run that command next. Lost? Run `/fab-status`.

### Two choices you control

Stack: `/fab-spec` asks for frontend, backend, and database, one at a time. Leave any blank for the fixed defaults (React + Vite, FastAPI, SQLite).

Speed: approve each checkpoint, or add `--auto` to skip the spec, plan, and integrate stops. Copy this:

```
npx fabrica-skills init-run --name taskflow --auto
```

`--auto` never skips the pre-launch check or a decision only you can make. In `--auto` mode the agent emits no extra messages: the assumption summary and progress lines are the only narration.

### Step 1: Spec

```
/fab-spec
Idea: TaskFlow, a local-first team task board. Tasks live in three columns
(todo / doing / done) with a move action, title + notes, a text search box,
and a small live stats panel. One local server, web UI, no external services.
```

Expected outcome: the agent asks a few questions, then records your stack answers (or the defaults) in `preferred_stack`. In `--auto` mode it prints an assumption summary instead of waiting. Then `docs/spec.md` is written and `next_action` points to `/fab-plan`.

### Step 2: Blueprint

```
/fab-plan
```

Expected outcome: architecture, stack choice, and build stages (e.g. `task-crud-api`, `search-stats`, `web-dashboard`) in `docs/blueprint.md`, with each stack slot labeled operator-specified or default. `next_action` points to `/fab-scaffold`.

### Step 3: Scaffold

```
/fab-scaffold
```

Expected outcome: a project skeleton in your current folder: source directories, a tests folder, dependency files, one root `README.md`, and `.env.example` when the app needs environment variables. The run object now tracks the stages.

### Step 4: Build and score each stage

Repeat this pair once per stage from your blueprint, using the exact stage names:

```
/fab-build task-crud-api
```

```
/fab-eval task-crud-api
```

Expected outcome: `/fab-build` implements just that stage with focused tests and runs them. `/fab-eval` scores it 0 to 10 on five axes (spec fit, contract fit, tests, clarity, safety) and writes `docs/eval/<stage-name>.md`.

If any axis scores below 6, the stage is blocked and `next_action` points to the fix loop:

```
/fab-fix task-crud-api
```

Then re-run `/fab-eval`. Continue with the remaining stages.

### Step 5: Integrate

```
/fab-integrate
```

Expected outcome: all stages wired into one end-to-end flow, the full test suite green in a single command, and integration evidence recorded in the run object.

### Step 6: Verify local launch

```
/fab-verify
```

Expected outcome: the app starts locally and the agent smokes it over loopback (real process boot, HTTP checks). Anything external or destructive needs your explicit approval first. In `--auto` mode the agent still stops here: the stop message has three parts (Done, Waiting on, If hold).

### Step 7: Wrap up

```
/fab-handoff
```

```
/fab-retro
```

Expected outcome: resumable session notes in `docs/handoff.md`, a retrospective in `docs/retro.md`, and `status: "complete"` in `fabrica.run.json` once you approve the pre-launch check.

---

## If something goes wrong

| Situation | Do this |
|---|---|
| A stage is blocked (score < 6) | `/fab-fix <stage-name>`: paste the failing output with it |
| Not sure where you are | `/fab-status`, or read `next_action` in `fabrica.run.json` |
| Need to pause / resume later | `/fab-handoff`, then resume from `docs/handoff.md` next session |
| Agent does not see `/fab-*` | Tell it: `Follow .agents/skills/<skill-name>/SKILL.md` |

## Clean up (optional)

```
npx fabrica-skills uninstall
```

Removes only the skill directories it installed. Your app code stays untouched.
