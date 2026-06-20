#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');

const SCHEMA_PATH = resolve(root, 'schemas/run-object.schema.json');
const FIXTURE_PATH = resolve(root, 'test/fixtures/invalid-run.json');

function error(msg) {
  console.error(`[assert-invalid] FAIL: ${msg}`);
  process.exit(1);
}

if (!existsSync(FIXTURE_PATH)) {
  error(`Fixture not found: invalid-run.json`);
}

const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf-8'));
const instance = JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8'));

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const cleanSchema = { ...schema, $schema: undefined };
const validate = ajv.compile(cleanSchema);
const valid = validate(instance);

if (valid) {
  error('Expected invalid fixture to fail validation, but it passed');
}

const errorPaths = validate.errors.map(e => e.instancePath);

const expectedErrors = ['/status', '/app_stages/0/quality_score'];
const missing = expectedErrors.filter(p => !errorPaths.includes(p));

if (missing.length > 0) {
  error(`Expected errors at: ${expectedErrors.join(', ')} but missing: ${missing.join(', ')}`);
}

console.log('[assert-invalid] OK — fixture fails at /status and /app_stages/0/quality_score as expected');
process.exit(0);
