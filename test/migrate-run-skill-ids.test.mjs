import assert from 'assert';
import { test, runAll } from './_harness.mjs';
import { canonicalSkillId, isDeprecatedSkillId } from '../scripts/_skill-aliases.mjs';
import { migrateRunObject } from '../scripts/migrate-run-skill-ids.mjs';

test('isDeprecatedSkillId ignores prototype-chain names', () => {
  assert.strictEqual(isDeprecatedSkillId('fab-intake'), true);
  assert.strictEqual(isDeprecatedSkillId('fab-spec'), false);
  assert.strictEqual(isDeprecatedSkillId('__proto__'), false);
  assert.strictEqual(isDeprecatedSkillId('constructor'), false);
  assert.strictEqual(isDeprecatedSkillId(null), false);
  assert.strictEqual(isDeprecatedSkillId(undefined), false);
});

test('canonicalSkillId never returns a non-string', () => {
  assert.strictEqual(canonicalSkillId('fab-intake'), 'fab-spec');
  assert.strictEqual(canonicalSkillId('fab-spec'), 'fab-spec');
  assert.strictEqual(canonicalSkillId('__proto__'), '__proto__');
});

test('migrateRunObject rewrites deprecated ids and counts them', () => {
  const run = {
    current_step: 'fab-intake',
    next_action: '/fab-build api',
    gate_levels: { 'fab-intake': 'checkpoint', 'fab-spec': 'checkpoint' },
    costs: { by_step: {} },
  };
  assert.strictEqual(migrateRunObject(run), 2);
  assert.strictEqual(run.current_step, 'fab-spec');
  assert.strictEqual(run.next_action, '/fab-build api');
  assert.strictEqual(run.gate_levels['fab-spec'], 'checkpoint');
  assert.strictEqual('fab-intake' in run.gate_levels, false);
});

test('migrateRunObject leaves __proto__ keys alone', () => {
  const run = JSON.parse(
    '{"current_step":"fab-spec","next_action":null,"gate_levels":{"__proto__":"auto"},"costs":{"by_step":{}}}',
  );
  assert.strictEqual(migrateRunObject(run), 0);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(run.gate_levels, '__proto__'), true);
  assert.strictEqual(Object.keys(run.gate_levels).includes('[object Object]'), false);
});

runAll();
