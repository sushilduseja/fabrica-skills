# Agent-Executed Manual Tests

Behavioral specs with no executable enforcement — they are carried out by an AI
agent reading the markdown skills in `.skills/`. Run these by hand and record the
observed output against the expected output at each step. Use a disposable clone.

## Setup

```bash
git clone https://github.com/sushilduseja/fabrica-skills.git
cd fabrica-skills
npm ci
npm run setup
```

Point your agent's skill path at `.skills/`. Use `/fab-*` slash commands if your
agent supports them; otherwise ask it to follow the matching `SKILL.md` files.
Record every step's agent output in a scratch file for the audit trail.

## A. fab-fix recovery loop (plan item 29)

1. Drive a run to a failing stage: `/fab-spec` → `/fab-plan` →
   `/fab-scaffold` → `/fab-build parse-input` where `parse-input` has a failing test.
2. Trigger `/fab-fix parse-input`.
3. Expected, in order:
   - The agent first reports the root cause from the stage's logs/artifacts
     before proposing any fix (root-cause-first; no shotgun edits).
   - It applies the smallest viable fix.
   - It re-runs the previously failing check and shows it now passes
     (regression proof).
   - It resumes the pipeline via the updated `next_action`.
4. Expected state after: `fabrica.run.json` `last_error.type` is one of the
   schema enum values, `app_stages` for the stage is `active` or `done`, and
   `next_action` points forward. Run `node scripts/validate-run.mjs fabrica.run.json`
   and confirm exit 0.

Pass when: steps 3 and 4 hold. Record the agent's reported root cause.

## B. Handoff resumability across a cold session (plan item 30)

1. Mid-run, run `/fab-handoff`.
2. Expected: `docs/handoff.md` is written by temp-file-then-rename (no leftover
   `docs/.tmp*` files), states the run status in one line, lists completed steps,
   app stages, artifacts, verifications, decisions, and blockers, and includes the
   exact `next_action` as copyable text — not executed.
3. Cold-session test: start a brand-new agent pointed at the same checkout and
   give it only `docs/handoff.md` (not this conversation). Ask it to resume.
   Expected: it continues from `next_action` without asking what happened.
4. Confirm `/fab-handoff` modified no run-object field (`fabrica.run.json`
   unchanged; it is read-only for run state by design).

Pass when: steps 2–4 hold.

## C. Partial-run interruption and resume (plan item 31)

1. During a `/fab-build` implementation, interrupt the agent mid-write.
2. Expected: `fabrica.run.json` is either the pre-run state or fully written —
   never truncated half-JSON. Run `node scripts/validate-run.mjs fabrica.run.json`
   and confirm it either validates or reports a clear, parseable error (never a
   stack trace).
3. If interrupted during a `/fab-handoff` write: `docs/handoff.md` is either the
   old or the new version, never partial.
4. Resume with a fresh session using the handoff; expect continuity from the last
   completed step.

Pass when: steps 2–4 hold. Record the interruption point.

## D. fab-status rendering across precision states (plan item 33)

For each state, first run `node scripts/validate-run.mjs fabrica.run.json` to
confirm the run object is valid, then run `/fab-status`.

1. `costs.precision = "unknown"`, all cost fields `"unknown"`.
   Expected: COST panel shows `unknown` for every cost value; the agent never
   invents token, call, or dollar figures.
2. `costs.precision = "estimated"` with numeric token counts.
   Expected: COST panel shows the numbers labeled estimated; a COST DETAILS
   section appears only when a `costs.by_step` entry exceeds 20% of known spend;
   at most one concrete cost-reduction suggestion, only when total cost is known
   or estimated.
3. `costs.precision = "measured"` with numeric token counts.
   Expected: COST panel shows exact figures; downgrading precision back to
   `unknown` without clearing the numbers is rejected by the validator (already
   covered by the automated suite) — the agent must clear numerics on downgrade.

Pass when: the rendered dashboard matches the expected panel for each state and
no file was modified by `/fab-status` (it is read-only).

## Status

- [ ] A. fab-fix loop
- [ ] B. cold-session handoff
- [ ] C. partial-run interruption
- [ ] D. fab-status three states

## Execution Tracking

Do **not** mark the overall test suite "complete" in any summary doc until every row
below has at least one dated execution with a recorded result.

| Item | Last executed | Result |
|---|---|---|
| fab-fix recovery loop | — (pending) | pending |
| Cold-session handoff resumability | — (pending) | pending |
| Kill-mid-fab-build recovery | — (pending) | pending |
| fab-status rendering across precision states | — (pending) | pending |