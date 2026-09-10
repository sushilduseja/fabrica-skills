#!/usr/bin/env node
/**
 * Human-minted checkpoint approval (SD-6).
 *
 * Only this command can effectively approve a checkpoint step: it refuses
 * non-TTY stdin, shows the pending decision surface, and appends the verdict
 * record on exact typed confirmation.
 */
import { createInterface } from 'readline';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { readJsonFile, stringifyJson } from './_path-utils.mjs';

export const APPROVALS = {
  spec: {
    step: 'fab-spec',
    field: 'spec_path',
    noun: 'spec',
    decisionNeeded: 'Approve the spec before it is written to docs/spec.md',
  },
  blueprint: {
    step: 'fab-plan',
    field: 'blueprint_path',
    noun: 'blueprint',
    decisionNeeded: 'Approve the blueprint before it is written to docs/blueprint.md',
  },
  adoption: {
    step: 'fab-adopt',
    field: null,
    noun: 'adoption',
    decisionNeeded: 'Approve adoption of the blueprint into execution',
  },
  integration: {
    step: 'fab-integrate',
    field: null,
    noun: 'integration',
    decisionNeeded: 'Approve the wiring plan before integration writes',
  },
};

export function appendApproval(run, artifact, verdict, nowIso) {
  const spec = APPROVALS[artifact];
  if (!spec) throw new Error(`Unknown approval artifact: ${artifact}`);
  if (!['approve', 'revise', 'reject'].includes(verdict)) throw new Error(`Invalid verdict: ${verdict}`);
  return {
    ...run,
    human_decisions: [
      ...(run.human_decisions || []),
      {
        step: spec.step,
        decision_needed: spec.decisionNeeded,
        options: ['approve', 'revise', 'reject'],
        decision: verdict,
        rationale: 'Operator verdict typed in a local terminal via fabrica-skills approve.',
        triggered_at: nowIso,
        resolved_at: nowIso,
      },
    ],
  };
}

export function buildApprovalSummary(run, artifact) {
  const spec = APPROVALS[artifact];
  if (!spec) throw new Error(`Unknown approval artifact: ${artifact}`);
  const lines = [
    `step: ${spec.step} (gate: ${(run.gate_levels || {})[spec.step] ?? 'missing'})`,
    `current_step: ${run.current_step}`,
    `next_action: ${run.next_action}`,
  ];
  if (spec.field) {
    lines.push(`${spec.field}: ${run[spec.field] ?? '(not set yet — confirm the draft in chat first)'}`);
  }
  if (run.preferred_stack) lines.push(`preferred_stack: ${JSON.stringify(run.preferred_stack)}`);
  return lines.join('\n');
}

/**
 * Parse approve argv without touching fs or TTY (unit-testable).
 * Accepts `--file <path>` and `--file=<path>`; anything else is rejected.
 * @param {string[]} argv
 * @param {string} cwd
 * @returns {{ artifact: string, file: string }}
 */
export function parseApproveArgs(argv, cwd) {
  const artifact = argv.find((a) => !a.startsWith('-'));
  if (!APPROVALS[artifact]) {
    throw new Error(`unknown artifact "${artifact ?? ''}" (expected one of: ${Object.keys(APPROVALS).join(', ')})`);
  }
  const fi = argv.findIndex((a) => a === '--file' || a.startsWith('--file='));
  let fileValue;
  if (fi !== -1) {
    fileValue = argv[fi].includes('=') ? argv[fi].slice('--file='.length) : argv[fi + 1];
    if (!fileValue) throw new Error('--file requires a run-object path');
  }
  return { artifact, file: resolve(cwd, fileValue ?? 'fabrica.run.json') };
}

/**
 * Parse one prompt line into a verdict, or null when it is not an exact
 * `<approve|revise|reject> <noun>` reply (F-1: trailing tokens never mint).
 * @param {string} answer
 * @param {string} noun
 * @returns {string|null}
 */
export function parsePromptAnswer(answer, noun) {
  const parts = answer.trim().split(/\s+/);
  if (parts.length !== 2) return null;
  const [verdict, name] = parts;
  if (name !== noun || !['approve', 'revise', 'reject'].includes(verdict)) return null;
  return verdict;
}

function approveFail(msg) {
  console.error(`[approve] ERROR: ${msg}`);
  process.exitCode = 1;
  return false;
}

export async function runApprove(argv, cwd) {
  let artifact;
  let file;
  try {
    ({ artifact, file } = parseApproveArgs(argv, cwd));
  } catch (err) {
    return approveFail(err.message);
  }
  const spec = APPROVALS[artifact];
  if (!process.stdin.isTTY) {
    return approveFail(
      'approval requires an interactive terminal (stdin is not a TTY) — run this command yourself in a terminal; piped input, including agent-driven pipes, is refused and records nothing.',
    );
  }
  const run = readJsonFile(file, file, '[approve]');
  if (!run || typeof run !== 'object' || Array.isArray(run))
    return approveFail(`Run object in ${file} must be a JSON object`);
  if (!run.gate_levels || run.gate_levels[spec.step] !== 'checkpoint') {
    console.log(`[approve] nothing to approve — gate_levels.${spec.step} is not "checkpoint".`);
    return true;
  }
  console.log(buildApprovalSummary(run, artifact));
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  // F-3: stdin closed with no line (EOF on a PTY) must refuse, never hang.
  const answer = await new Promise((res) => {
    rl.on('close', () => res(null));
    rl.question(
      `Type 'approve ${spec.noun}' to approve, 'revise ${spec.noun}' to send back, or 'reject ${spec.noun}' to stop: `,
      res,
    );
  });
  rl.close();
  const verdict = answer == null ? null : parsePromptAnswer(answer, spec.noun);
  if (!verdict) {
    return approveFail('not approved — file unchanged.');
  }
  const now = new Date().toISOString();
  writeFileSync(file, stringifyJson(appendApproval(run, artifact, verdict, now)), 'utf-8');
  console.log(
    `[approve] recorded ${verdict} for ${spec.step} in ${file} — re-invoke the agent (or reply done) so it can validate and proceed.`,
  );
  return true;
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  await runApprove(process.argv.slice(2), process.cwd());
  if (process.exitCode) process.exit(process.exitCode);
}
