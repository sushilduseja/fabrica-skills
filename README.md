# fabrica-skills [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/sushilduseja/fabrica-skills)

Agent-readable markdown skills for turning a rough product idea into a small local app prototype.

This is a skills-only repository. It is not a runtime, SaaS, queue, deploy tool, or agent orchestrator. You install the skills. Your AI coding agent follows the skills. You approve each gate.

## What this is

- Markdown skills your coding agent follows
- A CLI to install those skills into agent skill directories
- A JSON Schema + validator for optional `fabrica.run.json` run state

## What this is not

- An autonomous orchestrator that runs skills without an agent
- A hosted build service

## What You Get

- 14 skills. Each skill is one self-contained `SKILL.md` file. The count covers 13 `fab-*` pipeline skills plus standalone `fabrica-code-review`.
- A canonical skill manifest lives at `skills/manifest.json`. It is the single source of truth for skill inventory, dependencies, gate defaults, and plugin discovery.
- The workflow is spec-first. It runs from idea to product spec to blueprint to scaffold to implementation to quality check to integration to launch.
- Scaffolding guidance is stack-agnostic. Skills derive runtimes, services, commands, files, and verification steps from the blueprint. Skills never hardcode Python, Node, React, FastAPI, Docker, or any sample app.
- The durable run state file is `fabrica.run.json`.
- A JSON Schema validates run state. It lives at `schemas/run-object.schema.json`.
- Prototype behavior is local-first. External deploy stays deferred. It needs your explicit approval.
- Docker and container verification are supported when the blueprint calls for them. Never report static Docker checks as runtime Docker verification.

## Requirements

- Git.
- Node.js 16.7+.
- An AI coding agent that reads local markdown skill files.

## Quickstart

1. Install the package.

   ```bash
   npm install -D fabrica-skills
   ```

2. Install the skills into your project.

   ```bash
   npx fabrica-skills install
   ```

3. Confirm the install.

   ```bash
   npx fabrica-skills status
   ```

   The command lists 14 installed skills.

## Other install methods

Install without a local dependency. Run this command:

```bash
npx fabrica-skills@latest install
```

Install for every repo on the machine (global install). Run this command:

```bash
npx fabrica-skills@latest install --global
```

Install from a local checkout. Run this command from the repo root:

```bash
node bin/fabrica-skills.mjs install --global
```

Global roots resolve through `os.homedir()` (`C:\Users\<name>` on Windows, `/home/<name>` on Linux, `/Users/<name>` on macOS).

Upgrade the skills. Run this command:

```bash
npx fabrica-skills@latest update
```

Remove the skills. Run this command:

```bash
npx fabrica-skills uninstall
```

See CHANGELOG.md for release history.

## First run

Create a valid run object. Run this command:

```bash
npx fabrica-skills init-run --name my-app
```

Then ask your coding agent to run intake:

```text
/fab-spec
Idea: Build a local CLI that accepts pasted invoice text and returns normalized JSON.
```

Then follow `next_action` in `fabrica.run.json`.

## Skill walkthrough

### 1. Open your project in your AI coding agent

Confirm the agent sees the installed skills.

### 2. Run intake

Send this to the agent:

```text
/fab-spec
Idea: Build a local CLI that accepts pasted invoice text and returns normalized JSON.
```

The agent asks targeted questions. Then the agent shows a spec for approval.

Approve only when the spec is specific enough for a stranger to build. The skill writes:

- `docs/spec.md`
- `fabrica.run.json`
- `next_action: "/fab-plan"`

### 3. Create the blueprint

Send:

```text
/fab-plan
```

The agent proposes architecture, stack, app stages, and build order.

Approve only when the plan is small and testable. The skill writes:

- `docs/blueprint.md`
- app stages in `fabrica.run.json`
- `next_action: "/fab-scaffold"`

### 4. Scaffold the app

Send:

```text
/fab-scaffold
```

The skill scaffolds inside the current project root. In a source checkout of `fabrica-skills` itself, the skill keeps the contributor behavior. It creates a sibling app directory:

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

The skill implements only that stage. It adds focused tests. It runs the narrowest useful test command. It updates `fabrica.run.json`.

### 6. Check quality

```text
/fab-eval <stage-name>
```

The skill writes:

```text
docs/eval/<stage-name>.md
```

It scores the stage from 0 to 10 on spec fit, contract fit, tests, clarity, and safety. Any axis below 6 blocks the stage. It sets the next action to `/fab-fix <stage-name>`.

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
  Repeat build/eval until required stages are done.
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

The review skill installs as `fabrica-code-review`. Run it as `/fab-code-review`.

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
  bin/                   CLI entry point (fabrica-skills)
  docs/STATE_MACHINE.md  Visual state machine + common command pathways
  docs/examples/         Checked-in sample spec and blueprint
  examples/              Canonical run-object template
  skills/manifest.json   Canonical inventory
  skills/core/*/         Core MVP skills (+ errors.json each)
  skills/prototype/*/    Full-pipeline skills (+ errors.json each)
  skills/standalone/*/   Standalone skills (+ errors.json each)
  skills/shared/         Shared run-object schema notes
  scripts/               Validators, manifest sync, installer CLIs
  schemas/               run-object.schema.json
  test/fixtures/         valid + invalid run objects for CI
  .github/               CI workflows
  .claude-plugin/        Claude Code plugin manifest
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

Those live paths are generated by `/fab-spec` and `/fab-plan`. Git ignores those paths.

`docs/VALIDATION.md` records the validation evidence. It covers schema checks, script hardening checks, manifest and frontmatter drift checks, install safety checks, and container and full-stack guidance coverage.

## Troubleshooting

| Problem | Fix |
|---|---|
| `node` is not found | Install Node.js 16.7+. Then rerun `npm run setup`. |
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
