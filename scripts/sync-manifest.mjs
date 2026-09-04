#!/usr/bin/env node

/**
 * Sync (check or write) generated artifacts from skills/manifest.json:
 * - .claude-plugin/plugin.json
 * - schemas/run-object.schema.json (current_step enum + gate_levels)
 *
 * Small orchestration interface over two modules: catalog integrity
 * (scripts/_skill-catalog.mjs) and generated-artifact projection
 * (scripts/_artifact-projection.mjs). Filesystem reads and writes stay here
 * at the seam.
 *
 * Usage:
 *   node scripts/sync-manifest.mjs --check   # verify only (exit 1 on drift)
 *   node scripts/sync-manifest.mjs           # write generated files
 */
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { readJsonFile, stringifyJson, toRepoRelative } from './_path-utils.mjs';
import { checkSkillCatalog } from './_skill-catalog.mjs';
import { buildPluginDocument, buildSchemaDocument } from './_artifact-projection.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');

const PLUGIN_PATH = resolve(root, '.claude-plugin/plugin.json');
const SCHEMA_PATH = resolve(root, 'schemas/run-object.schema.json');

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

let manifest;
let schema;
try {
  ({ manifest, schema } = checkSkillCatalog(root));
} catch (err) {
  error(err.message);
}

const currentPlugin = readJsonFile(PLUGIN_PATH, '.claude-plugin/plugin.json');
const generatedPlugin = buildPluginDocument(currentPlugin, manifest);
const generatedSchema = buildSchemaDocument(schema, manifest);

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
    console.error(
      '[sync-manifest] CHECK FAILED: schemas/run-object.schema.json generated sections differ from manifest',
    );
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
    console.log(`[sync-manifest] WROTE ${PLUGIN_PATH} (${generatedPlugin.skills.length} skills)`);
  }
  if (schemaDiffers) {
    writeJSONAtomic(SCHEMA_PATH, generatedSchema, 'schemas/run-object.schema.json');
    console.log(
      `[sync-manifest] WROTE ${SCHEMA_PATH} generated run-object sections (${generatedSchema.properties.gate_levels.required.length} skills)`,
    );
  }
  console.log('[sync-manifest] DONE');
  process.exit(0);
}

writeJSONAtomic(PLUGIN_PATH, generatedPlugin, '.claude-plugin/plugin.json');
console.log(`[sync-manifest] WROTE ${PLUGIN_PATH} (${generatedPlugin.skills.length} skills)`);

writeJSONAtomic(SCHEMA_PATH, generatedSchema, 'schemas/run-object.schema.json');
console.log(
  `[sync-manifest] WROTE ${SCHEMA_PATH} generated run-object sections (${generatedSchema.properties.gate_levels.required.length} skills)`,
);

console.log('[sync-manifest] DONE');
