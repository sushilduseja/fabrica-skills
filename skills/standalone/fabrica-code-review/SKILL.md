---
name: fabrica-code-review
description: Two-axis review of changes since a fixed git point: Standards and Spec, via parallel sub-agents.
category: standalone
phase: 2
disable-model-invocation: true
default_gate: auto
overridable: true
---

# fabrica-code-review

Two-axis review of the diff between `HEAD` and a fixed point the user supplies:

- **Standards**: does the code conform to this repository's documented coding standards?
- **Spec**: does the code faithfully implement the originating issue or specification?

Both axes run as **parallel sub-agents** so they do not share context or bias each other. This skill only prepares inputs, launches both reviews, and aggregates the results.

This skill is standalone. It does not require any other skill, run state file, or prior pipeline step. Invoke it as `/fab-code-review` followed by the fixed point (and optional spec text).

## Execution Guardrails

1. Read-only by default. Use git only for `rev-parse`, `log`, and `diff` (plus optional issue fetch when the environment already provides `gh` or similar). Never modify application source, force-push, amend, or stage/commit unless the user explicitly asks after the report. Never post PR comments, approve, merge, or close.
2. Pin the fixed point and confirm a non-empty diff before any review work. Never review a partial snapshot: if collection fails, stop and report the concrete error.
3. Run Standards and Spec with isolated context (parallel sub-agents when available, otherwise clearly separate sequential passes). Never let one pass rewrite the other, never merge findings into one ranked list, and never declare a single overall pass/fail.
4. Establish intent from evidence only, in order: user argument, commit references, repo files, then ask. Do not invent requirements and do not treat chat history as a spec unless the user points at it.
5. Gate every finding on exact file and line, concrete execution path, why it is wrong or unsafe, runtime or intent impact, and fix direction. Suppress anything unverifiable from repository evidence.
6. Run the security pass only on deterministic signals; a non-triggered heuristic is not a clean bill of health.

## Process

### 1. Pin the fixed point

Whatever the user named as the fixed point (commit SHA, branch, tag, `main`, `origin/main`, `HEAD~5`, etc.). If they did not specify one, ask once and wait.

Resolve and capture:

1. `git rev-parse <fixed-point>` — must succeed.
2. Diff command (three-dot, against merge-base): `git diff <fixed-point>...HEAD`
3. Commit list: `git log <fixed-point>..HEAD --oneline`

Fail fast before any sub-agent if:

- the ref does not resolve, or
- the diff is empty (nothing to review).

Report the resolved SHA and a one-line summary of how many files/commits changed.

### 2. Identify the spec source

Search in this order; stop at the first usable source:

1. **User argument** — a path or pasted text the user provided with the invocation.
2. **Commit message references** — issue or ticket IDs in `git log` subjects/bodies (`#123`, `Closes #45`, `JIRA-90`, GitLab `!67`, etc.). If the environment can fetch issue bodies (e.g. `gh issue view`), do so; otherwise quote the commit messages and ask whether to continue with that as the only spec signal.
3. **Repo files** — under `docs/`, `specs/`, `spec/`, `.scratch/`, or `adr/`, prefer names matching the branch or feature slug.
4. **Ask** — if nothing is found, ask where the spec is. If the user says there is none, skip the Spec sub-agent and note `Spec: no spec available` in the final report.

Do not invent requirements. Do not treat chat history as a spec unless the user points at it.

### 3. Identify the standards sources

Collect repository documents that state how code should be written, for example:

- `CODING_STANDARDS.md`, `CONTRIBUTING.md`, `STYLE.md`
- `docs/coding-standards.md`, `docs/engineering/*`
- language or tool configs only when they encode human rules (not machine-only formatters)

If none exist, still run Standards using **only** the smell baseline below.

#### Smell baseline (always included)

On top of repo documents, Standards always carries this fixed set of classic code smells. Two binding rules:

- **The repo overrides.** A documented repo standard always wins. If the repo endorses a pattern the baseline would flag, suppress that smell.
- **Always a judgement call.** Each smell is a labelled heuristic (e.g. “possible Feature Envy”), never an automatic hard failure. Skip anything already enforced by project tooling (linters, formatters, typecheckers) when that tooling clearly covers the same concern.

Match each smell against the **diff** (not the whole codebase):

- **Mysterious Name** — a function, variable, or type whose name does not reveal what it does or holds. → rename; if no honest name exists, the design is unclear.
- **Duplicated Code** — the same logic shape appears in more than one hunk or file in the change. → extract the shared shape.
- **Feature Envy** — a method reaches into another object’s data more than its own. → move the method toward the data it uses.
- **Data Clumps** — the same few fields or parameters travel together repeatedly. → bundle into one type.
- **Primitive Obsession** — a primitive or string stands in for a domain concept that deserves its own type. → introduce a small type.
- **Repeated Switches** — the same `switch` / `if` cascade on the same discriminator recurs in the change. → polymorphism or one shared map.
- **Shotgun Surgery** — one logical change forces scattered edits across many files. → gather what changes together.
- **Divergent Change** — one module is edited for several unrelated reasons. → split by reason to change.
- **Speculative Generality** — abstraction or hooks for needs the spec does not have. → remove until a real need appears.
- **Message Chains** — long `a.b().c().d()` chains the caller should not depend on. → hide behind one method.
- **Middle Man** — a type that mostly delegates. → call the real target directly.
- **Refused Bequest** — a subtype ignores most of what it inherits. → prefer composition.

### 4. Spawn both sub-agents in parallel

If the agent runtime cannot spawn true sub-agents, run two **isolated sequential passes** with separate context windows (or equivalent): Standards first, then Spec, still without letting one pass’s conclusions rewrite the other. Prefer parallel when available.

#### Standards sub-agent — include all of:

- The exact diff command and the commit list.
- Paths (and, when small enough, excerpts) of standards files found in step 3.
- The **full smell baseline** text from step 3 (the sub-agent must not rely on memory of this skill).
- Brief:

  > Report, per file or hunk where relevant: (a) every place the diff violates a documented standard — cite file and rule; (b) any baseline smell you spot — name it and quote the hunk. Distinguish hard violations (documented standards) from judgement calls (baseline smells). Repo standards override the baseline. Skip issues tooling already enforces. Under 400 words.

#### Spec sub-agent — include all of:

- The exact diff command and the commit list.
- The path or fetched contents of the spec.
- Brief:

  > Report: (a) requirements the spec asked for that are missing or only partial; (b) behaviour in the diff that was not asked for (scope creep); (c) requirements that look implemented but appear wrong. Quote the spec line or issue text for each finding. Under 400 words.

If there is no spec, **do not** spawn the Spec sub-agent; record that in the aggregate report.

### 5. Aggregate

Present results under two headings only:

```markdown
## Standards
<standards report, verbatim or lightly cleaned>

## Spec
<spec report, or "no spec available">
```

Rules:

- Do **not** merge findings into one ranked list.
- Do **not** declare a single overall pass/fail that collapses both axes.
- End with one summary line: finding counts per axis, and the worst issue **within each axis** (if any).

## Why two axes

A change can pass one axis and fail the other:

- Follows every standard but implements the wrong behaviour → Standards pass, Spec fail.
- Does exactly what the issue asked but breaks project conventions → Spec pass, Standards fail.

Keeping the axes separate stops one from masking the other.

## Error Handling

- `missing_input`: fixed point missing and unanswered, or empty diff → ask once for a commit, branch, tag, or revision; stop on empty diff with nothing to review.
- `invalid_state`: fixed point does not resolve, or the directory is not a git work tree → stop and show the `git rev-parse` error.
- `external_failure`: a sub-agent or issue-fetch command failed → surface the error, still present the other axis if it completed, and offer to re-run the failed axis alone.

## Non-goals

- Do not auto-fix the findings.
- Do not open a PR unless the user asks after the report.
- Do not require CI to be green before reviewing.
- Do not expand scope into product roadmap review or design workshops.

Done.
