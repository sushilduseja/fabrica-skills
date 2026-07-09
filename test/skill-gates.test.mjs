import assert from 'assert';
import {
  assertFail,
  assertNoStackTrace,
  assertPass,
  combined,
  readJson,
  test,
  validateStdin,
  runAll,
} from './_harness.mjs';
import {
  validateFabLaunchGate,
  validateFabSignalGate,
  validateFabCheckGate,
  validateFabPulseGate,
} from '../scripts/_skill-gates.mjs';

/* ================================================================
 *  Unit-level: direct calls to each gate validator
 *  These test the logic in isolation without spawning validate-run.
 * ================================================================ */

test('fab-launch gate: external_deploy without human approval is rejected', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.verifications = [{ kind: 'external_deploy', command: 'deploy.sh', passed: true, summary: 'deploy', timestamp: '2026-06-19T12:30:00Z' }];
  const errors = validateFabLaunchGate(run);
  assert(errors.length > 0, 'expected gate to reject external_deploy without approval');
  assert(errors[0].includes('external_deploy'), errors[0]);
});

test('fab-launch gate: external_deploy WITH human approval is accepted', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.verifications = [{ kind: 'external_deploy', command: 'deploy.sh', passed: true, summary: 'deploy', timestamp: '2026-06-19T12:30:00Z' }];
  run.human_decisions = [{ step: 'fab-launch', decision_needed: 'Deploy?', options: ['continue', 'abandon'], decision: 'continue', rationale: 'ok', triggered_at: '2026-06-19T12:00:00Z', resolved_at: '2026-06-19T12:01:00Z' }];
  const errors = validateFabLaunchGate(run);
  assert.strictEqual(errors.length, 0, `unexpected errors: ${JSON.stringify(errors)}`);
});

test('fab-launch gate: container_build without Docker command is rejected', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.verifications = [{ kind: 'container_build', command: 'node scripts/lint-dockerfiles.mjs', passed: true, summary: 'lint', timestamp: '2026-06-19T12:30:00Z' }];
  const errors = validateFabLaunchGate(run);
  assert(errors.length > 0, 'expected gate to reject container_build without Docker command');
  assert(errors[0].includes('does not invoke Docker'), errors[0]);
});

test('fab-launch gate: complete state requires launch verification', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.status = 'complete';
  run.experiment_phase = 'phase_2_pipeline';
  run.app_stages = [{ name: 'api', purpose: 'Build API', status: 'done', quality_score: 8, artifacts: ['src/api.js'], notes: null }];
  run.verifications = [];
  const errors = validateFabLaunchGate(run);
  assert(errors.length > 0, 'expected gate to reject complete without launch verification');
  assert(errors[0].includes('no local_launch or container_build verification'), errors[0]);
});

test('fab-signal gate: decision with value but no resolved_at is rejected', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.human_decisions = [{ step: 'fab-signal', decision_needed: 'Continue?', options: ['continue', 'abandon'], decision: 'continue', rationale: null, triggered_at: '2026-06-19T12:00:00Z', resolved_at: null }];
  const errors = validateFabSignalGate(run);
  assert(errors.length > 0, 'expected gate to reject auto-populated decision');
  assert(errors[0].includes('no resolved_at'), errors[0]);
});

test('fab-signal gate: pending decision (null value) is accepted', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.human_decisions = [{ step: 'fab-signal', decision_needed: 'Continue?', options: ['continue', 'abandon'], decision: null, rationale: null, triggered_at: '2026-06-19T12:00:00Z', resolved_at: null }];
  const errors = validateFabSignalGate(run);
  assert.strictEqual(errors.length, 0, `pending decision should be accepted: ${JSON.stringify(errors)}`);
});

test('fab-signal gate: properly resolved decision is accepted', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.human_decisions = [{ step: 'fab-signal', decision_needed: 'Continue?', options: ['continue', 'abandon'], decision: 'continue', rationale: 'Looks good', triggered_at: '2026-06-19T12:00:00Z', resolved_at: '2026-06-19T12:01:00Z' }];
  const errors = validateFabSignalGate(run);
  assert.strictEqual(errors.length, 0, `resolved decision should be accepted: ${JSON.stringify(errors)}`);
});

test('fab-check gate: sub-threshold quality_score (< 6) with status "done" is rejected', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.app_stages = [{ name: 'api', purpose: 'Build API', status: 'done', quality_score: 5, artifacts: ['src/api.js'], notes: null }];
  const errors = validateFabCheckGate(run);
  assert(errors.length > 0, 'expected gate to reject sub-threshold stage marked done');
  assert(errors[0].includes('quality_score 5'), errors[0]);
});

test('fab-check gate: sub-threshold stage with status "blocked" is accepted', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.app_stages = [{ name: 'api', purpose: 'Build API', status: 'blocked', quality_score: 5, artifacts: ['src/api.js'], notes: null }];
  const errors = validateFabCheckGate(run);
  assert.strictEqual(errors.length, 0, `blocked stage with low score should be accepted: ${JSON.stringify(errors)}`);
});

test('fab-check gate: high-scoring stage is accepted regardless of status', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.app_stages = [{ name: 'api', purpose: 'Build API', status: 'done', quality_score: 8, artifacts: ['src/api.js'], notes: null }];
  const errors = validateFabCheckGate(run);
  assert.strictEqual(errors.length, 0, `high-scoring done stage should be accepted: ${JSON.stringify(errors)}`);
});

test('fab-pulse gate: precision "unknown" with numeric cost field is rejected', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.costs = { precision: 'unknown', tokens_in: 100, tokens_out: 'unknown', api_calls: 'unknown', estimated_usd: 'unknown', budget_usd: null, by_step: {} };
  const errors = validateFabPulseGate(run);
  assert(errors.length > 0, 'expected gate to reject unknown precision with numeric tokens_in');
  assert(errors[0].includes('tokens_in'), errors[0]);
});

test('fab-pulse gate: all-unknown costs are accepted', () => {
  const run = readJson('test/fixtures/valid-run.json');
  const errors = validateFabPulseGate(run);
  assert.strictEqual(errors.length, 0, `valid fixture with all-unknown costs should be accepted: ${JSON.stringify(errors)}`);
});

/* ================================================================
 *  Integration-level: gate validators wired through validate-run --stdin
 *  These verify the full pipeline (schema → semantic → gate).
 * ================================================================ */

test('validate-run rejects external_deploy missing human approval (fab-launch gate)', () => {
  const valid = readJson('test/fixtures/valid-run.json');
  valid.verifications = [{ kind: 'external_deploy', command: 'deploy.sh', passed: true, summary: 'deploy', timestamp: '2026-06-19T12:30:00Z' }];
  const result = validateStdin(valid);
  assertFail(result);
  assert(combined(result).includes('external_deploy'), combined(result));
  assert(combined(result).includes('gate contract'), combined(result));
  assertNoStackTrace(result);
});

test('validate-run rejects auto-decided decision (fab-signal gate)', () => {
  const valid = readJson('test/fixtures/valid-run.json');
  valid.human_decisions = [{ step: 'fab-signal', decision_needed: 'Continue?', options: ['continue', 'abandon'], decision: 'continue', rationale: null, triggered_at: '2026-06-19T12:00:00Z', resolved_at: null }];
  const result = validateStdin(valid);
  assertFail(result);
  assert(combined(result).includes('no resolved_at'), combined(result));
  assert(combined(result).includes('gate contract'), combined(result));
  assertNoStackTrace(result);
});

test('validate-run rejects sub-threshold stage marked done (fab-check gate)', () => {
  const valid = readJson('test/fixtures/valid-run.json');
  valid.app_stages = [{ name: 'api', purpose: 'Build API', status: 'done', quality_score: 4.5, artifacts: ['src/api.js'], notes: null }];
  const result = validateStdin(valid);
  assertFail(result);
  assert(combined(result).includes('quality_score 4.5'), combined(result));
  assert(combined(result).includes('gate contract'), combined(result));
  assertNoStackTrace(result);
});

test('validate-run rejects unknown precision with numeric cost (fab-pulse gate)', () => {
  const valid = readJson('test/fixtures/valid-run.json');
  valid.costs = { precision: 'unknown', tokens_in: 100, tokens_out: 'unknown', api_calls: 'unknown', estimated_usd: 'unknown', budget_usd: null, by_step: {} };
  const result = validateStdin(valid);
  assertFail(result);
  assert(combined(result).includes('tokens_in'), combined(result));
  assert(combined(result).includes('gate contract'), combined(result));
  assertNoStackTrace(result);
});

runAll();
