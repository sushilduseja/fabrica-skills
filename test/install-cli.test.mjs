import assert from 'assert';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
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

function makePackageFixture() {
  const temp = copyRepoFixture();
  cpSync(join(root, 'bin'), join(temp, 'bin'), { recursive: true });
  return temp;
}

function makeProject() {
  return join(tmpdir(), `fabrica-consumer-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
}

function makeHome() {
  return join(tmpdir(), `fabrica-home-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
}

function setup() {
  const pkg = makePackageFixture();
  const project = makeProject();
  const home = makeHome();
  mkdirSync(project, { recursive: true });
  mkdirSync(home, { recursive: true });
  return { pkg, project, home };
}

function teardown({ pkg, project, home }) {
  rmSync(pkg, { recursive: true, force: true });
  rmSync(project, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
}

function cli(pkg, args, { cwd, home }) {
  return run([join(pkg, 'bin', 'fabrica-skills.mjs'), ...args], {
    cwd,
    env: { HOME: home, USERPROFILE: home },
  });
}

function readMarker(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

test('project install creates .agents/skills/fab-spec/SKILL.md plus marker', () => {
  const ctx = setup();
  try {
    const result = cli(ctx.pkg, ['install'], { cwd: ctx.project, home: ctx.home });
    assertPass(result, combined(result));
    const skillMd = join(ctx.project, '.agents', 'skills', 'fab-spec', 'SKILL.md');
    assert(existsSync(skillMd), 'expected .agents/skills/fab-spec/SKILL.md');
    const marker = readMarker(join(ctx.project, '.agents', 'skills', 'fab-spec', '.fabrica-managed.json'));
    assert.strictEqual(marker.managed_by, 'fabrica-skills');
    assert.strictEqual(marker.skill_id, 'fab-spec');
    assert.strictEqual(marker.package_version, '0.3.0');
    assert.strictEqual(marker.install_scope, 'project');
    assert(typeof marker.installed_at === 'string' && marker.installed_at.length > 0);
    assert.strictEqual(readdirSync(join(ctx.project, '.agents', 'skills')).length, 15);
    assertNoStackTrace(result);
  } finally {
    teardown(ctx);
  }
});

test('project install is idempotent', () => {
  const ctx = setup();
  try {
    let result = cli(ctx.pkg, ['install'], { cwd: ctx.project, home: ctx.home });
    assertPass(result, combined(result));
    const before = readFileSync(join(ctx.project, '.agents', 'skills', 'fab-spec', 'SKILL.md'), 'utf-8');
    result = cli(ctx.pkg, ['install'], { cwd: ctx.project, home: ctx.home });
    assertPass(result, combined(result));
    assert(combined(result).includes('installed 14 skills'));
    const after = readFileSync(join(ctx.project, '.agents', 'skills', 'fab-spec', 'SKILL.md'), 'utf-8');
    assert.strictEqual(after, before);
    assert(existsSync(join(ctx.project, '.agents', 'skills', 'fab-spec', '.fabrica-managed.json')));
    assertNoStackTrace(result);
  } finally {
    teardown(ctx);
  }
});

test('project install preserves pre-existing foreign skills', () => {
  const ctx = setup();
  try {
    mkdirSync(join(ctx.project, '.agents', 'skills', 'my-other-skill'), { recursive: true });
    writeFileSync(join(ctx.project, '.agents', 'skills', 'my-other-skill', 'SKILL.md'), 'foreign', 'utf-8');
    const result = cli(ctx.pkg, ['install'], { cwd: ctx.project, home: ctx.home });
    assertPass(result, combined(result));
    assert.strictEqual(
      readFileSync(join(ctx.project, '.agents', 'skills', 'my-other-skill', 'SKILL.md'), 'utf-8'),
      'foreign',
    );
    assert(existsSync(join(ctx.project, '.agents', 'skills', 'fab-spec', 'SKILL.md')));
    assertNoStackTrace(result);
  } finally {
    teardown(ctx);
  }
});

test('project install skips pre-existing unmarked fab-* dir with warning', () => {
  const ctx = setup();
  try {
    mkdirSync(join(ctx.project, '.agents', 'skills', 'fab-spec'), { recursive: true });
    writeFileSync(join(ctx.project, '.agents', 'skills', 'fab-spec', 'SKILL.md'), 'sentinel', 'utf-8');
    const result = cli(ctx.pkg, ['install'], { cwd: ctx.project, home: ctx.home });
    assertPass(result, combined(result));
    assert.strictEqual(
      readFileSync(join(ctx.project, '.agents', 'skills', 'fab-spec', 'SKILL.md'), 'utf-8'),
      'sentinel',
    );
    assert(!existsSync(join(ctx.project, '.agents', 'skills', 'fab-spec', '.fabrica-managed.json')));
    assert(combined(result).includes('Skipping'), combined(result));
    assertNoStackTrace(result);
  } finally {
    teardown(ctx);
  }
});

test('global install writes under temp HOME with catalog copy', () => {
  const ctx = setup();
  try {
    const result = cli(ctx.pkg, ['install', '--global'], { cwd: ctx.project, home: ctx.home });
    assertPass(result, combined(result));
    assert(existsSync(join(ctx.home, '.agents', 'skills', 'fab-spec', 'SKILL.md')));
    const marker = readMarker(join(ctx.home, '.agents', 'skills', 'fab-spec', '.fabrica-managed.json'));
    assert.strictEqual(marker.managed_by, 'fabrica-skills');
    assert.strictEqual(marker.install_scope, 'global');
    assert(existsSync(join(ctx.home, '.fabrica-skills', 'catalog', '0.3.0', 'skills', 'core', 'fab-spec', 'SKILL.md')));
    assert.strictEqual(
      readFileSync(join(ctx.home, '.fabrica-skills', 'catalog', '0.3.0', 'CURRENT'), 'utf-8'),
      '0.3.0\n',
    );
    assert(!existsSync(join(ctx.project, '.agents')), 'project dir must stay untouched on global install');
    assertNoStackTrace(result);
  } finally {
    teardown(ctx);
  }
});

test('uninstall removes only marked dirs', () => {
  const ctx = setup();
  try {
    let result = cli(ctx.pkg, ['install'], { cwd: ctx.project, home: ctx.home });
    assertPass(result, combined(result));
    mkdirSync(join(ctx.project, '.agents', 'skills', 'my-other-skill'), { recursive: true });
    writeFileSync(join(ctx.project, '.agents', 'skills', 'my-other-skill', 'SKILL.md'), 'foreign', 'utf-8');
    mkdirSync(join(ctx.project, '.agents', 'skills', 'fab-custom'), { recursive: true });
    writeFileSync(join(ctx.project, '.agents', 'skills', 'fab-custom', 'SKILL.md'), 'custom', 'utf-8');
    result = cli(ctx.pkg, ['uninstall'], { cwd: ctx.project, home: ctx.home });
    assertPass(result, combined(result));
    assert(!existsSync(join(ctx.project, '.agents', 'skills', 'fab-spec')), 'marked skill must be removed');
    assert.strictEqual(
      readFileSync(join(ctx.project, '.agents', 'skills', 'my-other-skill', 'SKILL.md'), 'utf-8'),
      'foreign',
    );
    assert.strictEqual(
      readFileSync(join(ctx.project, '.agents', 'skills', 'fab-custom', 'SKILL.md'), 'utf-8'),
      'custom',
    );
    assertNoStackTrace(result);
  } finally {
    teardown(ctx);
  }
});

test('update refreshes SKILL.md content from package', () => {
  const ctx = setup();
  try {
    let result = cli(ctx.pkg, ['install'], { cwd: ctx.project, home: ctx.home });
    assertPass(result, combined(result));
    const source = join(ctx.pkg, 'skills', 'core', 'fab-spec', 'SKILL.md');
    writeFileSync(source, `${readFileSync(source, 'utf-8')}\n<!-- refresh-sentinel -->\n`, 'utf-8');
    result = cli(ctx.pkg, ['update'], { cwd: ctx.project, home: ctx.home });
    assertPass(result, combined(result));
    assert(
      readFileSync(join(ctx.project, '.agents', 'skills', 'fab-spec', 'SKILL.md'), 'utf-8').includes(
        '<!-- refresh-sentinel -->',
      ),
    );
    assertNoStackTrace(result);
  } finally {
    teardown(ctx);
  }
});

test('unknown command exits nonzero', () => {
  const ctx = setup();
  try {
    const result = cli(ctx.pkg, ['frobnicate'], { cwd: ctx.project, home: ctx.home });
    assertFail(result);
    assert(combined(result).includes('Unknown command'), combined(result));
    assertNoStackTrace(result);
  } finally {
    teardown(ctx);
  }
});

test('--agent=claude only writes .claude/skills', () => {
  const ctx = setup();
  try {
    const result = cli(ctx.pkg, ['install', '--agent=claude'], { cwd: ctx.project, home: ctx.home });
    assertPass(result, combined(result));
    assert(existsSync(join(ctx.project, '.claude', 'skills', 'fab-spec', 'SKILL.md')));
    assert(existsSync(join(ctx.project, '.claude', 'skills', 'fab-spec', '.fabrica-managed.json')));
    assert(!existsSync(join(ctx.project, '.agents')), 'default agents root must not be created');
    assert(!existsSync(join(ctx.project, '.cursor')), 'unselected agents root must not be created');
    assertNoStackTrace(result);
  } finally {
    teardown(ctx);
  }
});

test('default install projects all skills into all five harness roots', () => {
  const ctx = setup();
  try {
    const result = cli(ctx.pkg, ['install'], { cwd: ctx.project, home: ctx.home });
    assertPass(result, combined(result));
    for (const dir of ['.agents', '.claude', '.cursor', '.codex', '.opencode']) {
      const root = join(ctx.project, dir, 'skills');
      assert(existsSync(join(root, 'fab-spec', 'SKILL.md')), `expected ${dir}/skills/fab-spec/SKILL.md`);
      const marker = readMarker(join(root, 'fab-spec', '.fabrica-managed.json'));
      assert.strictEqual(marker.managed_by, 'fabrica-skills');
      assert.strictEqual(marker.skill_id, 'fab-spec');
      assert.strictEqual(readdirSync(root).length, 15, `expected 14 skills plus alias in ${dir}/skills`);
    }
    assertNoStackTrace(result);
  } finally {
    teardown(ctx);
  }
});

test('selective --agent=claude,agents only writes two roots', () => {
  const ctx = setup();
  try {
    const result = cli(ctx.pkg, ['install', '--agent=claude,agents'], { cwd: ctx.project, home: ctx.home });
    assertPass(result, combined(result));
    assert(existsSync(join(ctx.project, '.claude', 'skills', 'fab-spec', 'SKILL.md')));
    assert(existsSync(join(ctx.project, '.agents', 'skills', 'fab-spec', 'SKILL.md')));
    assert.strictEqual(readdirSync(join(ctx.project, '.claude', 'skills')).length, 15);
    assert.strictEqual(readdirSync(join(ctx.project, '.agents', 'skills')).length, 15);
    assert(!existsSync(join(ctx.project, '.cursor')), 'unselected agents root must not be created');
    assert(!existsSync(join(ctx.project, '.codex')), 'unselected agents root must not be created');
    assert(!existsSync(join(ctx.project, '.opencode')), 'unselected agents root must not be created');
    assertNoStackTrace(result);
  } finally {
    teardown(ctx);
  }
});

test('install projects skill alias fab-code-review and uninstall removes it', () => {
  const ctx = setup();
  try {
    let result = cli(ctx.pkg, ['install'], { cwd: ctx.project, home: ctx.home });
    assertPass(result, combined(result));
    assert(existsSync(join(ctx.project, '.agents', 'skills', 'fab-code-review', 'SKILL.md')));
    const marker = readMarker(join(ctx.project, '.agents', 'skills', 'fab-code-review', '.fabrica-managed.json'));
    assert.strictEqual(marker.managed_by, 'fabrica-skills');
    assert.strictEqual(marker.skill_id, 'fabrica-code-review');
    result = cli(ctx.pkg, ['uninstall'], { cwd: ctx.project, home: ctx.home });
    assertPass(result, combined(result));
    assert(!existsSync(join(ctx.project, '.agents', 'skills', 'fab-code-review')));
    assertNoStackTrace(result);
  } finally {
    teardown(ctx);
  }
});

test('install fails cleanly on malformed manifest', () => {
  const ctx = setup();
  try {
    mutateJson(join(ctx.pkg, 'skills/manifest.json'), (m) => {
      m.skills = null;
    });
    const result = cli(ctx.pkg, ['install'], { cwd: ctx.project, home: ctx.home });
    assertFail(result);
    assert(combined(result).includes('non-empty skills array'), combined(result));
    assertNoStackTrace(result);
  } finally {
    teardown(ctx);
  }
});

test('install refuses a skill path escaping the catalog', () => {
  const ctx = setup();
  try {
    mutateJson(join(ctx.pkg, 'skills/manifest.json'), (m) => {
      m.skills[0].path = 'skills/core/fab-spec/../../../../tmp';
    });
    const result = cli(ctx.pkg, ['install'], { cwd: ctx.project, home: ctx.home });
    assertFail(result);
    assert(combined(result).includes('unsafe path'), combined(result));
    assertNoStackTrace(result);
  } finally {
    teardown(ctx);
  }
});

test('cli fails cleanly on corrupt package metadata', () => {
  const ctx = setup();
  try {
    writeFileSync(join(ctx.pkg, 'package.json'), '{bad json', 'utf-8');
    const result = cli(ctx.pkg, ['install'], { cwd: ctx.project, home: ctx.home });
    assertFail(result);
    assert(combined(result).includes('package metadata'), combined(result));
    assertNoStackTrace(result);
  } finally {
    teardown(ctx);
  }
});

runAll();
