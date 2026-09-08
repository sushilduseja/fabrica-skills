# fabrica-skills

[![npm version](https://img.shields.io/npm/v/fabrica-skills.svg)](https://www.npmjs.com/package/fabrica-skills) [![MIT license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/sushilduseja/fabrica-skills)

Turn a rough product idea into a small, working local app. An AI coding agent does the work. You approve the key decisions, or skip approval with one flag.

This repository ships markdown skills only. It has no runtime, no hosted service, no deploy tool. Your coding agent reads the skills and follows them.

## Documentation

[DeepWiki](https://deepwiki.com/sushilduseja/fabrica-skills/): AI-generated documentation and codebase exploration.

## Quickstart

Run these two commands in your project folder.

```
npx fabrica-skills@latest install
npx fabrica-skills@latest status
```

The first command copies 16 skills into the skill folders your agent already reads: `.agents/`, `.claude/`, `.cursor/`, `.codex/`, `.opencode/`. It adds nothing to `package.json` and installs no dependency. The second command lists 16 installed skills. Your agent can now see them.

## Two choices you control

### Choose your stack

`/fab-spec` asks for your frontend, backend, and database, one at a time. Answer each, or leave any blank.

A blank slot gets a fast, production-grade default:

| Slot | Default |
|---|---|
| Frontend | React + Vite |
| Backend | FastAPI |
| Database | SQLite |

You can override any slot. The agent uses your choice unless it conflicts with the spec, and explains why if it does.

### Choose your speed: approve each step, or run on auto

By default, the agent stops and shows you the spec and the plan before it writes anything. You approve, then it continues.

Add `--auto` to skip the spec, plan, and integrate approval stops. The agent writes the spec, the plan, and the wiring without waiting, then shows you a short summary of what it assumed.

```
npx fabrica-skills@latest init-run --name my-app --auto
```

Two steps always stop for you, with or without `--auto`:

- The pre-launch check, before anything reaches a real user.
- Any decision the agent cannot make for you.

## First run

Create a run file.

```
npx fabrica-skills@latest init-run --name my-app
```

Ask your agent to start intake.

```
/fab-spec
Idea: TaskFlow — a local-first team task board. Tasks in three columns
(todo / doing / done) with move, title + notes, text search, and a small
live stats panel. One local server, web UI, no external services.
```

The agent shows you a field called `next_action` after each step. Run that command next. Repeat until the run finishes.

For a full walkthrough from idea to running app, see [examples/fabrica-skills-QUICKSTART.md](https://github.com/sushilduseja/fabrica-skills/blob/main/examples/fabrica-skills-QUICKSTART.md).

## How a run flows

```
New project:
  /fab-spec -> /fab-plan -> /fab-scaffold -> /fab-build <stage> -> /fab-eval <stage>
  Repeat build/eval → /fab-integrate -> /fab-verify -> /fab-handoff -> /fab-retro

Existing project (init-existing-run):
  init-existing-run -> /fab-discover -> /fab-spec -> /fab-plan -> /fab-adopt
  -> /fab-build <stage> -> /fab-eval <stage> -> /fab-integrate -> /fab-verify

Use as needed: /fab-fix <stage>, /fab-decide, /fab-status
```

New and existing share build, eval, integrate, and verify. New uses `docs/spec.md` and `/fab-scaffold`; existing uses `docs/fabrica/` and `/fab-adopt` (see `docs/STATE_MACHINE.md`).

Full diagram: [docs/STATE_MACHINE.md](https://github.com/sushilduseja/fabrica-skills/blob/main/docs/STATE_MACHINE.md).

## Existing projects

To manage a pre-existing repository (never for a greenfield run), create the run inside that repository:

```
npx fabrica-skills@latest init-existing-run --name my-app
```

Then follow the existing-project flow: `/fab-discover` (read-only inspection → `docs/fabrica/project-profile.md`) → `/fab-spec` → `/fab-plan` → `/fab-adopt` (activates work, never scaffolds) → build, eval, integrate, and verify as usual. Spec and blueprint live under `docs/fabrica/`. Adoption rechecks the recorded Git baseline and stops on drift, or on uncommitted work without your explicit decision. Limits: one repository per run; Fabrica never replaces your build, tests, or CI.

## Every skill, one line each

| Skill | Phase | Stops for approval? | Does this |
|---|---|---|---|
| `/fab-spec` | 0 | Yes, unless `--auto` | Turns your idea into a spec. |
| `/fab-discover` | 0 | No | Surveys an existing repo → `docs/fabrica/project-profile.md`. |
| `/fab-plan` | 0 | Yes, unless `--auto` | Turns the spec into an architecture and a build order. |
| `/fab-adopt` | 1 | Yes, unless `--auto` | Registers an existing repo (never scaffolds). |
| `/fab-scaffold` | 1 | No | Builds the project skeleton. |
| `/fab-build` | 1 | No | Implements one stage. |
| `/fab-eval` | 1 | No | Scores one stage on quality. |
| `/fab-status` | 1 | No | Shows the current run state. |
| `/fab-handoff` | 1 | No | Writes a resumable handoff note. |
| `/fab-fix` | 2 | No | Diagnoses and fixes a failing stage. |
| `/fab-integrate` | 2 | Yes, unless `--auto` | Connects finished stages into one flow. |
| `/fab-verify` | 2 | Always | Runs the pre-launch check. |
| `/fab-decide` | 2 | Always | Records a decision only you can make. |
| `/fab-pr-review` | 2 | No | Reviews a pull request. |
| `/fab-retro` | 2 | No | Scores the finished run. |
| `/fab-code-review` | 2 | No | Reviews changes since a fixed git point. |

The review skill installs under the name `fabrica-code-review`. Run it as `/fab-code-review`. Install creates 16 skills plus the `fab-code-review` alias directory (same content as `fabrica-code-review`); `status` reports 16/16; disk may show 17 dirs per harness.

## What each stop means

| Stop type | What happens |
|---|---|
| `auto` | The agent proceeds. It does not wait for you. |
| `checkpoint` | The agent shows you the result first. You approve before it writes anything. |
| `review` | The agent runs local checks freely. It asks before any external or destructive action. |
| `full` | The agent asks before it starts, and again after it finishes. |

## The run file

Every run keeps its state in one file: `fabrica.run.json`.

| Field | Holds |
|---|---|
| `status` | Where the run stands right now. |
| `current_step` | The skill running now. |
| `current_app_stage` | The stage being worked on. |
| `next_action` | The exact command to run next. |
| `last_error` | The last error, or `null`. |
| `app_stages` | Every stage: status, files, quality score. |
| `preferred_stack` | Your frontend, backend, and database choice. |
| `gate_levels` | The resolved stop type for each skill. |
| `costs` | Token and dollar cost, when known. |
| `verifications` | Every test and launch result. |
| `human_decisions` | Every decision you recorded. |

Full schema: `schemas/run-object.schema.json`. The validator checks every write against it before saving: `scripts/validate-run.mjs`.

## Other ways to install

### Install once for every project on your machine

```
npx fabrica-skills@latest install --global
```

Skills go to your home folder, not the project folder. A global install resolves through `os.homedir()` to your real home directory: `C:\Users\<name>` on Windows, `/home/<name>` on Linux, `/Users/<name>` on macOS.

`--global` copies skills only. It does not put a `fabrica-skills` command on your PATH. Always run the CLI through `npx`.

### Pin the version for your team

`@latest` moves. If your team wants the same skills on every machine, pin the package and let your lockfile hold the version:

```
npm install -D fabrica-skills
npx fabrica-skills install
```

With the package in `node_modules`, `npx fabrica-skills` runs the pinned copy, not the registry. To change versions, change the dependency and re-run the install command.

### Install from a local checkout of this repo

```
node bin/fabrica-skills.mjs install --global
```

### Update

```
npx fabrica-skills@latest update
```

### Remove

```
npx fabrica-skills@latest uninstall
```

Release history: `CHANGELOG.md`.

## Requirements

- Git.
- Node.js 16.7 or newer.
- Network access for the first `npx` fetch. After that, the CLI comes from your local npm cache.
- An AI coding agent that reads local markdown skill files.

Python backends: scaffolds prefer [uv](https://github.com/astral-sh/uv) and `uv run` (no venv activation). If `uv` is missing, the agent asks once before installing it — under `--auto` it falls back instead of asking. If install is impossible or declined, it falls back to `.venv` + path-qualified `python -m pip` (still no activate).

## Repository layout

```
fabrica-skills/
  bin/                   CLI entry point (fabrica-skills)
  skills/manifest.json   Canonical skill inventory
  skills/core/*/         Core skills
  skills/prototype/*/    Full-pipeline skills
  skills/standalone/*/   Standalone skills
  skills/shared/         Shared run-object schema notes
  scripts/               Validators, manifest sync, installer CLIs
  schemas/               run-object.schema.json
  docs/STATE_MACHINE.md  Visual state machine and command pathways
  docs/examples/         Sample spec and blueprint
  examples/              Canonical run-object template
  test/fixtures/         Valid and invalid run objects for CI
  .github/               CI workflows
  .claude-plugin/        Claude Code plugin manifest
  CLAUDE.md              Agent rules
  CONTEXT.md             Domain vocabulary and design decisions
  CONTRIBUTING.md        Contributor workflow
  AGENTS.md              Agent discovery config
```

## Troubleshooting

| Problem | Fix |
|---|---|
| `node` is not found | Install Node.js 16.7 or newer. Then run the install command again. |
| `npx` asks "Ok to proceed?" | Answer `y` once, or run `npx -y fabrica-skills@latest install`. |
| Installed skills are older than the version you want | Run `npx fabrica-skills@latest update`, then `status` again. |
| Your agent does not see the slash commands | Point it at a real install path, e.g. `.agents/skills/fab-spec/SKILL.md` or `.claude/skills/fab-spec/SKILL.md` (also `.cursor/skills`, `.codex/skills`, `.opencode/skills`). Or use `.claude-plugin/plugin.json` if your agent supports it. Run `npx fabrica-skills@latest status` to confirm 16/16. |
| `fabrica.run.json` is missing | Prefer `npx fabrica-skills@latest init-run --name <slug>` (add `--auto` to skip spec/plan/integrate stops). Or start with `/fab-spec`, which can create the file. `/fab-spec` remains the only skill entry point. |
| A stage is blocked | Run the exact command in `next_action` (usually `/fab-fix <stage>`). Stage names come from `next_action` or `app_stages` in `fabrica.run.json` (or `docs/blueprint.md`) — character-for-character. Do not invent names or copy sample names from docs unless they match your run. Paste the failing output with the command. |
| Cost shows `unknown` | Expected. This means spend has not been measured yet. |
| The agent wants to deploy externally | Stop, unless you want this. This tool builds local prototypes first. |

## What this is not

- Not an orchestrator that runs skills without an agent.
- Not a hosted build service.
- Does not add app code to this repository.
- Does not run a hidden chain of skills on its own.
- Does not manage multiple agents at once.
- Does not measure exact token cost unless your agent or provider reports it.

## License

MIT. See `LICENSE`.
