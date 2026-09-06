import assert from 'assert';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { assertWithinRoot } from '../scripts/_path-utils.mjs';
import {
  copyRepoFixture,
  mutateJson,
  root,
  run,
  test,
  assertPass,
  assertFail,
  combined,
  assertNoStackTrace,
  runAll,
} from './_harness.mjs';

test('link-skills succeeds, is idempotent, and installs all manifest-managed skills', () => {
  const temp = copyRepoFixture();
  try {
    let result = run(['scripts/link-skills.mjs'], { cwd: temp });
    assertPass(result, combined(result));
    assert(existsSync(join(temp, '.skills/fab-spec/SKILL.md')));

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
    rmSync(join(temp, 'skills/core/fab-spec'), { recursive: true, force: true });
    const result = run(['scripts/link-skills.mjs'], { cwd: temp });
    assertFail(result);
    assert(combined(result).includes('Source directory not found'));
    assert(!existsSync(join(temp, '.skills/fab-plan')));
    assertNoStackTrace(result);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('link-skills rejects manifest path traversal', () => {
  const temp = copyRepoFixture();
  try {
    mutateJson(join(temp, 'skills/manifest.json'), (manifest) => {
      manifest.skills[0].path = 'skills/core/fab-spec/../../../../tmp';
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
    assert(!existsSync(join(outside, 'fab-spec')));
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
    assert(existsSync(join(home, '.fabrica-skills', '.skills', 'fab-spec', 'SKILL.md')));
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
      symlinkSync(join(temp, 'missing-target'), join(temp, '.skills/fab-spec'), 'dir');
    } catch {
      // Symlinks unsupported; still test preservation.
    }

    const result = run(['scripts/link-skills.mjs'], { cwd: temp });
    assertPass(result, combined(result));
    assert(existsSync(join(temp, '.skills/fab-custom/KEEP')));
    assert(existsSync(join(temp, '.skills/fab-spec/SKILL.md')));
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
    const original = join(temp, 'skills/core/fab-spec');
    const moved = join(temp, 'skills/core/fab-spec-real');
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

test('link-skills --global refuses symlinked .skills directory', () => {
  const temp = copyRepoFixture();
  const home = mkdtempSync(join(tmpdir(), 'fabrica-skills-global-sym-'));
  const outside = mkdtempSync(join(tmpdir(), 'fabrica-skills-outside-global-'));
  try {
    mkdirSync(join(home, '.fabrica-skills'), { recursive: true });
    try {
      symlinkSync(outside, join(home, '.fabrica-skills', '.skills'), 'dir');
    } catch {
      return;
    }
    const result = run(['scripts/link-skills.mjs', '--global'], {
      cwd: temp,
      env: { HOME: home, USERPROFILE: home },
    });
    assertFail(result);
    assert(combined(result).includes('must not be a symlink or junction'));
    assert(!existsSync(join(outside, 'fab-spec')));
    assertNoStackTrace(result);
  } finally {
    rmSync(temp, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test('link-skills preserves non-manifest skills through repeated setup', () => {
  const temp = copyRepoFixture();
  try {
    mkdirSync(join(temp, '.skills'), { recursive: true });
    mkdirSync(join(temp, '.skills/fab-mytool'), { recursive: true });
    writeFileSync(join(temp, '.skills/fab-mytool/KEEP'), 'keep', 'utf-8');
    mkdirSync(join(temp, '.skills/other-tool'), { recursive: true });
    writeFileSync(join(temp, '.skills/other-tool/KEEP'), 'keep', 'utf-8');

    let result = run(['scripts/link-skills.mjs'], { cwd: temp });
    assertPass(result, combined(result));
    assert(existsSync(join(temp, '.skills/fab-mytool/KEEP')), 'fab-mytool should survive first run');
    assert(existsSync(join(temp, '.skills/other-tool/KEEP')), 'other-tool should survive first run');

    result = run(['scripts/link-skills.mjs'], { cwd: temp });
    assertPass(result, combined(result));
    assert(existsSync(join(temp, '.skills/fab-mytool/KEEP')), 'fab-mytool should survive second run');
    assert(existsSync(join(temp, '.skills/other-tool/KEEP')), 'other-tool should survive second run');

    assertNoStackTrace(result);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

/**
 * Patch link-skills.mjs so every symlink/junction call throws EPERM.
 * This forces the copy-fallback path regardless of host platform.
 */
function patchForEPermFallback(scriptsDir) {
  const mjsPath = join(scriptsDir, 'link-skills.mjs');
  const orig = readFileSync(mjsPath, 'utf-8');
  const patched = orig
    .replace("const isWindows = process.platform === 'win32';", 'const isWindows = true;')
    .replace(
      "symlinkSync(skillPath, linkDest, 'junction');",
      "const __e = new Error('simulated EPERM'); __e.code = 'EPERM'; throw __e;",
    )
    .replace(
      "symlinkSync(rel, linkDest, 'dir');",
      "const __e = new Error('simulated EPERM'); __e.code = 'EPERM'; throw __e;",
    );
  writeFileSync(mjsPath, patched, 'utf-8');
}

test('link-skills falls back to copy when junction/symlink fails with EPERM', () => {
  const temp = copyRepoFixture();
  try {
    patchForEPermFallback(join(temp, 'scripts'));
    const result = run(['scripts/link-skills.mjs'], { cwd: temp });
    assertPass(result, combined(result));
    const out = combined(result);
    assert(out.includes('COPY'), `expected COPY output but got:\n${out}`);
    assert(existsSync(join(temp, '.skills/fab-spec/SKILL.md')));
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('link-skills EPERM copy-fallback refreshes stale copies on rerun', () => {
  const temp = copyRepoFixture();
  try {
    patchForEPermFallback(join(temp, 'scripts'));

    // First run — creates copies.
    let result = run(['scripts/link-skills.mjs'], { cwd: temp });
    assertPass(result, combined(result));

    // Modify a source SKILL.md after the first install.
    const sourceMd = join(temp, 'skills/core/fab-spec/SKILL.md');
    const marker = '\n<!-- STALENESS_MARKER_REFRESHED -->\n';
    writeFileSync(sourceMd, readFileSync(sourceMd, 'utf-8') + marker, 'utf-8');

    // Second run — copies should be refreshed (remove + re-copy).
    result = run(['scripts/link-skills.mjs'], { cwd: temp });
    assertPass(result, combined(result));

    // Assert the copy in .skills/ has the marker (proving refresh).
    const copyMd = readFileSync(join(temp, '.skills/fab-spec/SKILL.md'), 'utf-8');
    assert(copyMd.endsWith(marker), 'expected copy to be refreshed with source change');
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('link-skills removes a managed skill entry that is a symlink to outside without touching its target', () => {
  const temp = copyRepoFixture();
  const outside = mkdtempSync(join(tmpdir(), 'fabrica-skills-outside-skill-'));
  try {
    mkdirSync(join(temp, '.skills'), { recursive: true });
    writeFileSync(join(outside, 'MARKER'), 'do-not-delete', 'utf-8');
    try {
      symlinkSync(outside, join(temp, '.skills', 'fab-spec'), 'dir');
    } catch {
      rmSync(temp, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
      return;
    }

    const result = run(['scripts/link-skills.mjs'], { cwd: temp });
    assertPass(result, combined(result));
    assert(existsSync(join(outside, 'MARKER')), 'symlink target must remain untouched');
    assert(!existsSync(join(outside, 'SKILL.md')), 'must not write through the symlink into its target');
    assert(existsSync(join(temp, '.skills', 'fab-spec', 'SKILL.md')), 'managed entry should be reinstalled');
  } finally {
    rmSync(temp, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test('link-skills recovers from ENOTEMPTY when clearing a managed entry (rmdirSync retry)', () => {
  const temp = copyRepoFixture();
  try {
    mkdirSync(join(temp, '.skills', 'fab-spec'), { recursive: true });

    const mjsPath = join(temp, 'scripts', 'link-skills.mjs');
    const orig = readFileSync(mjsPath, 'utf-8');
    const patched = orig.replace(
      'rmSync(linkDest, { recursive: true, force: true });',
      "const __e = new Error('simulated ENOTEMPTY'); __e.code = 'ENOTEMPTY'; throw __e;",
    );
    writeFileSync(mjsPath, patched, 'utf-8');

    const result = run(['scripts/link-skills.mjs'], { cwd: temp });
    assertPass(result, combined(result));
    assert(combined(result).includes('CLEAN'), combined(result));
    assert(existsSync(join(temp, '.skills', 'fab-spec', 'SKILL.md')));
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('link-skills creates alias entries pointing at the canonical skill source', () => {
  const temp = copyRepoFixture();
  try {
    const result = run(['scripts/link-skills.mjs'], { cwd: temp });
    assertPass(result, combined(result));
    assert(existsSync(join(temp, '.skills/fab-code-review/SKILL.md')));
    const content = readFileSync(join(temp, '.skills/fab-code-review/SKILL.md'), 'utf-8');
    assert(content.includes('name: fabrica-code-review'), content.slice(0, 200));
    assertNoStackTrace(result);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('assertWithinRoot allows nested paths including spaces, rejects escapes', () => {
  const rootWithSpace = join(tmpdir(), 'fabrica home with space');
  assertWithinRoot(join(rootWithSpace, '.fabrica-skills', '.skills', 'fab-spec'), rootWithSpace);
  assertWithinRoot(rootWithSpace, rootWithSpace);
  assert.throws(() => assertWithinRoot(join(rootWithSpace, '..', 'outside'), rootWithSpace), /outside allowed root/);
  assert.throws(() => assertWithinRoot(`${rootWithSpace}-evil`, rootWithSpace), /outside allowed root/);
});

test('link-skills --global installs under a space-containing home with no short-name substitution', () => {
  const temp = copyRepoFixture();
  const spaceHome = join(tmpdir(), 'fabrica Test User');
  mkdirSync(spaceHome, { recursive: true });
  try {
    const result = run(['scripts/link-skills.mjs', '--global'], {
      cwd: temp,
      env: { HOME: spaceHome, USERPROFILE: spaceHome },
    });
    assertPass(result, combined(result));
    const out = combined(result);
    assert(out.includes('GLOBAL'), out);
    // The space in the home dir name must survive path resolution intact.
    // (Any `~` elsewhere in the line comes from TMPDIR's own short-name
    // prefix in this environment, not from substitution of our segment.)
    assert(out.includes('fabrica Test User'), `home with space must survive intact: ${out}`);
    assert(
      out.includes(join(spaceHome, '.fabrica-skills', '.skills')),
      `install must land under the exact space-containing home: ${out}`,
    );
    assert(existsSync(join(spaceHome, '.fabrica-skills', '.skills', 'fab-spec', 'SKILL.md')));
    assertNoStackTrace(result);
  } finally {
    rmSync(temp, { recursive: true, force: true });
    rmSync(spaceHome, { recursive: true, force: true });
  }
});

test('repo contains no shell-string path interpolation (8.3 short-name bug class)', () => {
  const roots = [join(root, 'scripts'), join(root, 'bin')];
  const forbidden = ['execSync(', 'exec(`', 'shell:', 'cmd /c', 'cmd.exe', '%USERPROFILE%', '%HOMEPATH%', '%HOME%'];
  const offenders = [];
  for (const dir of roots) {
    for (const entry of readdirSync(dir)) {
      if (!entry.endsWith('.mjs')) continue;
      const content = readFileSync(join(dir, entry), 'utf8');
      for (const token of forbidden) {
        if (content.includes(token)) offenders.push(`${entry}: ${token}`);
      }
      if (/spawnSync\(\s*['"`]/.test(content)) offenders.push(`${entry}: spawn with string command`);
    }
  }
  assert.deepStrictEqual(offenders, [], `shell-string path interpolation found: ${offenders.join('; ')}`);
});

runAll();
