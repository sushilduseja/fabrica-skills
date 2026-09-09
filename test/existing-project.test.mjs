import assert from 'node:assert/strict';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { copyRepoFixture, root, run, test, assertPass, combined, validateStdin, runAll } from './_harness.mjs';
import { schemaValid } from './_ajv.mjs';

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
    assert(schemaValid(discover), 'discover update must validate');

    const spec = {
      ...discover,
      current_step: 'fab-spec',
      spec_path: 'docs/fabrica/spec.md',
      next_action: '/fab-plan',
      preferred_stack: { frontend: null, backend: null, database: null },
    };
    assert(schemaValid(spec), 'existing spec update must validate');

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
    assert(schemaValid(adopt), 'adopt activation must validate');
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

test('existing-project spec/blueprint paths are Fabrica-owned and guarded', () => {
  const dir = makeLegacyApp();
  try {
    const out = join(dir, 'fabrica.run.json');
    assertPass(pkgBin(['init-existing-run', '--name', 'legacy-app', '--out', out], dir));
    assert(JSON.parse(readFileSync(out, 'utf-8')).project_context.origin === 'existing');

    // fab-spec guardrail 7: profile required; fab-scaffold must refuse existing runs
    const specSkill = readFileSync(join(root, 'skills/core/fab-spec/SKILL.md'), 'utf-8');
    assert(specSkill.includes('docs/fabrica/spec.md'), 'spec must document fabrica-owned spec path');
    const planSkill = readFileSync(join(root, 'skills/core/fab-plan/SKILL.md'), 'utf-8');
    assert(planSkill.includes('docs/fabrica/blueprint.md'), 'plan must document fabrica-owned blueprint path');
    const scaffoldSkill = readFileSync(join(root, 'skills/core/fab-scaffold/SKILL.md'), 'utf-8');
    assert(scaffoldSkill.includes('/fab-adopt'), 'scaffold must route existing runs to adopt');

    // fab-discover safety: read-only, no secrets, profile path
    const discoverSkill = readFileSync(join(root, 'skills/core/fab-discover/SKILL.md'), 'utf-8');
    assert(discoverSkill.includes('not modify application source'));
    assert(discoverSkill.includes('Do not discover or persist secrets'));

    // fab-adopt safety: baseline, dirty worktree, no scaffold
    const adoptSkill = readFileSync(join(root, 'skills/core/fab-adopt/SKILL.md'), 'utf-8');
    assert(adoptSkill.includes('baseline'));
    assert(adoptSkill.includes('never scaffold') || adoptSkill.includes('not scaffold'));

    // Spec must not overwrite existing project docs — guardrail text present
    assert(specSkill.includes('never overwrite existing project documents'));

    // Write-scope and command guardrails on execution skills
    const buildSkill = readFileSync(join(root, 'skills/core/fab-build/SKILL.md'), 'utf-8');
    assert(buildSkill.includes('allowed change paths'));
    assert(buildSkill.includes('approved literal commands'));
    assert(buildSkill.includes('recheck') && buildSkill.includes('baseline'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('existing-project e2e fixture workflow stays in-memory valid end to end', () => {
  const dir = makeLegacyApp({ git: true });
  try {
    const out = join(dir, 'fabrica.run.json');
    assertPass(pkgBin(['init-existing-run', '--name', 'legacy-app', '--out', out], dir));
    let runObject = JSON.parse(readFileSync(out, 'utf-8'));

    // /fab-discover → /fab-spec (profile would be written to docs/fabrica/project-profile.md)
    runObject = { ...runObject, current_step: 'fab-discover', next_action: '/fab-spec' };
    assert(schemaValid(runObject), 'discover update must validate');

    // /fab-spec writes docs/fabrica/spec.md
    runObject = {
      ...runObject,
      current_step: 'fab-spec',
      spec_path: 'docs/fabrica/spec.md',
      next_action: '/fab-plan',
      preferred_stack: { frontend: null, backend: null, database: null },
    };
    assertPass(validateStdin(runObject), 'existing spec update must validate');

    // /fab-plan writes docs/fabrica/blueprint.md with allowed paths
    runObject = {
      ...runObject,
      current_step: 'fab-plan',
      blueprint_path: 'docs/fabrica/blueprint.md',
      next_action: '/fab-adopt',
      app_stages: [
        { name: 'auth-fix', purpose: 'Fix auth', status: 'pending', quality_score: null, artifacts: [], notes: null },
      ],
    };
    assert(schemaValid(runObject), 'existing plan update must validate');

    // /fab-adopt activates first stage
    runObject = {
      ...runObject,
      current_step: 'fab-adopt',
      current_app_stage: 'auth-fix',
      next_action: '/fab-build auth-fix',
      app_stages: [{ ...runObject.app_stages[0], status: 'active' }],
    };
    assertPass(validateStdin(runObject), 'adopt activation must validate');

    // /fab-build → done
    runObject = {
      ...runObject,
      current_step: 'fab-build',
      app_stages: [{ ...runObject.app_stages[0], status: 'done', quality_score: 8, artifacts: ['src/index.js'] }],
      next_action: '/fab-eval auth-fix',
    };
    assert(schemaValid(runObject), 'build done must validate');
    assert.strictEqual(runObject.app_stages[0].artifacts[0], 'src/index.js');

    // /fab-eval → /fab-integrate (no scaffold in existing-project mode)
    runObject = {
      ...runObject,
      current_step: 'fab-eval',
      next_action: '/fab-integrate',
    };
    assert(schemaValid(runObject), 'eval must validate');

    // /fab-integrate → /fab-verify
    runObject = {
      ...runObject,
      current_step: 'fab-integrate',
      status: 'verifying',
      experiment_phase: 'phase_2_pipeline',
      next_action: '/fab-verify',
    };
    assert(schemaValid(runObject), 'integrate must validate');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

runAll();
