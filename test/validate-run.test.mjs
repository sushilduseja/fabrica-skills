import assert from 'assert';
import { rmSync, writeFileSync, mkdtempSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import {
  assertFail,
  assertNoStackTrace,
  assertPass,
  combined,
  copyRepoFixture,
  mutateJson,
  readJson,
  root,
  run,
  test,
  validateStdin,
  runAll,
} from './_harness.mjs';

test('validate-run accepts the valid fixture', () => {
  const result = run(['scripts/validate-run.mjs', 'test/fixtures/valid-run.json']);
  assertPass(result);
  assert(combined(result).includes('[validate-run] OK'));
});

test('validate-run rejects malformed JSON with a clear error and no stack trace', () => {
  const result = run(['scripts/validate-run.mjs', '--stdin'], { input: '{bad json' });
  assertFail(result);
  assert(combined(result).includes('[validate-run] ERROR: Invalid JSON from stdin'));
  assertNoStackTrace(result);
});

test('validate-run rejects missing files with a clear error and no stack trace', () => {
  const result = run(['scripts/validate-run.mjs', 'test/fixtures/does-not-exist.json']);
  assertFail(result);
  assert(combined(result).includes('[validate-run] ERROR: File not found'));
  assertNoStackTrace(result);
});

test('validate-run rejects every missing required top-level field', () => {
  const valid = readJson('test/fixtures/valid-run.json');
  for (const field of Object.keys(valid)) {
    const candidate = { ...valid };
    delete candidate[field];
    const result = validateStdin(candidate);
    assertFail(result, `field ${field} unexpectedly passed`);
    assert(combined(result).includes('must have required property'), `field ${field}: ${combined(result)}`);
  }
});

test('validate-run rejects invalid values for every run-object field family', () => {
  const valid = readJson('test/fixtures/valid-run.json');
  const cases = [
    ['schema_version', (o) => { o.schema_version = '9.9.0'; }],
    ['id', (o) => { o.id = 'not-a-uuid'; }],
    ['name', (o) => { o.name = '../owned'; }],
    ['experiment_phase', (o) => { o.experiment_phase = 'phase_x'; }],
    ['created_at', (o) => { o.created_at = 'not-a-date'; }],
    ['updated_at', (o) => { o.updated_at = 'not-a-date'; }],
    ['status', (o) => { o.status = 'invalid_status'; }],
    ['current_step', (o) => { o.current_step = 'not-a-skill'; }],
    ['current_app_stage', (o) => { o.current_app_stage = '../stage'; }],
    ['next_action', (o) => { o.next_action = '/fab-forge ../stage'; }],
    ['last_error', (o) => { o.last_error = { type: 'unknown_error', message: 'x' }; }],
    ['spec_path', (o) => { o.spec_path = '../spec.md'; }],
    ['blueprint_path', (o) => { o.blueprint_path = '../blueprint.md'; }],
    ['app_stages', (o) => { o.app_stages = [{ name: '../x', purpose: '', status: 'done', quality_score: 11, artifacts: ['../secret'], notes: null }]; }],
    ['costs', (o) => { o.costs.tokens_in = -1; }],
    ['verifications', (o) => { o.verifications = [{ kind: 'unit', command: '', passed: true, summary: 'ok', timestamp: 'not-a-date' }]; }],
    ['human_decisions', (o) => { o.human_decisions = [{ step: '', decision_needed: '', options: [], decision: null, rationale: null, triggered_at: 'not-a-date', resolved_at: null }]; }],
    ['gate_levels', (o) => { o.gate_levels['fab-launch'] = 'auto'; }],
    ['additionalProperties', (o) => { o.unvalidated_state = true; }],
  ];

  for (const [label, mutate] of cases) {
    const candidate = JSON.parse(JSON.stringify(valid));
    mutate(candidate);
    const result = validateStdin(candidate);
    assertFail(result, `${label} unexpectedly passed`);
  }
});

test('validate-run enforces status × experiment_phase compatibility', () => {
  const candidate = readJson('test/fixtures/valid-run.json');
  candidate.status = 'complete';
  candidate.experiment_phase = 'phase_0_spec';
  const result = validateStdin(candidate);
  assertFail(result);
  assert(combined(result).includes('status "complete" is not valid'));
  assertNoStackTrace(result);
});

test('validate-run accepts fully populated valid run objects', () => {
  const candidate = readJson('test/fixtures/valid-run.json');
  candidate.experiment_phase = 'phase_2_pipeline';
  candidate.status = 'complete';
  candidate.current_step = 'fab-launch';
  candidate.current_app_stage = 'parse-input';
  candidate.next_action = '/fab-retro';
  candidate.last_error = { type: 'external_failure', message: 'Resolved local launch issue' };
  candidate.blueprint_path = 'docs/blueprint.md';
  candidate.app_stages = [{
    name: 'parse-input',
    purpose: 'Parse raw input into normalized fields',
    status: 'done',
    quality_score: 8.75,
    artifacts: ['src/parser.js', '.env.example'],
    notes: 'Ready for launch',
  }];
  candidate.costs = {
    precision: 'measured',
    tokens_in: 10,
    tokens_out: 20,
    api_calls: 2,
    estimated_usd: 0.03,
    budget_usd: 1,
    by_step: {
      'fab-forge': { precision: 'estimated', tokens_in: 5, tokens_out: 9, usd: 0.01 },
    },
  };
  candidate.verifications = [{
    kind: 'local_launch',
    command: 'npm run test',
    passed: true,
    summary: 'All local launch checks passed',
    timestamp: '2026-06-19T12:30:00Z',
  }];
  candidate.human_decisions = [{
    step: 'fab-signal',
    decision_needed: 'Continue with local-only launch?',
    options: ['continue', 'abandon'],
    decision: 'continue',
    rationale: 'Prototype scope is local-only',
    triggered_at: '2026-06-19T12:00:00Z',
    resolved_at: '2026-06-19T12:01:00Z',
  }];

  assertPass(validateStdin(candidate));
});

test('validate-run exhaustively enforces status × phase matrix', () => {
  const valid = readJson('test/fixtures/valid-run.json');
  const matrix = {
    designing: ['phase_0_spec'],
    framing: ['phase_0_spec'],
    forging: ['phase_1_slice', 'phase_2_pipeline'],
    checking: ['phase_1_slice', 'phase_2_pipeline'],
    weaving: ['phase_2_pipeline'],
    verifying: ['phase_2_pipeline'],
    complete: ['phase_2_pipeline'],
    blocked: ['phase_0_spec', 'phase_1_slice', 'phase_2_pipeline'],
    abandoned: ['phase_0_spec', 'phase_1_slice', 'phase_2_pipeline'],
  };
  const phases = ['phase_0_spec', 'phase_1_slice', 'phase_2_pipeline'];

  for (const [status, allowed] of Object.entries(matrix)) {
    for (const phase of phases) {
      const candidate = JSON.parse(JSON.stringify(valid));
      candidate.status = status;
      candidate.experiment_phase = phase;
      if (['forging', 'checking', 'weaving', 'verifying', 'complete'].includes(status)) {
        candidate.app_stages = [{ name: 'api', purpose: 'Build API', status: 'done', quality_score: 8, artifacts: ['src/api.js'], notes: null }];
        candidate.current_app_stage = 'api';
        candidate.next_action = status === 'complete' ? '/fab-retro' : '/fab-forge api';
      }
      if (status === 'complete') {
        candidate.current_step = 'fab-launch';
        candidate.verifications = [{ kind: 'local_launch', command: 'npm start', passed: true, summary: 'app launched', timestamp: '2026-06-19T12:30:00Z' }];
      }
      const result = validateStdin(candidate);
      if (allowed.includes(phase)) {
        assertPass(result, `${status}/${phase} should pass: ${combined(result)}`);
      } else {
        assertFail(result, `${status}/${phase} should fail`);
        assert(combined(result).includes(`status "${status}" is not valid`));
      }
    }
  }
});

test('validate-run rejects empty stdin, mixed args, and malformed file input clearly', () => {
  let result = run(['scripts/validate-run.mjs', '--stdin'], { input: '' });
  assertFail(result);
  assert(combined(result).includes('No JSON received on stdin'));
  assertNoStackTrace(result);

  result = run(['scripts/validate-run.mjs', '--stdin', 'test/fixtures/valid-run.json'], { input: '{}' });
  assertFail(result);
  assert(combined(result).includes('Usage:'));
  assertNoStackTrace(result);

  const temp = mkdtempSync(join(tmpdir(), 'fabrica-bad-json-'));
  try {
    const bad = join(temp, 'bad.json');
    writeFileSync(bad, '{bad json', 'utf-8');
    result = run(['scripts/validate-run.mjs', bad]);
    assertFail(result);
    assert(combined(result).includes('Invalid JSON in'));
    assertNoStackTrace(result);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('_assert-invalid captures expected validation failures without leaking validator stderr', () => {
  const result = run(['scripts/_assert-invalid.mjs']);
  assertPass(result);
  assert(combined(result).includes('invalid-run.json fails as expected'));
  assert(!combined(result).includes('[validate-run] FAILED'), combined(result));
});

test('validate-run rejects nested additional properties in all structured objects', () => {
  const valid = readJson('test/fixtures/valid-run.json');
  const stage = { name: 'api', purpose: 'Build API', status: 'done', quality_score: 8, artifacts: ['src/api.js'], notes: null };
  const cases = [
    ['last_error extra', (o) => { o.last_error = { type: 'invalid_state', message: 'x', stack: 'nope' }; }],
    ['stage extra', (o) => { o.app_stages = [{ ...stage, owner: 'agent' }]; }],
    ['costs extra', (o) => { o.costs.currency = 'USD'; }],
    ['cost by_step extra', (o) => { o.costs.by_step = { 'fab-forge': { precision: 'estimated', tokens_in: 1, tokens_out: 1, usd: 0.01, model: 'x' } }; }],
    ['verification extra', (o) => { o.verifications = [{ kind: 'unit', command: 'npm test', passed: true, summary: 'ok', timestamp: '2026-06-19T12:30:00Z', raw: 'nope' }]; }],
    ['human decision extra', (o) => { o.human_decisions = [{ step: 'fab-signal', decision_needed: 'Pick', options: ['a'], decision: null, rationale: null, triggered_at: '2026-06-19T12:30:00Z', resolved_at: null, raw: 'nope' }]; }],
  ];

  for (const [label, mutate] of cases) {
    const candidate = JSON.parse(JSON.stringify(valid));
    mutate(candidate);
    const result = validateStdin(candidate);
    assertFail(result, `${label} unexpectedly passed`);
  }
});

test('validate-run accepts valid trace integration and terminal complete states', () => {
  const valid = readJson('test/fixtures/valid-run.json');

  const trace = JSON.parse(JSON.stringify(valid));
  trace.status = 'blocked';
  trace.app_stages = [{ name: 'api', purpose: 'Build API', status: 'failed', quality_score: 4, artifacts: ['src/api.js'], notes: null }];
  trace.next_action = '/fab-trace integration';
  assertPass(validateStdin(trace));

  const complete = JSON.parse(JSON.stringify(valid));
  complete.status = 'complete';
  complete.experiment_phase = 'phase_2_pipeline';
  complete.current_step = 'fab-launch';
  complete.current_app_stage = 'api';
  complete.next_action = '/fab-retro';
  complete.app_stages = [{ name: 'api', purpose: 'Build API', status: 'done', quality_score: 9.5, artifacts: ['src/api.js'], notes: 'done' }];
  complete.verifications = [{ kind: 'local_launch', command: 'npm start', passed: true, summary: 'app launched', timestamp: '2026-06-19T12:30:00Z' }];
  assertPass(validateStdin(complete));
});

test('validate-run rejects semantic run-state inconsistencies beyond JSON Schema', () => {
  const valid = readJson('test/fixtures/valid-run.json');
  const baseStage = {
    name: 'api',
    purpose: 'Build the API',
    status: 'done',
    quality_score: 8,
    artifacts: ['src/api.js'],
    notes: null,
  };
  const cases = [
    ['duplicate app stage names', (o) => { o.app_stages = [baseStage, { ...baseStage }]; }, 'duplicate app_stages name'],
    ['current_app_stage missing from stages', (o) => { o.status = 'forging'; o.experiment_phase = 'phase_1_slice'; o.current_app_stage = 'missing'; o.app_stages = [baseStage]; o.next_action = '/fab-forge api'; }, 'current_app_stage "missing"'],
    ['unknown next_action skill', (o) => { o.next_action = '/fab-not-real'; }, 'next_action skill "fab-not-real"'],
    ['forge next_action missing stage argument', (o) => { o.status = 'forging'; o.experiment_phase = 'phase_1_slice'; o.app_stages = [baseStage]; o.next_action = '/fab-forge'; }, 'references unknown app stage'],
    ['forge next_action unknown stage', (o) => { o.status = 'forging'; o.experiment_phase = 'phase_1_slice'; o.app_stages = [baseStage]; o.next_action = '/fab-forge web'; }, 'references unknown app stage "web"'],
    ['trace next_action unknown target', (o) => { o.status = 'blocked'; o.app_stages = [baseStage]; o.next_action = '/fab-trace web'; }, 'unknown trace target "web"'],
    ['complete with unfinished stages', (o) => { o.status = 'complete'; o.experiment_phase = 'phase_2_pipeline'; o.app_stages = [{ ...baseStage, status: 'blocked' }]; o.next_action = '/fab-retro'; }, 'requires all app stages to be done'],
    ['complete with early current_step', (o) => { o.status = 'complete'; o.experiment_phase = 'phase_2_pipeline'; o.app_stages = [baseStage]; o.current_step = 'fab-intake'; o.next_action = '/fab-retro'; }, 'not compatible with current_step'],
    ['forging with no app stages', (o) => { o.status = 'forging'; o.experiment_phase = 'phase_1_slice'; o.app_stages = []; o.next_action = '/fab-frame'; }, 'requires at least one app_stages entry'],
  ];

  for (const [label, mutate, expected] of cases) {
    const candidate = JSON.parse(JSON.stringify(valid));
    mutate(candidate);
    const result = validateStdin(candidate);
    assertFail(result, `${label} unexpectedly passed`);
    assert(combined(result).includes(expected), `${label}: ${combined(result)}`);
    assertNoStackTrace(result);
  }
});

test('validate-run rejects Windows-hostile and trailing-punctuation slugs', () => {
  const valid = readJson('test/fixtures/valid-run.json');
  const cases = [
    ['reserved run name', (o) => { o.name = 'con'; }],
    ['reserved run name with suffix separator', (o) => { o.name = 'aux-api'; }],
    ['trailing dot run name', (o) => { o.name = 'api.'; }],
    ['trailing dash stage', (o) => { o.app_stages = [{ name: 'api-', purpose: 'x', status: 'pending', quality_score: null, artifacts: [], notes: null }]; }],
    ['reserved current stage', (o) => { o.current_app_stage = 'nul'; }],
    ['reserved next action argument', (o) => { o.next_action = '/fab-forge con'; }],
  ];

  for (const [label, mutate] of cases) {
    const candidate = JSON.parse(JSON.stringify(valid));
    mutate(candidate);
    const result = validateStdin(candidate);
    assertFail(result, `${label} unexpectedly passed`);
  }
});

test('validate-run accepts container verification kinds used by Docker-capable prototypes', () => {
  const valid = readJson('test/fixtures/valid-run.json');
  for (const kind of ['container_build', 'static_analysis']) {
    const candidate = JSON.parse(JSON.stringify(valid));
    candidate.verifications = [{
      kind,
      command: kind === 'container_build' ? 'docker compose build' : 'node scripts/check-docker-files.mjs',
      passed: true,
      summary: `${kind} verification passed`,
      timestamp: '2026-06-19T12:30:00Z',
    }];
    assertPass(validateStdin(candidate), `${kind} should validate`);
  }
});

test('validate-run rejects verification kind / command inconsistencies', () => {
  const valid = readJson('test/fixtures/valid-run.json');
  const cases = [
    ['container_build with non-Docker command', { kind: 'container_build', command: 'node scripts/check-docker-files.mjs', passed: true, summary: 'static check', timestamp: '2026-06-19T12:30:00Z' }, 'does not appear to invoke Docker'],
    ['static_analysis with Docker build command', { kind: 'static_analysis', command: 'docker compose build', passed: true, summary: 'container build', timestamp: '2026-06-19T12:30:00Z' }, 'appears to build a container'],
  ];
  for (const [label, verification, expected] of cases) {
    const candidate = JSON.parse(JSON.stringify(valid));
    candidate.verifications = [verification];
    const result = validateStdin(candidate);
    assertFail(result, `${label} unexpectedly passed`);
    assert(combined(result).includes(expected), `${label}: ${combined(result)}`);
    assertNoStackTrace(result);
  }
});

runAll();
