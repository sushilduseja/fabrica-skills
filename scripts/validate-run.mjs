#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');

const SCHEMA_PATH = resolve(root, 'schemas/run-object.schema.json');

function error(msg) {
  console.error(`[validate-run] ERROR: ${msg}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const stdinMode = args.includes('--stdin');

let instance;
let inputLabel;

if (stdinMode) {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const input = Buffer.concat(chunks).toString('utf-8');
  try {
    instance = JSON.parse(input);
  } catch (e) {
    error(`Invalid JSON from stdin: ${e.message}`);
  }
  inputLabel = 'stdin';
} else {
  const targetPath = args[0];
  if (!targetPath) {
    error('Usage: node scripts/validate-run.mjs [--stdin | <path-to-fabrica.run.json>]');
  }
  const absolutePath = resolve(process.cwd(), targetPath);
  if (!existsSync(absolutePath)) {
    error(`File not found: ${targetPath}`);
  }
  instance = JSON.parse(readFileSync(absolutePath, 'utf-8'));
  inputLabel = targetPath;
}

const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf-8'));

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const cleanSchema = { ...schema, $schema: undefined };
const validate = ajv.compile(cleanSchema);
const valid = validate(instance);

if (valid) {
  console.log(`[validate-run] OK — run object from ${inputLabel} is valid`);
  process.exit(0);
}

console.error(`[validate-run] FAILED — ${validate.errors.length} schema violation(s):`);
for (const err of validate.errors) {
  const path = err.instancePath || '(root)';
  console.error(`  ${path}  ${err.message}`);
}
process.exit(1);
