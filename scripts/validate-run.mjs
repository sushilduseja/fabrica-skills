#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');

const SCHEMA_PATH = resolve(root, 'schemas/run-object.schema.json');

// Status × experiment_phase compatibility matrix.
// Each phase permits a subset of run-level statuses.
const STATUS_PHASE_MATRIX = {
  designing:  ['phase_0_spec'],
  framing:    ['phase_0_spec'],
  forging:    ['phase_1_slice', 'phase_2_pipeline'],
  checking:   ['phase_1_slice', 'phase_2_pipeline'],
  weaving:    ['phase_2_pipeline'],
  verifying:  ['phase_2_pipeline'],
  complete:   ['phase_2_pipeline'],
  blocked:    ['phase_0_spec', 'phase_1_slice', 'phase_2_pipeline'],
  abandoned:  ['phase_0_spec', 'phase_1_slice', 'phase_2_pipeline'],
};

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

if (!valid) {
  console.error(`[validate-run] FAILED — ${validate.errors.length} schema violation(s):`);
  for (const err of validate.errors) {
    const path = err.instancePath || '(root)';
    console.error(`  ${path}  ${err.message}`);
  }
  process.exit(1);
}

// Post-schema: status × experiment_phase compatibility
const allowedPhases = STATUS_PHASE_MATRIX[instance.status];
if (allowedPhases && !allowedPhases.includes(instance.experiment_phase)) {
  error(`status "${instance.status}" is not valid with experiment_phase "${instance.experiment_phase}" (expected one of: ${allowedPhases.join(', ')})`);
}

console.log(`[validate-run] OK — run object from ${inputLabel} is valid`);
process.exit(0);
