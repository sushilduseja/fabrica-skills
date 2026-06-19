#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');

const MANIFEST_PATH = resolve(root, 'skills/manifest.json');
const PLUGIN_PATH = resolve(root, '.claude-plugin/plugin.json');
const SCHEMA_PATH = resolve(root, 'schemas/run-object.schema.json');

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');

function loadJSON(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function writeJSON(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function error(msg) {
  console.error(`[sync-manifest] ERROR: ${msg}`);
  process.exit(1);
}

// Load manifest
if (!existsSync(MANIFEST_PATH)) {
  error(`Manifest not found at ${MANIFEST_PATH}`);
}
const manifest = loadJSON(MANIFEST_PATH);

if (!manifest.schema_version) error('manifest missing schema_version');
if (!manifest.repo_version) error('manifest missing repo_version');
if (!Array.isArray(manifest.skills)) error('manifest.skills must be an array');
if (manifest.skills.length === 0) error('manifest.skills is empty');

// Step 4: Validate every skill path exists and contains SKILL.md
for (const skill of manifest.skills) {
  if (!skill.id) error(`skill missing id at index ${manifest.skills.indexOf(skill)}`);
  if (!skill.path) error(`skill "${skill.id}" missing path`);

  const skillDir = resolve(root, skill.path);
  const skillFile = resolve(skillDir, 'SKILL.md');

  if (!existsSync(skillDir)) {
    error(`skill "${skill.id}" path not found: ${skill.path}`);
  }
  if (!existsSync(skillFile)) {
    error(`skill "${skill.id}" missing SKILL.md at ${skill.path}/SKILL.md`);
  }

  const validGates = ['auto', 'checkpoint', 'review', 'full'];
  if (skill.default_gate && !validGates.includes(skill.default_gate)) {
    error(`skill "${skill.id}" invalid default_gate "${skill.default_gate}"`);
  }

  // Validate error_metadata_path
  if (skill.error_metadata_path) {
    const errPath = resolve(root, skill.error_metadata_path);
    if (!existsSync(errPath)) {
      error(`skill "${skill.id}" error_metadata_path not found: ${skill.error_metadata_path}`);
    }
    const errMeta = loadJSON(errPath);
    if (errMeta.skill_id !== skill.id) {
      error(`skill "${skill.id}" errors.json skill_id mismatch: "${errMeta.skill_id}"`);
    }
    if (!Array.isArray(errMeta.errors)) {
      error(`skill "${skill.id}" errors.json.errors must be an array`);
    }
    const validErrorTypes = ['missing_input', 'invalid_state', 'gate_blocked', 'validation_failed', 'prerequisite_missing', 'external_failure'];
    for (const e of errMeta.errors) {
      if (!validErrorTypes.includes(e.type)) {
        error(`skill "${skill.id}" errors.json has invalid error type "${e.type}"`);
      }
      if (!e.trigger) error(`skill "${skill.id}" errors.json error "${e.type}" missing trigger`);
      if (!e.diagnosis) error(`skill "${skill.id}" errors.json error "${e.type}" missing diagnosis`);
      if (!e.rescue_action) error(`skill "${skill.id}" errors.json error "${e.type}" missing rescue_action`);
      if (!e.user_message) error(`skill "${skill.id}" errors.json error "${e.type}" missing user_message`);
    }
  }
}

// Step 5: Generate .claude-plugin/plugin.json skill entries from manifest
const pluginSkills = manifest.skills.map(s => ({
  name: s.id,
  path: `${s.path}/SKILL.md`,
}));

const currentPlugin = loadJSON(PLUGIN_PATH);
const generatedPlugin = {
  name: currentPlugin.name,
  description: currentPlugin.description,
  version: manifest.repo_version,
  skills: pluginSkills,
};

// Step 6: Generate gate_levels.required from manifest skill ids
const currentSchema = loadJSON(SCHEMA_PATH);
const gateLevelsRequired = manifest.skills.map(s => s.id);

const generatedSchema = JSON.parse(JSON.stringify(currentSchema));
generatedSchema.properties.gate_levels.required = gateLevelsRequired;

// Resolve remaining duplicate source-of-truth in schema gate_levels.properties
// Keep the explicit const entries (fab-launch=review, fab-signal=full)
// and the additionalProperties enum constraint
// Remove any property entry that only duplicates the additionalProperties default
const gateProps = generatedSchema.properties.gate_levels.properties || {};
const manifestGateDefaults = {};
for (const s of manifest.skills) {
  manifestGateDefaults[s.id] = s.default_gate;
}

// Keep only non-default overrides in gate_levels.properties
const cleanedGateProps = {};
for (const [prop, val] of Object.entries(gateProps)) {
  const matchingSkill = manifest.skills.find(s => s.id === prop);
  if (matchingSkill && val.const === matchingSkill.default_gate) {
    continue;
  }
  if (val.enum || val.type) {
    continue;
  }
  cleanedGateProps[prop] = val;
}
// Always keep explicit const entries that differ from default
if (gateProps['fab-launch']) cleanedGateProps['fab-launch'] = gateProps['fab-launch'];
if (gateProps['fab-signal']) cleanedGateProps['fab-signal'] = gateProps['fab-signal'];

generatedSchema.properties.gate_levels.properties = cleanedGateProps;

// --check mode: exit nonzero if generated files differ from current
if (checkOnly) {
  let hasDiff = false;

  const pluginStr = JSON.stringify(generatedPlugin, null, 2) + '\n';
  if (readFileSync(PLUGIN_PATH, 'utf-8') !== pluginStr) {
    console.error('[sync-manifest] CHECK FAILED: .claude-plugin/plugin.json differs from manifest');
    hasDiff = true;
  }

  const schemaStr = JSON.stringify(generatedSchema, null, 2) + '\n';
  if (readFileSync(SCHEMA_PATH, 'utf-8') !== schemaStr) {
    console.error('[sync-manifest] CHECK FAILED: schemas/run-object.schema.json gate_levels differ from manifest');
    hasDiff = true;
  }

  if (hasDiff) {
    process.exit(1);
  }
  console.log('[sync-manifest] CHECK OK — all generated files match manifest');
  process.exit(0);
}

// Write generated files
writeJSON(PLUGIN_PATH, generatedPlugin);
console.log(`[sync-manifest] WROTE ${PLUGIN_PATH} (${pluginSkills.length} skills)`);

writeJSON(SCHEMA_PATH, generatedSchema);
console.log(`[sync-manifest] WROTE ${SCHEMA_PATH} gate_levels (${gateLevelsRequired.length} skills)`);

console.log('[sync-manifest] DONE');
