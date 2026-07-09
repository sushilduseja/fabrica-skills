import assert from 'assert';
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
export const root = resolve(__dirname, '..');
const node = process.execPath;

export const tests = [];

export function test(name, fn) {
  tests.push({ name, fn });
}

export function run(args, options = {}) {
  return spawnSync(node, args, {
    cwd: options.cwd || root,
    input: options.input,
    encoding: 'utf-8',
    env: { ...process.env, ...(options.env || {}) },
  });
}

export function combined(result) {
  return `${result.stdout || ''}${result.stderr || ''}`;
}

export function assertPass(result, detail = combined(result)) {
  assert.strictEqual(result.status, 0, detail);
}

export function assertFail(result, detail = combined(result)) {
  assert.notStrictEqual(result.status, 0, detail);
}

export function assertNoStackTrace(result) {
  const out = combined(result);
  assert(!/\n\s*at\s+/.test(out), out);
  assert(!out.includes('Error [ERR_'), out);
}

export function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf-8'));
}

export function validateStdin(obj) {
  return run(['scripts/validate-run.mjs', '--stdin'], { input: JSON.stringify(obj) });
}

export function copyRepoFixture() {
  const temp = mkdtempSync(join(tmpdir(), 'fabrica-skills-test-'));
  for (const entry of ['scripts', 'skills', 'schemas', '.claude-plugin', 'package.json']) {
    const src = resolve(root, entry);
    if (existsSync(src)) {
      cpSync(src, join(temp, entry), { recursive: true });
    }
  }
  return temp;
}

export function mutateJson(path, mutator) {
  const data = JSON.parse(readFileSync(path, 'utf-8'));
  mutator(data);
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

export function runAll() {
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
}
