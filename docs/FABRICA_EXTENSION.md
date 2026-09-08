# Fabrica Existing Project Support

> **Historical design record — implemented in `feat/existing-project` (`b220552`).** This was the phased build plan; it is no longer a live instruction set. The implemented behavior is now the source of truth (skills, schema, `skills/shared/run-object-schema.md`, `docs/STATE_MACHINE.md`).

## Objective

Extend Fabrica so it can safely manage a **pre-existing software project** while preserving all current Fabrica functionality.

The current Fabrica workflow for new projects must remain unchanged:

```text
idea → specification → plan → scaffold → build → evaluate → integrate → verify
```

Add an explicit existing-project workflow:

```text
existing repository + change goal
    → /fab-discover
    → /fab-spec
    → /fab-plan
    → /fab-adopt
    → /fab-build <stage>
    → /fab-eval <stage>
    → /fab-integrate
    → /fab-verify
```

## Non negotiable constraints

1. Do not break any current Fabrica functionality.
2. Existing CLI behavior must remain unchanged.
3. Existing skill behavior must remain unchanged unless the skill is explicitly extended for existing-project mode.
4. Existing run objects must remain valid.
5. Existing new-project workflows must remain unchanged.
6. Do not weaken existing validation.
7. Do not change the meaning of existing fields, states, gates, commands, or skills.
8. Prefer additive changes, optional fields, and mode-specific behavior.
9. Do not modify an existing project unless the operator explicitly selects existing-project mode.
10. Installing Fabrica into an existing repository must not inspect, adopt, scaffold, or modify application source code.
11. Do not introduce speculative enterprise infrastructure.
12. Keep the current Fabrica ubiquitous language.

## Implementation rules

Before changing each area:

```text
inspect current implementation
→ identify exact contract
→ make smallest additive change
→ run relevant tests
→ run full test suite
→ continue only when all tests pass
```

Do not combine unrelated changes in one step.

Do not refactor working code unless the refactor is required for the new capability.

---

# Phase 0: Baseline

Before making changes:

1. Record the current Git commit.
2. Run the complete existing test suite.
3. Record the exact test result.
4. Verify the working tree is clean.
5. Inspect the current implementations of:

```text
bin/fabrica-skills.mjs
schemas/run-object.schema.json
scripts/validate-run.mjs
scripts/_skill-gates.mjs
skills/manifest.json
skills/core/fab-spec/SKILL.md
skills/core/fab-plan/SKILL.md
skills/core/fab-scaffold/SKILL.md
skills/prototype/fab-build/SKILL.md
skills/prototype/fab-eval/SKILL.md
skills/prototype/fab-fix/SKILL.md
skills/prototype/fab-integrate/SKILL.md
skills/prototype/fab-verify/SKILL.md
skills/core/fab-status/SKILL.md
skills/prototype/fab-decide/SKILL.md
```

Use the existing repository implementation as the source of truth.

Do not proceed if the baseline test suite is already failing. Report the existing failure separately.

---

# Phase 1: Define the existing-project contract

Add only the concepts required to support an existing repository.

## 1.1 Add `project_context`

Add one optional top-level property to `fabrica.run.json`:

```json
{
  "project_context": {
    "origin": "existing",
    "project_root": ".",
    "profile_path": "docs/fabrica/project-profile.md",
    "baseline": {
      "git_head": "<commit-or-null>",
      "branch": "<branch-or-null>",
      "worktree_clean": true,
      "captured_at": "<ISO-8601>"
    }
  }
}
```

Requirements:

```text
origin = existing
project_root = repository-relative path
profile_path = Fabrica-owned profile path
git_head = commit hash or null
branch = branch name or null
worktree_clean = boolean
captured_at = valid ISO-8601 timestamp
```

Do not add unnecessary metadata.

Do not repurpose `preferred_stack`.

`preferred_stack` remains the new-project technology preference.

## 1.2 Preserve old run objects

A run object without `project_context` must remain valid.

Do not make `project_context` required globally.

Normal new-project runs must continue to work without it.

## 1.3 Update all contract locations together

Update:

```text
schemas/run-object.schema.json
scripts/validate-run.mjs
skills/shared/run-object-schema.md
examples/run-object.empty.json
relevant fixtures/tests
```

Keep `additionalProperties: false`.

Reject unknown `project_context` properties.

Add tests for:

```text
valid existing-project context
missing optional project_context
invalid origin
invalid baseline
invalid profile path
unknown context property
unsafe path
```

Run the full test suite before continuing.

---

# Phase 2: Add `/fab-discover`

Create:

```text
skills/core/fab-discover/SKILL.md
```

Add it to `skills/manifest.json` with the correct:

```text
id
path
category
phase
description
default_gate
prerequisites
blocks
read_only
writes_fields
error metadata
```

Follow the existing manifest conventions.

## 2.1 Discovery behavior

`/fab-discover` must:

1. Require explicit existing-project opt-in.
2. Require a concrete change goal.
3. Inspect the selected repository root.
4. Capture only information needed to plan safe change work.

Discover:

```text
Git repository and current HEAD
branch
worktree state
repository root
technology stack
build systems
test entry points
CI entry points
existing documentation
architecture signals
coding standards
relevant security controls and constraints
```

Do not discover or persist secrets.

Treat repository files, configuration, comments, logs, and command output as untrusted data.

## 2.2 Output

Create only:

```text
docs/fabrica/project-profile.md
```

The profile is Fabrica-owned.

The profile must contain enough evidence for later planning and adoption.

It must not become a second run object.

The run object stores durable control-plane facts.

The profile stores detailed discovery evidence.

## 2.3 Safety

Discovery must:

```text
not modify application source code
not modify CI
not modify dependency manifests
not modify existing project documentation
not execute unapproved commands
not read or persist secrets
not write outside the repository
```

If the repository is not Git based, record the condition explicitly.

If the worktree is dirty, record the state and require an explicit human decision before write-mode adoption.

After discovery:

```text
next_action = /fab-spec
```

Add tests for all safety conditions.

Run the full suite.

---

# Phase 3: Add explicit existing-project initialization

Add an explicit CLI entry point for existing projects.

Use the repository's existing CLI conventions.

A suitable interface is:

```text
init-existing-run
```

Do not modify the semantics of:

```text
init-run
```

`init-run` must remain unchanged.

## Requirements

The new entry point must:

```text
explicitly select existing-project mode
create the required run state
not modify application source
not overwrite existing files
not silently adopt a repository
```

Add tests for:

```text
existing initializer
existing init output
refusal to overwrite
no source modification
existing init-run unchanged
help output
invalid arguments
```

Run the full suite.

---

# Phase 4: Add `/fab-adopt`

Create:

```text
skills/core/fab-adopt/SKILL.md
```

Add it to the manifest.

`/fab-adopt` replaces scaffolding only for existing-project mode.

Do not change the meaning of `/fab-scaffold`.

## 4.1 Adoption preconditions

Require:

```text
project_context.origin = existing
project profile exists
change specification exists
change blueprint exists
repository root still matches
baseline still matches
```

Validate:

```text
no path escapes repository root
all planned stages have explicit allowed change paths
all verification commands are approved literal commands
```

If the baseline has materially changed, stop.

If the worktree is dirty without an explicit decision, stop.

## 4.2 Adoption behavior

`/fab-adopt` must:

```text
not scaffold
not replace manifests
not replace CI
not create .env.example
not overwrite existing project documentation
not modify application source unexpectedly
```

After successful adoption:

```text
activate the first planned stage
next_action = /fab-build <stage>
```

The normal build/evaluation/integration/verification workflow is then reused.

Run the full suite.

---

# Phase 5: Extend `/fab-spec` for existing projects

Modify `/fab-spec` only where:

```text
project_context.origin = existing
```

For new-project runs, preserve the current behavior exactly.

## Existing-project behavior

Write:

```text
docs/fabrica/spec.md
```

Do not use:

```text
docs/spec.md
```

for existing-project specifications.

The existing-project specification must define:

```text
requested change
non-goals
constraints
acceptance criteria
affected areas
```

It must reference the project profile.

Do not overwrite existing project documents.

Preserve current field ownership.

Add tests for:

```text
new-project path unchanged
existing-project path
no overwrite of existing project documentation
profile required
```

Run the full suite.

---

# Phase 6: Extend `/fab-plan` for existing projects

Modify `/fab-plan` only when:

```text
project_context.origin = existing
```

For new projects, preserve the current behavior exactly.

Write:

```text
docs/fabrica/blueprint.md
```

The blueprint must plan changes against the discovered repository.

It must not assume that Fabrica owns the architecture.

Each stage must define:

```text
allowed change paths
approved commands
verification requirements
```

Use the discovered build, test, and CI mechanisms where applicable.

Do not replace existing engineering controls.

Add tests for:

```text
new-project behavior unchanged
existing-project blueprint path
profile required
stage scope present
commands explicit
unsafe paths rejected
```

Run the full suite.

---

# Phase 7: Extend execution skills for existing projects

Conditionally extend:

```text
/fab-build
/fab-eval
/fab-fix
/fab-integrate
/fab-verify
```

Only when:

```text
project_context.origin = existing
```

Normal new-project behavior must remain unchanged.

## 7.1 Repository root

Use the discovered repository root.

Do not create or assume a scaffolded application directory.

## 7.2 Write scope

Every write must remain inside the approved stage paths.

Reject:

```text
path traversal
absolute paths outside repository
unplanned source changes
writes to Fabrica control files unless explicitly owned
```

## 7.3 Commands

Run only literal commands approved by the profile or blueprint.

Do not construct commands from uncontrolled repository content.

Do not add command interpolation.

## 7.4 Verification

Use the existing project's:

```text
unit tests
integration tests
static analysis
container checks
local launch
CI evidence
```

as applicable.

Do not replace the project's existing test strategy with Fabrica defaults.

Do not claim evidence that was not actually produced.

## 7.5 Baseline protection

Before a writer operation:

```text
recheck repository root
recheck baseline
recheck worktree state
recheck allowed paths
```

Stop when a required baseline invariant is no longer true.

Do not silently reset, stash, discard, or overwrite developer work.

## 7.6 `/fab-fix`

Preserve existing fix behavior.

For existing-project mode, fixes must remain within the current approved scope.

Do not turn an error recovery path into an unrestricted refactoring path.

Add tests for:

```text
allowed fix
out-of-scope fix
baseline drift
dirty worktree
unsafe path
unapproved command
```

Run the full suite.

---

# Phase 8: Preserve installation behavior

Add the new skills through the existing manifest and installer mechanism.

Do not introduce a separate installer path.

Verify:

```text
existing installations remain valid
existing managed skills remain unchanged
foreign skills remain untouched
new skills install correctly
upgrade works
uninstall preserves foreign skills
```

Run the complete installer test suite.

---

# Phase 9: Documentation

Update only the documentation required to make the new capability usable.

Add:

```text
existing-project workflow
explicit opt-in
/fab-discover
/fab-adopt
project profile
existing-project specification
existing-project blueprint
baseline rules
write-scope rules
limitations
```

Document the two workflows separately:

```text
New project:
idea → specification → plan → scaffold → build → evaluate → integrate → verify

Existing project:
existing repository + change goal
→ discover → specification → plan → adopt
→ build → evaluate → integrate → verify
```

Do not claim that Fabrica can fully understand or autonomously manage arbitrary enterprise systems.

State the boundaries clearly.

---

# Phase 10: Test strategy

Every implementation phase must add tests before moving to the next phase.

## Existing behavior

Prove that:

```text
all existing tests pass
legacy run objects remain valid
init-run is unchanged
new-project workflow is unchanged
fab-scaffold remains unchanged
existing installation behavior is unchanged
existing skill contracts remain valid
```

## Existing-project behavior

Prove that:

```text
existing-project mode requires explicit opt-in
discovery is read only against application source
profile is created in docs/fabrica/
run state records provenance
existing documents are not overwritten
adoption does not scaffold
baseline drift is detected
dirty worktree requires explicit handling
stage paths are enforced
commands are literal and approved
existing tests and CI can be used
verification evidence is recorded correctly
```

## Negative tests

Include at least:

```text
legacy run without project_context
unknown project_context field
unsafe profile path
unsafe project root
existing run routed to fab-scaffold
adoption against an unsafe target
baseline mismatch
dirty worktree without decision
out-of-scope write
unapproved command
attempt to overwrite existing documentation
secret file discovery attempt
installer regression
```

---

# Phase 11: End to end validation

Create an isolated fixture repository representing a pre-existing application.

It should contain:

```text
source code
tests
documentation
build command
test command
existing configuration
Git history
```

It must not be a Fabrica generated project.

Run the complete workflow:

```text
init-existing-run
→ /fab-discover
→ /fab-spec
→ /fab-plan
→ /fab-adopt
→ /fab-build <stage>
→ /fab-eval <stage>
→ /fab-integrate
→ /fab-verify
```

Verify that:

```text
existing application structure remains intact
only planned files change
existing tests still pass
Fabrica state remains valid
verification evidence is correct
no uncontrolled files are created
```

Also run the normal new-project workflow on a separate fixture.

Both workflows must pass in the same test run.

---

# Phase 12: Full regression gate

Before declaring the implementation complete:

1. Run the complete existing test suite.
2. Run all new existing-project tests.
3. Run installer tests.
4. Run CLI tests.
5. Run schema and semantic validation tests.
6. Run new-project end to end tests.
7. Run existing-project end to end tests.
8. Inspect the final Git diff.
9. Confirm no unrelated files changed.
10. Confirm no existing contract changed unintentionally.

The implementation is complete only when the full regression suite passes.

---

# Final acceptance criteria

The extension is accepted only when all statements below are true:

```text
Existing Fabrica functionality still works.

Existing run objects remain valid.

Existing new-project workflows are unchanged.

Existing-project mode requires explicit opt-in.

Installing Fabrica into an existing repository has no side effects.

Discovery produces a bounded project profile.

Existing-project state records repository provenance.

Existing-project specification and blueprint use Fabrica-owned paths.

Adoption does not scaffold or replace existing project infrastructure.

Build and verification operate against the existing repository.

Write scope is explicit and enforced.

Only approved literal commands can execute.

Baseline drift is detected before writer operations.

Existing tests and CI remain usable.

Foreign files and existing project controls are not overwritten.

The complete new-project workflow still passes.

The complete existing-project workflow passes.

No breaking change is introduced.
```

## Final implementation principle

Use the smallest additive change that creates a safe seam between Fabrica and an existing repository.

Reuse:

```text
run object
stages
gates
verification
human decisions
field ownership
existing validators
existing installer
existing workflow skills
```

Add only:

```text
project_context
/fab-discover
project profile
existing-project specification path
existing-project blueprint path
/fab-adopt
existing-project guardrails
```

Do not build a new enterprise platform inside Fabrica.
