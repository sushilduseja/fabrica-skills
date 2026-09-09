import assert from 'assert';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { test, runAll } from './_harness.mjs';

test('all skills have execution guardrails and error handling', () => {
  const manifest = JSON.parse(readFileSync(resolve(import.meta.dirname, '..', 'skills', 'manifest.json'), 'utf-8'));
  const allowedErrors = new Set(
    JSON.parse(readFileSync(resolve(import.meta.dirname, '..', 'schemas', 'run-object.schema.json'), 'utf-8'))
      .properties.last_error.oneOf[1].properties.type.enum,
  );

  for (const skill of manifest.skills) {
    const skillText = readFileSync(resolve(import.meta.dirname, '..', skill.path, 'SKILL.md'), 'utf-8');
    assert(skillText.includes('## Execution Guardrails'), `${skill.id} missing execution guardrails`);
    assert(skillText.includes('## Error Handling'), `${skill.id} missing error handling`);

    const errMeta = JSON.parse(
      readFileSync(
        resolve(import.meta.dirname, '..', skill.error_metadata_path || skill.path + '/errors.json'),
        'utf-8',
      ),
    );
    const skillErrorTypes = new Set((errMeta.errors || []).map((e) => e.type));
    for (const errorType of skillErrorTypes) {
      assert(allowedErrors.has(errorType), `${skill.id} errors.json uses unknown type ${errorType}`);
      const mentioned =
        skillText.includes('`' + errorType + '`') ||
        skillText.includes('"' + errorType + '"') ||
        skillText.includes("'" + errorType + "'");
      assert(mentioned, `${skill.id} SKILL.md Error Handling omits errors.json type ${errorType}`);
    }
  }
});

test('example docs are separated from live run write paths', () => {
  const root = resolve(import.meta.dirname, '..');
  assert(existsSync(resolve(root, 'docs/examples/spec.md')), 'docs/examples/spec.md must exist');
  assert(existsSync(resolve(root, 'docs/examples/blueprint.md')), 'docs/examples/blueprint.md must exist');
  assert(!existsSync(resolve(root, 'docs/spec.md')), 'docs/spec.md must not be a checked-in source file');
  assert(!existsSync(resolve(root, 'docs/blueprint.md')), 'docs/blueprint.md must not be a checked-in source file');

  const gitignore = readFileSync(resolve(root, '.gitignore'), 'utf-8');
  for (const ignored of ['fabrica.run.json', 'docs/spec.md', 'docs/blueprint.md', '.skills/', 'node_modules/']) {
    assert(gitinclude(ignored, gitignore), `.gitignore must include ${ignored}`);
  }
});

function gitinclude(entry, gitignore) {
  return gitignore.split('\n').some((line) => line.trim() === entry || line.trim().startsWith(entry));
}

test('all generated-file patterns are covered by .gitignore', () => {
  const root = resolve(import.meta.dirname, '..');
  const gitignore = readFileSync(resolve(root, '.gitignore'), 'utf-8');

  const generatedPaths = [
    'fabrica.run.json',
    'docs/spec.md',
    'docs/blueprint.md',
    'docs/eval/',
    'docs/handoff.md',
    'docs/integration.md',
    'docs/retro.md',
    '.skills/',
  ];

  for (const p of generatedPaths) {
    assert(gitinclude(p, gitignore), `.gitignore must include ${p}`);
  }
});

test('README documents os.homedir() cross-platform global install paths', () => {
  const root = resolve(import.meta.dirname, '..');
  const readme = readFileSync(resolve(root, 'README.md'), 'utf-8');
  assert(readme.includes('os.homedir()'), 'README must document os.homedir()');
  assert(readme.includes('C:\\Users\\<name>'), 'README must list the Windows home path');
  assert(readme.includes('/home/<name>'), 'README must list the Linux home path');
  assert(readme.includes('/Users/<name>'), 'README must list the macOS home path');
  assert(!readme.includes('sushildusejas'), 'README must not contain a fabricated home path');
});

test('README documents the session-restart activation requirement', () => {
  const root = resolve(import.meta.dirname, '..');
  const readme = readFileSync(resolve(root, 'README.md'), 'utf-8');
  assert(readme.includes('restart your agent session'), 'README must name the session restart');
  assert(readme.includes('fresh session'), 'README must require a fresh session for /fab-spec');
  assert(readme.includes('doctor'), 'README must point at the doctor verification command');
  assert(
    readme.includes('--agent=claude') || readme.includes('--agent=<name>'),
    'README must document single-harness installs',
  );
});

test('QUICKSTART documents restart before first invocation', () => {
  const root = resolve(import.meta.dirname, '..');
  const quickstart = readFileSync(resolve(root, 'examples', 'fabrica-skills-QUICKSTART.md'), 'utf-8');
  assert(quickstart.includes('Restart your agent session'), 'QUICKSTART must require a session restart');
  assert(quickstart.includes('doctor'), 'QUICKSTART must point at the doctor verification command');
});

test('VALIDATION links the manual harness matrix', () => {
  const root = resolve(import.meta.dirname, '..');
  const validation = readFileSync(resolve(root, 'docs', 'VALIDATION.md'), 'utf-8');
  assert(validation.includes('RELEASE_HARNESS_MATRIX'), 'VALIDATION must link the manual harness matrix');
  assert(existsSync(resolve(root, 'docs', 'RELEASE_HARNESS_MATRIX.md')), 'harness matrix doc must exist');
});

test('no shipped skill sets disable-model-invocation (breaks /slash invocation)', () => {
  const root = resolve(import.meta.dirname, '..');
  const manifest = JSON.parse(readFileSync(resolve(root, 'skills', 'manifest.json'), 'utf-8'));
  for (const skill of manifest.skills) {
    const text = readFileSync(resolve(root, skill.path, 'SKILL.md'), 'utf-8');
    assert(
      !/^disable-model-invocation:/m.test(text),
      `${skill.id} sets disable-model-invocation, which breaks explicit /${skill.id} invocation on affected harnesses`,
    );
  }
});

test('fab-spec and fab-plan enforce non-auto turn boundaries and explicit approval', () => {
  const root = resolve(import.meta.dirname, '..');
  const spec = readFileSync(resolve(root, 'skills', 'core', 'fab-spec', 'SKILL.md'), 'utf-8');
  const plan = readFileSync(resolve(root, 'skills', 'core', 'fab-plan', 'SKILL.md'), 'utf-8');
  for (const [id, text] of [
    ['fab-spec', spec],
    ['fab-plan', plan],
  ]) {
    assert(text.includes('hard turn boundary'), `${id} must name the hard turn boundary`);
    assert(text.includes('Custom answer'), `${id} must require the custom-answer path`);
    assert(text.includes(`gate_levels.${id}`), `${id} must resolve the effective gate from gate_levels first`);
  }
  assert(spec.includes('Turn 1 is questions only'), 'fab-spec must require a questions-only first turn');
  assert(spec.includes('approve spec'), 'fab-spec must require artifact-bound approval');
  assert(plan.includes('approve blueprint'), 'fab-plan must require artifact-bound approval');
  assert(
    plan.includes('Interview decisions'),
    'fab-plan must require the durable Interview decisions log in the blueprint',
  );
});

runAll();
