# CEO Review — fabrica-skills

> Historical design record. Current implementation source of truth is `skills/manifest.json`, `schemas/run-object.schema.json`, `scripts/validate-run.mjs`, `docs/STATE_MACHINE.md`, and `docs/VALIDATION.md`. Do not treat this document as active workflow instructions.

**Status:** ACTIVE — findings captured for selective action
**Date:** 2026-06-19
**Mode:** SELECTIVE EXPANSION (cherry-pick high-leverage improvements from architecture review)
**Branch:** main

---

## Project Context

fabrica-skills is a skills-only repository (13 fab-* markdown files) for guiding an AI agent from product idea to prototype. All 13 skills are implemented and validated through Phases 0-2. The MVP is complete.

**Git history (14 commits):**
- Initial commit → docs → CEO scope additions (v0.1) → Phase 0/1/2 → PRD review fixes → README polish → `--global` flag

**Current state:** Post-MVP seasoning. No active TODOs or FIXMEs. All skills present. The project is clean but has repetition-as-compensation for lack of a machine-readable manifest.

---

## Pre-Review System Audit

| Metric | Value |
|--------|-------|
| Branch | `main` |
| Commits | 14 |
| Stashes | None |
| TODOs/FIXMEs | None |
| Skills | 13 (6 core, 6 prototype + fab-pulse) |
| Schema | `schemas/run-object.schema.json` |
| Linking script | `scripts/link-skills.mjs` |

---

## Architecture Review Findings (carried forward)

Source: `docs/architecture-review.html`

| # | Finding | Strength | Scope |
|---|---------|----------|-------|
| 1A | `fab-ledger` (48 lines) — shallow module. All behaviors already in `fab-pulse`. Fold into details mode. | Worth exploring | ✅ Accept |
| 2A | Dependency graph spread across 14 files. No machine-readable manifest. Centralize into `skills/manifest.json`. | **Strong** | ✅ Accept |
| 3A | `fab-trace` hardcodes error-type-to-diagnosis dispatch table. Externalize to per-skill `errors.json` metadata. | **Strong** | ✅ Accept |
| 3B | `fab-weave` inlines `fab-trace` behavior, creating circular dependency. Replace with clean delegation. | **Strong** | ✅ Accept |
| 4A | "Validate against schema" appears identically in 11 skills but is advisory. Create `scripts/validate-run.mjs`. | **Strong** | ✅ Accept |
| 4B | `fab-check` scoring formula is a natural-language instruction. Extract to `scripts/score-quality.mjs`. | Worth exploring | ❌ Defer |
| 5A | 13-skill inventory duplicated in 4 files (`link-skills.mjs`, `plugin.json`, schema, `fab-intake`). Generate from single source. | **Strong** | ✅ Accept |
| 5B | Run object boilerplate (`current_step`, `updated_at`) in every writer. Establish global convention in CLAUDE.md. | Strong | ✅ Accept |
| 5C | Error taxonomy per-skill scattered across Error Handling sections. Move to per-skill `errors.json`. | Strong | ✅ Accept |
| 5D | Gate model triplicated (schema, fab-intake, per-skill, PRD). Derive from manifest. | Strong | ✅ Accept |

**Top recommendation:** `skills/manifest.json` + per-skill error metadata — addresses 6 of 11 findings. The manifest is the root cause fix.

---

## Mode Decision

**SELECTIVE EXPANSION** — Hold MVP scope. Cherry-pick high-leverage consolidations from the architecture review. No cathedral additions.

---

## Section 1: Architecture Review

*(From improve-codebase-architecture skill output — incorporated by reference)*

### Findings incorporated

| Theme | Issue | Accepted |
|-------|-------|----------|
| Centralization | Dependency graph → `skills/manifest.json` | ✅ |
| Centralization | Skill inventory → single source | ✅ |
| Centralization | Gate defaults → derive from manifest | ✅ |
| Externalization | Error dispatch → per-skill `errors.json` | ✅ |
| Externalization | Validation → `scripts/validate-run.mjs` | ✅ |
| Externalization | Scoring → `scripts/score-quality.mjs` | ❌ Deferred |
| Consolidation | `fab-ledger` → fold into `fab-pulse` | ✅ |
| Cleanup | `fab-weave` inline trace → delegate | ✅ |
| Convention | Run object boilerplate → global rule | ✅ |

### New findings (CEO review)

*(To be added as review proceeds)*

---

## Section 2: Error & Rescue Map

The PRD (§5c) defines 6 error types with a complete Error & Rescue Registry (§8). Architecture review found that `fab-trace` hardcodes the dispatch table rather than reading from per-skill metadata. Fix accepted: externalize to `errors.json` per skill.

### Gaps identified

| Gap | Severity | Fix | Status |
|-----|----------|-----|--------|
| `fab-trace` dispatch table hardcoded | Medium | Externalize to `skills/*/errors.json` | Accepted |
| Schema validation advisory, not enforced | Medium | `scripts/validate-run.mjs` | Accepted |

---

## Section 3: Security & Threat Model

fabrica-skills is a skills-only repo. No runtime, no SaaS, no network services, no user data. Security surface is minimal.

| Threat | Likelihood | Impact | Mitigated? |
|--------|-----------|--------|------------|
| Prompt injection in agent following skill | Low | Medium | Mitigated by gate model (checkpoint/review gates) |
| Secrets committed via `.env.example` drift | Low | High | Mitigated by `fab-launch` secret scan checklist (PRD §7b) |
| Corrupted `fabrica.run.json` from invalid agent behavior | Medium | Medium | Partially — schema exists but validation is advisory (🔴 GAP: accepted fix 4A) |

**No new security findings beyond the architecture review's accepted fixes.**

---

## Section 4: Data Flow & Interaction Edge Cases

### Run object state machine

```
  designing → framing → forging → checking → weaving → verifying → complete
      ↓          ↓         ↓         ↓           ↓           ↓
    blocked ←───┴─────────┴─────────┴───────────┴───────────┘
      ↓
  abandoned
```

| Transition | Source skill | Edge case handled? |
|-----------|-------------|-------------------|
| → designing | fab-intake | ✅ Fresh start only |
| → framing | fab-blueprint | ✅ Spec must exist |
| → forging | fab-frame | ✅ Blueprint must exist |
| → checking | fab-forge | ✅ Stage must be implemented |
| → blocked | fab-check | ✅ Score <6 on any axis |
| → weaving | fab-check → fab-weave | ✅ All stages done |
| → verifying | fab-weave | ✅ Integration test written |
| → complete | fab-launch | ✅ Only if verified |
| → abandoned | Any | ⚠️ No formal abandonment flow |

**Gap:** No formal abandonment transition documented. `abandoned` is in the schema enum but no skill explicitly sets it. Agent could set `status = abandoned` without recording why.

---

## Section 5: Code Quality Review

### DRY violations

| Pattern | Occurrences | Fix |
|---------|------------|-----|
| "Validate the run object against the schema" | 10 skills | Replace with global CLAUDE.md rule |
| `current_step = "fab-*"` | 10 skills | Auto-set by convention |
| `updated_at` | 10 skills | Auto-bump by convention |
| Skill names listed as arrays | 4 files | Derive from `skills/manifest.json` |
| Gate defaults listed | 4 locations | Derive from manifest |

### Structural inconsistencies

| Finding | File | Severity | Fix |
|---------|------|----------|-----|
| Behavior step 5 inlines entire run object schema (13 sub-bullets) | `fab-intake` line 36 | Medium | Reference `schemas/run-object.schema.json` instead |
| Bare `` `current_step` `` (missing `= "fab-intake"` assignment) | `fab-intake` line 69 | Medium | Add `= "fab-intake"` for consistency |
| "Reasonable window" undefined timeout | `fab-signal` line 38 | Low | Specify concrete timeout (e.g. "30 seconds") |
| "Important context" undefined threshold | `fab-passport` line 34 | Low | Add examples of what constitutes important context |

### Shallow modules

| Skill | Lines | Verdict |
|-------|-------|---------|
| `fab-ledger` | 48 | ✅ Fold into `fab-pulse` |
| `fab-signal` | 55 | Retain (gate enforcement is structural) |

### Schema design issues

| Finding | Location | Severity | Fix |
|---------|----------|----------|-----|
| `costs.estimated_usd` (top-level) vs `costs.by_step[].usd` — naming asymmetry | `schemas/run-object.schema.json` lines 80, 91 | Low | Rename `by_step.usd` → `by_step.estimated_usd` or document mapping in a skill |

---

## Section 6: Test Review

The validation plan (PRD §14) defines 6 manual tests. ADR-006 explicitly defers automated testing to post-MVP.

### Test coverage

| Test | Type | Status |
|------|------|--------|
| PRD contradiction review | Manual | ✅ Passed (v0.2) |
| Phase 0 sample run | Manual | ✅ Passed |
| Phase 1 sample run | Manual | ✅ Passed |
| Status test (`fab-pulse` + `unknown` costs) | Manual | ✅ Passed |
| Handoff test | Manual | ✅ Passed |
| Launch safety test | Manual | ✅ Passed |

### Testability gaps (from architecture review)

| Gap | Fix | Status |
|-----|-----|--------|
| Schema validation untestable | `scripts/validate-run.mjs` | Accepted |
| Scoring formula untestable | `scripts/score-quality.mjs` | Deferred |
| No automated exit conditions for skills | Post-MVP (ADR-006) | Deferred |

---

## Section 7: Performance Review

**Verdict:** No performance concerns. The project is 13 markdown files and a JSON schema. No runtime, no DB, no network calls in the skill execution path.

---

## Section 8: Observability & Debuggability

| Concern | Status |
|---------|--------|
| Run object tracks all state | ✅ `fabrica.run.json` is the audit trail |
| Error taxonomy captures failure modes | ✅ 6 error types defined |
| `fab-trace` uses error types for diagnosis | ⚠️ Hardcoded dispatch (accepted fix) |
| `fab-retro` captures per-run improvements | ✅ Post-run retrospective |
| `fab-signal` records human decisions | ✅ Timestamped decision log |

---

## Section 9: Deployment & Rollout

**Verdict:** Not applicable. This is a markdown-only repo. No deploy pipeline, no migrations, no runtime.

---

## Section 10: Long-Term Trajectory

### Technical debt introduced by MVP

| Debt item | Severity | Pay-down |
|-----------|----------|----------|
| 4x skill inventory duplication | Low | Generate from manifest (accepted) |
| Advisory schema validation | Low | `scripts/validate-run.mjs` (accepted) |
| No skill versioning | Low | Post-MVP (ADR deferred) |
| No test framework | Low | Post-MVP (ADR deferred) |

### Path dependency assessment

- **Reversibility: 5/5** (easily reversible) — all state in `fabrica.run.json`, all behaviors in markdown, no platform lock-in.
- **Phase 2/3 planning:** The architecture supports adding skills without breaking the pipeline. The manifest approach makes dependency validation explicit.

---

## Section 11: Design & UX Review

**Skipped** — no UI scope. This project produces terminal-style ASCII dashboards (`fab-pulse`), not user-facing interfaces.

---

## Accepted Scope (cherry-picked from architecture review)

- ✅ `skills/manifest.json` — centralized dependency graph, gate defaults, skill list
- ✅ `scripts/validate-run.mjs` — enforceable schema validation
- ✅ `skills/*/errors.json` — per-skill error metadata for `fab-trace` lookup
- ✅ Fold `fab-ledger` into `fab-pulse` details mode
- ✅ Replace `fab-weave` inline trace with clean delegation
- ✅ Single-source skill inventory (generate `plugin.json`, schema, fab-intake from manifest)
- ✅ Global conventions in CLAUDE.md (validation, `current_step`, `updated_at`)

### Eng-review additions

- ✅ `fab-intake` — reference schema instead of inline dump
- ✅ `fab-intake` — fix bare `current_step`
- ✅ `fab-signal` — specify concrete timeout value
- ✅ `fab-passport` — add examples of important context
- ✅ Schema — align `by_step.usd` → `by_step.estimated_usd`

## Deferred (TODOS)

- ❌ `scripts/score-quality.mjs` — low leverage, scoring works as-is
- ❌ Automated skill testing — ADR-006, post-MVP
- ❌ Skill versioning — ADR deferred
- ❌ Abandonment transition flow — edge case, low impact

---

---

## Section 13: CSO Security Posture Report

**Date:** 2026-06-19
**Mode:** Daily (8/10 confidence gate)
**Scope:** Full audit (all phases)
**Standalone artifact:** `.gstack/security-reports/2026-06-19-150000.json`

### Phase 0: Architecture Mental Model

fabrica-skills is a skills-only repository: 13 markdown files, 1 JSON schema, 1 JavaScript discovery script. No runtime server, no database, no SaaS, no network services, no user data, no authentication, no stored credentials. The only executable code is `scripts/link-skills.mjs` (file-system read/write within the repo). All 13 skills are agent prompt instructions — they define behavior but do not execute autonomously.

**Architecture summary:** Skill files read by an AI coding agent. Agent interprets `Behavior` sections as instructions. State is stored in `fabrica.run.json`. No code from the skills is ever executed by a web server, background job, or network service.

**Trust boundary:** Between the AI agent and the skill files. An attacker who could modify a SKILL.md could influence agent behavior (theoretically). This is the repo's only meaningful trust boundary.

### Phase 1: Attack Surface Census

```
ATTACK SURFACE MAP
══════════════════
CODE SURFACE
  Public endpoints:      0
  Authenticated:         0
  Admin-only:            0
  API endpoints:         0
  File upload points:    0
  External integrations: 0
  Background jobs:       0
  WebSocket channels:    0

INFRASTRUCTURE SURFACE
  CI/CD workflows:       0
  Webhook receivers:     0
  Container configs:     0
  IaC configs:           0
  Deploy targets:        0
  Secret management:     N/A — no services
```

**Finding:** Attack surface is effectively zero. No services, no endpoints, no network-connected infrastructure.

### Phase 2: Secrets Archaeology

- **Git history scanned (14 commits, all branches):** Zero matches for AWS keys, GitHub tokens, Slack tokens, API keys, or credential patterns.
- **`.env` tracked by git:** No — `.env` is in `.gitignore`.
- **CI configs with inline secrets:** No CI/CD workflows exist.
- **Placeholder `.env.example`:** Does not exist in the repo.

**Finding:** No secrets exposed in git history.

### Phase 3: Dependency Supply Chain

- **No package managers detected:** No `package.json`, `Gemfile`, `requirements.txt`, `pyproject.toml`, `Cargo.toml`, `go.mod`, or similar.
- **The only executable dependency is Node.js** (for `scripts/link-skills.mjs`), which uses only built-in modules (`fs`, `path`, `process`).
- **Zero third-party dependencies.** Supply chain attack surface is nil.

**Finding:** Zero dependencies, zero supply chain risk.

### Phase 4: CI/CD Pipeline Security

- **No CI/CD workflows exist:** No `.github/workflows/`, `.gitlab-ci.yml`, or `.circleci/config.yml`.

**Finding:** No pipeline to audit.

### Phase 5: Infrastructure Shadow Surface

- **No Dockerfiles** or container configs.
- **No Terraform** or K8s manifests.
- **No IaC configs** of any kind.
- **No database connection strings** in any file.
- **No staging/prod environment configs.**

**Finding:** No infrastructure surface.

### Phase 6: Webhook & Integration Audit

- **Zero webhook handlers** — no routes, no callbacks, no integration endpoints.
- **No TLS verification disabling patterns.**

**Finding:** No integration surface.

### Phase 7: LLM & AI Security

- **No `eval()`, `exec()`, `dangerouslySetInnerHTML`, `v‑html`, `raw()`** in any file.
- **No LLM tool/function calling definitions** in the codebase — skills are markdown instructions, not executable LLM tool schemas.
- **No AI API keys** in any file.
- **No user input flows** through system prompts or tool schemas (skills are static markdown read by the agent, not dynamic prompt construction).

**Finding:** No LLM security vulnerabilities. The repo does not contain or construct prompts at runtime — it is a static instruction set.

### Phase 8: Skill Supply Chain

All 13 SKILL.md files scanned for:
- Network exfiltration (`curl`, `wget`, `fetch`, `exfiltrat`) → **Zero matches**
- Credential access (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `process.env`) → **Zero matches**
- Prompt injection (`IGNORE PREVIOUS`, `system override`, `disregard`, `forget your instructions`) → **Zero matches**

**Finding:** All 13 skills are clean of suspicious patterns.

### Phase 9: OWASP Top 10

| Category | Applicable? | Finding |
|----------|-------------|---------|
| A01 Broken Access Control | No runtime | N/A |
| A02 Cryptographic Failures | No crypto in code | N/A |
| A03 Injection | No executable code paths (skills are static) | N/A |
| A04 Insecure Design | No design flaws identified | ✅ Clean |
| A05 Security Misconfiguration | No configurable services | N/A |
| A06 Vulnerable Components | Zero dependencies | ✅ Clean |
| A07 Authentication Failures | No auth in code | N/A |
| A08 Data Integrity Failures | No CI/CD, no deserialization | ✅ Clean |
| A09 Logging & Monitoring | Not applicable (no runtime) | N/A |
| A10 SSRF | No outbound requests in code | N/A |

### Phase 10: STRIDE Threat Model

**Components:** Only one component — the SKILL.md file set (plus `schemas/run-object.schema.json` and `scripts/link-skills.mjs`).

| Threat | Assessment |
|--------|------------|
| **Spoofing** | ✗ No identities, no auth, no impersonation surface. Not applicable. |
| **Tampering** | ✗ Skills are markdown in git. Tampering requires write access to the repo, which is already a root-level compromise. No in-transit tampering surface (no network). |
| **Repudiation** | ✅ Git history provides full audit trail. Every change is attributed. |
| **Info Disclosure** | ✗ No sensitive data stored or processed in the repo itself. |
| **DoS** | ✗ No services to overwhelm. Theoretical concern: large `fabrica.run.json` could slow agent, but this is a usability issue, not a security issue. |
| **Elevation of Privilege** | ✗ No privilege model exists. N/A. |

**Finding:** No STRIDE threats applicable to this repo.

### Phase 11: Data Classification

All data in this repo is **PUBLIC**:
- Skill definitions (agent instructions)
- JSON schema for run object
- Scripts for cross-platform linking
- Documentation (CONTEXT.md, README, PRD)

No RESTRICTED or CONFIDENTIAL data exists. The `.gstack/security-reports/` directory is local-only and not tracked by git.

### Phase 12: False Positive Filtering

**Confidence gate (8/10, daily mode):**
- 22 candidate patterns scanned across all phases
- 0 survived the initial pattern match (all phases produced zero candidates)
- 0 candidates to filter through Phase 12 gates

**Filter summary:** Zero findings to report. Every phase returned clean results consistent with the repo's nature (markdown-only, zero runtime, zero dependencies).

### Phase 13: Findings Report

```
SECURITY FINDINGS
═════════════════
#   Sev    Conf   Status      Category         Finding
──  ────   ────   ──────      ────────         ───────
(No findings — all phases returned clean)
```

**Security posture verdict:** The fabrica-skills repository has zero security findings across all 14 CSO audit phases. This is expected and correct for a markdown-only skills repository with no runtime, no dependencies, no network services, and no stored credentials.

**What this means:** The repo's security posture is appropriate for its threat model. The trust boundary is between the AI agent and the skill files — an attacker who can modify SKILL.md files (requires repo write access) could influence agent behavior. This is mitigated by git-based change tracking, code review, and the fact that skills are static instructions, not executable code.

### Protection file check

- `.gitleaks.toml` or `.secretlintrc`? → **Not found**
- `.gitignore` exists and covers `.env`, `fabrica.run.json`, `.skills/`, `__pycache__/`, build artifacts
- **Recommendation:** Not needed — the repo has no secrets to leak and no CI/CD pipeline. If a CI/CD pipeline is added later, add a `.gitleaks.toml` at that time.

### Remaining recommendations

| # | Recommendation | Severity | Rationale |
|---|---------------|----------|-----------|
| 1 | No action needed | Info | Current security posture is appropriate for repo threat model |
| 2 | If CI/CD is added later, add gitleaks scanning and `.gitleaks.toml` | Future | Prevents credential leaks once pipeline exists |

### Disclaimer

**This tool is not a substitute for a professional security audit.** /cso is an AI-assisted scan that catches common vulnerability patterns — it is not comprehensive, not guaranteed, and not a replacement for hiring a qualified security firm. LLMs can miss subtle vulnerabilities, misunderstand complex auth flows, and produce false negatives. For production systems handling sensitive data, payments, or PII, engage a professional penetration testing firm. Use /cso as a first pass to catch low-hanging fruit and improve your security posture between professional audits — not as your only line of defense.

---

## Open Questions

1. Should the manifest live at `skills/manifest.json` or be combined with `scripts/link-skills.mjs`?
2. Should `errors.json` per skill be a separate file or embedded in the manifest?
3. What's the priority order for implementing accepted fixes?
4. Should the `by_step.usd` → `estimated_usd` rename be a schema-only change, or does it need corresponding skill updates?



