import assert from 'assert';
import { readFileSync } from 'fs';
import { assertFail, assertNoStackTrace, combined, readJson, test, validateStdin, runAll } from './_harness.mjs';
import {
  resolveGateLevel,
  validateFabLaunchGate,
  validateFabSignalGate,
  validateFabCheckGate,
  validateFabPulseGate,
  validateNextActionGate,
  validateTimestampOrderGate,
  validateCostPrecisionGate,
} from '../scripts/_skill-gates.mjs';

/* ================================================================
 *  Unit-level: direct calls to each gate validator
 *  These test the logic in isolation without spawning validate-run.
 * ================================================================ */

test('fab-verify gate: external_deploy without human approval is rejected', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.verifications = [
    {
      kind: 'external_deploy',
      command: 'deploy.sh',
      passed: true,
      summary: 'deploy',
      timestamp: '2026-06-19T12:30:00Z',
    },
  ];
  const errors = validateFabLaunchGate(run);
  assert(errors.length > 0, 'expected gate to reject external_deploy without approval');
  assert(errors[0].includes('external_deploy'), errors[0]);
});

test('fab-verify gate: external_deploy WITH human approval is accepted', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.verifications = [
    {
      kind: 'external_deploy',
      command: 'deploy.sh',
      passed: true,
      summary: 'deploy',
      timestamp: '2026-06-19T12:30:00Z',
    },
  ];
  run.human_decisions = [
    {
      step: 'fab-verify',
      decision_needed: 'Deploy?',
      options: ['continue', 'abandon'],
      decision: 'continue',
      rationale: 'ok',
      triggered_at: '2026-06-19T12:00:00Z',
      resolved_at: '2026-06-19T12:01:00Z',
    },
  ];
  const errors = validateFabLaunchGate(run);
  assert.strictEqual(errors.length, 0, `unexpected errors: ${JSON.stringify(errors)}`);
});

test('fab-verify gate: container_build without Docker command is rejected', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.verifications = [
    {
      kind: 'container_build',
      command: 'node scripts/lint-dockerfiles.mjs',
      passed: true,
      summary: 'lint',
      timestamp: '2026-06-19T12:30:00Z',
    },
  ];
  const errors = validateFabLaunchGate(run);
  assert(errors.length > 0, 'expected gate to reject container_build without Docker command');
  assert(errors[0].includes('does not invoke Docker'), errors[0]);
});

test('fab-verify gate: complete state requires launch verification', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.status = 'complete';
  run.experiment_phase = 'phase_2_pipeline';
  run.app_stages = [
    { name: 'api', purpose: 'Build API', status: 'done', quality_score: 8, artifacts: ['src/api.js'], notes: null },
  ];
  run.verifications = [];
  const errors = validateFabLaunchGate(run);
  assert(errors.length > 0, 'expected gate to reject complete without launch verification');
  assert(errors[0].includes('no local_launch or container_build verification'), errors[0]);
});

test('fab-decide gate: decision with value but no resolved_at is rejected', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.human_decisions = [
    {
      step: 'fab-decide',
      decision_needed: 'Continue?',
      options: ['continue', 'abandon'],
      decision: 'continue',
      rationale: null,
      triggered_at: '2026-06-19T12:00:00Z',
      resolved_at: null,
    },
  ];
  const errors = validateFabSignalGate(run);
  assert(errors.length > 0, 'expected gate to reject auto-populated decision');
  assert(errors[0].includes('no resolved_at'), errors[0]);
});

test('fab-decide gate: pending decision (null value) is accepted', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.human_decisions = [
    {
      step: 'fab-decide',
      decision_needed: 'Continue?',
      options: ['continue', 'abandon'],
      decision: null,
      rationale: null,
      triggered_at: '2026-06-19T12:00:00Z',
      resolved_at: null,
    },
  ];
  const errors = validateFabSignalGate(run);
  assert.strictEqual(errors.length, 0, `pending decision should be accepted: ${JSON.stringify(errors)}`);
});

test('fab-decide gate: properly resolved decision is accepted', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.human_decisions = [
    {
      step: 'fab-decide',
      decision_needed: 'Continue?',
      options: ['continue', 'abandon'],
      decision: 'continue',
      rationale: 'Looks good',
      triggered_at: '2026-06-19T12:00:00Z',
      resolved_at: '2026-06-19T12:01:00Z',
    },
  ];
  const errors = validateFabSignalGate(run);
  assert.strictEqual(errors.length, 0, `resolved decision should be accepted: ${JSON.stringify(errors)}`);
});

test('fab-eval gate: sub-threshold quality_score (< 6) with status "done" is rejected', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.app_stages = [
    { name: 'api', purpose: 'Build API', status: 'done', quality_score: 5, artifacts: ['src/api.js'], notes: null },
  ];
  const errors = validateFabCheckGate(run);
  assert(errors.length > 0, 'expected gate to reject sub-threshold stage marked done');
  assert(errors[0].includes('quality_score 5'), errors[0]);
});

test('fab-eval gate: sub-threshold stage with status "blocked" is accepted', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.app_stages = [
    { name: 'api', purpose: 'Build API', status: 'blocked', quality_score: 5, artifacts: ['src/api.js'], notes: null },
  ];
  const errors = validateFabCheckGate(run);
  assert.strictEqual(errors.length, 0, `blocked stage with low score should be accepted: ${JSON.stringify(errors)}`);
});

test('fab-eval gate: high-scoring stage is accepted regardless of status', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.app_stages = [
    { name: 'api', purpose: 'Build API', status: 'done', quality_score: 8, artifacts: ['src/api.js'], notes: null },
  ];
  const errors = validateFabCheckGate(run);
  assert.strictEqual(errors.length, 0, `high-scoring done stage should be accepted: ${JSON.stringify(errors)}`);
});

test('fab-status gate: precision "unknown" with numeric cost field is rejected', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.costs = {
    precision: 'unknown',
    tokens_in: 100,
    tokens_out: 'unknown',
    api_calls: 'unknown',
    estimated_usd: 'unknown',
    budget_usd: null,
    by_step: {},
  };
  const errors = validateFabPulseGate(run);
  assert(errors.length > 0, 'expected gate to reject unknown precision with numeric tokens_in');
  assert(errors[0].includes('tokens_in'), errors[0]);
});

test('fab-status gate: all-unknown costs are accepted', () => {
  const run = readJson('test/fixtures/valid-run.json');
  const errors = validateFabPulseGate(run);
  assert.strictEqual(
    errors.length,
    0,
    `valid fixture with all-unknown costs should be accepted: ${JSON.stringify(errors)}`,
  );
});

/* ================================================================
 *  Integration-level: gate validators wired through validate-run --stdin
 *  These verify the full pipeline (schema → semantic → gate).
 * ================================================================ */

test('validate-run rejects external_deploy missing human approval (fab-verify gate)', () => {
  const valid = readJson('test/fixtures/valid-run.json');
  valid.verifications = [
    {
      kind: 'external_deploy',
      command: 'deploy.sh',
      passed: true,
      summary: 'deploy',
      timestamp: '2026-06-19T12:30:00Z',
    },
  ];
  const result = validateStdin(valid);
  assertFail(result);
  assert(combined(result).includes('external_deploy'), combined(result));
  assert(combined(result).includes('gate contract'), combined(result));
  assertNoStackTrace(result);
});

test('validate-run rejects auto-decided decision (fab-decide gate)', () => {
  const valid = readJson('test/fixtures/valid-run.json');
  valid.human_decisions = [
    {
      step: 'fab-decide',
      decision_needed: 'Continue?',
      options: ['continue', 'abandon'],
      decision: 'continue',
      rationale: null,
      triggered_at: '2026-06-19T12:00:00Z',
      resolved_at: null,
    },
  ];
  const result = validateStdin(valid);
  assertFail(result);
  assert(combined(result).includes('no resolved_at'), combined(result));
  assert(combined(result).includes('gate contract'), combined(result));
  assertNoStackTrace(result);
});

test('validate-run rejects sub-threshold stage marked done (fab-eval gate)', () => {
  const valid = readJson('test/fixtures/valid-run.json');
  valid.app_stages = [
    { name: 'api', purpose: 'Build API', status: 'done', quality_score: 4.5, artifacts: ['src/api.js'], notes: null },
  ];
  const result = validateStdin(valid);
  assertFail(result);
  assert(combined(result).includes('quality_score 4.5'), combined(result));
  assert(combined(result).includes('gate contract'), combined(result));
  assertNoStackTrace(result);
});

test('validate-run rejects unknown precision with numeric cost (fab-status gate)', () => {
  const valid = readJson('test/fixtures/valid-run.json');
  valid.costs = {
    precision: 'unknown',
    tokens_in: 100,
    tokens_out: 'unknown',
    api_calls: 'unknown',
    estimated_usd: 'unknown',
    budget_usd: null,
    by_step: {},
  };
  const result = validateStdin(valid);
  assertFail(result);
  assert(combined(result).includes('tokens_in'), combined(result));
  assert(combined(result).includes('gate contract'), combined(result));
  assertNoStackTrace(result);
});

/* ================================================================
 *  Test 4 — next_action rule enforcement
 * ================================================================ */

test('next-action gate: fab-integrate next_action with pending stage is rejected', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.status = 'weaving';
  run.experiment_phase = 'phase_2_pipeline';
  run.next_action = '/fab-integrate';
  run.app_stages = [
    { name: 'api', purpose: 'Build API', status: 'pending', quality_score: null, artifacts: [], notes: null },
  ];
  const errors = validateNextActionGate(run);
  assert(errors.length > 0, 'expected gate to reject fab-integrate with pending stage');
  assert(errors[0].includes('fab-integrate'), errors[0]);
  assert(errors[0].includes('pending'), errors[0]);
});

test('next-action gate: fab-integrate next_action with all stages done is accepted', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.status = 'weaving';
  run.experiment_phase = 'phase_2_pipeline';
  run.next_action = '/fab-integrate';
  run.app_stages = [
    { name: 'api', purpose: 'Build API', status: 'done', quality_score: 8, artifacts: ['src/api.js'], notes: null },
  ];
  const errors = validateNextActionGate(run);
  assert.strictEqual(errors.length, 0, `unexpected errors: ${JSON.stringify(errors)}`);
});

test('next-action gate: fab-verify next_action without verifying status is rejected', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.next_action = '/fab-verify';
  run.status = 'weaving';
  const errors = validateNextActionGate(run);
  assert(errors.length > 0, 'expected gate to reject fab-verify without verifying status');
  assert(errors[0].includes('fab-verify'), errors[0]);
  assert(errors[0].includes('verifying'), errors[0]);
});

test('next-action gate: fab-verify next_action with verifying status is accepted', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.next_action = '/fab-verify';
  run.status = 'verifying';
  const errors = validateNextActionGate(run);
  assert.strictEqual(errors.length, 0, `unexpected errors: ${JSON.stringify(errors)}`);
});

/* ================================================================
 *  Test 9 — human_decisions timestamp ordering
 * ================================================================ */

test('timestamp gate: resolved_at before triggered_at is rejected', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.human_decisions = [
    {
      step: 'fab-decide',
      decision_needed: 'Continue?',
      options: ['continue', 'abandon'],
      decision: 'continue',
      rationale: 'ok',
      triggered_at: '2026-06-19T12:05:00Z',
      resolved_at: '2026-06-19T12:00:00Z',
    },
  ];
  const errors = validateTimestampOrderGate(run);
  assert(errors.length > 0, 'expected gate to reject resolved_at before triggered_at');
  assert(errors[0].includes('earlier than'), errors[0]);
});

test('timestamp gate: resolved_at after triggered_at is accepted', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.human_decisions = [
    {
      step: 'fab-decide',
      decision_needed: 'Continue?',
      options: ['continue', 'abandon'],
      decision: 'continue',
      rationale: 'ok',
      triggered_at: '2026-06-19T12:00:00Z',
      resolved_at: '2026-06-19T12:05:00Z',
    },
  ];
  const errors = validateTimestampOrderGate(run);
  assert.strictEqual(errors.length, 0, `unexpected errors: ${JSON.stringify(errors)}`);
});

test('timestamp gate: null resolved_at is accepted (pending decision)', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.human_decisions = [
    {
      step: 'fab-decide',
      decision_needed: 'Continue?',
      options: ['continue', 'abandon'],
      decision: null,
      rationale: null,
      triggered_at: '2026-06-19T12:00:00Z',
      resolved_at: null,
    },
  ];
  const errors = validateTimestampOrderGate(run);
  assert.strictEqual(errors.length, 0, `pending decision should be accepted: ${JSON.stringify(errors)}`);
});

/* ================================================================
 *  Test 7 — cost-precision state integrity
 * ================================================================ */

test('cost precision gate: invalid precision value is rejected', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.costs.precision = 'approximate';
  const errors = validateCostPrecisionGate(run);
  assert(errors.length > 0, 'expected gate to reject invalid precision');
  assert(errors[0].includes('not valid'), errors[0]);
});

test('cost precision gate: valid precision values are accepted', () => {
  for (const precision of ['unknown', 'estimated', 'measured']) {
    const run = readJson('test/fixtures/valid-run.json');
    run.costs = {
      precision,
      tokens_in: precision === 'unknown' ? 'unknown' : 10,
      tokens_out: 'unknown',
      api_calls: 'unknown',
      estimated_usd: 'unknown',
      budget_usd: null,
      by_step: {},
    };
    const errors = validateCostPrecisionGate(run);
    assert.strictEqual(errors.length, 0, `precision "${precision}" should be accepted: ${JSON.stringify(errors)}`);
  }
});

/* ================================================================
 *  Integration-level: next-action, timestamp, cost through validate-run --stdin
 * ================================================================ */

test('validate-run rejects fab-integrate with pending stage (next-action gate)', () => {
  const valid = readJson('test/fixtures/valid-run.json');
  valid.status = 'weaving';
  valid.experiment_phase = 'phase_2_pipeline';
  valid.next_action = '/fab-integrate';
  valid.app_stages = [
    { name: 'api', purpose: 'Build API', status: 'pending', quality_score: null, artifacts: [], notes: null },
  ];
  const result = validateStdin(valid);
  assertFail(result);
  assert(combined(result).includes('fab-integrate'), combined(result));
  assert(combined(result).includes('gate contract'), combined(result));
  assertNoStackTrace(result);
});

test('validate-run rejects timestamp ordering violation', () => {
  const valid = readJson('test/fixtures/valid-run.json');
  valid.human_decisions = [
    {
      step: 'fab-decide',
      decision_needed: 'Continue?',
      options: ['continue', 'abandon'],
      decision: 'continue',
      rationale: 'ok',
      triggered_at: '2026-06-19T12:05:00Z',
      resolved_at: '2026-06-19T12:00:00Z',
    },
  ];
  const result = validateStdin(valid);
  assertFail(result);
  assert(combined(result).includes('earlier than'), combined(result));
  assert(combined(result).includes('gate contract'), combined(result));
  assertNoStackTrace(result);
});

test('validate-run rejects invalid cost precision', () => {
  const valid = readJson('test/fixtures/valid-run.json');
  valid.costs.precision = 'approximate';
  const result = validateStdin(valid);
  assertFail(result);
  assert(combined(result).includes('must be equal to one of the allowed values'), combined(result));
  assertNoStackTrace(result);
});

/* ================================================================
 *  Cross-check: gate-enforced rules must be documented in the
 *  corresponding skill's SKILL.md Execution Guardrails section.
 *  This catches doc/gate drift (a gate silently diverging from,
 *  or a guardrail being removed without updating, the validator).
 * ================================================================ */

test('gate-enforced rules are documented in the corresponding SKILL.md guardrails', () => {
  const manifest = JSON.parse(readFileSync('skills/manifest.json', 'utf-8'));
  const pathById = Object.fromEntries(manifest.skills.map((s) => [s.id, s.path]));

  const cases = [
    { skill: 'fab-verify', keywords: ['explicit operator approval', 'Docker'] },
    { skill: 'fab-decide', keywords: ['resolved_at', 'do not auto-decide'] },
    { skill: 'fab-eval', keywords: ['quality_score', 'below 6'] },
    { skill: 'fab-status', keywords: ['unknown'] },
    { skill: 'fab-integrate', keywords: ['app_stages', 'done'] },
  ];

  for (const { skill, keywords } of cases) {
    const content = readFileSync(`${pathById[skill]}/SKILL.md`, 'utf-8');
    for (const kw of keywords) {
      assert(content.includes(kw), `SKILL.md for ${skill} must document the gate-enforced rule containing "${kw}"`);
    }
  }
});

/* ================================================================
 *  --auto gate resolution (resolveGateLevel)
 *  The flag downgrades overridable checkpoints only; locked skills
 *  (overridable: false) keep their default gate regardless.
 * ================================================================ */

test('--auto gate config precondition: manifest gates match the documented contract', () => {
  const manifest = JSON.parse(readFileSync('skills/manifest.json', 'utf-8'));
  const byId = Object.fromEntries(manifest.skills.map((s) => [s.id, s]));
  assert.strictEqual(byId['fab-spec'].default_gate, 'checkpoint');
  assert.strictEqual(byId['fab-spec'].overridable, true);
  assert.strictEqual(byId['fab-plan'].default_gate, 'checkpoint');
  assert.strictEqual(byId['fab-plan'].overridable, true);
  assert.strictEqual(byId['fab-verify'].default_gate, 'review');
  assert.strictEqual(byId['fab-verify'].overridable, false);
  assert.strictEqual(byId['fab-decide'].default_gate, 'full');
  assert.strictEqual(byId['fab-decide'].overridable, false);
});

test('--auto on fab-spec resolves checkpoint to auto', () => {
  const entry = { default_gate: 'checkpoint', overridable: true };
  assert.strictEqual(resolveGateLevel('fab-spec', entry, true), 'auto');
});

test('--auto on fab-plan resolves checkpoint to auto', () => {
  const entry = { default_gate: 'checkpoint', overridable: true };
  assert.strictEqual(resolveGateLevel('fab-plan', entry, true), 'auto');
});

test('--auto on fab-verify still resolves to review (locked)', () => {
  const entry = { default_gate: 'review', overridable: false };
  assert.strictEqual(resolveGateLevel('fab-verify', entry, true), 'review');
});

test('--auto on fab-decide still resolves to full (locked)', () => {
  const entry = { default_gate: 'full', overridable: false };
  assert.strictEqual(resolveGateLevel('fab-decide', entry, true), 'full');
});

test('no flag: fab-spec and fab-plan still resolve to checkpoint', () => {
  const entry = { default_gate: 'checkpoint', overridable: true };
  assert.strictEqual(resolveGateLevel('fab-spec', entry, false), 'checkpoint');
  assert.strictEqual(resolveGateLevel('fab-plan', entry, false), 'checkpoint');
});

test('--auto never bypasses overridable:false, even for checkpoint defaults', () => {
  const entry = { default_gate: 'checkpoint', overridable: false };
  assert.strictEqual(resolveGateLevel('fab-status', entry, true), 'checkpoint');
});

test('--auto behavior is documented in the SKILL.md contract files', () => {
  const manifest = JSON.parse(readFileSync('skills/manifest.json', 'utf-8'));
  const pathById = Object.fromEntries(manifest.skills.map((s) => [s.id, s.path]));
  const read = (id) => readFileSync(`${pathById[id]}/SKILL.md`, 'utf-8');

  assert(read('fab-spec').includes('--auto'), 'fab-spec must document the --auto gate conditional');
  assert(read('fab-spec').includes('Assumed from your idea'), 'fab-spec must document the assumption summary block');
  assert(read('fab-plan').includes('--auto'), 'fab-plan must document the --auto gate conditional');
  assert(read('fab-integrate').includes('--auto'), 'fab-integrate must document the --auto gate conditional');
  assert(read('fab-build').includes('[fab-build] stage'), 'fab-build must document the progress narration line');
  assert(read('fab-eval').includes('[fab-eval] stage'), 'fab-eval must document the progress narration line');
});

test('locked gates document the terse stop-message format', () => {
  const manifest = JSON.parse(readFileSync('skills/manifest.json', 'utf-8'));
  const pathById = Object.fromEntries(manifest.skills.map((s) => [s.id, s.path]));
  for (const id of ['fab-verify', 'fab-decide']) {
    const content = readFileSync(`${pathById[id]}/SKILL.md`, 'utf-8');
    assert(content.includes('Waiting on'), `${id} must specify the Waiting on stop-message part`);
    assert(content.includes('No other prose'), `${id} must forbid extra prose in the stop message`);
  }
});

test('checkpoint skills document the no-yield rule for auto gates', () => {
  const manifest = JSON.parse(readFileSync('skills/manifest.json', 'utf-8'));
  const pathById = Object.fromEntries(manifest.skills.map((s) => [s.id, s.path]));
  for (const id of ['fab-spec', 'fab-plan', 'fab-integrate']) {
    const content = readFileSync(`${pathById[id]}/SKILL.md`, 'utf-8');
    assert(content.includes('do not end the agent turn at this step'), `${id} must document the no-yield rule`);
    assert(content.includes('continue directly to `next_action`'), `${id} must point at next_action`);
    assert(content.includes('the only narration'), `${id} must forbid intermediate narration in auto mode`);
  }
});

test('fab-scaffold requires one consolidated root README', () => {
  const manifest = JSON.parse(readFileSync('skills/manifest.json', 'utf8'));
  const pathById = Object.fromEntries(manifest.skills.map((s) => [s.id, s.path]));
  const content = readFileSync(`${pathById['fab-scaffold']}/SKILL.md`, 'utf-8');
  assert(content.includes('consolidated root `README.md`'), 'fab-scaffold must require a consolidated root README');
  assert(content.includes('Do not write per-service READMEs'), 'fab-scaffold must forbid per-service READMEs');
});

runAll();
