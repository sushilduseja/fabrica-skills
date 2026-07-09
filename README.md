# fabrica-skills [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/sushilduseja/fabrica-skills)

Agent-readable markdown skills for turning a rough product idea into a small local app prototype.

This is a skills-only repository. It is not a runtime, SaaS, queue, deploy tool, or agent orchestrator. You install the skill documents, then your AI coding agent follows them while you approve the checkpoint steps.

## What You Get

- 12 `fab-*` skills, each stored as a self-contained `SKILL.md`.
- A canonical skill manifest at `skills/manifest.json` — the single source of truth for skill inventory, dependencies, gate defaults, and plugin discovery.
- A spec-first workflow: idea -> product spec -> blueprint -> scaffold -> implementation -> quality check -> integration -> local launch.
- Stack-agnostic scaffolding guidance. Skills must derive runtimes, services, commands, files, and verification steps from the blueprint rather than hardcoding Python, Node, React, FastAPI, Docker, or any sample app.
- A durable run state file: `fabrica.run.json`.
- A JSON Schema for validating run state: `schemas/run-object.schema.json`.
- Local-first prototype behavior. External deploy is deferred and must be explicitly approved. Docker/container verification is supported when the blueprint calls for it, but static Docker checks must not be reported as runtime Docker verification.

## Requirements

- Git.
- Node.js 16.7+.
- An AI coding agent that can read local markdown skill files.

## Quick Start

Use a disposable clone or branch for your first run. The first two skills write `docs/spec.md`, `docs/blueprint.md`, and `fabrica.run.json`; `fab-frame` then creates the app in a sibling directory named `../<app-name>/`.

### 1. Clone and install

```bash
git clone https://github.com/sushilduseja/fabrica-skills.git
cd fabrica-skills
npm ci
```

### 2. Validate and link

```bash
npm run setup
```

Expected result: validation passes, and a `.skills/` directory contains one entry per active skill (see `skills/manifest.json`). If validation or linking fails, the command exits nonzero and prints a `[validate-run]`, `[assert-invalid]`, `[sync-manifest]`, or `[link-skills]` error with the fix. For the full positive, negative, and security regression suite along with format and lint checks, run `npm run check`.

On Windows, the script uses directory junctions. On macOS and Linux, it uses symlinks. If a Windows junction is blocked, it falls back to copying the skill directory and tells you to rerun setup after source updates to refresh copied skills.

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

`/fab-frame` copies `fabrica.run.json`, `docs/spec.md`, and `docs/blueprint.md` into the generated app directory. After `/fab-frame`, the app-directory copy is canonical. The source-repo copies are runtime outputs only and are ignored by git.

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

Use `next_action` in `fabrica.run.json` as the source of truth. For the full visual state machine and common command pathways, see [`docs/STATE_MACHINE.md`](docs/STATE_MACHINE.md).

Useful commands:

```text
/fab-pulse
/fab-passport
```

- `/fab-pulse` shows pipeline, quality, cost, and next action. Pass `--mode=details` for per-step cost breakdown.
- `/fab-passport` writes a resumable handoff at `docs/handoff.md`.

## Install Options

### Local: `.skills/` (recommended for per-project use)

```bash
node scripts/link-skills.mjs
```

Creates `.skills/` inside the repo with one entry per active skill (see `skills/manifest.json`). The command is idempotent and refreshes only manifest-managed skill entries; unrelated skills, including unrelated `fab-*` skills, are left alone. The command refuses to use `.skills/` if it is a symlink or junction.

### Global: `~/.fabrica-skills/` (for cross-project agent access)

```bash
node scripts/link-skills.mjs --global
```

Installs to `~/.fabrica-skills/.skills/` using `os.homedir()` for cross-platform resolution (`C:\sushildusejas\<name>` on Windows, `/home/<name>` or `/sushildusejas/<name>` on Unix). The command refuses to write through a symlinked or junctioned global install directory. The agent must be pointed at this path to discover skills.

### Agent Discovery

| Agent | Discovery mechanism |
|---|---|
| Claude Code | `.claude-plugin/plugin.json` + `CLAUDE.md` |
| OpenCode / Codex CLI | `AGENTS.md` (already in repo) |
| Any agent with configurable skill path | Point to `.skills/` directory |

The `AGENTS.md` at the repo root covers non-Claude agents. After a global install, point each agent's skill search path to `~/.fabrica-skills/.skills/`.

### Manual copy

Copy any individual `SKILL.md` into your agent's skill directory:

```text
skills/core/fab-intake/SKILL.md
skills/prototype/fab-trace/SKILL.md
```

Each skill is designed to be readable on its own, but the full workflow works best when all skills are available. The active skill count is defined in `skills/manifest.json`.

## Workflow

Visual state machine and pathway reference: [`docs/STATE_MACHINE.md`](docs/STATE_MACHINE.md).

```text
Phase 0: Spec and blueprint
  /fab-intake -> /fab-blueprint
  Output: docs/spec.md, docs/blueprint.md, fabrica.run.json

Phase 1: One or more vertical slices
  /fab-frame -> /fab-forge <stage> -> /fab-check <stage>
  Repeat forge/check until required stages are done.
  Output: scaffolded app, tests, quality scores, next_action

Phase 2: Integrated local prototype
  /fab-weave -> /fab-launch -> /fab-passport -> /fab-retro
  Recovery and decision commands as needed: /fab-trace <stage|integration>, /fab-signal, /fab-pulse
  Output: local end-to-end verification, launch evidence, decisions, handoff, retrospective
```

## Skill Inventory

| Skill | Phase | Default gate | Job |
|---|---:|---|---|
| `/fab-intake` | 0 | checkpoint | Convert a rough idea into a spec and initialize the run object. |
| `/fab-blueprint` | 0 | checkpoint | Convert a spec into app architecture and a build order. |
| `/fab-frame` | 1 | auto | Scaffold the app project skeleton and first-stage contracts. |
| `/fab-forge` | 1 | auto | Implement one named app stage against the blueprint. |
| `/fab-check` | 1 | auto | Evaluate one app stage against quality criteria. |
| `/fab-pulse` | 1 | auto | Render the current run state as a terminal dashboard. |
| `/fab-passport` | 1 | auto | Write a resumable handoff document. |
| `/fab-trace` | 2 | auto | Diagnose a failing stage and apply the smallest viable fix. |
| `/fab-weave` | 2 | checkpoint | Connect completed stages into an end-to-end flow. |
| `/fab-launch` | 2 | review | Run a pre-launch checklist and verify the app locally. |
| `/fab-signal` | 2 | full | Capture a human decision. |
| `/fab-retro` | 2 | auto | Score the run and identify process improvements. |

Plain-language aliases:

| Skill | Means |
|---|---|
| `/fab-intake` | collect requirements and write the spec |
| `/fab-blueprint` | design the architecture and build stages |
| `/fab-frame` | scaffold the project skeleton |
| `/fab-forge` | implement one stage |
| `/fab-check` | evaluate one stage |
| `/fab-pulse` | show status |
| `/fab-passport` | write handoff notes |
| `/fab-trace` | debug a failure |
| `/fab-weave` | integrate stages |
| `/fab-launch` | verify local launch |
| `/fab-signal` | record a human decision |
| `/fab-retro` | write the retrospective |

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

- `status`: current lifecycle state; see [`docs/STATE_MACHINE.md`](docs/STATE_MACHINE.md).
- `current_step`: current `fab-*` skill.
- `current_app_stage`: active app stage.
- `next_action`: exact command to run next.
- `last_error`: structured error or `null`.
- `app_stages`: stage status, artifacts, notes, and quality score.
- `costs`: measured, estimated, or `unknown`.
- `verifications`: test and launch results.
- `human_decisions`: decisions recorded by `/fab-signal`.

The schema is in `schemas/run-object.schema.json`. Post-schema semantic checks live in `scripts/validate-run.mjs`. Skills validate state before writing.

## Repository Layout

```text
fabrica-skills/
  CLAUDE.md              Agent rules
  CONTEXT.md             Domain vocabulary + ADRs
  CONTRIBUTING.md        Contributor workflow
  AGENTS.md              Agent discovery config
  docs/STATE_MACHINE.md  Visual state machine + common command pathways
  skills/manifest.json   Canonical inventory
  skills/core/*/         Core MVP skills (+ errors.json each)
  skills/prototype/*/    Full-pipeline skills (+ errors.json each)
  docs/examples/         Checked-in sample spec and blueprint
  scripts/               link-skills, sync-manifest, validate-run
  schemas/               run-object.schema.json
  test/fixtures/         valid + invalid run objects for CI
```

## Example Docs

Checked-in examples live under:

```text
docs/examples/spec.md
docs/examples/blueprint.md
```

The live run paths are:

```text
docs/spec.md
docs/blueprint.md
```

Those live paths are generated by `/fab-intake` and `/fab-blueprint` and are ignored by git.

`docs/VALIDATION.md` records the current validation evidence: schema checks, script hardening checks, manifest/frontmatter drift checks, install safety checks, and container/full-stack guidance coverage.

## Troubleshooting

| Problem | Fix |
|---|---|
| `node` is not found | Install Node.js 16.7+ and rerun `npm run setup`. |
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



