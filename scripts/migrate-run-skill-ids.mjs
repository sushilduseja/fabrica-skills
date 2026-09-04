#!/usr/bin/env node

/**
 * Migrate a fabrica.run.json written with pre-rename skill ids to canonical ids.
 *
 * Rewrites current_step, the next_action skill token, gate_levels keys, and
 * costs.by_step keys. Leaves app_stages[].name unchanged (those are app stage
 * slugs, not skill ids).
 *
 * Usage:
 *   node scripts/migrate-run-skill-ids.mjs <path-to-fabrica.run.json>
 */
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { readJsonFile, stringifyJson } from './_path-utils.mjs';
import { SKILL_ALIASES } from './_skill-aliases.mjs';

/**
 * Log a migration error and exit.
 * @param {string} msg
 */
function fail(msg) {
  console.error(`[migrate-run-skill-ids] ERROR: ${msg}`);
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length !== 1) {
  fail('Usage: node scripts/migrate-run-skill-ids.mjs <path-to-fabrica.run.json>');
}

const targetPath = args[0];
const run = readJsonFile(resolve(process.cwd(), targetPath), targetPath, '[migrate-run-skill-ids]');
if (!run || typeof run !== 'object' || Array.isArray(run)) {
  fail(`Run object in ${targetPath} must be a JSON object`);
}

let rewrites = 0;

if (typeof run.current_step === 'string' && SKILL_ALIASES[run.current_step]) {
  run.current_step = SKILL_ALIASES[run.current_step];
  rewrites += 1;
}

if (typeof run.next_action === 'string') {
  const [token] = run.next_action.slice(1).split(' ');
  if (SKILL_ALIASES[token]) {
    run.next_action = `/${SKILL_ALIASES[token]}${run.next_action.slice(token.length + 1)}`;
    rewrites += 1;
  }
}

function renameKeys(section) {
  if (!section || typeof section !== 'object' || Array.isArray(section)) return;
  for (const key of Object.keys(section)) {
    if (SKILL_ALIASES[key]) {
      if (!(SKILL_ALIASES[key] in section)) {
        section[SKILL_ALIASES[key]] = section[key];
      }
      delete section[key];
      rewrites += 1;
    }
  }
}

renameKeys(run.gate_levels);
if (run.costs && typeof run.costs === 'object') {
  renameKeys(run.costs.by_step);
}

writeFileSync(resolve(process.cwd(), targetPath), stringifyJson(run), 'utf-8');
if (rewrites === 0) {
  console.log(`[migrate-run-skill-ids] OK — no deprecated skill ids in ${targetPath}`);
} else {
  console.log(`[migrate-run-skill-ids] OK — rewrote ${rewrites} deprecated skill id(s) in ${targetPath}`);
}
