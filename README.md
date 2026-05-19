# fabrica-skills [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/sushilduseja/fabrica-skills)

Agent-readable markdown skills for turning a rough product idea into a small local app prototype.

This is a skills-only repository. It is not a runtime, SaaS, queue, deploy tool, or agent orchestrator. You install the skill documents, then your AI coding agent follows them while you approve the checkpoint steps.

## What You Get

- 13 `fab-*` skills, each stored as a self-contained `SKILL.md`.
- A spec-first workflow: idea -> product spec -> blueprint -> scaffold -> implementation -> quality check.
- A durable run state file: `fabrica.run.json`.
- A JSON Schema for validating run state: `schemas/run-object.schema.json`.
- Local-first prototype behavior. External deploy is deferred and must be explicitly approved.

## Requirements

- Git.
- Node.js 16.7+ for `scripts/link-skills.mjs`.
- An AI coding agent that can read local markdown skill files.

No package install is required for this repo.

## Quick Start

Use a disposable clone or branch for your first run. The first two skills write `docs/spec.md`, `docs/blueprint.md`, and `fabrica.run.json`; `fab-frame` then creates the app in a sibling directory named `../<app-name>/`.

### 1. Clone the skills repo

```bash
git clone https://github.com/sushilduseja/fabrica-skills.git
cd fabrica-skills
```

### 2. Create the local skill index

```bash
node scripts/link-skills.mjs
```

Expected result: a `.skills/` directory with 13 entries, one per `fab-*` skill.

On Windows, the script uses directory junctions. On macOS and Linux, it uses symlinks. If a Windows junction is blocked, it falls back to copying the skill directory.

### 3. Open this repo in your AI coding agent

Make sure the agent can see `.skills/`.

If your agent supports slash commands, use the `/fab-*` names below. If it does not, ask it to follow the matching skill file directly, for example:

```text
Follow .skills/fab-intake/SKILL.md.
Idea: Build a local CLI that accepts pasted invoice text and returns normalized JSON.
```

### 4. Run intake

Send this to the agent:

```text
/fab-intake
Idea: Build a local CLI that accepts pasted invoice text and returns normalized JSON.
```

The agent should ask targeted questions, then show a spec for approval.

Approve only when the spec is specific enough for a stranger to build. The skill writes:

- `docs/spec.md`
- `fabrica.run.json`
- `next_action: "/fab-blueprint"`

### 5. Create the blueprint

Send:

```text
/fab-blueprint
```

The agent should propose architecture, stack, app stages, and build order.

Approve only when the plan is small and testable. The skill writes:

- `docs/blueprint.md`
- app stages in `fabrica.run.json`
- `next_action: "/fab-frame"`

### 6. Scaffold the app

Send:

```text
/fab-frame
```

The skill creates a sibling app directory:

```text
../<app-name>/
```

Expected files include:

- `fabrica.run.json`
- `docs/spec.md`
- `docs/blueprint.md`
- app stubs
- tests folder
- dependency files such as `pyproject.toml`, `requirements.txt`, `Makefile`, or `package.json`
- `.env.example` when the app needs environment variables

After this step, continue work from the generated app directory. If your agent loses access to slash commands after switching directories, point it back to the source skill path, such as:

```text
Follow ../fabrica-skills/skills/core/fab-forge/SKILL.md.
```

### 7. Build one stage

Use the exact stage name from `fabrica.run.json` or `docs/blueprint.md`.

```text
/fab-forge <stage-name>
```

The skill implements only that stage, adds focused tests, runs the narrowest useful test command, and updates `fabrica.run.json`.

### 8. Check quality

```text
/fab-check <stage-name>
```

The skill writes:

```text
docs/eval/<stage-name>.md
```

It scores the stage from 0 to 10 on spec fit, contract fit, tests, clarity, and safety. Any axis below 6 blocks the stage and sets the next action to `/fab-trace <stage-name>`.

### 9. Continue from the run state

Use `next_action` in `fabrica.run.json` as the source of truth.

Useful commands:

```text
/fab-pulse
/fab-ledger
/fab-passport
```

- `/fab-pulse` shows pipeline, quality, cost, and next action.
- `/fab-ledger` shows cost estimates when available and `unknown` when not.
- `/fab-passport` writes a resumable handoff at `docs/handoff.md`.

## Install Options

### Recommended: local `.skills/`

```bash
node scripts/link-skills.mjs
```

The script refreshes only `fab-*` entries inside `.skills/`. Non-`fab-*` entries are left alone.

### Claude Code plugin manifest

Agents that support `.claude-plugin/plugin.json` can discover all 13 skills from the plugin manifest.

### Manual copy

Copy any individual `SKILL.md` into your agent's skill directory:

```text
skills/core/fab-intake/SKILL.md
skills/prototype/fab-trace/SKILL.md
```

Each skill is designed to be readable on its own, but the full workflow works best when all 13 skills are available.

## Workflow

```text
Phase 0: Spec-only demo
  /fab-intake -> /fab-blueprint
  Output: docs/spec.md, docs/blueprint.md, fabrica.run.json

Phase 1: Tiny vertical slice
  /fab-frame -> /fab-forge <stage> -> /fab-check <stage> -> /fab-pulse
  Output: scaffolded app, tests, quality score, next action

Phase 2: Thin full-pipeline prototype
  /fab-trace -> /fab-weave -> /fab-launch -> /fab-ledger -> /fab-signal -> /fab-passport -> /fab-retro
  Output: local end-to-end verification, cost review, decisions, handoff, retrospective
```

## Skill Inventory

| Skill | Phase | Default gate | Job |
|---|---:|---|---|
| `/fab-intake` | 0 | checkpoint | Convert a rough idea into `docs/spec.md` and initialize `fabrica.run.json`. |
| `/fab-blueprint` | 0 | checkpoint | Convert the spec into architecture, app stages, and build order. |
| `/fab-frame` | 1 | auto | Create the app skeleton and first-stage contracts. |
| `/fab-forge` | 1 | auto | Implement one named app stage with focused tests. |
| `/fab-check` | 1 | auto | Score one stage on spec fit, contract fit, tests, clarity, and safety. |
| `/fab-pulse` | 1 | auto | Show pipeline, quality, cost, and next action. |
| `/fab-passport` | 1 | auto | Write a resumable handoff document. |
| `/fab-trace` | 2 | auto | Diagnose a failed stage, state root cause, and apply the smallest fix. |
| `/fab-weave` | 2 | checkpoint | Connect completed stages into one local end-to-end flow. |
| `/fab-launch` | 2 | review | Verify the integrated app locally. External deploy requires approval. |
| `/fab-ledger` | 2 | auto | Show cost precision, totals, and per-step estimates when available. |
| `/fab-signal` | 2 | full | Capture a human decision with rationale and timestamp. |
| `/fab-retro` | 2 | auto | Score the run and identify process improvements. |

Gate meanings:

| Gate | Meaning |
|---|---|
| `auto` | The agent may proceed without pausing. |
| `checkpoint` | The agent must show the result or plan before writing. |
| `review` | Local checks may run; external, destructive, or deploy actions need approval. |
| `full` | The agent needs approval before starting and confirmation after completion. |

## Run State

Every run is tracked in `fabrica.run.json`.

Important fields:

- `status`: current lifecycle state.
- `current_step`: current `fab-*` skill.
- `current_app_stage`: active app stage.
- `next_action`: exact command to run next.
- `last_error`: structured error or `null`.
- `app_stages`: stage status, artifacts, notes, and quality score.
- `costs`: measured, estimated, or `unknown`.
- `verifications`: test and launch results.
- `human_decisions`: decisions recorded by `/fab-signal`.

The schema is in `schemas/run-object.schema.json`. Skills validate state before writing.

## Repository Layout

```text
fabrica-skills/
  .claude-plugin/plugin.json
  skills/core/*/SKILL.md
  skills/prototype/*/SKILL.md
  scripts/link-skills.mjs
  schemas/run-object.schema.json
  docs/spec.md
  docs/blueprint.md
  docs/VALIDATION.md
  CONTEXT.md
```

## Example Docs

The checked-in `docs/spec.md` and `docs/blueprint.md` are generated examples from the invoice-note-parser sample run. They show what `/fab-intake` and `/fab-blueprint` should produce.

`docs/VALIDATION.md` records the current validation evidence: schema checks, skill file checks, a Phase 0 sample run, a Phase 1 sample run, `fab-pulse`, handoff, and launch safety.

## Troubleshooting

| Problem | Fix |
|---|---|
| `node` is not found | Install Node.js 16.7+ and rerun `node scripts/link-skills.mjs`. |
| Slash command is not found | Point your agent at `.skills/<skill-name>/SKILL.md` or use the `.claude-plugin/plugin.json` manifest if supported. |
| `fabrica.run.json` is missing | Start with `/fab-intake`. It is the only entry-point skill. |
| A stage is blocked | Run `/fab-trace <stage-name>` with the failure output. |
| Cost shows `unknown` | This is expected when token or API spend has not been measured. |
| External deploy is requested | Stop unless you explicitly want it. MVP launch verification is local-first. |

## Non-Goals

- No app code lives in this repository.
- No hosted service or control plane.
- No hidden automatic skill chaining.
- No multi-agent scheduler.
- No production deploy provider matrix.
- No exact token metering unless the agent/provider exposes it cleanly.
