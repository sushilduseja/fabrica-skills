#!/usr/bin/env node

import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { resolve } from 'path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');
const node = process.execPath;

const DEFAULT_CASES = [
  {
    fixture: 'test/fixtures/invalid-run.json',
    expected: ['/status', '/app_stages/0/quality_score'],
  },
  {
    fixture: 'test/fixtures/invalid-gate-keys.json',
    expected: ['/gate_levels'],
  },
];

function fail(msg, output = '') {
  console.error(`[assert-invalid] FAIL: ${msg}`);
  if (output) {
    console.error(output.trimEnd());
  }
  process.exit(1);
}

function assertInvalid(fixture, expected) {
  const result = spawnSync(node, ['scripts/validate-run.mjs', fixture], {
    cwd: root,
    encoding: 'utf-8',
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`;

  if (result.error) {
    fail(`Could not run validator for ${fixture}: ${result.error.message}`);
  }
  if (result.status === 0) {
    fail(`Expected ${fixture} to fail validation, but it passed`, output);
  }
  if (/\n\s*at\s+/.test(output) || output.includes('Error [ERR_')) {
    fail(`Validator produced a stack trace for ${fixture}`, output);
  }

  const missing = expected.filter((snippet) => !output.includes(snippet));
  if (missing.length > 0) {
    fail(`Expected ${fixture} output to include: ${missing.join(', ')}`, output);
  }

  console.log(`[assert-invalid] OK — ${fixture} fails as expected (${expected.join(', ')})`);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  for (const testCase of DEFAULT_CASES) {
    assertInvalid(testCase.fixture, testCase.expected);
  }
  process.exit(0);
}

if (args.length < 2) {
  fail('Usage: node scripts/_assert-invalid.mjs [<fixture> <expected-output> ...]');
}

assertInvalid(args[0], args.slice(1));
