# fabrica-skills

A set of agent-readable markdown skills for testing one premise:

> Can a solo operator guide an AI agent from a raw product idea to a small working app through explicit, inspectable, reusable skill documents?

This is not a runtime, SaaS, or orchestration framework. The product surface is the skill set itself.

## Install

```bash
npx skills@latest add your-username/fabrica-skills
```

## Skill Inventory

### Core (Phase 1)

| Skill | Job |
|---|---|
| `/fab-intake` | Convert a rough idea into a bounded product spec |
| `/fab-blueprint` | Convert the spec into app architecture and build order |
| `/fab-frame` | Create project skeleton and first-stage contracts |
| `/fab-forge` | Implement one named app stage with tests |
| `/fab-check` | Score one app stage on spec fit, tests, clarity, safety |
| `/fab-pulse` | Render pipeline, quality, cost, and next action |
| `/fab-passport` | Write a resumable handoff document |

### Prototype (Phase 2)

| Skill | Job |
|---|---|
| `/fab-trace` | Diagnose a failing stage, state root cause, apply fix |
| `/fab-weave` | Connect completed stages into end-to-end flow |
| `/fab-launch` | Verify integrated app locally |
| `/fab-ledger` | Show cost breakdown and per-step estimates |
| `/fab-signal` | Capture a human decision with rationale |
| `/fab-retro` | Score the run and identify process improvements |

## Phases

```
Phase 0 — Spec-only demo
  fab-intake → fab-blueprint
  Output: docs/spec.md, docs/blueprint.md

Phase 1 — Tiny vertical slice
  fab-frame → fab-forge → fab-check → fab-pulse
  Output: one app stage with code, tests, quality score

Phase 2 — Thin full-pipeline prototype
  All 13 skills
  Output: complete toy app run with local verification
```

## Quick Start

1. Run `/fab-intake` with a rough product idea
2. Confirm the spec, run `/fab-blueprint`
3. Confirm the blueprint, run `/fab-frame`
4. Build stages with `/fab-forge`, check with `/fab-check`
5. Monitor progress with `/fab-pulse`
