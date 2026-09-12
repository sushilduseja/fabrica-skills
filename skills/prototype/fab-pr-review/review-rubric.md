# fab Code Review Rubric

## Mission

Find material defects, missing behavior, unsafe assumptions, and architectural problems in a GitHub pull request. Report only evidence-backed findings.

## Review axes

### Intent

Determine whether the change implements the intended behavior.

Evidence priority:

`user context > PR description > linked issue > commits > tests > title`

Check:

- missing requirements
- partial implementation
- wrong behavior
- scope creep
- contradictions between stated intent and implementation

Never invent requirements.

### Code

Review these failure classes.

#### Correctness

State transitions, boundary cases, null/empty behavior, error paths, validation, retries, defaults, resource lifecycle, partial failure.

#### Data and persistence

Transactions, atomicity, uniqueness, field mapping, consistency, partial writes, migration safety, rollback, destructive operations, stale reads.

#### Concurrency

Read-check-write races, check-then-act, duplicate creation, idempotency, locking, ordering, async behavior, retries, non-atomic transitions.

#### Security

Authentication, authorization, IDOR, trust boundaries, validation, injection, unsafe deserialization, secret exposure, sensitive logging, token validation, privilege changes.

#### API and contracts

Breaking changes, compatibility, serialization, defaults, error contracts, event schemas, enum/value propagation, consumer assumptions.

#### Performance

N+1, unbounded work, algorithmic regressions, unnecessary allocations, repeated I/O, hot-path queries, indexing, caching, expensive calls in loops.

#### Tests

Happy paths, failures, boundaries, permissions, concurrency, regression coverage, determinism, assertions around new behavior.

#### Architecture and maintainability

Follow repository-specific rules first. Generic structural smells are judgement calls, not violations. Useful Fowler-derived checks include duplication, mysterious naming, feature envy, data clumps, primitive obsession, repeated switches, shotgun surgery, divergent change, speculative generality, message chains, middle man, and refused bequest.

Also inspect leaky boundaries, wrong abstraction level, hidden coupling, misplaced business logic, and fragile propagation paths.

## Change propagation

For each changed or introduced enum/status/value, API field, database column, event/message, state transition, permission, configuration option, public method, or contract, inspect relevant consumers.

Check validation, persistence, switches, filters, allowlists, serialization, UI, workers, defaults, and fall-through behavior.

## Evidence gate

A finding needs all of these:

1. file and line or smallest useful code span
2. concrete execution path
3. explanation of why it is wrong or unsafe
4. runtime or intent impact
5. practical fix direction

Suppress findings that cannot be verified from repository evidence.

Internal confidence:

- 9-10: verified concrete defect
- 7-8: very likely defect
- 5-6: plausible but uncertain
- below 5: suppress

## Severity

- P0: severe production/security impact, data loss, or merge-blocking failure
- P1: real defect or serious risk that should be fixed before merge
- P2: material issue worth fixing but usually not merge-blocking
- P3: minor design or maintainability issue

Do not inflate style preferences into defects.

When reporting, order all P0-P2 findings by severity then file path in a single numbered "fix order" list before the detailed sections. This ordering rule affects presentation only, not the confidence/evidence gate above.

## Review boundaries

A clean verdict means only that no material evidence-backed finding was identified in the reviewed repository and available context. It does not mean the system is proven defect-free.

`security_relevant=false` means the deterministic heuristic did not trigger. It does not mean security was verified clean.

Cross-repository consumers are outside the default review boundary unless explicitly supplied as additional context.
