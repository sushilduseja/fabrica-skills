---
name: fab-pr-review
description: Review a GitHub pull request for production defects, security gaps, and intent mismatches with an evidence-backed verdict.
category: prototype
phase: 2
disable-model-invocation: true
default_gate: auto
overridable: false
---

## Job

Review one GitHub pull request for production defects and intent gaps against a deterministic PR snapshot, then produce one concise verdict. Read-only: never modify source, post comments, approve, merge, or close the PR.

## Trigger

Operator supplies a GitHub pull request URL, optionally followed by intent context.

## Prerequisites

- None — independent of pipeline state. Does not read or write `fabrica.run.json`.
- `git` and the GitHub CLI (`gh`) installed with `gh auth login` completed.

## Input

- PR URL (required): `https://github.com/OWNER/REPO/pull/NUMBER`
- Intent context (optional): free text after the URL, e.g. what the change must guarantee.

## Output

Inline review report with exactly this structure, in this order:

```text
## review

### summary
### verdict
### fix order
### blockers
### important
### minor
### intent
### tests
```

The verdict is exactly one of:

```text
request changes: P0/P1 findings
request changes: intent gap
approve with no material findings
review limited: insufficient intent context
```

Findings are classified as:

```text
P0  severe production or security impact, data loss, or merge-blocking failure
P1  real defect or serious risk that should be fixed before merge
P2  material issue worth fixing but usually not merge-blocking
P3  minor design or maintainability issue
```

P0 through P2 findings appear in one ordered fix-order list before their detailed sections. `approve with no material findings` means no evidence-backed finding cleared the confidence gate on this pass, not that the PR is proven defect-free. On request only, save the exact report to a user-chosen local file; never write a file unless explicitly asked.

## Execution Guardrails

1. Collect a deterministic snapshot first: PR metadata, base SHA, head SHA, canonical `git diff base...head`, changed files, CI evidence, and review context. Verify both SHAs locally and check out the PR head detached. Review the bundle, never an independently reconstructed diff.
2. Do not modify source code, post PR comments, approve, merge, close, or push anything. Read-only means no writes to the repo, the PR, or the run object.
3. Establish intent using this evidence order: user context, then PR description, then linked issue, then commits, then tests, then title. Do not invent requirements. If reliable intent cannot be established, report intent review as limited rather than guessing.
4. Run an independent second pass over the same bundle that does not treat primary findings as authoritative. It hunts missed production defects, cross-file consequences, concurrency and data-integrity problems, authorization gaps, contract breakage, boundary failures, intent mismatches, and weak evidence. When the host offers a real subagent mechanism, dispatch it independently; otherwise run a clearly separate sequential second review and say so in the report.
5. Apply the evidence gate to every finding: exact file and line (or smallest useful span), concrete execution path, why the behavior is wrong or unsafe, runtime or intent impact, and practical fix direction. Suppress findings that cannot be verified from repository evidence. Agreement between reviewers does not by itself increase confidence.
6. Run the dedicated security pass only when changed paths or diff content match deterministic signals (authentication, authorization, permissions, tokens, secrets, deserialization, SQL, shell execution, crypto, sessions, roles, ACLs, IDOR). When no signal matches, skip the pass and say so explicitly. A non-triggered heuristic means no signal was found, not that security is verified clean.
7. Inspect callers, consumers, interfaces, configuration, migrations, tests, and adjacent code whenever the change can affect them, not just the diff lines.
8. Never review a partial snapshot. If collection fails (auth, access, missing SHAs), stop and report the concrete collector error instead.

## Behavior

1. Parse the PR URL and optional intent context from the invocation.
2. Collect the deterministic snapshot (metadata, base/head SHAs, canonical diff, changed files, CI evidence, context) and verify both SHAs locally.
3. Establish intent from the evidence order in the guardrails.
4. Run the primary review across correctness, data and persistence, concurrency, security, API and contracts, performance, tests, architecture, and maintainability.
5. Run the independent second pass over the same bundle.
6. Deduplicate both finding sets through the evidence gate; drop anything unverifiable.
7. Emit the report in the fixed output structure with one of the four verdicts.

Done.

## Error Handling

- `missing_input`: no PR URL supplied, or the GitHub CLI is missing or unauthenticated → halt and show the invocation form plus `gh auth login`.
- `invalid_state`: snapshot incomplete (unverifiable SHAs, partial diff, missing CI evidence that the verdict needs) → stop without reviewing and report what is missing.
- `external_failure`: `gh`, `git`, or network call fails mid-collection → halt, show the collector output, and suggest retry or access fix. Never review from the partial bundle.
