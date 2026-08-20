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

runAll();
