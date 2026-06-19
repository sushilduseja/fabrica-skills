---
name: fab-pulse
description: Render current pipeline, quality, cost, and next action as an inline terminal dashboard.
category: core
phase: 1
---

## Job

Show the operator the current run state in a single glance.

## Trigger

Operator wants current run state.

## Prerequisites

- `fabrica.run.json` exists

## Input

- `fabrica.run.json` (required)
- `mode` (optional): `summary` (default) or `details`. Details mode adds a COST DETAILS section.

## Output

Inline terminal-style dashboard. No files written.

## Behavior

1. Read `fabrica.run.json`.
2. Render three panels: PIPELINE, QUALITY, COST.
3. Pipeline panel: for each skill, show icon (done/active/pending/blocked/failed) and status.
4. Quality panel: for each app stage, show name, quality_score, status, and key artifacts.
5. Cost panel: show precision, tokens_in, tokens_out, estimated_usd. Display `unknown` for missing values.
6. If `mode=details` or any `costs.by_step` entry exceeds 20% of known spend, render a COST DETAILS section below the main dashboard: show per-step breakdown with precision, tokens, and usd for each. Flag steps above 20% of total. If precision is unknown, state what data is missing instead of inventing numbers. Provide one concrete cost-reduction suggestion only when total cost is known or estimated.
7. Render `next_action` prominently at the bottom.
8. Highlight blocked or failed items in red.
9. Do not modify any files.

## Error Handling

- `missing_input`: Run object missing → halt, suggest `/fab-intake`.
- `invalid_state`: Run object corrupted → show last valid state, suggest restore.

## Reference Layout

```
fabrica — run: <name> — <phase>

PIPELINE                    QUALITY            COST
fab-intake        done      spec fit   9.0     estimated usd  unknown
fab-blueprint     done      contract   8.5     tokens in      unknown
fab-frame         done      tests      —       tokens out     unknown
fab-forge:parse   active    parse      —       precision      unknown
fab-check:parse   pending   blocked    0

next: /fab-forge parse-invoice-text
```

## Gate

**Default:** auto
**Overridable:** no

## Run Object Updates

None (read-only).
