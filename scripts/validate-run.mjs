#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');

const SCHEMA_PATH = resolve(root, 'schemas/run-object.schema.json');

// Status × experiment_phase compatibility matrix.
// Each phase permits a subset of run-level statuses.
const STATUS_PHASE_MATRIX = {
  designing: ['phase_0_spec'],
  framing: ['phase_0_spec'],
  forging: ['phase_1_slice', 'phase_2_pipeline'],
  checking: ['phase_1_slice', 'phase_2_pipeline'],
  weaving: ['phase_2_pipeline'],
  verifying: ['phase_2_pipeline'],
  complete: ['phase_2_pipeline'],
  blocked: ['phase_0_spec', 'phase_1_slice', 'phase_2_pipeline'],
  abandoned: ['phase_0_spec', 'phase_1_slice', 'phase_2_pipeline'],
};

function fail(msg) {
  console.error(`[validate-run] ERROR: ${msg}`);
  process.exit(1);
}

function readJsonFile(path, label) {
  let raw;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch (err) {
    fail(`Cannot read ${label}: ${err.message}`);
  }

  try {
    return JSON.parse(raw);
  } catch (err) {
    fail(`Invalid JSON in ${label}: ${err.message}`);
  }
}

async function readStdinJson() {
  const chunks = [];
  try {
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
  } catch (err) {
    fail(`Cannot read stdin: ${err.message}`);
  }

  const input = Buffer.concat(chunks).toString('utf-8');
  if (input.trim().length === 0) {
    fail('No JSON received on stdin');
  }

  try {
    return JSON.parse(input);
  } catch (err) {
    fail(`Invalid JSON from stdin: ${err.message}`);
  }
}

async function loadAjv() {
  try {
    const [{ default: Ajv }, { default: addFormats }] = await Promise.all([
      import('ajv'),
      import('ajv-formats'),
    ]);
    return { Ajv, addFormats };
  } catch (err) {
    fail(`Validator dependencies are unavailable. Run "npm ci" before validating. Detail: ${err.message}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const stdinMode = args.includes('--stdin');
  const pathArgs = args.filter((arg) => arg !== '--stdin');
  if ((stdinMode && pathArgs.length > 0) || (!stdinMode && pathArgs.length !== 1) || args.length > 2) {
    fail('Usage: node scripts/validate-run.mjs [--stdin | <path-to-fabrica.run.json>]');
  }

  let instance;
  let inputLabel;

  if (stdinMode) {
    instance = await readStdinJson();
    inputLabel = 'stdin';
  } else {
    const targetPath = pathArgs[0];

    const absolutePath = resolve(process.cwd(), targetPath);
    if (!existsSync(absolutePath)) {
      fail(`File not found: ${targetPath}`);
    }

    instance = readJsonFile(absolutePath, targetPath);
    inputLabel = targetPath;
  }

  if (!existsSync(SCHEMA_PATH)) {
    fail(`Schema not found: ${SCHEMA_PATH}`);
  }

  const schema = readJsonFile(SCHEMA_PATH, 'schemas/run-object.schema.json');
  const { Ajv, addFormats } = await loadAjv();

  let validate;
  try {
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    const cleanSchema = { ...schema, $schema: undefined };
    validate = ajv.compile(cleanSchema);
  } catch (err) {
    fail(`Schema compile failed: ${err.message}`);
  }

  const valid = validate(instance);
  if (!valid) {
    console.error(`[validate-run] FAILED — ${validate.errors.length} schema violation(s):`);
    for (const err of validate.errors) {
      const path = err.instancePath || '(root)';
      console.error(`  ${path}  ${err.message}`);
    }
    process.exit(1);
  }

  // Post-schema: status × experiment_phase compatibility.
  const allowedPhases = STATUS_PHASE_MATRIX[instance.status];
  if (allowedPhases && !allowedPhases.includes(instance.experiment_phase)) {
    fail(`status "${instance.status}" is not valid with experiment_phase "${instance.experiment_phase}" (expected one of: ${allowedPhases.join(', ')})`);
  }

  const skillIds = schema.properties.current_step.oneOf.find((entry) => Array.isArray(entry.enum))?.enum || [];
  const stageNames = new Set();
  for (const [index, stage] of instance.app_stages.entries()) {
    if (stageNames.has(stage.name)) {
      fail(`duplicate app_stages name "${stage.name}" at index ${index}`);
    }
    stageNames.add(stage.name);
  }

  if (['forging', 'checking', 'weaving', 'verifying', 'complete'].includes(instance.status) && instance.app_stages.length === 0) {
    fail(`status "${instance.status}" requires at least one app_stages entry`);
  }

  if (instance.status === 'complete') {
    const incomplete = instance.app_stages.filter((stage) => stage.status !== 'done').map((stage) => stage.name);
    if (incomplete.length > 0) {
      fail(`status "complete" requires all app stages to be done (not done: ${incomplete.join(', ')})`);
    }
  }

  if (instance.current_app_stage !== null && !stageNames.has(instance.current_app_stage)) {
    fail(`current_app_stage "${instance.current_app_stage}" does not match any app_stages name`);
  }

  if (instance.next_action !== null) {
    const [nextSkill, nextArg, ...extra] = instance.next_action.slice(1).split(' ');
    if (extra.length > 0) {
      fail(`next_action "${instance.next_action}" has too many arguments`);
    }
    if (!skillIds.includes(nextSkill)) {
      fail(`next_action skill "${nextSkill}" is not in skills/manifest.json`);
    }
    if (['fab-forge', 'fab-check'].includes(nextSkill) && !stageNames.has(nextArg)) {
      fail(`next_action "${instance.next_action}" references unknown app stage "${nextArg || ''}"`);
    }
    if (nextSkill === 'fab-trace' && nextArg && nextArg !== 'integration' && !stageNames.has(nextArg)) {
      fail(`next_action "${instance.next_action}" references unknown trace target "${nextArg}"`);
    }
  }

  console.log(`[validate-run] OK — run object from ${inputLabel} is valid`);
}

main().catch((err) => {
  fail(`Unexpected validator failure: ${err.message}`);
});
