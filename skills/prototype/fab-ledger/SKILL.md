---
name: fab-ledger
description: Show cost breakdown with precision level and per-step estimates.
category: prototype
phase: 2
---

## Job

Display cost data from the run object: precision level, totals, and per-step breakdown.

## Trigger

Operator wants cost review.

## Input

- `fabrica.run.json` (required)

## Output

Inline cost report. No files written.

## Behavior

1. Show cost precision: unknown, estimated, or measured.
2. Show totals and per-step breakdown when available.
3. Flag any step above 20% of known spend.
4. If precision is unknown, state what data is missing instead of inventing numbers.
5. Provide one concrete cost-reduction suggestion only when total cost is known or estimated.
6. Do not modify files.

## Gate

**Default:** auto
**Overridable:** no

## Run Object Updates

None (read-only).
