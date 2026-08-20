import assert from 'assert';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  copyRepoFixture,
  mutateJson,
  run,
  test,
  assertPass,
  assertFail,
  combined,
  assertNoStackTrace,
  runAll,
} from './_harness.mjs';

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

test('sync-manifest detects frontmatter name drift from manifest', () => {
  const temp = copyRepoFixture();
  const skillMdPath = join(temp, 'skills/core/fab-intake/SKILL.md');
  const content = readFileSync(skillMdPath, 'utf-8');
  const patched = content.replace(/^name:\s*fab-intake$/m, 'name: fab-intake-modified');
  writeFileSync(skillMdPath, patched, 'utf-8');
  const result = run(['scripts/sync-manifest.mjs', '--check'], { cwd: temp });
  assertFail(result);
  assert(combined(result).includes('frontmatter name does not match manifest'), combined(result));
  assertNoStackTrace(result);
});

test('sync-manifest detects frontmatter phase drift from manifest', () => {
  const temp = copyRepoFixture();
  const skillMdPath = join(temp, 'skills/core/fab-intake/SKILL.md');
  const content = readFileSync(skillMdPath, 'utf-8');
  const patched = content.replace(/^phase:\s*0$/m, 'phase: 2');
  writeFileSync(skillMdPath, patched, 'utf-8');
  const result = run(['scripts/sync-manifest.mjs', '--check'], { cwd: temp });
  assertFail(result);
  assert(combined(result).includes('frontmatter phase does not match manifest phase'), combined(result));
  assertNoStackTrace(result);
});

test('sync-manifest detects orphaned error type in errors.json not mentioned in SKILL.md', () => {
  const temp = copyRepoFixture();
  const errPath = join(temp, 'skills/core/fab-intake/errors.json');
  const errMeta = JSON.parse(readFileSync(errPath, 'utf-8'));
  // Add prerequisite_missing — valid in schema, but NOT in fab-intake's SKILL.md Error Handling section.
  errMeta.errors.push({
    type: 'prerequisite_missing',
    trigger: 'Not in SKILL.md',
    diagnosis: 'x',
    rescue_action: 'y',
    user_message: 'z',
  });
  writeFileSync(errPath, JSON.stringify(errMeta, null, 2), 'utf-8');
  const result = run(['scripts/sync-manifest.mjs', '--check'], { cwd: temp });
  assertFail(result);
  assert(combined(result).includes('but it is not mentioned in the SKILL.md'), combined(result));
  assertNoStackTrace(result);
});

runAll();
