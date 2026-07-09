#!/usr/bin/env node

/**
 * Sync (check or write) generated artifacts from skills/manifest.json:
 * - .claude-plugin/plugin.json
 * - schemas/run-object.schema.json (current_step enum + gate_levels)
 *
 * Validates manifest integrity, frontmatter consistency, error metadata,
 * field ownership, and cross-references between SKILL.md Error Handling
 * sections and errors.json.
 *
 * Usage:
 *   node scripts/sync-manifest.mjs --check   # verify only (exit 1 on drift)
 *   node scripts/sync-manifest.mjs           # write generated files
 */
import {
  existsSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import {
  assertInsideRoot,
  assertSafeRelPath,
  assertDirectoryNotSymlink,
  errorExit,
  lstatIfPresent,
  readJsonFile,
  stringifyJson,
  toRepoRelative,
} from './_path-utils.mjs';

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
if (args.some((arg) => arg !== '--check' && arg !== '--write')) {
  console.error('[sync-manifest] ERROR: Usage: node scripts/sync-manifest.mjs [--check|--write]');
  process.exit(1);
}
const checkOnly = args.includes('--check');
const writeMode = args.includes('--write');

/**
 * Log a sync-manifest error and exit.
 * @param {string} msg
 */
function error(msg) {
  console.error(`[sync-manifest] ERROR: ${msg}`);
  process.exit(1);
}

/**
 * Write a JSON file atomically by writing to a temp file then renaming.
 * On failure, cleans up the temp file best-effort and exits.
 * @param {string} path Absolute target path.
 * @param {any} data Data to serialize as JSON.
 * @param {string} label Human-readable label for error messages.
 */
function writeJSONAtomic(path, data, label) {
  const tmpPath = resolve(dirname(path), `.${toRepoRelative(root, path).replaceAll('/', '-')}.${process.pid}.tmp`);
  try {
    writeFileSync(tmpPath, stringifyJson(data), { encoding: 'utf-8', flag: 'wx' });
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

const manifest = readJsonFile(MANIFEST_PATH, 'skills/manifest.json');

if (typeof manifest.schema_version !== 'string') error('manifest missing schema_version');
if (typeof manifest.repo_version !== 'string') error('manifest missing repo_version');
if (!Array.isArray(manifest.skills)) error('manifest.skills must be an array');
if (manifest.skills.length === 0) error('manifest.skills is empty');

const schema = readJsonFile(SCHEMA_PATH, 'schemas/run-object.schema.json');
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

  const skillDir = assertSafeRelPath(root, `skill "${skill.id}" path`, skill.path, SKILL_PATH_RE);
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

  const errPath = assertSafeRelPath(root, `skill "${skill.id}" error_metadata_path`, skill.error_metadata_path, ERRORS_PATH_RE);
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

  const errMeta = readJsonFile(errPath, skill.error_metadata_path);
  if (errMeta.skill_id !== skill.id) {
    error(`skill "${skill.id}" errors.json skill_id mismatch: "${errMeta.skill_id}"`);
  }
  if (!Array.isArray(errMeta.errors) || errMeta.errors.length === 0) {
    error(`skill "${skill.id}" errors.json.errors must be a non-empty array`);
  }
  const errorTypesInMeta = new Set();
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
    errorTypesInMeta.add(e.type);
  }

  // Cross-reference: every backtick error type mentioned in the Error Handling section must exist in errors.json.
  const errorSectionMatch = skillContent.match(/## Error Handling\n([\s\S]*?)(?=\n## |\n---|$)/);
  if (errorSectionMatch) {
    const errorSection = errorSectionMatch[1];
    const mentionedTypes = new Set(
      [...errorSection.matchAll(/`([a-z_]+)`/g)].map((m) => m[1])
    );
    for (const mentioned of mentionedTypes) {
      if (validErrorTypes.includes(mentioned) && !errorTypesInMeta.has(mentioned)) {
        error(`skill "${skill.id}" Error Handling section mentions "${mentioned}" but it is not defined in errors.json`);
      }
    }
    // Reverse direction: every error type in errors.json must be mentioned in the Error Handling section.
    for (const errorType of errorTypesInMeta) {
      const quoted = '`' + errorType + '`';
      if (!errorSection.includes(quoted)) {
        error(`skill "${skill.id}" errors.json defines "${errorType}" but it is not mentioned in the SKILL.md Error Handling section`);
      }
    }
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

const currentPlugin = readJsonFile(PLUGIN_PATH, '.claude-plugin/plugin.json');
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

const pluginOnDisk = readFileSync(PLUGIN_PATH, 'utf-8');
const pluginGenerated = stringifyJson(generatedPlugin);
const pluginDiffers = pluginOnDisk !== pluginGenerated;

const schemaOnDisk = readFileSync(SCHEMA_PATH, 'utf-8');
const schemaGenerated = stringifyJson(generatedSchema);
const schemaDiffers = schemaOnDisk !== schemaGenerated;

if (checkOnly) {
  let failed = false;
  if (pluginDiffers) {
    console.error('[sync-manifest] CHECK FAILED: .claude-plugin/plugin.json differs from manifest');
    failed = true;
  }
  if (schemaDiffers) {
    console.error('[sync-manifest] CHECK FAILED: schemas/run-object.schema.json generated sections differ from manifest');
    failed = true;
  }
  if (failed) process.exit(1);
  console.log('[sync-manifest] CHECK OK — all generated files match manifest');
  process.exit(0);
}

if (writeMode) {
  if (!pluginDiffers && !schemaDiffers) {
    console.log('[sync-manifest] CHECK OK — all generated files match manifest, nothing to write');
    process.exit(0);
  }
  if (pluginDiffers) {
    writeJSONAtomic(PLUGIN_PATH, generatedPlugin, '.claude-plugin/plugin.json');
    console.log(`[sync-manifest] WROTE ${PLUGIN_PATH} (${pluginSkills.length} skills)`);
  }
  if (schemaDiffers) {
    writeJSONAtomic(SCHEMA_PATH, generatedSchema, 'schemas/run-object.schema.json');
    console.log(`[sync-manifest] WROTE ${SCHEMA_PATH} generated run-object sections (${skillIds.length} skills)`);
  }
  console.log('[sync-manifest] DONE');
  process.exit(0);
}

writeJSONAtomic(PLUGIN_PATH, pluginGenerated, '.claude-plugin/plugin.json');
console.log(`[sync-manifest] WROTE ${PLUGIN_PATH} (${pluginSkills.length} skills)`);

writeJSONAtomic(SCHEMA_PATH, schemaGenerated, 'schemas/run-object.schema.json');
console.log(`[sync-manifest] WROTE ${SCHEMA_PATH} generated run-object sections (${skillIds.length} skills)`);

console.log('[sync-manifest] DONE');
