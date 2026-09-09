# Release harness matrix (manual)

Automated tests assert that `SKILL.md` files are copied. Only a fresh agent
session proves a slash command resolves. Run this matrix before each release,
on Windows from a clean directory.

## Per-harness steps

Repeat for each harness (`agents`, `claude`, `cursor`, `codex`, `opencode`):

1. Create a clean directory and open it in the harness under test.
2. Install for that harness only:
   `npx fabrica-skills@latest install --agent=<name>`
3. Confirm the success message names the exact command path, the restart
   step, and `doctor`; run `npx fabrica-skills@latest doctor --agent=<name>`
   and confirm it reports ready.
4. Restart/reload the harness session (skills load at session start).
5. In the fresh session, invoke:
   `/fab-spec` with the TaskFlow prompt from
   `examples/fabrica-skills-QUICKSTART.md`.
6. Confirm `/fab-spec` runs the spec intake, stops at its default checkpoint,
   writes no app source, and sets `next_action: /fab-plan`.
7. Invoke `/fab-plan` separately and confirm its independent checkpoint.
8. Record pass/fail per harness below.

## Result log

| Harness | Install + doctor | `/fab-spec` checkpoint | `/fab-plan` checkpoint | No source before approvals (non-`--auto`) |
|---|---|---|---|---|
| agents | | | | |
| claude | | | | |
| cursor | | | | |
| codex | | | | |
| opencode | | | | |

## Auto-mode confirmation

In one harness, repeat with `init-run --auto` and confirm
only the documented automatic progression (spec, plan, integrate proceed;
`/fab-verify` and `/fab-decide` still stop).

## Non-auto gate fixtures (greenfield + existing-project)

Run in one harness per track. Document pass/fail per row; do not fake
unit tests of the model.

| Case | Expect |
|---|---|
| Non-auto, rich idea text | Questions first (multiple-choice + custom); no `docs/spec.md` write |
| Non-auto, blank stack replies | Defaults applied; labeled default in artifacts |
| Non-auto, reject spec | No run-state advance; no durable spec |
| Non-auto, approve spec then reject plan | Spec retained; no blueprint / no scaffold or adopt |
| Auto | Writes allowed without approval wait; blueprint log has `auto` rows |
| Existing non-auto without profile | Halt; no spec under `docs/fabrica/` |
| Existing non-auto with profile | Questions change-scoped; paths under `docs/fabrica/` only |

For the existing-project track, use `init-existing-run` and confirm
`/fab-discover` (profile) precedes `/fab-spec`, and `/fab-adopt` never
scaffolds. Assert no application source or phase artifact is written
before the corresponding explicit approval, and each resulting
`next_action` is correct.
