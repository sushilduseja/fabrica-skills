#!/usr/bin/env node

import {
  existsSync,
  lstatSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { dirname, relative, resolve, sep } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');

const MANIFEST_PATH = resolve(root, 'skills/manifest.json');
const PLUGIN_PATH = resolve(root, '.claude-plugin/plugin.json');
const SCHEMA_PATH = resolve(root, 'schemas/run-object.schema.json');

const VALID_GATES = ['auto', 'checkpoint', 'review', 'full'];
const VALID_CATEGORIES = ['core', 'prototype'];
const SKILL_PATH_RE = /^skills\/(core|prototype)\/fab-[a-z0-9-]+$/;
const ERRORS_PATH_RE = /^skills\/(core|prototype)\/fab-[a-z0-9-]+\/errors\.json$/;
const SKILL_ID_RE = /^fab-[a-z0-9-]+$/;

const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--check')) {
  console.error('[sync-manifest] ERROR: Usage: node scripts/sync-manifest.mjs [--check]');
  process.exit(1);
}
const checkOnly = args.includes('--check');

function error(msg) {
  console.error(`[sync-manifest] ERROR: ${msg}`);
  process.exit(1);
}

function toRepoRelative(absPath) {
  return relative(root, absPath).split(sep).join('/');
}

function assertInsideRoot(label, absPath) {
  const rel = relative(root, absPath);
  if (rel === '..' || rel.startsWith(`..${sep}`) || resolve(absPath) === resolve(root, '..')) {
    error(`${label} resolves outside repository root: ${absPath}`);
  }
}

function assertRepoRelativePath(label, relPath, pattern) {
  if (typeof relPath !== 'string' || relPath.trim() === '') {
    error(`${label} must be a non-empty repository-relative path`);
  }
  if (relPath.includes('\\')) {
    error(`${label} must use forward slashes, not backslashes: ${relPath}`);
  }
  if (relPath.startsWith('/') || /^[A-Za-z]:\//.test(relPath)) {
    error(`${label} must not be absolute: ${relPath}`);
  }
  if (relPath.split('/').includes('..')) {
    error(`${label} must not contain path traversal (..): ${relPath}`);
  }
  if (!pattern.test(relPath)) {
    error(`${label} has invalid layout: ${relPath}`);
  }

  const absPath = resolve(root, relPath);
  assertInsideRoot(label, absPath);
  return absPath;
}

function lstatIfPresent(path) {
  try {
    return lstatSync(path);
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    error(`Cannot inspect ${path}: ${err.message}`);
  }
}

function assertDirectoryNotSymlink(label, absPath) {
  const stat = lstatIfPresent(absPath);
  if (!stat) {
    error(`${label} not found: ${toRepoRelative(absPath)}`);
  }
  if (stat.isSymbolicLink()) {
    error(`${label} must not be a symlink or junction: ${toRepoRelative(absPath)}`);
  }
  if (!stat.isDirectory()) {
    error(`${label} is not a directory: ${toRepoRelative(absPath)}`);
  }
}

function loadJSON(path, label) {
  let raw;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch (err) {
    error(`Cannot read ${label}: ${err.message}`);
  }

  try {
    return JSON.parse(raw);
  } catch (err) {
    error(`Invalid JSON in ${label}: ${err.message}`);
  }
}

function stringifyJSON(data) {
  return JSON.stringify(data, null, 2) + '\n';
}

function writeJSONAtomic(path, data, label) {
  const tmpPath = resolve(dirname(path), `.${toRepoRelative(path).replaceAll('/', '-')}.${process.pid}.tmp`);
  try {
    writeFileSync(tmpPath, stringifyJSON(data), { encoding: 'utf-8', flag: 'wx' });
    renameSync(tmpPath, path);
  } catch (err) {
    try {
      if (existsSync(tmpPath)) rmSync(tmpPath, { force: true });
    } catch {
      // Best effort cleanup only.
    }
    error(`Cannot write ${label}: ${err.message}`);
  }
}

if (!existsSync(MANIFEST_PATH)) {
  error(`Manifest not found at ${MANIFEST_PATH}`);
}

const manifest = loadJSON(MANIFEST_PATH, 'skills/manifest.json');

if (typeof manifest.schema_version !== 'string') error('manifest missing schema_version');
if (typeof manifest.repo_version !== 'string') error('manifest missing repo_version');
if (!Array.isArray(manifest.skills)) error('manifest.skills must be an array');
if (manifest.skills.length === 0) error('manifest.skills is empty');

const schema = loadJSON(SCHEMA_PATH, 'schemas/run-object.schema.json');
const lastErrorSchema = schema?.properties?.last_error?.oneOf?.[1]?.properties?.type?.enum;
if (!Array.isArray(lastErrorSchema)) {
  error('schemas/run-object.schema.json does not expose last_error.type enum');
}
const validErrorTypes = lastErrorSchema;

const RUN_OBJECT_FIELDS = [
  'schema_version', 'id', 'name', 'experiment_phase', 'created_at', 'updated_at',
  'status', 'current_step', 'current_app_stage', 'next_action', 'last_error',
  'spec_path', 'blueprint_path', 'app_stages', 'costs', 'verifications',
  'human_decisions', 'gate_levels',
];

const fieldOwners = {};
const seenIds = new Set();
const seenPaths = new Set();
const skillIds = [];

for (let index = 0; index < manifest.skills.length; index += 1) {
  const skill = manifest.skills[index];
  if (!skill || typeof skill !== 'object' || Array.isArray(skill)) {
    error(`skill at index ${index} must be an object`);
  }

  if (!SKILL_ID_RE.test(skill.id || '')) {
    error(`skill at index ${index} has invalid id: ${skill.id}`);
  }
  if (seenIds.has(skill.id)) error(`duplicate skill id: "${skill.id}"`);
  seenIds.add(skill.id);
  skillIds.push(skill.id);

  if (!VALID_CATEGORIES.includes(skill.category)) {
    error(`skill "${skill.id}" has invalid category "${skill.category}"`);
  }
  if (!Number.isInteger(skill.phase) || skill.phase < 0 || skill.phase > 2) {
    error(`skill "${skill.id}" phase must be integer 0, 1, or 2`);
  }
  if (!VALID_GATES.includes(skill.default_gate)) {
    error(`skill "${skill.id}" invalid default_gate "${skill.default_gate}"`);
  }
  if (typeof skill.overridable !== 'boolean') {
    error(`skill "${skill.id}" overridable must be boolean`);
  }
  if (typeof skill.read_only !== 'boolean') {
    error(`skill "${skill.id}" read_only must be boolean`);
  }

  const skillDir = assertRepoRelativePath(`skill "${skill.id}" path`, skill.path, SKILL_PATH_RE);
  const pathCategory = skill.path.split('/')[1];
  if (pathCategory !== skill.category) {
    error(`skill "${skill.id}" path category "${pathCategory}" does not match manifest category "${skill.category}"`);
  }
  if (typeof skill.description !== 'string' || skill.description.trim() === '') {
    error(`skill "${skill.id}" missing description`);
  }
  const expectedSkillName = skill.path.split('/').pop();
  if (expectedSkillName !== skill.id) {
    error(`skill "${skill.id}" path basename "${expectedSkillName}" does not match id`);
  }
  if (seenPaths.has(skill.path)) error(`duplicate skill path "${skill.path}" for "${skill.id}"`);
  seenPaths.add(skill.path);

  assertDirectoryNotSymlink(`skill "${skill.id}" path`, skillDir);

  const skillFile = resolve(skillDir, 'SKILL.md');
  if (!lstatIfPresent(skillFile)) {
    error(`skill "${skill.id}" missing SKILL.md at ${skill.path}/SKILL.md`);
  }

  const errPath = assertRepoRelativePath(`skill "${skill.id}" error_metadata_path`, skill.error_metadata_path, ERRORS_PATH_RE);
  if (skill.error_metadata_path !== `${skill.path}/errors.json`) {
    error(`skill "${skill.id}" error_metadata_path must be ${skill.path}/errors.json`);
  }
  if (!lstatIfPresent(errPath)) {
    error(`skill "${skill.id}" error_metadata_path not found: ${skill.error_metadata_path}`);
  }

  let skillContent;
  try {
    skillContent = readFileSync(skillFile, 'utf-8');
  } catch (err) {
    error(`Cannot read ${skill.path}/SKILL.md: ${err.message}`);
  }
  const fmMatch = skillContent.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    error(`skill "${skill.id}" missing YAML frontmatter`);
  }
  const fm = fmMatch[1];
  const fmName = fm.match(/^name:\s*(.*)$/m);
  if (!fmName || fmName[1] !== skill.id) {
    error(`skill "${skill.id}" frontmatter name does not match manifest id`);
  }
  const fmDescription = fm.match(/^description:\s*(.*)$/m);
  if (!fmDescription || fmDescription[1] !== skill.description) {
    error(`skill "${skill.id}" frontmatter description does not match manifest description`);
  }
  const fmCategory = fm.match(/^category:\s*(.*)$/m);
  if (!fmCategory || fmCategory[1] !== skill.category) {
    error(`skill "${skill.id}" frontmatter category does not match manifest category "${skill.category}"`);
  }
  const fmPhase = fm.match(/^phase:\s*(.*)$/m);
  if (!fmPhase || Number(fmPhase[1]) !== skill.phase) {
    error(`skill "${skill.id}" frontmatter phase does not match manifest phase "${skill.phase}"`);
  }
  const fmDisableModel = fm.match(/^disable-model-invocation:\s*(.*)$/m);
  if (!fmDisableModel || fmDisableModel[1] !== 'true') {
    error(`skill "${skill.id}" frontmatter disable-model-invocation must be true`);
  }
  const fmGate = fm.match(/^default_gate:\s*(.*)$/m);
  if (!fmGate || fmGate[1] !== skill.default_gate) {
    error(`skill "${skill.id}" frontmatter default_gate does not match manifest default_gate "${skill.default_gate}"`);
  }
  const fmOverridable = fm.match(/^overridable:\s*(.*)$/m);
  if (!fmOverridable || fmOverridable[1] !== String(skill.overridable)) {
    error(`skill "${skill.id}" frontmatter overridable does not match manifest overridable "${skill.overridable}"`);
  }

  if (!Array.isArray(skill.prerequisites)) {
    error(`skill "${skill.id}" prerequisites must be an array`);
  }
  for (const prereq of skill.prerequisites) {
    if (!SKILL_ID_RE.test(prereq || '')) {
      error(`skill "${skill.id}" prerequisite has invalid id "${prereq}"`);
    }
    if (!seenIds.has(prereq) && !manifest.skills.some((s) => s.id === prereq)) {
      error(`skill "${skill.id}" prerequisite "${prereq}" not found in manifest`);
    }
  }

  if (!Array.isArray(skill.blocks)) {
    error(`skill "${skill.id}" blocks must be an array`);
  }
  for (const blocked of skill.blocks) {
    if (!SKILL_ID_RE.test(blocked || '')) {
      error(`skill "${skill.id}" block has invalid id "${blocked}"`);
    }
    if (!manifest.skills.some((s) => s.id === blocked)) {
      error(`skill "${skill.id}" blocks "${blocked}" not found in manifest`);
    }
  }

  const errMeta = loadJSON(errPath, skill.error_metadata_path);
  if (errMeta.skill_id !== skill.id) {
    error(`skill "${skill.id}" errors.json skill_id mismatch: "${errMeta.skill_id}"`);
  }
  if (!Array.isArray(errMeta.errors) || errMeta.errors.length === 0) {
    error(`skill "${skill.id}" errors.json.errors must be a non-empty array`);
  }
  for (const e of errMeta.errors) {
    if (!e || typeof e !== 'object' || Array.isArray(e)) {
      error(`skill "${skill.id}" errors.json contains a non-object error entry`);
    }
    if (!validErrorTypes.includes(e.type)) {
      error(`skill "${skill.id}" errors.json has invalid error type "${e.type}"`);
    }
    if (!e.trigger) error(`skill "${skill.id}" errors.json error "${e.type}" missing trigger`);
    if (!e.diagnosis) error(`skill "${skill.id}" errors.json error "${e.type}" missing diagnosis`);
    if (!e.rescue_action) error(`skill "${skill.id}" errors.json error "${e.type}" missing rescue_action`);
    if (!e.user_message) error(`skill "${skill.id}" errors.json error "${e.type}" missing user_message`);
  }

  if (skill.read_only) {
    if (skill.writes_fields && skill.writes_fields.length > 0) {
      error(`skill "${skill.id}" is read_only but writes_fields is non-empty`);
    }
  } else if (!Array.isArray(skill.writes_fields)) {
    error(`skill "${skill.id}" missing writes_fields array`);
  } else if (skill.writes_fields.length === 0) {
    error(`skill "${skill.id}" is not read_only but writes_fields is empty`);
  }

  for (const f of (skill.writes_fields || [])) {
    if (!RUN_OBJECT_FIELDS.includes(f)) {
      error(`skill "${skill.id}" writes unknown run object field "${f}"`);
    }
    if (!fieldOwners[f]) fieldOwners[f] = [];
    fieldOwners[f].push(skill.id);
  }
}

for (const field of RUN_OBJECT_FIELDS) {
  if (!fieldOwners[field] || fieldOwners[field].length === 0) {
    error(`run object field "${field}" has no owning skill`);
  }
}

const pluginSkills = manifest.skills.map((s) => ({
  name: s.id,
  path: `${s.path}/SKILL.md`,
}));

const currentPlugin = loadJSON(PLUGIN_PATH, '.claude-plugin/plugin.json');
const generatedPlugin = {
  name: currentPlugin.name,
  description: currentPlugin.description,
  version: manifest.repo_version,
  skills: pluginSkills,
};

const gateProperties = {};
for (const s of manifest.skills) {
  if (!s.overridable && s.default_gate) {
    gateProperties[s.id] = { const: s.default_gate };
  }
}

const generatedSchema = JSON.parse(JSON.stringify(schema));
generatedSchema.properties.current_step = {
  oneOf: [
    { type: 'null' },
    { type: 'string', enum: skillIds },
  ],
};
generatedSchema.properties.gate_levels = {
  type: 'object',
  required: [...skillIds],
  propertyNames: { enum: skillIds },
  properties: gateProperties,
  additionalProperties: {
    type: 'string',
    enum: VALID_GATES,
  },
};

if (checkOnly) {
  let hasDiff = false;

  if (readFileSync(PLUGIN_PATH, 'utf-8') !== stringifyJSON(generatedPlugin)) {
    console.error('[sync-manifest] CHECK FAILED: .claude-plugin/plugin.json differs from manifest');
    hasDiff = true;
  }

  if (readFileSync(SCHEMA_PATH, 'utf-8') !== stringifyJSON(generatedSchema)) {
    console.error('[sync-manifest] CHECK FAILED: schemas/run-object.schema.json generated sections differ from manifest');
    hasDiff = true;
  }

  if (hasDiff) process.exit(1);
  console.log('[sync-manifest] CHECK OK — all generated files match manifest');
  process.exit(0);
}

writeJSONAtomic(PLUGIN_PATH, generatedPlugin, '.claude-plugin/plugin.json');
console.log(`[sync-manifest] WROTE ${PLUGIN_PATH} (${pluginSkills.length} skills)`);

writeJSONAtomic(SCHEMA_PATH, generatedSchema, 'schemas/run-object.schema.json');
console.log(`[sync-manifest] WROTE ${SCHEMA_PATH} generated run-object sections (${skillIds.length} skills)`);

console.log('[sync-manifest] DONE');
