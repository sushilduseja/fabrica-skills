import assert from 'assert';
import { readFileSync, rmSync, mkdtempSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import {
  assertFail,
  assertNoStackTrace,
  combined,
  readJson,
  root,
  test,
  validateStdin,
  run,
  runAll,
} from './_harness.mjs';
import {
  resolveGateLevel,
  validateFabLaunchGate,
  validateFabSignalGate,
  validateFabCheckGate,
  validateFabPulseGate,
  validateNextActionGate,
  validateTimestampOrderGate,
  validateCostPrecisionGate,
  validateCheckpointApprovalGate,
} from '../scripts/_skill-gates.mjs';
import { appendApproval, buildApprovalSummary, parseApproveArgs, parsePromptAnswer } from '../scripts/approve.mjs';

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
  const manifest = readJson('skills/manifest.json');
  const pathById = Object.fromEntries(manifest.skills.map((s) => [s.id, s.path]));

  const cases = [
    { skill: 'fab-verify', keywords: ['explicit operator approval', 'Docker'] },
    { skill: 'fab-decide', keywords: ['resolved_at', 'do not auto-decide'] },
    { skill: 'fab-eval', keywords: ['quality_score', 'below 6'] },
    { skill: 'fab-status', keywords: ['unknown'] },
    { skill: 'fab-integrate', keywords: ['app_stages', 'done'] },
  ];

  for (const { skill, keywords } of cases) {
    const content = readFileSync(join(root, pathById[skill], 'SKILL.md'), 'utf-8');
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
  const manifest = readJson('skills/manifest.json');
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
  const manifest = readJson('skills/manifest.json');
  const pathById = Object.fromEntries(manifest.skills.map((s) => [s.id, s.path]));
  const read = (id) => readFileSync(join(root, pathById[id], 'SKILL.md'), 'utf-8');

  assert(read('fab-spec').includes('--auto'), 'fab-spec must document the --auto gate conditional');
  assert(read('fab-spec').includes('Assumed from your idea'), 'fab-spec must document the assumption summary block');
  assert(read('fab-plan').includes('--auto'), 'fab-plan must document the --auto gate conditional');
  assert(read('fab-integrate').includes('--auto'), 'fab-integrate must document the --auto gate conditional');
  assert(read('fab-build').includes('[fab-build] stage'), 'fab-build must document the progress narration line');
  assert(read('fab-eval').includes('[fab-eval] stage'), 'fab-eval must document the progress narration line');
});

test('locked gates document the terse stop-message format', () => {
  const manifest = readJson('skills/manifest.json');
  const pathById = Object.fromEntries(manifest.skills.map((s) => [s.id, s.path]));
  for (const id of ['fab-verify', 'fab-decide']) {
    const content = readFileSync(`${pathById[id]}/SKILL.md`, 'utf-8');
    assert(content.includes('Waiting on'), `${id} must specify the Waiting on stop-message part`);
    assert(content.includes('No other prose'), `${id} must forbid extra prose in the stop message`);
  }
});

test('checkpoint skills document the no-yield rule for auto gates', () => {
  const manifest = readJson('skills/manifest.json');
  const pathById = Object.fromEntries(manifest.skills.map((s) => [s.id, s.path]));
  for (const id of ['fab-spec', 'fab-plan', 'fab-integrate']) {
    const content = readFileSync(`${pathById[id]}/SKILL.md`, 'utf-8');
    assert(content.includes('do not end the agent turn at this step'), `${id} must document the no-yield rule`);
    assert(content.includes('continue to `next_action`'), `${id} must point at next_action`);
    assert(content.includes('the only narration'), `${id} must forbid intermediate narration in auto mode`);
    assert(
      content.includes('equivalent to `gate_levels` already being `auto`'),
      `${id} must document Policy A (persisted levels win)`,
    );
  }
});

test('fab-spec auto-continues without asking continue-vs-fresh', () => {
  const manifest = readJson('skills/manifest.json');
  const pathById = Object.fromEntries(manifest.skills.map((s) => [s.id, s.path]));
  const content = readFileSync(join(root, pathById['fab-spec'], 'SKILL.md'), 'utf-8');
  assert(
    content.includes('continue the existing run without asking continue-vs-fresh'),
    'fab-spec must document auto-continue when levels say auto',
  );
  assert(
    content.includes('When the resolved gate is `auto`'),
    'fab-spec assumption summary must trigger on resolved gate, not prompt text',
  );
});

test('fab-scaffold requires one consolidated root README', () => {
  const manifest = readJson('skills/manifest.json');
  const pathById = Object.fromEntries(manifest.skills.map((s) => [s.id, s.path]));
  const content = readFileSync(join(root, pathById['fab-scaffold'], 'SKILL.md'), 'utf-8');
  assert(content.includes('consolidated root `README.md`'), 'fab-scaffold must require a consolidated root README');
  assert(content.includes('Do not write per-service READMEs'), 'fab-scaffold must forbid per-service READMEs');
});

test('existing-project conditionals are documented in SKILL.md guardrails', () => {
  const manifest = readJson('skills/manifest.json');
  const pathById = Object.fromEntries(manifest.skills.map((s) => [s.id, s.path]));
  const read = (id) => readFileSync(join(root, pathById[id], 'SKILL.md'), 'utf-8');

  assert(
    read('fab-discover').includes('docs/fabrica/project-profile.md'),
    'fab-discover must document the profile path',
  );
  assert(read('fab-discover').includes('untrusted data'), 'fab-discover must document untrusted-data handling');
  assert(read('fab-adopt').includes('never scaffold'), 'fab-adopt must prohibit scaffolding');
  assert(read('fab-adopt').includes('baseline'), 'fab-adopt must document baseline recheck');
  assert(read('fab-spec').includes('docs/fabrica/spec.md'), 'fab-spec must document the existing-project spec path');
  assert(
    read('fab-plan').includes('docs/fabrica/blueprint.md'),
    'fab-plan must document the existing-project blueprint path',
  );
  assert(read('fab-scaffold').includes('/fab-adopt'), 'fab-scaffold must route existing runs to fab-adopt');
  assert(read('fab-build').includes('allowed change paths'), 'fab-build must document write-scope confinement');
  assert(read('fab-fix').includes('approved scope'), 'fab-fix must document scope confinement');
  assert(read('fab-verify').includes('existing repository'), 'fab-verify must document existing-repo verification');
});

test('fab-discover guardrails enforce read-only inspection', () => {
  const manifest = readJson('skills/manifest.json');
  const pathById = Object.fromEntries(manifest.skills.map((s) => [s.id, s.path]));
  const discover = readFileSync(join(root, pathById['fab-discover'], 'SKILL.md'), 'utf-8');
  assert(discover.includes('not modify application source'), 'fab-discover must forbid modifying application source');
  assert(discover.includes('Do not discover or persist secrets'), 'fab-discover must forbid persisting secrets');
  assert(discover.includes('untrusted data'), 'fab-discover must treat repository files as untrusted data');
  assert(discover.includes('docs/fabrica/project-profile.md'), 'fab-discover must name the profile path');
  const adopt = readFileSync(join(root, pathById['fab-adopt'], 'SKILL.md'), 'utf-8');
  assert(adopt.includes('baseline'), 'fab-adopt must document baseline recheck');
  assert(adopt.includes('dirty'), 'fab-adopt must document dirty-worktree handling');
  assert(adopt.includes('never scaffold') || adopt.includes('not scaffold'), 'fab-adopt must prohibit scaffolding');
});

test('P3 hardening: fab-build prerequisites and fab-discover gate', () => {
  const manifest = readJson('skills/manifest.json');
  const pathById = Object.fromEntries(manifest.skills.map((s) => [s.id, s.path]));
  const buildPrereq = readFileSync(join(root, pathById['fab-build'], 'SKILL.md'), 'utf-8');
  assert(
    buildPrereq.includes('/fab-adopt') && buildPrereq.includes('project_context.origin'),
    'fab-build prerequisites must mention /fab-adopt when project_context.origin is existing',
  );
  assert(
    buildPrereq.includes('docs/fabrica/blueprint.md'),
    'fab-build prerequisites must note existing-project blueprint path',
  );
  const discoverEntry = manifest.skills.find((s) => s.id === 'fab-discover');
  assert.strictEqual(discoverEntry.default_gate, 'auto', 'fab-discover gate is intentionally auto (read-only survey)');
  assert.strictEqual(discoverEntry.overridable, true);
  // Schema vs skill path: spec_path coupling stays in skill prose, not schema. Schema must allow both docs/spec.md and docs/fabrica/spec.md.
  const schema = readJson('schemas/run-object.schema.json');
  const specStringBranch = schema.properties.spec_path.oneOf.find((b) => b.type === 'string');
  const pattern = new RegExp(specStringBranch.pattern);
  assert(pattern.test('docs/spec.md'), 'schema must allow docs/spec.md');
  assert(pattern.test('docs/fabrica/spec.md'), 'schema must allow docs/fabrica/spec.md');
});

test('STATE_MACHINE documents both new-project and existing-project pathways', () => {
  const content = readFileSync(join(root, 'docs/STATE_MACHINE.md'), 'utf-8');
  assert(content.includes('New project (greenfield)'), 'STATE_MACHINE must label the new-project pathway');
  assert(content.includes('Existing project (opt-in'), 'STATE_MACHINE must document the existing-project pathway');
  assert(content.includes('init-existing-run'), 'STATE_MACHINE must document init-existing-run');
  assert(content.includes('/fab-discover'), 'STATE_MACHINE must include /fab-discover');
  assert(content.includes('/fab-adopt'), 'STATE_MACHINE must include /fab-adopt');
  assert(content.includes('project_context'), 'STATE_MACHINE must mention project_context');
});

test('existing-project negative conditions are documented', () => {
  const manifest = readJson('skills/manifest.json');
  const pathById = Object.fromEntries(manifest.skills.map((s) => [s.id, s.path]));
  // overwrite-docs, out-of-scope, unapproved-command, baseline drift, secret handling
  assert(
    readFileSync(join(root, pathById['fab-spec'], 'SKILL.md'), 'utf-8').includes(
      'never overwrite existing project documents',
    ),
    'fab-spec must forbid overwriting existing project documents',
  );
  assert(
    readFileSync(join(root, pathById['fab-build'], 'SKILL.md'), 'utf-8').includes('allowed change paths'),
    'fab-build must require allowed change paths',
  );
  assert(
    readFileSync(join(root, pathById['fab-build'], 'SKILL.md'), 'utf-8').includes('approved literal commands'),
    'fab-build must require approved literal commands',
  );
  assert(
    readFileSync(join(root, pathById['fab-adopt'], 'SKILL.md'), 'utf-8').includes('baseline'),
    'fab-adopt must check baseline drift',
  );
  assert(
    readFileSync(join(root, pathById['fab-discover'], 'SKILL.md'), 'utf-8').includes(
      'Do not discover or persist secrets',
    ),
    'fab-discover must forbid secret persistence',
  );
});

/* ================================================================
 *  Unit-level: validateCheckpointApprovalGate (spec/plan checkpoints)
 * ================================================================ */

test('checkpoint gate: fab-spec write with no approval record is rejected', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.human_decisions = [];
  const errors = validateCheckpointApprovalGate(run);
  assert(errors.length === 1, `expected exactly 1 error, got ${errors.length}: ${errors.join('; ')}`);
  assert(errors[0].includes('gate_levels.fab-spec'), errors[0]);
  assert(errors[0].includes('spec_path'), errors[0]);
  assert(errors[0].includes('approve spec'), errors[0]);
});

test('checkpoint gate: fab-spec write with approval record is accepted', () => {
  const run = readJson('test/fixtures/valid-run.json');
  assert.deepStrictEqual(validateCheckpointApprovalGate(run), [], 'fixture itself must satisfy the gate');
});

test('checkpoint gate: approval record without resolved_at does not count', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.human_decisions = run.human_decisions.map((d) => ({ ...d, resolved_at: null }));
  const errors = validateCheckpointApprovalGate(run);
  assert(errors.length === 1, 'unresolved approval must not satisfy the checkpoint');
});

test('checkpoint gate: wrong step or decision token does not count', () => {
  const base = readJson('test/fixtures/valid-run.json');
  const wrongStep = {
    ...base,
    human_decisions: [{ ...base.human_decisions[0], step: 'fab-verify' }],
  };
  assert(
    validateCheckpointApprovalGate(wrongStep).length === 1,
    'approval recorded against another step must not count',
  );

  const wrongDecision = {
    ...base,
    human_decisions: [{ ...base.human_decisions[0], decision: 'continue' }],
  };
  assert(
    validateCheckpointApprovalGate(wrongDecision).length === 1,
    'non-"approve" decision must not satisfy the checkpoint',
  );
});

test('checkpoint gate: fab-plan write requires its own approval record', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.current_step = 'fab-plan';
  run.blueprint_path = 'docs/blueprint.md';
  const withoutRecord = validateCheckpointApprovalGate(run);
  assert(withoutRecord.length === 1, 'blueprint write without fab-plan approval must be rejected');
  assert(withoutRecord[0].includes('approve blueprint'), withoutRecord[0]);

  run.human_decisions = [
    ...run.human_decisions,
    {
      step: 'fab-plan',
      decision_needed: 'Approve the blueprint before it is written',
      options: ['approve', 'revise', 'reject'],
      decision: 'approve',
      rationale: "Operator replied 'approve blueprint'",
      triggered_at: '2026-06-19T12:10:00Z',
      resolved_at: '2026-06-19T12:15:00Z',
    },
  ];
  assert.deepStrictEqual(validateCheckpointApprovalGate(run), [], 'blueprint write with record must pass');
});

test('checkpoint gate: auto gate levels are exempt from the approval requirement', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.gate_levels['fab-spec'] = 'auto';
  run.human_decisions = [];
  assert.deepStrictEqual(validateCheckpointApprovalGate(run), [], '--auto writes must not require an approval record');
});

test('checkpoint gate: rule is scoped to the write moment (later phases unaffected)', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.current_step = 'fab-scaffold';
  run.human_decisions = [];
  assert.deepStrictEqual(
    validateCheckpointApprovalGate(run),
    [],
    'record-less history must not block unrelated later-phase skills',
  );
});

test('checkpoint gate: nothing written yet requires no approval record', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.spec_path = null;
  run.human_decisions = [];
  assert.deepStrictEqual(validateCheckpointApprovalGate(run), [], 'fresh runs must not require a record');
});

test('checkpoint gate: a later revise record does not void a prior approval (first-approval semantics)', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.human_decisions = [
    ...run.human_decisions,
    {
      step: 'fab-spec',
      decision_needed: 'Approve the revised spec',
      options: ['approve', 'revise', 'reject'],
      decision: 'revise',
      rationale: 'Operator requested a revision after the first write',
      triggered_at: '2026-06-19T12:20:00Z',
      resolved_at: '2026-06-19T12:21:00Z',
    },
  ];
  assert.deepStrictEqual(
    validateCheckpointApprovalGate(run),
    [],
    'mechanical scope is first-approval: a later non-approve record must not block, so audit-record appends stay legal',
  );
});

test('checkpoint gate: rejection message names both new-project and existing-project artifact paths', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.human_decisions = [];
  const errors = validateCheckpointApprovalGate(run);
  assert(errors[0].includes('docs/spec.md'), errors[0]);
  assert(errors[0].includes('docs/fabrica/spec.md'), errors[0]);
  assert(errors[0].includes('approve spec'), errors[0]);
});

test('validateAllGates includes the checkpoint approval gate', async () => {
  const { validateAllGates } = await import('../scripts/_skill-gates.mjs');
  const run = readJson('test/fixtures/valid-run.json');
  run.human_decisions = [];
  assert(
    validateAllGates(run).some((e) => e.includes('gate_levels.fab-spec')),
    'validateAllGates must surface checkpoint approval violations',
  );
});

test('validate-run CLI rejects a checkpoint spec write without approval (--stdin)', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.human_decisions = [];
  const result = validateStdin(run);
  assertFail(result);
  assertNoStackTrace(result);
  assert(combined(result).includes('no approval'), combined(result));
});

test('canonical fixture carries the approval record required by the checkpoint gate', () => {
  const fixture = readJson('test/fixtures/valid-run.json');
  const record = fixture.human_decisions.find((d) => d.step === 'fab-spec' && d.decision === 'approve');
  assert(record, 'canonical fixture must carry a fab-spec approval record');
  assert(record.resolved_at, 'canonical fixture approval must be resolved');
  assert.deepStrictEqual(validateCheckpointApprovalGate(fixture), []);
});

test('approve mints a record the checkpoint gate accepts', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.human_decisions = [];
  const minted = appendApproval(run, 'spec', 'approve', '2026-06-19T12:30:00Z');
  const rec = minted.human_decisions.at(-1);
  assert.strictEqual(rec.step, 'fab-spec');
  assert.strictEqual(rec.decision, 'approve');
  assert.deepStrictEqual(rec.options, ['approve', 'revise', 'reject']);
  assert(rec.resolved_at);
  assert.deepStrictEqual(validateCheckpointApprovalGate(minted), []);
});

test('approve refuses piped stdin without touching the run file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fabrica-approve-'));
  try {
    const target = join(dir, 'fabrica.run.json');
    writeFileSync(target, `${JSON.stringify(readJson('test/fixtures/valid-run.json'))}\n`, 'utf-8');
    const before = readFileSync(target, 'utf-8');
    const result = run(['scripts/approve.mjs', 'spec', '--file', target], { input: 'approve spec\n' });
    assertFail(result);
    assert(combined(result).includes('terminal'), combined(result));
    assert.strictEqual(readFileSync(target, 'utf-8'), before);
    assertNoStackTrace(result);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('approve summary surfaces pending stack values', () => {
  const run = readJson('test/fixtures/valid-run.json');
  run.preferred_stack = { frontend: 'React + Vite', backend: 'FastAPI', database: 'SQLite' };
  const summary = buildApprovalSummary(run, 'spec');
  assert(summary.includes('React + Vite') && summary.includes('FastAPI') && summary.includes('SQLite'));
  assert(summary.includes('spec_path'));
});

test('approve prompt parsing accepts only exact two-token verdicts', () => {
  assert.strictEqual(parsePromptAnswer('approve spec', 'spec'), 'approve');
  assert.strictEqual(parsePromptAnswer('revise spec', 'spec'), 'revise');
  assert.strictEqual(parsePromptAnswer('reject spec', 'spec'), 'reject');
  assert.strictEqual(parsePromptAnswer('approve  spec', 'spec'), 'approve');
  for (const bad of ['approve spec now', 'APPROVE spec', 'yes', '', 'approve', 'approve blueprint', 'ok go ahead']) {
    assert.strictEqual(parsePromptAnswer(bad, 'spec'), null, `must refuse ${JSON.stringify(bad)}`);
  }
});

test('approve arg parsing honors both --file forms', () => {
  const space = parseApproveArgs(['spec', '--file', 'sub/run.json'], '/r');
  assert.strictEqual(space.artifact, 'spec');
  assert.strictEqual(space.file, resolve('/r', 'sub/run.json'));
  const equals = parseApproveArgs(['blueprint', '--file=sub/run.json'], '/r');
  assert.strictEqual(equals.artifact, 'blueprint');
  assert.strictEqual(equals.file, resolve('/r', 'sub/run.json'));
  const bare = parseApproveArgs(['adoption'], '/r');
  assert.strictEqual(bare.file, resolve('/r', 'fabrica.run.json'));
  assert.throws(() => parseApproveArgs(['bogus'], '/r'), /unknown artifact/);
  assert.throws(() => parseApproveArgs(['spec', '--file'], '/r'), /--file requires/);
  assert.throws(() => parseApproveArgs(['spec', '--file='], '/r'), /--file requires/);
});

runAll();
