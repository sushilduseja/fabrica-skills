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

function approveFail(msg) {
  console.error(`[approve] ERROR: ${msg}`);
  process.exitCode = 1;
  return false;
}

export async function runApprove(argv, cwd) {
  const artifact = argv.find((a) => !a.startsWith('-'));
  const spec = APPROVALS[artifact];
  if (!spec)
    return approveFail(`unknown artifact "${artifact ?? ''}" (expected one of: ${Object.keys(APPROVALS).join(', ')})`);
  const fi = argv.indexOf('--file');
  if (fi !== -1 && !argv[fi + 1]) return approveFail('--file requires a run-object path');
  const file = resolve(cwd, fi !== -1 ? argv[fi + 1] : 'fabrica.run.json');
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
  const answer = await new Promise((res) =>
    rl.question(
      `Type 'approve ${spec.noun}' to approve, 'revise ${spec.noun}' to send back, or 'reject ${spec.noun}' to stop: `,
      res,
    ),
  );
  rl.close();
  const [verdict, noun] = answer.trim().split(/\s+/);
  if (noun !== spec.noun || !['approve', 'revise', 'reject'].includes(verdict)) {
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
