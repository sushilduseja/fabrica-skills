import assert from 'assert';
import { readFileSync } from 'fs';
import { assertFail, assertNoStackTrace, combined, readJson, test, validateStdin, runAll } from './_harness.mjs';
import {
  validateFabLaunchGate,
  validateFabSignalGate,
  validateFabCheckGate,
  validateFabPulseGate,
  validatePrerequisiteGate,
  validateTimestampOrderGate,
  validateCostPrecisionGate,
} from '../scripts/_skill-gates.mjs';

/* ================================================================
 *  Unit-level: direct calls to each gate validator
 *  These test the logic in isolation without spawning validate-run.
 * ================================================================ */

test('fab-launch gate: external_deploy without human approval is rejected', () => {
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

test('fab-launch gate: external_deploy WITH human approval is accepted', () => {
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
      step: 'fab-launch',
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

test('fab-launch gate: container_build without Docker command is rejected', () => {
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

test('fab-launch gate: complete state requires launch verification', () => {
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

test('fab-signal gate: decision with value but no resolved_at is rejected', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.human_decisions = [
    {
      step: 'fab-signal',
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

test('fab-signal gate: pending decision (null value) is accepted', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.human_decisions = [
    {
      step: 'fab-signal',
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

test('fab-signal gate: properly resolved decision is accepted', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.human_decisions = [
    {
      step: 'fab-signal',
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

test('fab-check gate: sub-threshold quality_score (< 6) with status "done" is rejected', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.app_stages = [
    { name: 'api', purpose: 'Build API', status: 'done', quality_score: 5, artifacts: ['src/api.js'], notes: null },
  ];
  const errors = validateFabCheckGate(run);
  assert(errors.length > 0, 'expected gate to reject sub-threshold stage marked done');
  assert(errors[0].includes('quality_score 5'), errors[0]);
});

test('fab-check gate: sub-threshold stage with status "blocked" is accepted', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.app_stages = [
    { name: 'api', purpose: 'Build API', status: 'blocked', quality_score: 5, artifacts: ['src/api.js'], notes: null },
  ];
  const errors = validateFabCheckGate(run);
  assert.strictEqual(errors.length, 0, `blocked stage with low score should be accepted: ${JSON.stringify(errors)}`);
});

test('fab-check gate: high-scoring stage is accepted regardless of status', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.app_stages = [
    { name: 'api', purpose: 'Build API', status: 'done', quality_score: 8, artifacts: ['src/api.js'], notes: null },
  ];
  const errors = validateFabCheckGate(run);
  assert.strictEqual(errors.length, 0, `high-scoring done stage should be accepted: ${JSON.stringify(errors)}`);
});

test('fab-pulse gate: precision "unknown" with numeric cost field is rejected', () => {
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

test('fab-pulse gate: all-unknown costs are accepted', () => {
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

test('validate-run rejects external_deploy missing human approval (fab-launch gate)', () => {
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

test('validate-run rejects auto-decided decision (fab-signal gate)', () => {
  const valid = readJson('test/fixtures/valid-run.json');
  valid.human_decisions = [
    {
      step: 'fab-signal',
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

test('validate-run rejects sub-threshold stage marked done (fab-check gate)', () => {
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

test('validate-run rejects unknown precision with numeric cost (fab-pulse gate)', () => {
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
 *  Test 4 — next_action prerequisite-graph enforcement
 * ================================================================ */

test('prerequisite gate: fab-weave next_action with pending stage is rejected', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.status = 'weaving';
  run.experiment_phase = 'phase_2_pipeline';
  run.next_action = '/fab-weave';
  run.app_stages = [
    { name: 'api', purpose: 'Build API', status: 'pending', quality_score: null, artifacts: [], notes: null },
  ];
  const errors = validatePrerequisiteGate(run);
  assert(errors.length > 0, 'expected gate to reject fab-weave with pending stage');
  assert(errors[0].includes('fab-weave'), errors[0]);
  assert(errors[0].includes('pending'), errors[0]);
});

test('prerequisite gate: fab-weave next_action with all stages done is accepted', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.status = 'weaving';
  run.experiment_phase = 'phase_2_pipeline';
  run.next_action = '/fab-weave';
  run.app_stages = [
    { name: 'api', purpose: 'Build API', status: 'done', quality_score: 8, artifacts: ['src/api.js'], notes: null },
  ];
  const errors = validatePrerequisiteGate(run);
  assert.strictEqual(errors.length, 0, `unexpected errors: ${JSON.stringify(errors)}`);
});

test('prerequisite gate: fab-launch next_action without verifying status is rejected', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.next_action = '/fab-launch';
  run.status = 'weaving';
  const errors = validatePrerequisiteGate(run);
  assert(errors.length > 0, 'expected gate to reject fab-launch without verifying status');
  assert(errors[0].includes('fab-launch'), errors[0]);
  assert(errors[0].includes('verifying'), errors[0]);
});

test('prerequisite gate: fab-launch next_action with verifying status is accepted', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.next_action = '/fab-launch';
  run.status = 'verifying';
  const errors = validatePrerequisiteGate(run);
  assert.strictEqual(errors.length, 0, `unexpected errors: ${JSON.stringify(errors)}`);
});

/* ================================================================
 *  Test 9 — human_decisions timestamp ordering
 * ================================================================ */

test('timestamp gate: resolved_at before triggered_at is rejected', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.human_decisions = [
    {
      step: 'fab-signal',
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
      step: 'fab-signal',
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
      step: 'fab-signal',
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
 *  Integration-level: prerequisite, timestamp, cost through validate-run --stdin
 * ================================================================ */

test('validate-run rejects fab-weave with pending stage (prerequisite gate)', () => {
  const valid = readJson('test/fixtures/valid-run.json');
  valid.status = 'weaving';
  valid.experiment_phase = 'phase_2_pipeline';
  valid.next_action = '/fab-weave';
  valid.app_stages = [
    { name: 'api', purpose: 'Build API', status: 'pending', quality_score: null, artifacts: [], notes: null },
  ];
  const result = validateStdin(valid);
  assertFail(result);
  assert(combined(result).includes('fab-weave'), combined(result));
  assert(combined(result).includes('gate contract'), combined(result));
  assertNoStackTrace(result);
});

test('validate-run rejects timestamp ordering violation', () => {
  const valid = readJson('test/fixtures/valid-run.json');
  valid.human_decisions = [
    {
      step: 'fab-signal',
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
    { skill: 'fab-launch', keywords: ['explicit operator approval', 'Docker'] },
    { skill: 'fab-signal', keywords: ['resolved_at', 'do not auto-decide'] },
    { skill: 'fab-check', keywords: ['quality_score', 'below 6'] },
    { skill: 'fab-pulse', keywords: ['unknown'] },
    { skill: 'fab-weave', keywords: ['app_stages', 'done'] },
  ];

  for (const { skill, keywords } of cases) {
    const content = readFileSync(`${pathById[skill]}/SKILL.md`, 'utf-8');
    for (const kw of keywords) {
      assert(content.includes(kw), `SKILL.md for ${skill} must document the gate-enforced rule containing "${kw}"`);
    }
  }
});

runAll();
