#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
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

// Load schema for valid error types
const schema = loadJSON(SCHEMA_PATH);
const validErrorTypes = schema.properties.last_error.oneOf[1].properties.type.enum;

// Track for uniqueness validation
const seenIds = new Set();
const seenPaths = new Set();
const allSkillIds = new Set();

// Validate every skill
for (const skill of manifest.skills) {
  if (!skill.id) error(`skill missing id at index ${manifest.skills.indexOf(skill)}`);
  if (seenIds.has(skill.id)) error(`duplicate skill id: "${skill.id}"`);
  seenIds.add(skill.id);
  allSkillIds.add(skill.id);

  if (!skill.path) error(`skill "${skill.id}" missing path`);
  if (seenPaths.has(skill.path)) error(`duplicate skill path "${skill.path}" for "${skill.id}"`);
  seenPaths.add(skill.path);

  const skillDir = resolve(root, skill.path);
  const skillFile = resolve(skillDir, 'SKILL.md');

  if (!existsSync(skillDir)) {
    error(`skill "${skill.id}" path not found: ${skill.path}`);
  }
  if (!existsSync(skillFile)) {
    error(`skill "${skill.id}" missing SKILL.md at ${skill.path}/SKILL.md`);
  }

  // Validate frontmatter name matches manifest id
  const skillContent = readFileSync(skillFile, 'utf-8');
  const fmMatch = skillContent.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const fmName = fmMatch[1].match(/^name:\s*(.*)$/m);
    if (fmName && fmName[1] !== skill.id) {
      error(`skill "${skill.id}" frontmatter name "${fmName[1]}" does not match manifest id`);
    }
  }

  const validGates = ['auto', 'checkpoint', 'review', 'full'];
  if (skill.default_gate && !validGates.includes(skill.default_gate)) {
    error(`skill "${skill.id}" invalid default_gate "${skill.default_gate}"`);
  }

  // Validate prerequisites reference only existing skills
  if (Array.isArray(skill.prerequisites)) {
    for (const prereq of skill.prerequisites) {
      if (!manifest.skills.some(s => s.id === prereq)) {
        error(`skill "${skill.id}" prerequisite "${prereq}" not found in manifest`);
      }
    }
  }

  // Validate blocks reference only existing skills
  if (Array.isArray(skill.blocks)) {
    for (const blocked of skill.blocks) {
      if (!manifest.skills.some(s => s.id === blocked)) {
        error(`skill "${skill.id}" blocks "${blocked}" not found in manifest`);
      }
    }
  }

  // Require and validate error_metadata_path
  if (!skill.error_metadata_path) {
    error(`skill "${skill.id}" missing error_metadata_path`);
  }

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

// Generate .claude-plugin/plugin.json skill entries from manifest
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

// Generate gate_levels section entirely from manifest
const skillIds = manifest.skills.map(s => s.id);
const gateRequired = [...skillIds];

// Build explicit properties: non-overridable skills get const
const gateProperties = {};
for (const s of manifest.skills) {
  if (!s.overridable && s.default_gate) {
    gateProperties[s.id] = { const: s.default_gate };
  }
}

const gateLevels = {
  type: "object",
  required: gateRequired,
  propertyNames: {
    enum: skillIds
  },
  properties: gateProperties,
  additionalProperties: {
    type: "string",
    enum: ["auto", "checkpoint", "review", "full"]
  }
};

// Generate full schema: start from current schema, replace gate_levels
const generatedSchema = JSON.parse(JSON.stringify(schema));
generatedSchema.properties.gate_levels = gateLevels;

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
console.log(`[sync-manifest] WROTE ${SCHEMA_PATH} gate_levels (${gateRequired.length} skills)`);

console.log('[sync-manifest] DONE');
