import assert from 'assert';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { copyRepoFixture, mutateJson, run, test, assertPass, assertFail, combined, assertNoStackTrace, runAll } from './_harness.mjs';

test('link-skills succeeds, is idempotent, and installs all manifest-managed skills', () => {
  const temp = copyRepoFixture();
  try {
    let result = run(['scripts/link-skills.mjs'], { cwd: temp });
    assertPass(result, combined(result));
    assert(existsSync(join(temp, '.skills/fab-intake/SKILL.md')));

    result = run(['scripts/link-skills.mjs'], { cwd: temp });
    assertPass(result, combined(result));
    assert(combined(result).includes('DONE'));
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('link-skills fails before partial install when a source is missing', () => {
  const temp = copyRepoFixture();
  try {
    rmSync(join(temp, 'skills/core/fab-intake'), { recursive: true, force: true });
    const result = run(['scripts/link-skills.mjs'], { cwd: temp });
    assertFail(result);
    assert(combined(result).includes('Source directory not found'));
    assert(!existsSync(join(temp, '.skills/fab-blueprint')));
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
      return;
    }
    const result = run(['scripts/link-skills.mjs'], { cwd: temp });
    assertFail(result);
    assert(combined(result).includes('must not be a symlink or junction'));
    assert(!existsSync(join(outside, 'fab-intake')));
    assertNoStackTrace(result);
  } finally {
    rmSync(temp, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test('link-skills --global happy path creates global install', () => {
  const temp = copyRepoFixture();
  const home = mkdtempSync(join(tmpdir(), 'fabrica-skills-global-'));
  try {
    const result = run(['scripts/link-skills.mjs', '--global'], {
      cwd: temp,
      env: { HOME: home, USERPROFILE: home },
    });
    assertPass(result, combined(result));
    assert(existsSync(join(home, '.fabrica-skills', '.skills', 'fab-intake', 'SKILL.md')));
    assert(combined(result).includes('DONE'));
  } finally {
    rmSync(temp, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test('link-skills preserves custom fab-* skills and refreshes broken symlinks', () => {
  const temp = copyRepoFixture();
  try {
    mkdirSync(join(temp, '.skills'), { recursive: true });
    mkdirSync(join(temp, '.skills/fab-custom'), { recursive: true });
    writeFileSync(join(temp, '.skills/fab-custom/KEEP'), 'keep', 'utf-8');
    try {
      symlinkSync(join(temp, 'missing-target'), join(temp, '.skills/fab-intake'), 'dir');
    } catch {
      // Symlinks unsupported; still test preservation.
    }

    const result = run(['scripts/link-skills.mjs'], { cwd: temp });
    assertPass(result, combined(result));
    assert(existsSync(join(temp, '.skills/fab-custom/KEEP')));
    assert(existsSync(join(temp, '.skills/fab-intake/SKILL.md')));
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

test('link-skills --global rejects when target exists as a regular file', () => {
  const temp = copyRepoFixture();
  const home = mkdtempSync(join(tmpdir(), 'fabrica-skills-global-file-'));
  try {
    writeFileSync(join(home, '.fabrica-skills'), 'not a directory', 'utf-8');
    const result = run(['scripts/link-skills.mjs', '--global'], {
      cwd: temp,
      env: { HOME: home, USERPROFILE: home },
    });
    assertFail(result);
    assert(combined(result).includes('global install directory exists but is not a directory'));
    assertNoStackTrace(result);
  } finally {
    rmSync(temp, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test('link-skills rejects duplicate ids and source symlinks', () => {
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
});

runAll();
