#!/usr/bin/env node
/**
 * End-to-end checkpoint-gate harness: drives scripts/validate-run.mjs (the same
 * choke-point every skill write must pass) with candidate run objects mutated
 * from test/fixtures/valid-run.json, and asserts the mechanical spec/plan
 * checkpoint contract from both directions.
 *
 *   npm run test:e2e
 *
 * Exit code 0 = all checks pass. Node-only (no bash dependency) so the harness
 * runs everywhere `npm run check` runs. Requires devDependencies (ajv) only;
 * nothing here ships in the npm package (test/ is unpacked).
 */
import assert from 'assert';
import { spawnSync } from 'child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const node = process.execPath;
const VALIDATOR = join(root, 'scripts', 'validate-run.mjs');
const APPROVE = join(root, 'scripts', 'approve.mjs');
const FIXTURE = join(root, 'test', 'fixtures', 'valid-run.json');
const tmp = mkdtempSync(join(tmpdir(), 'fabrica-e2e-'));

let PASS = 0;
let FAIL = 0;

function pass(name) {
  PASS += 1;
  console.log(`ok   ${name}`);
}

function fail(name, detail) {
  FAIL += 1;
  console.error(`FAIL ${name}`);
  if (detail) console.error(`     ${detail}`);
}

function readFixture() {
  return JSON.parse(readFileSync(FIXTURE, 'utf-8'));
}

function clone(run) {
  return JSON.parse(JSON.stringify(run));
}

function runValidator(args, input) {
  return spawnSync(node, [VALIDATOR, ...args], { encoding: 'utf-8', input });
}

function combined(result) {
  return `${result.stdout || ''}${result.stderr || ''}`;
}

// checkMut <name> <expected-rc> <grep-pattern|''> <mutator>
function checkMut(name, expected, pattern, mutate) {
  const candidate = mutate(clone(readFixture()));
  const result = runValidator(['--stdin'], JSON.stringify(candidate));
  if (result.status !== expected) {
    fail(name, `expected rc=${expected}, got rc=${result.status}\n${combined(result)}`);
    return;
  }
  if (pattern && !combined(result).includes(pattern)) {
    fail(name, `output missing pattern: ${pattern}\n${combined(result)}`);
    return;
  }
  pass(name);
}

function writeTmp(name, candidate) {
  const path = join(tmp, name);
  writeFileSync(path, JSON.stringify(candidate, null, 2) + '\n', 'utf-8');
  return path;
}

try {
  checkMut('baseline fixture validates', 0, '', (run) => run);
  checkMut('record-less spec write is rejected', 1, 'contains no approval', (run) => {
    run.human_decisions = [];
    return run;
  });

  // Failed --commit leaves the live run file byte-identical.
  {
    const rejected = clone(readFixture());
    rejected.human_decisions = [];
    const live = writeTmp('live.json', readFixture());
    const before = readFileSync(live, 'utf-8');
    const result = runValidator(['--stdin', '--commit', live], JSON.stringify(rejected));
    if (result.status !== 0 && readFileSync(live, 'utf-8') === before) {
      pass('failed --commit leaves live run byte-identical');
    } else {
      fail('failed --commit leaves live run byte-identical', combined(result));
    }
  }

  checkMut('record-carrying spec write is accepted', 0, '', (run) => run);
  checkMut('record-less blueprint write is rejected', 1, 'approve blueprint', (run) => {
    run.current_step = 'fab-plan';
    run.blueprint_path = 'docs/blueprint.md';
    run.human_decisions = [];
    return run;
  });
  checkMut('blueprint write with its own record is accepted', 0, '', (run) => {
    run.current_step = 'fab-plan';
    run.blueprint_path = 'docs/blueprint.md';
    run.human_decisions = [
      {
        step: 'fab-plan',
        decision_needed: 'Approve the blueprint',
        options: ['approve', 'revise', 'reject'],
        decision: 'approve',
        rationale: 'approved',
        triggered_at: '2026-06-19T12:10:00Z',
        resolved_at: '2026-06-19T12:15:00Z',
      },
    ];
    return run;
  });
  checkMut('auto gate is exempt', 0, '', (run) => {
    run.gate_levels['fab-spec'] = 'auto';
    run.human_decisions = [];
    return run;
  });
  checkMut('pending approval does not unlock', 1, 'contains no approval', (run) => {
    run.human_decisions = [
      {
        step: 'fab-spec',
        decision_needed: 'Approve',
        options: ['approve', 'revise', 'reject'],
        decision: null,
        rationale: 'pending',
        triggered_at: '2026-06-19T12:10:00Z',
        resolved_at: null,
      },
    ];
    return run;
  });
  {
    const stripped = clone(readFixture());
    stripped.human_decisions = [];
    const target = writeTmp('filemode.json', stripped);
    const result = runValidator([target]);
    if (result.status !== 0) {
      pass('file mode rejects record-less spec');
    } else {
      fail('file mode rejects record-less spec', combined(result));
    }
  }
  checkMut('later phase is unaffected', 0, '', (run) => {
    run.current_step = 'fab-scaffold';
    run.human_decisions = [];
    return run;
  });
  checkMut('existing-project record-less spec is rejected', 1, 'docs/fabrica/spec.md', (run) => {
    run.spec_path = 'docs/fabrica/spec.md';
    run.human_decisions = [];
    return run;
  });
  checkMut('existing-project approved spec is accepted', 0, '', (run) => {
    run.spec_path = 'docs/fabrica/spec.md';
    return run;
  });
  checkMut('later revise record does not void prior approval', 0, '', (run) => {
    run.human_decisions = [
      ...run.human_decisions,
      {
        step: 'fab-spec',
        decision_needed: 'Approve revised spec',
        options: ['approve', 'revise', 'reject'],
        decision: 'revise',
        rationale: 'revise',
        triggered_at: '2026-06-19T12:20:00Z',
        resolved_at: '2026-06-19T12:21:00Z',
      },
    ];
    return run;
  });

  // Piped stdin cannot mint approval (spawn pipes => isTTY false, like </dev/null).
  {
    const target = writeTmp('approve-run.json', readFixture());
    const before = readFileSync(target, 'utf-8');
    const result = spawnSync(node, [APPROVE, 'spec', '--file', target], {
      encoding: 'utf-8',
      input: 'approve spec\n',
    });
    if (result.status !== 0 && combined(result).includes('terminal') && readFileSync(target, 'utf-8') === before) {
      pass('piped approve refuses and leaves run byte-identical');
    } else {
      fail('piped approve refusal', combined(result));
    }
  }

  // Sanity: the harness itself stays honest (assert is live even outside test()).
  assert(PASS + FAIL === 14, `expected 14 checks, ran ${PASS + FAIL}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`# ${PASS} passed, ${FAIL} failed`);
if (FAIL > 0) process.exit(1);
