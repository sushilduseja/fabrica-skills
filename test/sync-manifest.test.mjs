import assert from 'assert';
import { copyRepoFixture, mutateJson, run, test, assertPass, assertFail, combined, assertNoStackTrace, runAll } from './_harness.mjs';

test('sync-manifest succeeds in --check mode on repo-clean fixture', () => {
  const temp = copyRepoFixture();
  const result = run(['scripts/sync-manifest.mjs', '--check'], { cwd: temp });
  assertPass(result, combined(result));
});

test('sync-manifest detects missing entry in --check mode', () => {
  const temp = copyRepoFixture();
  const manifestPath = temp + '/skills/manifest.json';
  mutateJson(manifestPath, (data) => {
    data.skills = data.skills.filter((s) => s.id !== 'fab-retro');
  });
  const result = run(['scripts/sync-manifest.mjs', '--check'], { cwd: temp });
  assertFail(result);
  assert(combined(result).includes('CHECK FAILED'));
  assertNoStackTrace(result);
});

test('sync-manifest detects extra manifest entry with missing directory in --check mode', () => {
  const temp = copyRepoFixture();
  const manifestPath = temp + '/skills/manifest.json';
  mutateJson(manifestPath, (data) => {
    data.skills.push({ id: 'fab-ghost', path: 'skills/core/fab-ghost' });
  });
  const result = run(['scripts/sync-manifest.mjs', '--check'], { cwd: temp });
  assertFail(result);
  assert(combined(result).includes('invalid category') || combined(result).includes('not found'));
  assertNoStackTrace(result);
});

test('sync-manifest --write mode exits successfully on clean repo (nothing to write)', () => {
  const temp = copyRepoFixture();
  const result = run(['scripts/sync-manifest.mjs', '--write'], { cwd: temp });
  assertPass(result, combined(result));
  assert(combined(result).includes('nothing to write'));
});

test('sync-manifest --write updates generated files and is idempotent', () => {
  const temp = copyRepoFixture();
  const manifestPath = temp + '/skills/manifest.json';

  mutateJson(manifestPath, (data) => {
    data.skills = data.skills.filter((s) => s.id !== 'fab-retro');
  });

  const writeResult = run(['scripts/sync-manifest.mjs', '--write'], { cwd: temp });
  assertPass(writeResult, `write failed: ${combined(writeResult)}`);
  assert(combined(writeResult).includes('WROTE'));

  const checkResult = run(['scripts/sync-manifest.mjs', '--check'], { cwd: temp });
  assertPass(checkResult, `check after write: ${combined(checkResult)}`);
});

runAll();
