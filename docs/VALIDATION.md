# Validation evidence

Executable source of truth:

```bash
npm ci
npm run check
```

That runs schema fixtures, unit/integration tests, and lint.

Supplementary runbooks for checks that are not fully automated:

- `docs/TESTING_INFRA.md` — Node floor, concurrency, cross-environment drills
- `docs/AGENT_E2E_TESTS.md` — agent-driven behavioral scenarios

Operator workflow reference: `docs/STATE_MACHINE.md`.
