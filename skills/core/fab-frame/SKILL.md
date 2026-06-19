---
name: fab-frame
description: Create project skeleton and first-stage contracts for a named app.
category: core
phase: 1
---

## Job

Scaffold the app project directory, stub files with correct signatures, dependency manifest, and cross-platform build commands.

## Trigger

Blueprint confirmed (`status = framing` in run object, `docs/blueprint.md` exists).

## Prerequisites

- `fab-blueprint` complete
- `docs/blueprint.md` exists
- `fabrica.run.json` exists

## Input

- `docs/blueprint.md` (required)
- `fabrica.run.json` (required)

## Output

- App project skeleton in sibling directory `../<app-name>/`
- Stub files with correct signatures, no implementation logic
- Dependency manifest (`pyproject.toml`, `requirements.txt`)
- `.env.example` for required environment variables
- Cross-platform commands (`Makefile` for POSIX, `package.json` for Windows/Universal)

## Behavior

1. Read `app_stages` from run object. Identify the first stage.
2. Create the app project root at `../<name>/` (sibling to the skills repo).
3. Create only the folders needed for the first app stage plus shared contracts.
4. Write stub Python files with correct function signatures, imports, and docstrings — no implementation logic.
5. Add `pyproject.toml` and `requirements.txt` for the selected stack.
6. Write `.env.example` only for required environment variables (e.g. `OLLAMA_HOST`).
7. Add a `Makefile` with targets: `install` (`pip install -e .`), `test`, `run`, `lint`.
8. Add a `package.json` with equivalent `scripts` for Windows users:
   - `"install": "pip install -e ."`
   - `"test": "pytest invoice_parser/tests/ -v"`
   - `"run": "python -m invoice_parser.cli"`
   - `"lint": "python -m flake8 invoice_parser/"`
9. Update `status = forging`, set first stage `status = active`, set `current_app_stage` to the stage name, set `next_action = "/fab-forge <first-stage-name>"`.
10. Run `node <fabrica-skills>/scripts/validate-run.mjs` (convention — see CLAUDE.md).

## Error Handling

- `prerequisite_missing`: Blueprint not confirmed → halt, suggest `/fab-blueprint` first.
- `invalid_state`: Project skeleton already exists → warn, offer to overwrite or skip.

## Gate

**Default:** auto
**Overridable:** yes

## Run Object Updates

- `status`, `current_app_stage`, `app_stages[].status`, `next_action`
- `current_step = "fab-frame"`
- `updated_at`
- Run object location moved to app project root (see Behavior step 8)
