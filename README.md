# fabrica-skills [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/sushilduseja/fabrica-skills)

Agent-readable markdown skills for turning a rough product idea into a small local app prototype.

This is a skills-only repository. It is not a runtime, SaaS, queue, deploy tool, or agent orchestrator. You install the skill documents, then your AI coding agent follows them while you approve the checkpoint steps.

## What this is

- Markdown skills your coding agent follows
- A CLI to install those skills into agent skill directories
- A JSON Schema + validator for optional `fabrica.run.json` run state

## What this is not

- An autonomous orchestrator that runs skills without an agent
- A hosted build service
- A guarantee that `npx @latest` works before the package is published to npm

## What You Get

- 14 skills, each stored as a self-contained `SKILL.md` (13 `fab-*` pipeline skills plus standalone `fabrica-code-review`).
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

## Install

**From npm (after publish):**

```bash
npx fabrica-skills@latest install
```

**From Git (always works):**

```bash
npm install -D github:sushilduseja/fabrica-skills
npx fabrica-skills install
```

**Global:**

```bash
npx fabrica-skills@latest install --global
# or, from a local checkout:
node bin/fabrica-skills.mjs install --global
```

Global roots resolve through `os.homedir()` (`C:\Users\<name>` on Windows, `/home/<name>` on Linux, `/Users/<name>` on macOS).

Upgrade:

```bash
npx fabrica-skills@latest update
```

Uninstall:

```bash
npx fabrica-skills uninstall
```

### Renamed in 0.3.0

| Old id | New id |
|---|---|
| `fab-intake` | `fab-spec` |
| `fab-blueprint` | `fab-plan` |
| `fab-frame` | `fab-scaffold` |
| `fab-forge` | `fab-build` |
| `fab-check` | `fab-eval` |
| `fab-pulse` | `fab-status` |
| `fab-passport` | `fab-handoff` |
| `fab-trace` | `fab-fix` |
| `fab-weave` | `fab-integrate` |
| `fab-launch` | `fab-verify` |
| `fab-signal` | `fab-decide` |
| `fab-retro` | `fab-retro` (unchanged) |

Old ids still validate with a deprecation warning in 0.3.x. Migrate saved run objects with `npx fabrica-skills validate --migrate-run fabrica.run.json`.

## First run

Start with a valid run object (or let `/fab-spec` create one):

```bash
npx fabrica-skills init-run --name my-app
```

In your app repo (after install), ask your coding agent:

```text
/fab-spec
Idea: Build a local CLI that accepts pasted invoice text and returns normalized JSON.
```

Then follow `next_action` in `fabrica.run.json`.

## Skill walkthrough

### 1. Open your project in your AI coding agent

Make sure the agent can see the installed skills.

If your agent supports slash commands, use the `/fab-*` names below. If it does not, ask it to follow the matching skill file directly, for example:

```text
Follow .agents/skills/fab-spec/SKILL.md.
Idea: Build a local CLI that accepts pasted invoice text and returns normalized JSON.
```

### 2. Run intake

Send this to the agent:

```text
/fab-spec
Idea: Build a local CLI that accepts pasted invoice text and returns normalized JSON.
```

The agent should ask targeted questions, then show a spec for approval.

Approve only when the spec is specific enough for a stranger to build. The skill writes:

- `docs/spec.md`
- `fabrica.run.json`
- `next_action: "/fab-plan"`

### 3. Create the blueprint

Send:

```text
/fab-plan
```

The agent should propose architecture, stack, app stages, and build order.

Approve only when the plan is small and testable. The skill writes:

- `docs/blueprint.md`
- app stages in `fabrica.run.json`
- `next_action: "/fab-scaffold"`

### 4. Scaffold the app

Send:

```text
/fab-scaffold
```

The skill scaffolds inside the current project root. In a source checkout of `fabrica-skills` itself it keeps the contributor behavior and creates a sibling app directory:

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

In a source checkout, `/fab-scaffold` copies `fabrica.run.json`, `docs/spec.md`, and `docs/blueprint.md` into the generated app directory. After `/fab-scaffold`, the app-directory copy is canonical. The source-repo copies are runtime outputs only and are ignored by git.

### 5. Build one stage

Use the exact stage name from `fabrica.run.json` or `docs/blueprint.md`.

```text
/fab-build <stage-name>
```

The skill implements only that stage, adds focused tests, runs the narrowest useful test command, and updates `fabrica.run.json`.

### 6. Check quality

```text
/fab-eval <stage-name>
```

The skill writes:

```text
docs/eval/<stage-name>.md
```

It scores the stage from 0 to 10 on spec fit, contract fit, tests, clarity, and safety. Any axis below 6 blocks the stage and sets the next action to `/fab-fix <stage-name>`.

### 7. Continue from the run state

Use `next_action` in `fabrica.run.json` as the source of truth. For the full visual state machine and common command pathways, see [`docs/STATE_MACHINE.md`](docs/STATE_MACHINE.md).

Useful commands:

```text
/fab-status
/fab-handoff
```

- `/fab-status` shows pipeline, quality, cost, and next action. Pass `--mode=details` for per-step cost breakdown.
- `/fab-handoff` writes a resumable handoff at `docs/handoff.md`.

## Workflow

Visual state machine and pathway reference: [`docs/STATE_MACHINE.md`](docs/STATE_MACHINE.md).

```text
Phase 0: Spec and blueprint
  /fab-spec -> /fab-plan
  Output: docs/spec.md, docs/blueprint.md, fabrica.run.json

Phase 1: One or more vertical slices
  /fab-scaffold -> /fab-build <stage> -> /fab-eval <stage>
  Repeat forge/check until required stages are done.
  Output: scaffolded app, tests, quality scores, next_action

Phase 2: Integrated local prototype
  /fab-integrate -> /fab-verify -> /fab-handoff -> /fab-retro
  Recovery and decision commands as needed: /fab-fix <stage|integration>, /fab-decide, /fab-status
  Output: local end-to-end verification, launch evidence, decisions, handoff, retrospective
```

## Skill Inventory

| Skill | Phase | Default gate | Job |
|---|---:|---|---|
| `/fab-spec` | 0 | checkpoint | Convert a rough idea into a spec and initialize the run object. |
| `/fab-plan` | 0 | checkpoint | Convert a spec into app architecture and a build order. |
| `/fab-scaffold` | 1 | auto | Scaffold the app project skeleton and first-stage contracts. |
| `/fab-build` | 1 | auto | Implement one named app stage against the blueprint. |
| `/fab-eval` | 1 | auto | Evaluate one app stage against quality criteria. |
| `/fab-status` | 1 | auto | Render the current run state as a terminal dashboard. |
| `/fab-handoff` | 1 | auto | Write a resumable handoff document. |
| `/fab-fix` | 2 | auto | Diagnose a failing stage and apply the smallest viable fix. |
| `/fab-integrate` | 2 | checkpoint | Connect completed stages into an end-to-end flow. |
| `/fab-verify` | 2 | review | Run a pre-launch checklist and verify the app locally. |
| `/fab-decide` | 2 | full | Capture a human decision. |
| `/fab-pr-review` | 2 | auto | Review a GitHub pull request with an evidence-backed verdict. |
| `/fab-retro` | 2 | auto | Score the run and identify process improvements. |
| `/fab-code-review` | 2 | auto | Review changes since a fixed git point on Standards and Spec axes. |

Plain-language aliases:

| Skill | Means |
|---|---|
| `/fab-spec` | collect requirements and write the spec |
| `/fab-plan` | design the architecture and build stages |
| `/fab-scaffold` | scaffold the project skeleton |
| `/fab-build` | implement one stage |
| `/fab-eval` | evaluate one stage |
| `/fab-status` | show status |
| `/fab-handoff` | write handoff notes |
| `/fab-fix` | debug a failure |
| `/fab-integrate` | integrate stages |
| `/fab-verify` | verify local launch |
| `/fab-decide` | record a human decision |
| `/fab-pr-review` | review a pull request |
| `/fab-retro` | write the retrospective |
| `/fab-code-review` | review a diff since a fixed point |

The review skill is installed as `fabrica-code-review` and invoked as `/fab-code-review`.

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
- `human_decisions`: decisions recorded by `/fab-decide`.

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

Those live paths are generated by `/fab-spec` and `/fab-plan` and are ignored by git.

`docs/VALIDATION.md` records the current validation evidence: schema checks, script hardening checks, manifest/frontmatter drift checks, install safety checks, and container/full-stack guidance coverage.

## Troubleshooting

| Problem | Fix |
|---|---|
| `node` is not found | Install Node.js 16.7+ and rerun `npm run setup`. |
| Slash command is not found | Point your agent at `.skills/<skill-name>/SKILL.md` or use the `.claude-plugin/plugin.json` manifest if supported. |
| `fabrica.run.json` is missing | Start with `/fab-spec`. It is the only entry-point skill. |
| A stage is blocked | Run `/fab-fix <stage-name>` with the failure output. |
| Cost shows `unknown` | This is expected when token or API spend has not been measured. |
| External deploy is requested | Stop unless you explicitly want it. MVP launch verification is local-first. |

## Non-Goals

- No app code lives in this repository.
- No hosted service or control plane.
- No hidden automatic skill chaining.
- No multi-agent scheduler.
- No production deploy provider matrix.
- No exact token metering unless the agent/provider exposes it cleanly.



