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
