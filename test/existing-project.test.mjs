import assert from 'node:assert/strict';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  copyRepoFixture,
  root,
  run,
  test,
  assertPass,
  combined,
  assertNoStackTrace,
  validateStdin,
  runAll,
} from './_harness.mjs';

function makeLegacyApp({ git = false } = {}) {
  const dir = join(tmpdir(), `fabrica-legacy-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
  mkdirSync(join(dir, 'src'), { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'legacy-app', scripts: { test: 'node test.js' } }));
  writeFileSync(join(dir, 'src', 'index.js'), 'module.exports = 42;\n');
  writeFileSync(join(dir, 'README.md'), '# legacy app\n');
  if (git) {
    const g = (args) => spawnSync('git', args, { cwd: dir, encoding: 'utf-8' });
    g(['init', '-q']);
    g(['config', 'user.email', 'test@example.com']);
    g(['config', 'user.name', 'test']);
    g(['add', '.']);
    g(['commit', '-qm', 'initial']);
  }
  return dir;
}

function listAll(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) {
        if (e.name === '.git') continue;
        walk(p);
      } else {
        out.push(p);
      }
    }
  };
  walk(dir);
  return out.sort();
}

function pkgBin(args, cwd) {
  const pkg = copyRepoFixture();
  cpSync(join(root, 'bin'), join(pkg, 'bin'), { recursive: true });
  try {
    return run([join(pkg, 'bin', 'fabrica-skills.mjs'), ...args], { cwd });
  } finally {
    rmSync(pkg, { recursive: true, force: true });
  }
}

test('existing-project init creates run state and touches nothing else', () => {
  const dir = makeLegacyApp();
  try {
    const before = listAll(dir);
    const result = pkgBin(['init-existing-run', '--name', 'legacy-app', '--out', join(dir, 'fabrica.run.json')], dir);
    assertPass(result, combined(result));
    const after = listAll(dir);
    assert.deepStrictEqual(
      after,
      [...before, join(dir, 'fabrica.run.json')].sort(),
      'init must create only the run file',
    );
    const written = JSON.parse(readFileSync(join(dir, 'fabrica.run.json'), 'utf-8'));
    assert.strictEqual(written.project_context.origin, 'existing');
    assert.strictEqual(written.next_action, '/fab-discover');
    assertPass(run(['scripts/validate-run.mjs', join(dir, 'fabrica.run.json')]));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('existing-project init captures a real git baseline, including dirty state', () => {
  const gitCheck = spawnSync('git', ['--version'], { encoding: 'utf-8' });
  if (gitCheck.status !== 0) return;
  const dir = makeLegacyApp({ git: true });
  try {
    let result = pkgBin(['init-existing-run', '--name', 'legacy-app', '--out', join(dir, 'fabrica.run.json')], dir);
    assertPass(result, combined(result));
    let written = JSON.parse(readFileSync(join(dir, 'fabrica.run.json'), 'utf-8'));
    assert.match(written.project_context.baseline.git_head, /^[0-9a-f]{40}$/);
    assert.strictEqual(typeof written.project_context.baseline.branch, 'string');
    assert.strictEqual(written.project_context.baseline.worktree_clean, true);

    writeFileSync(join(dir, 'src', 'index.js'), 'module.exports = 43;\n');
    result = pkgBin(['init-existing-run', '--name', 'legacy-app', '--out', join(dir, 'fabrica2.run.json')], dir);
    assertPass(result, combined(result));
    written = JSON.parse(readFileSync(join(dir, 'fabrica2.run.json'), 'utf-8'));
    assert.strictEqual(written.project_context.baseline.worktree_clean, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('existing-project run lifecycle validates end to end', () => {
  const dir = makeLegacyApp();
  try {
    const out = join(dir, 'fabrica.run.json');
    assertPass(pkgBin(['init-existing-run', '--name', 'legacy-app', '--out', out], dir));
    const runObject = JSON.parse(readFileSync(out, 'utf-8'));

    const discover = { ...runObject, current_step: 'fab-discover', next_action: '/fab-spec' };
    assertPass(validateStdin(discover), 'discover update must validate');

    const spec = {
      ...discover,
      current_step: 'fab-spec',
      spec_path: 'docs/fabrica/spec.md',
      next_action: '/fab-plan',
      preferred_stack: { frontend: null, backend: null, database: null },
    };
    assertPass(validateStdin(spec), 'existing spec update must validate');

    const adopt = {
      ...spec,
      current_step: 'fab-adopt',
      current_app_stage: 'auth-fix',
      next_action: '/fab-build auth-fix',
      app_stages: [
        {
          name: 'auth-fix',
          purpose: 'Fix auth',
          status: 'active',
          quality_score: null,
          artifacts: [],
          notes: null,
        },
      ],
    };
    assertPass(validateStdin(adopt), 'adopt activation must validate');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('legacy new-project init output has no project_context', () => {
  const dir = makeLegacyApp();
  try {
    const out = join(dir, 'fabrica.run.json');
    assertPass(pkgBin(['init-run', '--out', out], dir));
    const written = JSON.parse(readFileSync(out, 'utf-8'));
    assert(!('project_context' in written), 'init-run must not set project_context');
    assertPass(run(['scripts/validate-run.mjs', out]));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

runAll();
