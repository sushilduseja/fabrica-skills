# fabrica-skills — Product Requirements Document

**Version:** 0.2  
**Status:** Draft MVP / Experiment Spec  
**Type:** Skills-only repository  
**Operator:** Solo technical founder / indie hacker  
**Distribution:** Open source, self-hosted  

---

## 1. Product Identity

fabrica-skills is a set of agent-readable markdown skills for testing one premise:

> Can a solo operator guide an AI agent from a raw product idea to a small working app through explicit, inspectable, reusable skill documents?

This repository is not a runtime, SaaS, queue system, orchestration framework, or hosted product. The product surface is the skill set itself: clear instructions, stable handoff state, quality gates, and a repeatable operating loop.

The first version should feel like a small workshop, not a full factory. It must prove the flow before expanding the machinery.

---

## 2. Experiment Shape

The MVP is layered. Each phase should be useful on its own and should create evidence before the next phase is built.

| Phase | Goal | Skills used | Success signal |
|---|---|---|---|
| Phase 0 — Spec-only demo | Convert one raw app idea into a useful spec and architecture | `fab-intake`, `fab-blueprint` | A cold reader can implement the proposed app from the generated docs |
| Phase 1 — Tiny vertical slice | Scaffold one app and build one named app stage | `fab-intake`, `fab-blueprint`, `fab-frame`, `fab-forge`, `fab-check`, `fab-pulse` | One stage has code, tests, quality score, and status output |
| Phase 2 — Thin full-pipeline prototype | Provide all 13 skills as runnable docs without pretending production maturity | all skills | Operator can complete a toy app run with local verification and handoff |

The canonical experiment app is: **a local AI invoice note parser**. It accepts pasted invoice text and returns normalized JSON. It is intentionally small, has clear input/output, and can be tested without payments, auth, background jobs, or production data.

---

## 3. Factory Model

A run is a single attempt to turn one idea into one small app. The agent follows skills. The operator makes decisions. The run object stores durable state.

Terms:

| Term | Meaning |
|---|---|
| Skill | One reusable instruction document in this repo |
| Pipeline step | One skill invocation in the fabrica workflow |
| App stage | One buildable slice of the target app, defined by `fab-blueprint` |
| Run object | `fabrica.run.json`, the durable state file for one run |

Each skill reads `fabrica.run.json` when it exists. `fab-intake` is the only skill allowed to create it if missing. Skills update only the fields they own.

The factory exposes three observable layers:

| Layer | What it shows | MVP precision |
|---|---|---|
| Pipeline | Current step, app stages, next action | Required |
| Quality | Scores, blockers, missing tests | Required |
| Cost | Estimated token/API spend | Best effort; `unknown` is valid |

All three appear in `fab-pulse`. Missing cost data must render as `unknown`, not fail the dashboard.

---

## 4. Skill Inventory

Skill names use the `fab-` prefix to avoid collision with generic skill names in other repositories. The slash form is the invocation convention; the frontmatter name excludes the slash.

### Core MVP Skills

| # | Skill | Job |
|---|---|---|
| 1 | `/fab-intake` | Convert a rough idea into a bounded product spec and initialize the run |
| 2 | `/fab-blueprint` | Convert the spec into app architecture, app stages, and build order |
| 3 | `/fab-frame` | Create the project skeleton and contracts needed for the first stage |
| 4 | `/fab-forge` | Implement one named app stage against the blueprint |
| 5 | `/fab-check` | Score one app stage against spec, tests, clarity, and safety |
| 6 | `/fab-pulse` | Render current pipeline, quality, cost estimate, and next action |
| 7 | `/fab-passport` | Write a resumable handoff with state, artifacts, and next command |

### Thin Prototype Skills

| # | Skill | Job |
|---|---|---|
| 8 | `/fab-trace` | Diagnose a failing stage, state root cause, and apply a minimal fix |
| 9 | `/fab-weave` | Connect completed app stages into one local end-to-end flow |
| 10 | `/fab-launch` | Verify the integrated app locally; real external deploy is deferred |
| 11 | `/fab-ledger` | Summarize estimated token/API cost and cost concentration |
| 12 | `/fab-signal` | Capture a human decision and record why it was made |
| 13 | `/fab-retro` | Review the run and identify process improvements |

### Deferred Beyond MVP

- Multi-agent scheduling, queues, worker pools, or remote orchestration.
- Precise token metering across every agent provider.
- Multiple production deploy providers.
- Full SaaS auth, billing, telemetry, or hosted dashboards.
- Automatic skill-to-skill invocation. The operator or active agent still sequences the run.

---

## 5. Run Object — State Contract

`fabrica.run.json` lives in the generated app project root. During Phase 0, if no app project exists yet, it may live beside the generated docs until `fab-frame` creates the project.

`fab-intake` creates the file if missing. All other skills must stop with a clear error if the run object is absent.

```yaml
schema_version: "0.2"
id: string # uuid
name: string # e.g. "invoice-note-parser"
experiment_phase: enum [phase_0_spec, phase_1_slice, phase_2_pipeline]
created_at: ISO8601
updated_at: ISO8601
status: enum [
  init,
  specifying,
  designing,
  framing,
  forging,
  checking,
  weaving,
  verifying,
  complete,
  blocked,
  abandoned
]
current_step: string | null # skill name, e.g. "fab-forge"
current_app_stage: string | null # app stage name, e.g. "parse-invoice-text"
next_action: string | null # exact next command or decision
last_error: string | null

spec_path: string | null # docs/spec.md
blueprint_path: string | null # docs/blueprint.md

app_stages:
  - name: string
    purpose: string
    status: enum [pending, active, done, blocked, failed]
    quality_score: number | null # 0-10, not 0-1
    artifacts: string[]
    notes: string | null

costs:
  precision: enum [unknown, estimated, measured]
  tokens_in: int | "unknown"
  tokens_out: int | "unknown"
  api_calls: int | "unknown"
  estimated_usd: number | "unknown"
  budget_usd: number | null
  by_step: map<string, {
    precision: enum [unknown, estimated, measured]
    tokens_in: int | "unknown"
    tokens_out: int | "unknown"
    usd: number | "unknown"
  }>

verifications:
  - kind: enum [unit, integration, local_launch, external_deploy]
    command: string
    passed: bool
    summary: string
    timestamp: ISO8601

human_decisions:
  - step: string
    decision_needed: string
    options: string[]
    decision: string | null
    rationale: string | null
    triggered_at: ISO8601
    resolved_at: ISO8601 | null

gate_levels:
  fab-intake: checkpoint
  fab-blueprint: checkpoint
  fab-frame: auto
  fab-forge: auto
  fab-check: auto
  fab-pulse: auto
  fab-passport: auto
  fab-trace: auto
  fab-weave: checkpoint
  fab-launch: review
  fab-ledger: auto
  fab-signal: full
  fab-retro: auto
```

---

## 6. Skill Specifications

Each skill defines trigger, input, output, behavior, gate, and run object updates.

### `/fab-intake`

**Trigger:** Start of a new run, or a raw idea without a spec.

**Input:** Freeform idea or partial brief from the operator.

**Output:** `docs/spec.md` and initialized or updated `fabrica.run.json`.

**Behavior:**
1. Ask 5 to 7 targeted questions covering user, problem, core job, input, output, AI role, success metric, and non-goals.
2. Refuse vague user or core job answers; push until the app can be tested by a stranger.
3. Write `docs/spec.md` with: Overview, Users, Jobs, Inputs, Outputs, AI Role, Success Criteria, Non-Goals.
4. Create `fabrica.run.json` if missing.
5. Set `experiment_phase = phase_0_spec`, `status = designing`, `spec_path = "docs/spec.md"`, and `next_action = "/fab-blueprint"`.

**Default gate:** `checkpoint` — show the spec before writing.

---

### `/fab-blueprint`

**Trigger:** Confirmed spec exists.

**Input:** `docs/spec.md`, `fabrica.run.json`.

**Output:** `docs/blueprint.md`.

**Behavior:**
1. Derive minimal app components from first principles: input boundary, transformation core, output boundary, persistence only if necessary.
2. Pick one stack for the toy app, preferring boring local defaults unless the spec proves another choice is needed.
3. Define model requirements by capability, context, latency, and cost class; name example providers only as replaceable defaults.
4. Define app stages in build order. Each stage must have purpose, inputs, outputs, files expected, and test shape.
5. Write `docs/blueprint.md` with a small ASCII data-flow diagram.
6. Update `blueprint_path`, `app_stages`, `status = framing`, `next_action = "/fab-frame"`.

**Default gate:** `checkpoint` — show architecture summary before writing.

---

### `/fab-frame`

**Trigger:** Blueprint confirmed.

**Input:** `docs/blueprint.md`, `fabrica.run.json`.

**Output:** Project skeleton and first-stage contracts.

**Behavior:**
1. Create only the folders needed for the first app stage plus shared contracts.
2. Write stub files with correct signatures and no implementation logic.
3. Add a dependency manifest for the selected stack.
4. Write `.env.example` only for required environment variables.
5. Add cross-platform commands in `package.json`, `Makefile`, `justfile`, or equivalent; do not require POSIX shell only.
6. Update `status = forging`, stage statuses, and `next_action = "/fab-forge <first-app-stage>"`.

**Default gate:** `auto`.

---

### `/fab-forge`

**Trigger:** One named app stage is ready to implement.

**Input:** App stage name, `docs/blueprint.md`, relevant stubs and shared contracts.

**Output:** Working implementation and focused tests for that app stage.

**Behavior:**
1. Implement only the named app stage plus shared contracts required by that stage.
2. Keep behavior aligned with the spec and blueprint; do not add speculative features.
3. Write tests covering happy path, one realistic failure, and one edge case.
4. Run the narrowest available test command.
5. Update the app stage status, artifacts, verification result, and `next_action = "/fab-check <app-stage>"`.

**Default gate:** `auto`.

---

### `/fab-check`

**Trigger:** One app stage has implementation and tests.

**Input:** App stage name, implementation files, tests, `docs/spec.md`, `docs/blueprint.md`.

**Output:** `docs/eval/<app-stage>.md`.

**Behavior:**
1. Score 0 to 10 on: spec fit, contract fit, tests, code clarity, safety.
2. Weight spec fit and contract fit double.
3. Mark the app stage blocked if any axis is below 6.
4. List blocking fixes separately from optional improvements.
5. Update `quality_score` using the same 0-10 scale shown in dashboards.
6. Set `next_action` to either `/fab-trace <app-stage>` or the next build/integration command.

**Default gate:** `auto`.

---

### `/fab-trace`

**Trigger:** A stage is blocked, failing, or has a supplied error.

**Input:** App stage name, failing output, relevant files.

**Output:** Root cause, minimal fix, and test result.

**Behavior:**
1. State root cause in one sentence before proposing changes.
2. Apply the smallest fix that addresses the root cause.
3. Add or update a regression test if the failure can be reproduced locally.
4. Run the narrowest relevant test command.
5. Update `last_error`, app stage status, verification result, and `next_action`.

**Default gate:** `auto`.

---

### `/fab-weave`

**Trigger:** Required app stages are done and checked.

**Input:** App artifacts, `docs/blueprint.md`, `fabrica.run.json`.

**Output:** Local end-to-end flow and `docs/integration.md`.

**Behavior:**
1. Wire only the app stages needed for the canonical happy path.
2. Add one integration test from raw input to expected output.
3. Run the integration test and record result.
4. If integration fails, use `fab-trace` behavior inline.
5. Update `status = verifying`, `next_action = "/fab-launch"`.

**Default gate:** `checkpoint` — show wiring plan before mutation.

---

### `/fab-launch`

**Trigger:** Integrated app is ready for MVP verification.

**Input:** `docs/blueprint.md`, run object, local launch command.

**Output:** Local verification result. External deploy is out of MVP unless explicitly opted in later.

**Behavior:**
1. Run a pre-launch checklist: tests pass, env vars documented, no committed secrets, integration verified.
2. Show checklist and require explicit approval before running any external, destructive, or network deploy action.
3. For MVP, prefer local Docker or local dev server verification.
4. Check expected response or UI behavior.
5. Record verification with `kind = local_launch` and set `status = complete` only if verified.

**Default gate:** `review` — local checks may run, but external launch requires approval.

---

### `/fab-pulse`

**Trigger:** Operator wants current run state.

**Input:** `fabrica.run.json`.

**Output:** Inline terminal-style dashboard. No files written.

**Behavior:**
1. Render pipeline, quality, and cost panels.
2. Show `unknown` for missing cost values.
3. Show the exact `next_action` from the run object.
4. Do not modify files.

**Default gate:** `auto`.

**Reference layout:**

```text
fabrica — run: invoice-note-parser — phase_1_slice

PIPELINE                    QUALITY            COST
fab-intake        done      spec fit   9.0     estimated usd  unknown
fab-blueprint     done      contract   8.5     tokens in      unknown
fab-frame         done      tests      —       tokens out     unknown
fab-forge:parse   active    parse      —       precision      unknown
fab-check:parse   pending   blocked    0

next: /fab-forge parse-invoice-text
```

---

### `/fab-ledger`

**Trigger:** Operator wants cost review.

**Input:** `fabrica.run.json`.

**Output:** Inline cost report. No files written.

**Behavior:**
1. Show cost precision: `unknown`, `estimated`, or `measured`.
2. Show totals and per-step breakdown when available.
3. Flag any step above 20% of known spend.
4. If precision is `unknown`, state what data is missing instead of inventing numbers.
5. Provide one concrete cost-reduction suggestion only when total cost is known or estimated.

**Default gate:** `auto`.

---

### `/fab-signal`

**Trigger:** A human decision is needed.

**Input:** Decision context and options.

**Output:** Decision recorded in `human_decisions`.

**Behavior:**
1. State the decision needed in one sentence.
2. Present two or three meaningful options.
3. Wait for operator input.
4. Record decision, rationale, timestamp, and resumed next action.

**Default gate:** `full`.

---

### `/fab-passport`

**Trigger:** End of session or transfer to another agent/session.

**Input:** `fabrica.run.json`, recent context, artifacts.

**Output:** `docs/handoff.md`.

**Behavior:**
1. State current run status in one line.
2. List completed steps, app stages, artifacts, verifications, decisions, and blockers.
3. Include the exact next command.
4. Include any important context not captured in the run object.
5. Overwrite `docs/handoff.md`; do not append.

**Default gate:** `auto`.

---

### `/fab-retro`

**Trigger:** Run is complete, abandoned, or intentionally stopped.

**Input:** `fabrica.run.json`, eval reports, handoff if present.

**Output:** `docs/retro.md`.

**Behavior:**
1. Score the run 0 to 10 with one-sentence rationale.
2. Compare built output against original spec.
3. List blockers, root causes, and fixes.
4. Identify the highest known or estimated cost area.
5. Write three concrete process changes for the next run.
6. Estimate how long the same toy run would take manually.

**Default gate:** `auto`.

---

## 7. Human Involvement Model

| Skill | Default Gate | Overridable |
|---|---|---|
| `/fab-intake` | `checkpoint` | yes |
| `/fab-blueprint` | `checkpoint` | yes |
| `/fab-frame` | `auto` | yes |
| `/fab-forge` | `auto` | yes |
| `/fab-check` | `auto` | yes |
| `/fab-pulse` | `auto` | no |
| `/fab-passport` | `auto` | yes |
| `/fab-trace` | `auto` | yes |
| `/fab-weave` | `checkpoint` | yes |
| `/fab-launch` | `review` | no for external deploy approval |
| `/fab-ledger` | `auto` | no |
| `/fab-signal` | `full` | no |
| `/fab-retro` | `auto` | yes |

Gate level definitions:

| Level | Behavior |
|---|---|
| `auto` | No pause |
| `checkpoint` | Approval before file mutation or irreversible decision |
| `review` | Local checks may run; external, destructive, or network deploy actions require approval first |
| `full` | Approval before starting and confirmation after completion |

---

## 8. Repo Structure

```text
fabrica-skills/
  README.md
  CLAUDE.md
  CONTEXT.md
  .claude-plugin/
    plugin.json
  skills/
    core/
      fab-intake/SKILL.md
      fab-blueprint/SKILL.md
      fab-frame/SKILL.md
      fab-forge/SKILL.md
      fab-check/SKILL.md
      fab-pulse/SKILL.md
      fab-passport/SKILL.md
    prototype/
      fab-trace/SKILL.md
      fab-weave/SKILL.md
      fab-launch/SKILL.md
      fab-ledger/SKILL.md
      fab-signal/SKILL.md
      fab-retro/SKILL.md
  scripts/
    link-skills.mjs
```

**File roles:**

| File | Purpose |
|---|---|
| `README.md` | Public description, install command, skill table, and phase diagram |
| `CLAUDE.md` | Agent-facing rules: skill discovery, run object, gate model, naming convention |
| `CONTEXT.md` | Domain vocabulary and first-principles factory model |
| `.claude-plugin/plugin.json` | Plugin manifest for agents that support plugin discovery |
| `skills/core/*/SKILL.md` | Core MVP skill docs |
| `skills/prototype/*/SKILL.md` | Thin full-pipeline skill docs |
| `scripts/link-skills.mjs` | Cross-platform script that creates or refreshes a flat `.skills/` directory |

---

## 9. SKILL.md Format

Every `SKILL.md` uses this structure.

```yaml
---
name: fab-intake
description: One sentence written for agent skill discovery.
category: core | prototype
phase: 0 | 1 | 2
---
```

```markdown
## Job

One sentence describing the skill's responsibility.

## Trigger

When to invoke this skill.

## Input

- Required inputs
- Optional inputs

## Output

- Files, state changes, or inline result produced

## Behavior

1. Concrete action
2. Concrete action
3. Concrete action

## Gate

**Default:** auto | checkpoint | review | full
**Overridable:** yes | no
What the operator sees before the gate opens.

## Run Object Updates

- Exact fields this skill may write
```

Rules:

- Frontmatter `name` must be the unique `fab-*` name without a slash.
- User-facing invocation may use `/fab-*`.
- No `SKILL.md` should exceed 400 lines.
- Long rubrics or provider-specific notes belong in sibling `REFERENCE.md`.

---

## 10. Install and Discovery

**Install:**

```bash
npx skills@latest add your-username/fabrica-skills
```

**Agent discovery:** Agents load skills through `CLAUDE.md`, plugin metadata, or manual linking. Skill descriptions must be specific enough for an agent to choose the right `fab-*` skill without reading every file.

**Plugin manifest:** `.claude-plugin/plugin.json` registers all 13 `fab-*` skills.

**Manual link:** `scripts/link-skills.mjs` creates a flat `.skills/` directory for agents that require one. It must run on Windows, macOS, and Linux.

---

## 11. Non-Goals

- No application code in this repository.
- No proprietary runtime or hosted control plane.
- No multi-agent orchestration in MVP.
- No exact token metering unless provider/tooling exposes it cleanly.
- No production deploy provider matrix in MVP.
- No automatic skill chaining hidden from the operator.
- No generated UI beyond terminal-style status output.

---

## 12. Success Criteria

| # | Criterion |
|---|---|
| 1 | Phase 0 turns the invoice parser idea into useful `docs/spec.md` and `docs/blueprint.md` in under 15 minutes of operator time. |
| 2 | Phase 1 builds and checks one app stage with tests and a 0-10 quality score. |
| 3 | `fab-pulse` renders pipeline, quality, cost, and next action even when cost is `unknown`. |
| 4 | A new session can resume from `fabrica.run.json` and `docs/handoff.md` without asking what happened before. |
| 5 | `fab-launch` cannot perform external deploy or destructive action without explicit approval. |
| 6 | All skill names are unique `fab-*` names and do not reuse generic names from other skill repos. |
| 7 | The repository can be read cold by an engineer in under 20 minutes. |

---

## 13. Validation Plan

Before implementation is considered ready:

1. PRD contradiction review: run object creation, score scale, gate semantics, and naming convention must be internally consistent.
2. Sample run: execute Phase 0 and Phase 1 against the invoice parser idea.
3. Status test: confirm `fab-pulse` handles missing costs as `unknown`.
4. Handoff test: start a fresh session using only `fabrica.run.json` and `docs/handoff.md`.
5. Launch safety test: verify `fab-launch` asks before any external network deploy.
