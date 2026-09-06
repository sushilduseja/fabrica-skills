# fabrica-skills

Turn a rough product idea into a small, working local app. An AI coding agent does the work. You approve the key decisions, or skip approval with one flag.

This repository ships markdown skills only. It has no runtime, no hosted service, no deploy tool. Your coding agent reads the skills and follows them.

## Quickstart

Run these three commands in order.

```
npm install -D fabrica-skills
npx fabrica-skills install
npx fabrica-skills status
```

The last command lists 14 installed skills. Your agent can now see them.

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
npx fabrica-skills init-run --name my-app --auto
```

Two steps always stop for you, with or without `--auto`:

- The pre-launch check, before anything reaches a real user.
- Any decision the agent cannot make for you.

## First run

Create a run file.

```
npx fabrica-skills init-run --name my-app
```

Ask your agent to start intake.

```
/fab-spec
Idea: Build a local CLI that accepts pasted invoice text and returns normalized JSON.
```

The agent shows you a field called `next_action` after each step. Run that command next. Repeat until the run finishes.

For a full walkthrough from idea to running app, see [examples/fabrica-skills-QUICKSTART.md](https://github.com/sushilduseja/fabrica-skills/blob/main/examples/fabrica-skills-QUICKSTART.md).

## How a run flows

```
Phase 0: Spec and plan
  /fab-spec -> /fab-plan
  Produces: docs/spec.md, docs/blueprint.md, fabrica.run.json

Phase 1: Build one slice at a time
  /fab-scaffold -> /fab-build <stage> -> /fab-eval <stage>
  Repeat build and eval until every stage is done.

Phase 2: Connect and verify
  /fab-integrate -> /fab-verify -> /fab-handoff -> /fab-retro
  Use as needed: /fab-fix <stage>, /fab-decide, /fab-status
```

Full diagram: [docs/STATE_MACHINE.md](https://github.com/sushilduseja/fabrica-skills/blob/main/docs/STATE_MACHINE.md).

## Every skill, one line each

| Skill | Phase | Stops for approval? | Does this |
|---|---|---|---|
| `/fab-spec` | 0 | Yes, unless `--auto` | Turns your idea into a spec. |
| `/fab-plan` | 0 | Yes, unless `--auto` | Turns the spec into an architecture and a build order. |
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

The review skill installs under the name `fabrica-code-review`. Run it as `/fab-code-review`.

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

Skip the local dependency.
```
npx fabrica-skills@latest install
```

Install once for every project on your machine.
```
npx fabrica-skills@latest install --global
```

Install from a local checkout of this repo.
```
node bin/fabrica-skills.mjs install --global
```

A global install resolves through `os.homedir()` to your real home directory: `C:\Users\<name>` on Windows, `/home/<name>` on Linux, `/Users/<name>` on macOS.

Update.
```
npx fabrica-skills@latest update
```

Remove.
```
npx fabrica-skills uninstall
```

Release history: `CHANGELOG.md`.

## Requirements

- Git.
- Node.js 16.7 or newer.
- An AI coding agent that reads local markdown skill files.

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
| `node` is not found | Install Node.js 16.7 or newer. Then run `npm run setup`. |
| Your agent does not see the slash commands | Point it at `.skills/<skill-name>/SKILL.md`, or use `.claude-plugin/plugin.json` if your agent supports it. |
| `fabrica.run.json` is missing | Run `/fab-spec`. It is the only starting point. |
| A stage is blocked | Run `/fab-fix <stage-name>` with the failure output. |
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
