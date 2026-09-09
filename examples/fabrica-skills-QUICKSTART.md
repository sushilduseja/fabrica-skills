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

Install the skills.

```
npx fabrica-skills@latest install
```

There is no separate package install. `npx` fetches the CLI from npm, and the installer copies the skills into the skill folders in this folder. Nothing is added to `package.json`.

Expected outcome:

```
[fabrica-skills] installed 16 skills × 5 harness roots (project)
```

Skills load at session start. Restart your agent session before the next step, then verify:

```
npx fabrica-skills@latest doctor
```

Expected outcome: every selected harness reports its skills as copied. Prefer one harness? Re-run with `install --agent=<name>` (`agents`, `claude`, `cursor`, `codex`, `opencode`) and verify with `doctor --agent=<name>`.

Optional check that your agent sees the skills:

```
npx fabrica-skills@latest status
```

Expected outcome: `agents 16/16`, `claude 16/16`, `cursor 16/16`, `codex 16/16`, `opencode 16/16` under `harness`.

Two variants:

- Install for every project on your machine: add `--global`. Skills go to your home folder. The CLI itself never goes on your PATH; keep calling it through `npx`.
- Your team wants one fixed version everywhere: run `npm install -D fabrica-skills` first. Your lockfile then pins the version, and `npx fabrica-skills install` runs that pinned copy.

## 2. Open the project in your agent

Restart your agent session first (skills load at session start — `/fab-spec` in the pre-install session falls through to normal app-building). Then open the `taskflow` folder in your agent. Use the `/fab-*` names below, or point the agent at the skill file directly:

```
Follow .agents/skills/fab-spec/SKILL.md
```

## 3. Run the pipeline

```
/fab-spec → /fab-plan → /fab-scaffold → (/fab-build → /fab-eval) per stage → /fab-integrate → /fab-verify → /fab-handoff → /fab-retro
```

After each step, read `next_action` in `fabrica.run.json`. Run that command next. Lost? Run `/fab-status`.

Stage names are not fixed by this guide. After `/fab-plan` and `/fab-scaffold`, every `/fab-build`, `/fab-eval`, and `/fab-fix` argument must be the exact stage name from `next_action` or `app_stages` in `fabrica.run.json` (or the matching name in `docs/blueprint.md`).

### Two choices you control

Stack: `/fab-spec` asks for frontend, backend, and database, one at a time. Leave any blank for the fixed defaults (React + Vite, FastAPI, SQLite).

Speed: approve each checkpoint, or add `--auto` to skip the spec, plan, and integrate stops. Copy this:

```
npx fabrica-skills@latest init-run --auto
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

Without `--auto`, the stops are exact: Turn 1 asks the intake questions as short multiple-choice prompts (recommended default called out, plus `Custom answer`) — no writes in that turn. The approval turn shows the spec and waits for `approve spec`; anything else writes nothing. `/fab-plan` then waits for `approve blueprint` the same way.

If the agent starts building before approval: tell it to stop, confirm which unauthorized files to discard (approved artifacts and `fabrica.run.json` stay), and resume from the unchanged run state.

### Step 2: Blueprint

```
/fab-plan
```

Expected outcome: architecture, stack choice, and a build order of named stages in `docs/blueprint.md` and `fabrica.run.json` → `app_stages`. Stage names are chosen by the plan for *this* idea (for a TaskFlow-like board they *might* look like `task-crud-api`, `search-stats`, `web-dashboard` — those are examples only, not fixed names), with each stack slot labeled operator-specified or default. `next_action` points to `/fab-scaffold`.

### Step 3: Scaffold

```
/fab-scaffold
```

Expected outcome: a project skeleton in your current folder: source directories, a tests folder, dependency files, one root `README.md`, and `.env.example` when the app needs environment variables. The run object now tracks the stages.

### Step 4: Build and score each stage

Do **not** invent stage names and do **not** copy sample names from this guide unless they match your run.

1. Open `fabrica.run.json`.
2. Read `next_action` (preferred). It is the exact command to run next, including the stage name when one is required (e.g. `/fab-build <stage>`).
3. If you need the full list, use `app_stages[].name` and/or the stage list in `docs/blueprint.md`. Names must match **character-for-character**.

Repeat this pair once per stage, using **only** those exact names:

```
/fab-build <exact-stage-name-from-next_action-or-app_stages>
```

```
/fab-eval <same-exact-stage-name>
```

Example (only if your plan actually created this stage):

```
/fab-build task-crud-api
/fab-eval task-crud-api
```

Expected outcome: `/fab-build` implements just that stage with focused tests and runs them. `/fab-eval` scores it 0 to 10 on five axes and writes `docs/eval/<stage-name>.md`.

If any axis scores below 6, the stage is blocked and `next_action` points at the fix loop — run **that** command (do not guess the stage name):

```
/fab-fix <exact-stage-name-from-next_action>
```

Then re-run `/fab-eval` with the same exact stage name. Continue until every planned stage is done, always following `next_action`.

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
| A stage is blocked (score < 6) | `/fab-fix <stage-name>`: use the stage name from `next_action`, and paste the failing output with it |
| Not sure where you are | `/fab-status`, or read `next_action` in `fabrica.run.json` |
| Need to pause / resume later | `/fab-handoff`, then resume from `docs/handoff.md` next session |
| Agent does not see `/fab-*` | Restart the session, run `npx fabrica-skills@latest doctor`, then tell it: `Follow .agents/skills/<skill-name>/SKILL.md` in the fresh session |
| `/fab-spec` builds the app instead of running intake | You are in the pre-install session. Restart, invoke `/fab-spec` again, confirm `next_action` is `/fab-plan`, then run `/fab-plan` separately |

## Clean up (optional)

```
npx fabrica-skills@latest uninstall
```

Removes only the skill directories it installed. Your app code stays untouched.
