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
| Phase 2 — Thin full-pipeline prototype | Provide all skills as runnable docs without pretending production maturity | all skills | Operator can complete a toy app run with local verification and handoff |

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

The canonical inventory lives at `skills/manifest.json` — it is the single source of truth for skill ids, paths, categories, phases, prerequisites, gate defaults, and dependencies. The tables below are historical context.

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
| 11 | ~~`/fab-ledger`~~ | ~~Summarize estimated token/API cost and cost concentration~~ — folded into `/fab-pulse` (see `skills/manifest.json` for active skills) |
| 12 | `/fab-signal` | Capture a human decision and record why it was made |
| 13 | `/fab-retro` | Review the run and identify process improvements |

### Deferred Beyond MVP

- Multi-agent scheduling, queues, worker pools, or remote orchestration.
- Precise token metering across every agent provider.
- Multiple production deploy providers.
- Full SaaS auth, billing, telemetry, or hosted dashboards.
- Automatic skill-to-skill invocation. The operator or active agent still sequences the run.

---

## 4b. Skill Dependency Graph

Each skill declares its prerequisites. A skill must not run until all prerequisites are satisfied. `fab-trace` uses this graph to diagnose `prerequisite_missing` errors.

| Skill | Prerequisites | Blocks |
|-------|---------------|--------|
| `/fab-intake` | None (entry point) | All skills |
| `/fab-blueprint` | `fab-intake` complete, `docs/spec.md` exists | `fab-frame`, `fab-weave` |
| `/fab-frame` | `fab-blueprint` complete, `docs/blueprint.md` exists | `fab-forge` |
| `/fab-forge` | `fab-frame` complete, named app stage in blueprint | `fab-check` |
| `/fab-check` | `fab-forge` complete, implementation files exist | `fab-weave`, `fab-trace` (if blocked) |
| `/fab-trace` | Failing stage with error output | `fab-forge` (retry), `fab-check` (re-evaluate) |
| `/fab-weave` | All required app stages done and checked | `fab-launch` |
| `/fab-launch` | `fab-weave` complete, `docs/integration.md` exists | None (terminal) |
| `/fab-pulse` | `fabrica.run.json` exists | None (read-only) |
| ~~`/fab-ledger`~~ (folded into `/fab-pulse`) | `fabrica.run.json` exists | None (read-only) |
| `/fab-signal` | Decision context available | Depends on decision outcome |
| `/fab-passport` | `fabrica.run.json` exists | None (handoff) |
| `/fab-retro` | Run complete, abandoned, or stopped | None (terminal) |

**Parallel execution:** `fab-pulse` and `fab-signal` may run at any point after `fab-intake` creates the run object. They do not block or block other skills. Cost detail is available via `fab-pulse --mode=details`.

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
last_error: null | { type: string, message: string }

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
  # fab-ledger: auto  (folded into fab-pulse --mode=details)
  fab-signal: full
  fab-retro: auto
```

---

## 5b. Run Object Validation

Skills validate their writes to `fabrica.run.json` against a JSON Schema file at `schemas/run-object.schema.json`. The schema enforces:

- `status` must be one of the defined enum values
- `experiment_phase` must be one of the defined enum values
- `quality_score` must be 0-10 or null
- `costs.precision` must be one of `unknown`, `estimated`, `measured`
- All required fields must be present after `fab-intake` creates the file
- `app_stages[].status` must be one of `pending`, `active`, `done`, `blocked`, `failed`

**Enforcement:** Skills reference the schema in their spec. Before writing, the skill (or operator) validates the updated run object against the schema. If validation fails, the skill stops with a `validation_failed` error and does not write the corrupted state.

**Schema file:** `schemas/run-object.schema.json` — ships with the repo. Validation is executable via `node scripts/validate-run.mjs --stdin` (see CLAUDE.md for the candidate-write protocol).

---

## 5c. Error Taxonomy

All skills use a standardized error taxonomy. `last_error` in the run object stores both the error type and message: `{ "type": "error_type", "message": "human-readable detail" }`.

| Error Type | Meaning | Example |
|------------|---------|---------|
| `missing_input` | Required input not provided | "docs/spec.md not found" |
| `invalid_state` | Run object in unexpected state | "status=complete but fab-forge called" |
| `gate_blocked` | Operator did not approve gate | "fab-intake checkpoint not approved" |
| `validation_failed` | Run object write failed schema validation | "status 'draft' not in enum" |
| `prerequisite_missing` | Skill prerequisite not satisfied | "fab-forge called before fab-frame" |
| `external_failure` | External service or command failed | "test command exited with code 1" |

**fab-trace automation:** `fab-trace` uses the error type to prioritize diagnosis:
- `missing_input` → check file paths, suggest creating missing input
- `invalid_state` → check run object status, suggest corrective skill
- `gate_blocked` → show gate context, re-present approval
- `validation_failed` → show schema violation, suggest corrected value
- `prerequisite_missing` → check dependency graph, run missing prerequisite
- `external_failure` → re-run command, capture output, diagnose root cause

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
3. If the operator skips or refuses to answer a question, proceed with a partial spec: mark the unanswered section as `INCOMPLETE: <section name>` in the spec, and add a warning note at the top of `docs/spec.md` listing missing areas.
4. Write `docs/spec.md` with: Overview, Users, Jobs, Inputs, Outputs, AI Role, Success Criteria, Non-Goals. Incomplete sections are marked and warned.
5. Create `fabrica.run.json` if missing.
6. Set `experiment_phase = phase_0_spec`, `status = designing`, `spec_path = "docs/spec.md"`, and `next_action = "/fab-blueprint"`.

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

~~### `/fab-ledger` (folded into `/fab-pulse --mode=details`)~~

~~**Trigger:** Operator wants cost review.~~
~~**Input:** `fabrica.run.json`.~~
~~**Output:** Inline cost report. No files written.~~

~~**Behavior:**~~
~~1. Show cost precision: `unknown`, `estimated`, or `measured`.~~
~~2. Show totals and per-step breakdown when available.~~
~~3. Flag any step above 20% of known spend.~~
~~4. If precision is `unknown`, state what data is missing instead of inventing numbers.~~
~~5. Provide one concrete cost-reduction suggestion only when total cost is known or estimated.~~

~~**Default gate:** `auto`.~~

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
| ~~`/fab-ledger`~~ (folded into `/fab-pulse`) | `auto` | no |
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

## 7b. Secrets Management

Secrets (API keys, tokens, credentials) are never committed to the repository. The following rules apply:

**Storage:**
- Required environment variables are documented in `.env.example` (created by `fab-frame`)
- Actual values live in `.env` (gitignored) or the operator's secure credential store
- No secrets in `fabrica.run.json`, skill docs, or generated files

**Pre-launch checklist (`fab-launch`):**
- Verify `.env.example` exists and documents all required variables
- Verify `.env` is in `.gitignore`
- Scan committed files for common secret patterns (API keys, tokens, passwords)
- Fail the checklist if any secrets are found in committed files

**Env var validation:**
- `fab-launch` checks that all required env vars are set before local launch
- Missing vars produce a clear error: "Missing required env var: X. See .env.example"
- Skills that require env vars at runtime must fail fast with the same error format

**Secret rotation:**
- MVP does not require automated rotation
- Operators should rotate API keys manually on a regular cadence
- Documented in `docs/ops/secrets.md` if the project grows beyond MVP

---

## 8. Error & Rescue Map

Every skill defines how it handles failures. This map ensures no silent failures in the pipeline.

**Canonical source:** Per-skill `errors.json` files adjacent to each `SKILL.md`. The table below is historical context; the `errors.json` files are the source of truth for `fab-trace` diagnosis.

### Error & Rescue Registry

```
SKILL/CODEPATH          | WHAT CAN GO WRONG              | ERROR TYPE
------------------------|--------------------------------|------------------
fab-intake              | Operator gives vague answers   | missing_input
                        | Run object already exists      | invalid_state
fab-blueprint           | Spec missing or malformed      | missing_input
                        | Blueprint conflicts with spec  | invalid_state
fab-frame               | Blueprint not confirmed        | prerequisite_missing
                        | Project skeleton already exists| invalid_state
fab-forge               | App stage name invalid         | missing_input
                        | Stubs don't match blueprint    | invalid_state
                        | Tests fail after implementation| external_failure
fab-check               | App stage not implemented      | prerequisite_missing
                        | Quality score below threshold  | gate_blocked
fab-trace               | Error not reproducible         | external_failure
                        | Fix doesn't resolve root cause | external_failure
fab-weave               | Required stages not done       | prerequisite_missing
                        | Integration test fails         | external_failure
fab-launch              | Pre-launch checklist fails     | gate_blocked
                        | External deploy without approval| gate_blocked
fab-pulse               | Run object missing             | missing_input
                        | Run object corrupted           | invalid_state
~~fab-ledger~~ (folded into `fab-pulse`) | Cost data missing | missing_input
fab-signal              | Decision timeout               | gate_blocked
fab-passport            | Handoff context incomplete     | missing_input
fab-retro               | Run not complete/abandoned     | invalid_state
```

### Rescue Actions

```
ERROR TYPE + SCENARIO              | RESCUE ACTION                          | USER SEES
-----------------------------------|----------------------------------------|------------------
missing_input (vague answers)      | Re-ask with specific prompts           | "Need more detail on X"
invalid_state (duplicate run)      | Load existing run, show status         | "Run already exists: <name>"
missing_input (spec missing)       | Halt, suggest /fab-intake first        | "Run /fab-intake before /fab-blueprint"
invalid_state (spec conflict)      | Show conflict, suggest spec revision   | "Blueprint conflicts with spec: X vs Y"
prerequisite_missing (no blueprint)| Halt, suggest /fab-blueprint           | "Run /fab-blueprint before /fab-frame"
invalid_state (project exists)     | Warn, offer to overwrite or skip       | "Project exists: overwrite?"
missing_input (invalid stage)      | List valid stages from blueprint       | "Unknown stage. Valid: X, Y, Z"
invalid_state (stub mismatch)      | Regenerate stubs from blueprint        | "Stubs regenerated to match blueprint"
external_failure (tests fail)      | Set status=failed, suggest trace       | "Tests failed: run /fab-trace"
prerequisite_missing (no impl)     | Halt, suggest /fab-forge               | "Run /fab-forge before /fab-check"
gate_blocked (quality low)         | List blocking fixes, set blocked       | "Stage blocked: fix X, Y, Z"
external_failure (unreproducible)  | Log context, suggest manual diagnosis  | "Can't reproduce: check X, Y, Z manually"
external_failure (incomplete fix)  | Re-analyze root cause, suggest deeper  | "Fix incomplete: root cause may be X"
prerequisite_missing (stages)      | List missing stages                    | "Stages incomplete: X, Y needed"
external_failure (integration)     | Set status=failed, suggest trace       | "Integration failed: run /fab-trace"
gate_blocked (pre-launch)          | Show checklist failures                | "Pre-launch failed: X, Y, Z"
gate_blocked (unauthorized deploy) | Halt, require explicit approval        | "Deploy requires approval"
missing_input (no run object)      | Halt, suggest /fab-intake              | "No run object: run /fab-intake"
invalid_state (corrupted run)      | Show last valid state, suggest restore | "Run object corrupted: last valid state was X"
missing_input (no cost data)       | Show "unknown", state what's missing   | "Cost unknown: missing X"
gate_blocked (decision timeout)    | Keep decision pending, show next       | "Decision pending: choose A/B/C"
missing_input (incomplete handoff) | Include available context, note gaps   | "Handoff incomplete: missing X"
invalid_state (premature retro)    | Halt, show current status              | "Run not complete: status is X"
```

**Critical gap resolution:** Five error types previously had no rescue action. All are now covered:
- `SpecConflictError` → show conflict, suggest spec revision
- `StubMismatchError` → regenerate stubs from blueprint
- `UnreproducibleError` → log context, suggest manual diagnosis
- `IncompleteFixError` → re-analyze root cause, suggest deeper fix
- `CorruptedRunObjectError` → show last valid state, suggest restore from backup or re-run fab-intake

---

## 9. Repo Structure

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
      # fab-ledger/SKILL.md  (deleted — folded into fab-pulse)
      fab-signal/SKILL.md
      fab-retro/SKILL.md
  scripts/
    link-skills.mjs
  schemas/
    run-object.schema.json
```

**File roles:**

| File | Purpose |
|---|---|
| `README.md` | Public description, install command, skill table, and phase diagram |
| `CLAUDE.md` | Agent-facing rules: skill discovery, run object, gate model, naming convention |
| `CONTEXT.md` | Domain vocabulary, architectural decisions, and review metadata |
| `.claude-plugin/plugin.json` | Plugin manifest for agents that support plugin discovery |
| `skills/core/*/SKILL.md` | Core MVP skill docs |
| `skills/prototype/*/SKILL.md` | Thin full-pipeline skill docs |
| `scripts/link-skills.mjs` | Cross-platform script that creates or refreshes a flat `.skills/` directory |
| `schemas/run-object.schema.json` | JSON Schema for validating `fabrica.run.json` writes |

---

## 10. SKILL.md Format

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

## 11. Install and Discovery

**Install:**

```bash
npx skills@latest add your-username/fabrica-skills
```

**Agent discovery:** Agents load skills through `CLAUDE.md`, plugin metadata, or manual linking. Skill descriptions must be specific enough for an agent to choose the right `fab-*` skill without reading every file.

**Plugin manifest:** `.claude-plugin/plugin.json` registers all active `fab-*` skills (see `skills/manifest.json` for the current count).

**Manual link:** `scripts/link-skills.mjs` creates a flat `.skills/` directory for agents that require one. It must run on Windows, macOS, and Linux.

---

## 12. Non-Goals

- No application code in this repository.
- No proprietary runtime or hosted control plane.
- No multi-agent orchestration in MVP.
- No exact token metering unless provider/tooling exposes it cleanly.
- No production deploy provider matrix in MVP.
- No automatic skill chaining hidden from the operator.
- No generated UI beyond terminal-style status output.

---

## 13. Success Criteria

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

## 14. Validation Plan

Before implementation is considered ready:

1. **PRD contradiction review** — run object creation, score scale, gate semantics, and naming convention must be internally consistent.
   - **Pass:** No contradictions found in schema, enums, or skill specifications.
   - **Fail:** Any contradiction must be resolved before proceeding.

2. **Sample run: Phase 0** — execute `fab-intake` and `fab-blueprint` against the invoice parser idea.
   - **Pass:** `docs/spec.md` and `docs/blueprint.md` are generated, internally consistent, and a cold reader could implement the app from them.
   - **Fail:** Spec or blueprint is incomplete, contradictory, or ambiguous.

3. **Sample run: Phase 1** — execute `fab-frame`, `fab-forge`, and `fab-check` for one app stage.
   - **Pass:** One app stage has code, tests, quality score ≥ 6 on all axes, and status output.
   - **Fail:** Tests fail, quality score < 6 on any axis, or stage status is blocked/failed.

4. **Status test** — confirm `fab-pulse` handles missing costs as `unknown`.
   - **Pass:** `fab-pulse` renders all three panels (pipeline, quality, cost) with `unknown` displayed for missing cost values.
   - **Fail:** `fab-pulse` fails, crashes, or invents cost data when values are missing.

5. **Handoff test** — start a fresh session using only `fabrica.run.json` and `docs/handoff.md`.
   - **Pass:** New session resumes without asking what happened before; next action is clear.
   - **Fail:** New session requires operator to explain prior work or cannot determine next action.

6. **Launch safety test** — verify `fab-launch` asks before any external network deploy.
   - **Pass:** External deploy action is blocked until explicit operator approval is given.
   - **Fail:** External deploy proceeds without approval.

### Phase 0 Demo Script

To validate Success Criterion #1 (Phase 0 in under 15 minutes), run this demo:

1. Start a fresh session with no prior context.
2. Run `/fab-intake` with the invoice parser idea. Record start time.
3. Answer all intake questions. Note any skipped questions and partial spec warnings.
4. Confirm the spec. Run `/fab-blueprint`.
5. Confirm the blueprint. Record end time.
6. Verify: `docs/spec.md` exists, `docs/blueprint.md` exists, `fabrica.run.json` has correct state.
7. **Pass if:** Total time < 15 minutes, both docs are useful, run object state is correct.
8. **Fail if:** Time ≥ 15 minutes, docs are incomplete or contradictory, or run object state is incorrect.

---

## 15. Experiment Failure Criteria

The experiment is considered failed if any of the following occur:

| Failure Condition | Signal | Action |
|---|---|---|
| Phase 0 cannot produce a useful spec | `fab-intake` produces spec that a cold reader cannot implement | Pivot: simplify the intake questions or reduce spec scope |
| Phase 0 cannot produce a useful blueprint | `fab-blueprint` produces architecture that cannot be implemented | Pivot: constrain blueprint to simpler patterns |
| Phase 1 cannot build one app stage | `fab-forge` cannot produce working code with tests after 3 attempts | Pivot: reduce app stage scope or change stack choice |
| Quality scores consistently < 6 | `fab-check` scores < 6 on any axis for 3+ consecutive stages | Pivot: improve skill specifications or reduce stage complexity |
| Run object corruption | `fabrica.run.json` becomes unusable and cannot be recovered | Pivot: add stronger validation or simplify state contract |
| Operator time per run > 60 minutes | Total operator time for Phase 0 + Phase 1 exceeds 60 minutes | Pivot: reduce skill complexity or automate more steps |

**Abort criteria:** If all three phases fail after 5 attempts each with different pivot strategies, the premise is falsified. Document findings in `docs/retro.md` and consider alternative approaches.
