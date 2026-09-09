import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

/**
 * In-process JSON Schema checks for run-object shape tests.
 *
 * The AJV setup below mirrors scripts/validate-run.mjs exactly (same
 * options, same $schema strip, same schema file, same ajv-formats). If the
 * script's compile changes, update this mirror to match.
 *
 * Scope: pure schema-shape assertions only (required fields, types, enums,
 * patterns, formats, lengths). CLI behavior (exit codes, message text,
 * stdin/file modes, --migrate, --commit) and post-schema semantic checks
 * (status x phase, duplicates, next_action parsing, gate contracts) stay in
 * spawned validate-run tests, since that logic lives in the script's main().
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const schemaDoc = JSON.parse(readFileSync(resolve(root, 'schemas/run-object.schema.json'), 'utf-8'));

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const cleanSchema = { ...schemaDoc, $schema: undefined };
const validate = ajv.compile(cleanSchema);

export function validRun() {
  return JSON.parse(readFileSync(resolve(root, 'test/fixtures/valid-run.json'), 'utf-8'));
}

export function cloneRun(candidate) {
  return JSON.parse(JSON.stringify(candidate));
}

/**
 * @param {any} candidate
 * @returns {Array<{ keyword: string, message: string, params: any, instancePath: string }>}
 */
export function schemaErrors(candidate) {
  return validate(candidate) ? [] : [...(validate.errors || [])];
}

export function schemaValid(candidate) {
  return schemaErrors(candidate).length === 0;
}
