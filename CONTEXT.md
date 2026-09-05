# fabrica-skills: Context

## Domain Vocabulary

| Term | Meaning |
|------|---------|
| Skill | One reusable instruction document (`SKILL.md`) in this repo |
| Pipeline step | One skill invocation in the fabrica workflow |
| App stage | One buildable slice of the target app, defined by `fab-plan` |
| Run object | `fabrica.run.json`, the durable state file for one run |
| Gate | A pause point where the operator must approve before proceeding |
| Fabrica | The factory metaphor: turning raw ideas into small apps through skills |

## First-Principles Factory Model

fabrica-skills tests one premise: can a solo operator guide an AI agent from raw idea to working app through explicit, inspectable, reusable skill documents?

The product surface is the skill set itself. This is not a runtime, SaaS, queue system, or orchestration framework. Skills are markdown documents that agents follow. The operator sequences the run.

## Architectural Decisions (ADR Log)

### ADR-001: Spec-first implementation approach
**Date:** 2026-05-18
**Decision:** Finalize the PRD before implementing skills. Approach A from CEO review.
**Rationale:** The PRD is 90% complete and this is a novel pattern. Getting the contract right before building prevents costly rework when the skill model proves different than expected.
**Alternatives considered:**
- B: Build Phase 0 immediately, let spec emerge (rejected: risk of building contradictory skills)
- C: Hybrid: implement skeleton alongside PRD refinement (close second, deferred)

### ADR-002: Selective expansion review posture
**Date:** 2026-05-18
**Decision:** Hold the PRD's MVP scope as baseline, cherry-pick high-leverage additions.
**Rationale:** The PRD is already well-constrained. Selective expansion surfaces improvements without bloating the spec.

### ADR-003: Skill dependency graph as prerequisite table
**Date:** 2026-05-18
**Decision:** Each skill lists its prerequisites explicitly in a table format.
**Rationale:** Simple, readable, and directly actionable by agents. Enables `fab-trace` to diagnose missing prerequisite failures automatically.
**Alternatives considered:**
- DAG with ASCII visualization (rejected: overkill for linear pipeline)
- Implicit ordering through Trigger sections (rejected: easy to miss)

### ADR-004: Run object validation via JSON Schema
**Date:** 2026-05-18
**Decision:** JSON Schema file that skills reference in their specs.
**Rationale:** Standard, machine-readable format. Can be enforced later if a runtime is added. Makes validation expectations explicit.
**Alternatives considered:**
- Validation rules embedded in each skill's behavior (rejected: harder to maintain consistency)
- No validation schema (rejected: corrupted state causes cascading failures)

### ADR-005: Error taxonomy as simple enum
**Date:** 2026-05-18
**Decision:** Six error categories: `missing_input`, `invalid_state`, `gate_blocked`, `validation_failed`, `prerequisite_missing`, `external_failure`.
**Rationale:** Enough categories to enable `fab-trace` automation without over-constraining. Covers main failure modes in a pipeline system.

### ADR-006: Phase 0 demo as manual script with timing checklist
**Date:** 2026-05-18
**Decision:** Manual demo script with timing checklist, not automated validation.
**Rationale:** Concrete, testable, and low-cost. Becomes documentation for users trying the skills for the first time. Automated testing of markdown skills is premature for MVP.

### ADR-007: Remove dead states from status enum
**Date:** 2026-05-18
**Decision:** Remove `init` and `specifying` from the run object status enum.
**Rationale:** No skill ever sets these states. Dead states confuse agents and make the state machine harder to reason about.

### ADR-008: Partial spec handling for skipped intake questions
**Date:** 2026-05-18
**Decision:** `fab-intake` proceeds with partial specs, marks incomplete areas, and warns downstream skills.
**Rationale:** Allows progress while flagging incomplete areas. Incomplete specs are worse than no specs. Downstream skills must know what's missing.

### ADR-009: Validation pass/fail criteria required
**Date:** 2026-05-18
**Decision:** Each validation step in Section 13 must have explicit pass/fail criteria.
**Rationale:** Testable validation is the difference between a spec and an experiment. Without criteria, validation becomes subjective.

### ADR-010: Experiment failure criteria defined
**Date:** 2026-05-18
**Decision:** Add failure criteria to the PRD. Knowing when to stop is as important as knowing when to continue.
**Rationale:** Makes the experiment more scientific. Defines falsifiable conditions. Prevents sunk cost fallacy.

### ADR-011: Secrets management spec added
**Date:** 2026-05-18
**Decision:** Basic secrets management: `.env.example` for required vars, secret scanning in pre-launch checklist, env var validation.
**Rationale:** Even solo operators need to know where to store API keys safely. Prevents committed secrets.

### ADR-012: Rescue actions for all critical error gaps
**Date:** 2026-05-18
**Decision:** Define rescue actions for all five critical error gaps: `SpecConflictError`, `StubMismatchError`, `UnreproducibleError`, `IncompleteFixError`, `CorruptedRunObjectError`.
**Rationale:** Silent failures are the worst class of bug in a pipeline system. Every failure must have a defined recovery path.

## Deferred Decisions

| Decision | Deferred To | Rationale |
|----------|-------------|-----------|
| Skill testing framework | Post-MVP | Testing markdown skills is fundamentally different from testing code; premature for MVP |
| Skill versioning strategy | Post-MVP | "Successful problem": defer until multiple skill versions exist |
| Run history | Post-MVP | Premature until multiple runs exist; fab-retro already captures per-run improvements |

## Review Metadata

- **Review type:** CEO Review (Selective Expansion mode)
- **Date:** 2026-05-18
- **Approach:** Spec-first (Approach A)
- **Scope additions accepted:** 10
- **Scope additions deferred:** 3
- **Critical gaps identified:** 5 (all resolved with rescue actions)
- **Commit:** 24df2d6



