---
name: fab-pr-review
description: Review a GitHub pull request for production defects, security gaps, and intent mismatches with an evidence-backed verdict.
category: prototype
phase: 2
default_gate: auto
overridable: false
---

# fab Code Review

Review one GitHub.com pull request. Do not modify source code, post PR comments, approve, merge, or close the PR.

## Input

The user supplies:

`<PR_URL>`

Optional free-form intent context may follow the URL. Never require it. Never ask the user to provide it.

## Deterministic collection

Locate `scripts/collect_pr.py` in this skill directory and run it with distinct arguments:

```text
python <skill-directory>/scripts/collect_pr.py --url "<PR_URL>" --context "<optional context>"
```

Do not combine the URL and context into one shell argument.

The collector must finish before reasoning begins. If collection fails, stop and report the concrete setup or access error. Do not review a partial snapshot.

The collector creates a unique temporary bundle and prints `BUNDLE_DIR=...`. The outer skill owns cleanup and must delete the bundle in a `finally` step after the review finishes, succeeds, or fails.

## Review fixed point

Use the bundle as the source of truth:

- `metadata.json`: PR metadata, base/head SHAs, repository state, security flag, and review boundary.
- `pr.diff`: the canonical `git diff base...head` patch. Do not substitute another diff.
- `context.md`: optional user intent context.
- `snapshot.md`: compact review metadata.
- `changed-files.txt`: changed paths.
- `checks.json` and `checks-status.txt`: CI evidence.
- `repo/`: detached checkout at the PR head.

Confirm that the base SHA and head SHA match `metadata.json` before reviewing.

Read repository instructions before generic guidance. Look for `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, architecture docs, ADRs, and nearby project guidance.

Read the changed files and inspect relevant callers, consumers, interfaces, configuration, migrations, tests, and adjacent code outside the diff when the change can affect them.

## Intent review

Build the strongest defensible intent statement using this order:

`user context > PR description > linked issue > commits > tests > title`

Check:

- missing requirement
- partial implementation
- wrong behavior
- scope creep
- contradiction between stated intent and implementation

If reliable intent cannot be established, state that intent review was limited. Do not invent requirements.

## Code review

Always run this pass.

Review:

1. correctness: state transitions, boundary behavior, null/empty cases, error paths, validation, retries, defaults, resource lifecycle, partial failure
2. data and persistence: transactions, atomicity, uniqueness, field mapping, consistency, partial writes, migration safety, rollback, destructive operations, stale reads
3. concurrency: read-check-write races, check-then-act, duplicate creation, idempotency, locking, ordering, async behavior, retries, non-atomic transitions
4. security: authentication, authorization, IDOR, trust boundaries, validation, injection, unsafe deserialization, secrets, sensitive logs, token validation, privilege changes
5. API and contracts: breaking changes, compatibility, serialization, defaults, error contracts, event schemas, enum/value propagation, consumer assumptions
6. performance: N+1, unbounded work, algorithmic regressions, repeated I/O, hot-path queries, indexes, caching, expensive loops
7. tests: happy paths, failures, boundaries, permissions, concurrency, regression coverage, determinism, assertions around new behavior
8. architecture and maintainability: repository rules first, then structural smells and boundary/coupling problems

For generic structural quality, use judgement rather than treating smells as rules. Relevant Fowler-derived smells include duplication, mysterious naming, feature envy, data clumps, primitive obsession, repeated switches, shotgun surgery, divergent change, speculative generality, message chains, middle man, and refused bequest.

## Change propagation

For any changed or introduced enum/status/value, API field, database column, event/message, state transition, permission, configuration option, public method, or contract, inspect relevant consumers.

Check validation, persistence, switches, filters, allowlists, serialization, UI, workers, defaults, and fall-through behavior.

## Security pass

Only load `prompts/security.md` when `metadata.json.security_relevant` is `true`.

If the flag is false, report that the security heuristic did not trigger. Never imply that security was verified clean.

## Primary findings

For each finding, capture internally:

- severity P0-P3
- confidence 1-10
- exact file and line or smallest useful code span
- concrete execution path
- why it is wrong or unsafe
- impact
- practical fix direction

Suppress any finding below confidence 5 or any finding that cannot be verified from repository evidence.

## Independent second pass

After the primary review, save the findings to `<BUNDLE_DIR>/primary-review.md`.

Dispatch the harness-specific `fab-code-review-second-pass` subagent using the host's real subagent mechanism when available. Give it only the bundle path and its own review instructions from `prompts/second-pass.md`.

The second pass must independently inspect the repository and diff. It must not treat primary findings as authoritative. Its job is to find missed defects, cross-file consequences, intent gaps, and evidence weaknesses.

The second pass is read-only. It must have no file-editing capability.

If the host does not support subagents, run the second pass as a clearly separate fresh review instruction rather than pretending it is an independent subagent. The final report must state that the second pass was sequential rather than separately dispatched.

## Merge and evidence gate

Merge primary and second-pass findings by underlying issue. Deduplicate them.

Do not increase confidence just because two model outputs agree. Multiple observations can support a finding, but each finding still needs concrete repository evidence.

A finding that cannot be traced to code in the bundle is suppressed.

## Final output

Return exactly this structure, in this order:

`## review`

`### summary`
One or two sentences: what the PR does, and the headline risk if any. No findings detail here.

`### verdict`
One line: `<verdict value>` Â· CI: `<checks_status>` Â· Security heuristic: `<true|false>`

Verdict values (unchanged):
- `request changes: P0/P1 findings`
- `request changes: intent gap`
- `approve with no material findings`
- `review limited: insufficient intent context`

`### fix order`
A single numbered list across ALL P0/P1/P2 findings, ordered severity first (P0 before P1 before P2), then by file path. Each line:

`N. [P0] concise finding title - path/to/file:line`

This section exists so a reviewer has one ordered checklist before reading detail. Omit this section entirely when there are no P0/P1/P2 findings.

`### blockers` (P0/P1 findings, same numbering as the fix-order list)

For each:
```text
#### N. concise finding title
`path/to/file:line`
- Severity: P0 | P1
- Why: one or two concise sentences grounded in the code.
- Impact: concrete runtime or intent consequence.
- Fix: one practical direction.
```

`### important` (P2 findings, same format, continuing the numbering from fix order)

`### minor` (P3 findings, same format, not included in "fix order")

`### intent`
State whether intent was reviewed and what evidence was available. Material intent findings go here, not in blockers/important, even if severity P0/P1 â€” cross-reference by number if also listed in fix order.

`### tests`
Only material missing regression coverage, as a short bullet list.

Do not add sections beyond this list. Do not restate findings already covered. When `security_relevant` is `false`, state plainly in `### verdict` or `### summary`: "Security checks were not activated because the deterministic heuristic did not flag this PR." Never write "No security issues found."

Never claim that a clean review means the PR is proven defect-free.

## Cleanup

Delete the bundle in a `finally` block after all review work completes. Use `scripts/cleanup_bundle.py <BUNDLE_DIR>` so cleanup is OS-independent. Never leave the temporary bundle behind on normal completion or exception.

## Optional: save the report

Only when the user's context or a follow-up message explicitly asks to save, export, or write the review to a file, run:

    python "<CORE_DIR>/scripts/save_review.py" --core-dir "<CORE_DIR>" --owner "<owner>" --repo "<repo>" --number "<number>"

Pipe the exact final `## review` report text to this script's stdin. Owner, repo, and number come from `metadata.json`. Report the returned `SAVED_REVIEW=` path back to the user.

Never do this by default. Never invoke any GitHub write operation (`gh pr comment`, `gh pr review`, or any API call that posts, approves, merges, or closes) under any circumstance. Saving a local file is the only permitted persistence action.

## Execution Guardrails

1. Run the deterministic collector before any reasoning begins: `scripts/collect_pr.py` with the PR URL and context as distinct arguments. If collection fails, stop and report the concrete setup or access error. Never review a partial snapshot.
2. Confirm the base SHA and head SHA match `metadata.json` before reviewing. Unverifiable SHAs stop the review.
3. Read-only throughout: do not modify source code, post PR comments, approve, merge, close, push, or write the run object. The only permitted persistence is the opt-in local save via `scripts/save_review.py` when explicitly asked — never any GitHub write operation.
4. Load `prompts/security.md` only when `metadata.json` reports `security_relevant` as `true`. When the flag is false, state the heuristic did not trigger and never imply security was verified clean.
5. Delete the bundle with `scripts/cleanup_bundle.py` in a `finally` step after the review finishes, succeeds, or fails. Never leave the temporary bundle behind.

## Error Handling

- `missing_input`: no PR URL supplied, or the GitHub CLI is missing or unauthenticated → halt and show the invocation form plus `gh auth login`.
- `invalid_state`: snapshot incomplete (unverifiable SHAs, partial diff, missing CI evidence that the verdict needs) → stop without reviewing and report what is missing.
- `external_failure`: `gh`, `git`, or network call fails mid-collection → halt, show the collector output, and suggest retry or access fix. Never review from the partial bundle.
