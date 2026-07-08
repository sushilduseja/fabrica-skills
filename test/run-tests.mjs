#!/usr/bin/env node

import assert from 'assert';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');
const node = process.execPath;

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function run(args, options = {}) {
  return spawnSync(node, args, {
    cwd: options.cwd || root,
    input: options.input,
    encoding: 'utf-8',
    env: { ...process.env, ...(options.env || {}) },
  });
}

function combined(result) {
  return `${result.stdout || ''}${result.stderr || ''}`;
}

function assertPass(result, detail = combined(result)) {
  assert.strictEqual(result.status, 0, detail);
}

function assertFail(result, detail = combined(result)) {
  assert.notStrictEqual(result.status, 0, detail);
}

function assertNoStackTrace(result) {
  const out = combined(result);
  assert(!/\n\s*at\s+/.test(out), out);
  assert(!out.includes('Error [ERR_'), out);
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf-8'));
}

function validateStdin(obj) {
  return run(['scripts/validate-run.mjs', '--stdin'], { input: JSON.stringify(obj) });
}

function copyRepoFixture() {
  const temp = mkdtempSync(join(tmpdir(), 'fabrica-skills-test-'));
  for (const entry of ['scripts', 'skills', 'schemas', '.claude-plugin', 'package.json']) {
    cpSync(resolve(root, entry), join(temp, entry), { recursive: true });
  }
  return temp;
}

function mutateJson(path, mutator) {
  const data = JSON.parse(readFileSync(path, 'utf-8'));
  mutator(data);
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

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
    assert(combined(result).includes("must have required property"), `field ${field}: ${combined(result)}`);
  }
});

test('validate-run rejects invalid values for every run-object field family', () => {
  const valid = readJson('test/fixtures/valid-run.json');
  const cases = [
    ['schema_version', (o) => { o.schema_version = '9.9'; }],
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

test('sync-manifest --check succeeds for the committed repo', () => {
  const result = run(['scripts/sync-manifest.mjs', '--check']);
  assertPass(result);
});

test('sync-manifest rejects manifest path traversal without a stack trace', () => {
  const temp = copyRepoFixture();
  try {
    mutateJson(join(temp, 'skills/manifest.json'), (manifest) => {
      manifest.skills[0].path = '../outside';
    });
    const result = run(['scripts/sync-manifest.mjs', '--check'], { cwd: temp });
    assertFail(result);
    assert(combined(result).includes('path traversal') || combined(result).includes('invalid layout'));
    assertNoStackTrace(result);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('sync-manifest rejects unsafe error metadata paths', () => {
  const temp = copyRepoFixture();
  try {
    mutateJson(join(temp, 'skills/manifest.json'), (manifest) => {
      manifest.skills[0].error_metadata_path = 'skills/core/fab-intake/../../errors.json';
    });
    const result = run(['scripts/sync-manifest.mjs', '--check'], { cwd: temp });
    assertFail(result);
    assert(combined(result).includes('path traversal'));
    assertNoStackTrace(result);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('link-skills succeeds, is idempotent, and installs manifest-managed skills', () => {
  const temp = copyRepoFixture();
  try {
    let result = run(['scripts/link-skills.mjs'], { cwd: temp });
    assertPass(result);
    assert(existsSync(join(temp, '.skills/fab-intake')));

    result = run(['scripts/link-skills.mjs'], { cwd: temp });
    assertPass(result);
    assert(combined(result).includes('DONE — 12 skills installed'));
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('link-skills fails before partial install when a source skill is missing', () => {
  const temp = copyRepoFixture();
  try {
    rmSync(join(temp, 'skills/core/fab-intake'), { recursive: true, force: true });
    const result = run(['scripts/link-skills.mjs'], { cwd: temp });
    assertFail(result);
    assert(combined(result).includes('Source directory not found'));
    assert(!existsSync(join(temp, '.skills/fab-blueprint')), 'partial install should not exist');
    assertNoStackTrace(result);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('link-skills rejects manifest path traversal', () => {
  const temp = copyRepoFixture();
  try {
    mutateJson(join(temp, 'skills/manifest.json'), (manifest) => {
      manifest.skills[0].path = 'skills/core/fab-intake/../../../../tmp';
    });
    const result = run(['scripts/link-skills.mjs'], { cwd: temp });
    assertFail(result);
    assert(combined(result).includes('path is unsafe'));
    assertNoStackTrace(result);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('link-skills refuses to write through a symlinked .skills directory', () => {
  const temp = copyRepoFixture();
  const outside = mkdtempSync(join(tmpdir(), 'fabrica-skills-outside-'));
  try {
    try {
      symlinkSync(outside, join(temp, '.skills'), 'dir');
    } catch {
      // Some Windows environments disallow symlink creation for unprivileged users.
      return;
    }
    const result = run(['scripts/link-skills.mjs'], { cwd: temp });
    assertFail(result);
    assert(combined(result).includes('must not be a symlink or junction'));
    assert(!existsSync(join(outside, 'fab-intake')), 'outside directory must not receive writes');
    assertNoStackTrace(result);
  } finally {
    rmSync(temp, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test('link-skills refuses a symlinked global install directory', () => {
  const temp = copyRepoFixture();
  const home = mkdtempSync(join(tmpdir(), 'fabrica-skills-home-'));
  const outside = mkdtempSync(join(tmpdir(), 'fabrica-skills-global-outside-'));
  try {
    try {
      symlinkSync(outside, join(home, '.fabrica-skills'), 'dir');
    } catch {
      return;
    }
    const result = run(['scripts/link-skills.mjs', '--global'], { cwd: temp, env: { HOME: home, USERPROFILE: home } });
    assertFail(result);
    assert(combined(result).includes('global install directory'));
    assert(!existsSync(join(outside, '.skills/fab-intake')), 'outside global directory must not receive writes');
    assertNoStackTrace(result);
  } finally {
    rmSync(temp, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test('skill files contain explicit guardrails and actionable error metadata', () => {
  const manifest = readJson('skills/manifest.json');
  const allowedErrors = new Set(readJson('schemas/run-object.schema.json').properties.last_error.oneOf[1].properties.type.enum);

  for (const skill of manifest.skills) {
    const skillText = readFileSync(resolve(root, skill.path, 'SKILL.md'), 'utf-8');
    assert(skillText.includes('## Execution Guardrails'), `${skill.id} missing execution guardrails`);
    assert(skillText.includes('## Error Handling'), `${skill.id} missing error handling`);

    const errors = readJson(skill.error_metadata_path);
    assert.strictEqual(errors.skill_id, skill.id);
    assert(Array.isArray(errors.errors) && errors.errors.length > 0, `${skill.id} has no errors`);
    for (const err of errors.errors) {
      assert(allowedErrors.has(err.type), `${skill.id} invalid error type ${err.type}`);
      for (const field of ['trigger', 'diagnosis', 'rescue_action', 'user_message']) {
        assert.strictEqual(typeof err[field], 'string', `${skill.id} ${err.type} missing ${field}`);
        assert(err[field].length > 0, `${skill.id} ${err.type} empty ${field}`);
      }
    }
  }
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

test('sync-manifest rejects duplicate ids, category drift, write-field drift, and generated drift', () => {
  const cases = [
    ['duplicate skill id', (temp) => mutateJson(join(temp, 'skills/manifest.json'), (m) => { m.skills.push({ ...m.skills[0] }); }), 'duplicate skill id'],
    ['path category mismatch', (temp) => mutateJson(join(temp, 'skills/manifest.json'), (m) => { m.skills[0].category = 'prototype'; }), 'path category'],
    ['non-readonly empty writes', (temp) => mutateJson(join(temp, 'skills/manifest.json'), (m) => { m.skills[0].writes_fields = []; }), 'writes_fields is empty'],
    ['readonly writes fields', (temp) => mutateJson(join(temp, 'skills/manifest.json'), (m) => { m.skills.find((s) => s.id === 'fab-pulse').writes_fields = ['updated_at']; }), 'read_only but writes_fields'],
    ['unknown write field', (temp) => mutateJson(join(temp, 'skills/manifest.json'), (m) => { m.skills[0].writes_fields.push('owned_by_nobody'); }), 'unknown run object field'],
    ['frontmatter drift', (temp) => {
      const file = join(temp, 'skills/core/fab-intake/SKILL.md');
      writeFileSync(file, readFileSync(file, 'utf-8').replace('category: core', 'category: prototype'), 'utf-8');
    }, 'frontmatter category'],
    ['generated plugin drift', (temp) => {
      const file = join(temp, '.claude-plugin/plugin.json');
      writeFileSync(file, readFileSync(file, 'utf-8').replace('fab-intake', 'fab-intake-drift'), 'utf-8');
    }, 'CHECK FAILED'],
  ];

  for (const [name, mutate, expected] of cases) {
    const temp = copyRepoFixture();
    try {
      mutate(temp);
      const result = run(['scripts/sync-manifest.mjs', '--check'], { cwd: temp });
      assertFail(result, `${name} unexpectedly passed`);
      assert(combined(result).includes(expected), `${name}: ${combined(result)}`);
      assertNoStackTrace(result);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  }
});

test('sync-manifest rejects malformed JSON and unsafe invocation args clearly', () => {
  let temp = copyRepoFixture();
  try {
    writeFileSync(join(temp, 'skills/core/fab-intake/errors.json'), '{bad json', 'utf-8');
    const result = run(['scripts/sync-manifest.mjs', '--check'], { cwd: temp });
    assertFail(result);
    assert(combined(result).includes('Invalid JSON'));
    assertNoStackTrace(result);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }

  temp = copyRepoFixture();
  try {
    const result = run(['scripts/sync-manifest.mjs', '--write-outside'], { cwd: temp });
    assertFail(result);
    assert(combined(result).includes('Usage:'));
    assertNoStackTrace(result);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('link-skills preserves unrelated fab-* skills and refreshes broken managed symlinks', () => {
  const temp = copyRepoFixture();
  try {
    mkdirSync(join(temp, '.skills'), { recursive: true });
    mkdirSync(join(temp, '.skills/fab-custom'), { recursive: true });
    writeFileSync(join(temp, '.skills/fab-custom/KEEP'), 'keep', 'utf-8');
    try {
      symlinkSync(join(temp, 'missing-target'), join(temp, '.skills/fab-intake'), 'dir');
    } catch {
      // Symlinks may be unavailable on some Windows environments; still test preservation.
    }

    const result = run(['scripts/link-skills.mjs'], { cwd: temp });
    assertPass(result);
    assert(existsSync(join(temp, '.skills/fab-custom/KEEP')), 'unrelated fab-* skill must be preserved');
    assert(existsSync(join(temp, '.skills/fab-intake/SKILL.md')), 'managed skill must be refreshed');
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('link-skills rejects regular-file .skills, malformed manifests, and bad args clearly', () => {
  let temp = copyRepoFixture();
  try {
    writeFileSync(join(temp, '.skills'), 'not a directory', 'utf-8');
    const result = run(['scripts/link-skills.mjs'], { cwd: temp });
    assertFail(result);
    assert(combined(result).includes('exists but is not a directory'));
    assertNoStackTrace(result);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }

  temp = copyRepoFixture();
  try {
    writeFileSync(join(temp, 'skills/manifest.json'), '{bad json', 'utf-8');
    const result = run(['scripts/link-skills.mjs'], { cwd: temp });
    assertFail(result);
    assert(combined(result).includes('Invalid JSON in skills/manifest.json'));
    assertNoStackTrace(result);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }

  temp = copyRepoFixture();
  try {
    const result = run(['scripts/link-skills.mjs', '--unknown'], { cwd: temp });
    assertFail(result);
    assert(combined(result).includes('Usage:'));
    assertNoStackTrace(result);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});


test('schema accepts container verification kinds used by Docker-capable prototypes', () => {
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

test('core skills document full-stack container hardening requirements', () => {
  const blueprint = readFileSync(resolve(root, 'skills/core/fab-blueprint/SKILL.md'), 'utf-8');
  const frame = readFileSync(resolve(root, 'skills/core/fab-frame/SKILL.md'), 'utf-8');
  const forge = readFileSync(resolve(root, 'skills/core/fab-forge/SKILL.md'), 'utf-8');
  const launch = readFileSync(resolve(root, 'skills/prototype/fab-launch/SKILL.md'), 'utf-8');

  assert(blueprint.includes('React, FastAPI, SQLite, Docker'));
  assert(blueprint.includes('Container-only absolute paths'));
  assert(frame.includes('Do not use `latest`'));
  assert(frame.includes('vite-env.d.ts'));
  assert(frame.includes('Dockerfile'));
  assert(forge.includes('Avoid `latest`'));
  assert(forge.includes('/data/app.db'));
  assert(launch.includes('container_build'));
  assert(launch.includes('static_analysis'));
  assert(launch.includes('do not claim Docker runtime verification passed'));
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
  assertPass(validateStdin(complete));
});

test('sync-manifest rejects symlinked skill directories and unsafe path variants', () => {
  let temp = copyRepoFixture();
  try {
    const original = join(temp, 'skills/core/fab-intake');
    const moved = join(temp, 'skills/core/fab-intake-real');
    rmSync(moved, { recursive: true, force: true });
    try {
      cpSync(original, moved, { recursive: true });
      rmSync(original, { recursive: true, force: true });
      symlinkSync(moved, original, 'dir');
    } catch {
      rmSync(temp, { recursive: true, force: true });
      return;
    }
    const result = run(['scripts/sync-manifest.mjs', '--check'], { cwd: temp });
    assertFail(result);
    assert(combined(result).includes('must not be a symlink or junction'));
    assertNoStackTrace(result);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }

  temp = copyRepoFixture();
  try {
    mutateJson(join(temp, 'skills/manifest.json'), (manifest) => {
      manifest.skills[0].path = 'skills\\core\\fab-intake';
    });
    const result = run(['scripts/sync-manifest.mjs', '--check'], { cwd: temp });
    assertFail(result);
    assert(combined(result).includes('backslashes'));
    assertNoStackTrace(result);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('link-skills rejects duplicate ids, source symlinks, global file targets, and preserves non-fab entries', () => {
  let temp = copyRepoFixture();
  try {
    mutateJson(join(temp, 'skills/manifest.json'), (manifest) => {
      manifest.skills.push({ ...manifest.skills[0] });
    });
    const result = run(['scripts/link-skills.mjs'], { cwd: temp });
    assertFail(result);
    assert(combined(result).includes('duplicate skill ids'));
    assertNoStackTrace(result);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }

  temp = copyRepoFixture();
  try {
    const original = join(temp, 'skills/core/fab-intake');
    const moved = join(temp, 'skills/core/fab-intake-real');
    try {
      cpSync(original, moved, { recursive: true });
      rmSync(original, { recursive: true, force: true });
      symlinkSync(moved, original, 'dir');
    } catch {
      rmSync(temp, { recursive: true, force: true });
      return;
    }
    const result = run(['scripts/link-skills.mjs'], { cwd: temp });
    assertFail(result);
    assert(combined(result).includes('must be a real directory'));
    assertNoStackTrace(result);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }

  temp = copyRepoFixture();
  const home = mkdtempSync(join(tmpdir(), 'fabrica-skills-home-file-'));
  try {
    writeFileSync(join(home, '.fabrica-skills'), 'not a directory', 'utf-8');
    const result = run(['scripts/link-skills.mjs', '--global'], { cwd: temp, env: { HOME: home, USERPROFILE: home } });
    assertFail(result);
    assert(combined(result).includes('global install directory exists but is not a directory'));
    assertNoStackTrace(result);
  } finally {
    rmSync(temp, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }

  temp = copyRepoFixture();
  try {
    mkdirSync(join(temp, '.skills'), { recursive: true });
    mkdirSync(join(temp, '.skills/custom-skill'), { recursive: true });
    writeFileSync(join(temp, '.skills/custom-skill/KEEP'), 'keep', 'utf-8');
    const result = run(['scripts/link-skills.mjs'], { cwd: temp });
    assertPass(result);
    assert(existsSync(join(temp, '.skills/custom-skill/KEEP')), 'non-fab custom skill must be preserved');
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});


test('documentation is synchronized with state machine and validation implementation', () => {
  const read = (file) => readFileSync(resolve(root, file), 'utf-8');
  const readme = read('README.md');
  const stateMachine = read('docs/STATE_MACHINE.md');
  const validation = read('docs/VALIDATION.md');
  const shared = read('skills/shared/run-object-schema.md');
  const claude = read('CLAUDE.md');

  assert(readme.includes('[`docs/STATE_MACHINE.md`](docs/STATE_MACHINE.md)'));
  assert(!readme.includes('fab-ledger'));
  assert(stateMachine.includes('```mermaid'));
  assert(stateMachine.includes('/fab-intake'));
  assert(stateMachine.includes('/fab-launch'));
  assert(stateMachine.includes('container_build'));
  assert(stateMachine.includes('static_analysis'));
  assert(validation.includes('32/32 tests passed'));
  assert(validation.includes('Post-schema semantic validation'));
  assert(shared.includes('docs/STATE_MACHINE.md'));
  assert(shared.includes('container_build'));
  assert(shared.includes('static_analysis'));
  assert(claude.includes('docs/STATE_MACHINE.md'));
  assert(claude.includes('semantic run-state invariants'));
});

let failed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(err.stack || err.message);
  }
}

if (failed > 0) {
  console.error(`\n${failed}/${tests.length} tests failed`);
  process.exit(1);
}

console.log(`\n${tests.length}/${tests.length} tests passed`);
