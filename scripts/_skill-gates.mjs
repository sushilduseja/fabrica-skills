#!/usr/bin/env node

/**
 * Gate-contract validators for fab-* skills.
 *
 * Each function inspects a fabrica.run.json instance and returns an array of
 * error strings. An empty array means the gate contract is satisfied.
 *
 * These codify the "Execution Guardrails" and "Behavior" sections of each
 * SKILL.md as executable invariants so they can be verified automatically
 * rather than left to agent good faith.
 */
import { invokesDockerCommand } from './_verification-kind.mjs';

/**
 * Validate fab-verify (review gate) invariants.
 *
 * Key contracts:
 *   - external_deploy verification requires prior human approval
 *   - container_build kind must invoke Docker
 *   - complete status requires a launch verification when current_step is fab-verify
 *
 * @param {Object} run — parsed fabrica.run.json
 * @returns {string[]}
 */
export function validateFabLaunchGate(run) {
  const errors = [];

  for (const [i, v] of (run.verifications || []).entries()) {
    if (v.kind === 'external_deploy') {
      const approved = (run.human_decisions || []).some((d) => d.step === 'fab-verify' && d.decision === 'continue');
      if (!approved) {
        errors.push(
          `verifications[${i}].kind "external_deploy" requires a prior human_decisions` +
            ` entry with step "fab-verify" and decision "continue"`,
        );
      }
    }
    if (v.kind === 'container_build' && !invokesDockerCommand(v.command)) {
      errors.push(`verifications[${i}].kind "container_build" command "${v.command}" does not invoke Docker`);
    }
  }

  if (run.status === 'complete') {
    const hasLaunchVerification = (run.verifications || []).some((v) =>
      ['local_launch', 'container_build'].includes(v.kind),
    );
    if (!hasLaunchVerification) {
      errors.push(
        'status "complete" with no local_launch or container_build verification — ' +
          'launch must verify the app before completing',
      );
    }
  }

  return errors;
}

/**
 * Validate fab-decide (full gate) invariants.
 *
 * Key contracts:
 *   - A decision with a non-null value must have a resolved_at timestamp
 *     (no auto-deciding)
 *   - A pending decision (null decision) must not be silently resolved
 *
 * @param {Object} run — parsed fabrica.run.json
 * @returns {string[]}
 */
export function validateFabSignalGate(run) {
  const errors = [];

  for (const [i, d] of (run.human_decisions || []).entries()) {
    if (d.decision !== null && (d.resolved_at === null || d.resolved_at === undefined)) {
      errors.push(
        `human_decisions[${i}] has decision "${d.decision}" but no resolved_at — ` +
          'decisions must not be auto-populated without operator confirmation',
      );
    }
  }

  return errors;
}

/**
 * Validate fab-eval (auto gate) invariants.
 *
 * Key contracts:
 *   - A stage with quality_score < 6 must not be marked "done"
 *     (per-axis gating — any sub-threshold axis blocks regardless of average)
 *   - An empty/unscored stage should not be "done"
 *
 * @param {Object} run — parsed fabrica.run.json
 * @returns {string[]}
 */
export function validateFabCheckGate(run) {
  const errors = [];

  for (const [i, stage] of (run.app_stages || []).entries()) {
    if (stage.quality_score !== null && stage.quality_score < 6 && stage.status === 'done') {
      errors.push(
        `app_stages[${i}] "${stage.name}" has quality_score ${stage.quality_score} (< 6) ` +
          'but status is "done" — a sub-threshold axis must block the stage',
      );
    }
  }

  return errors;
}

/**
 * Validate fab-status (auto gate, read-only) invariants.
 *
 * Key contracts:
 *   - Never substitute computed values for "unknown" cost data
 *   - Render "unknown" as-is for missing or null cost values
 *
 * Since there is no rendering code, this validates cost-data integrity:
 * if precision is "unknown", all numeric cost fields must also be "unknown".
 *
 * @param {Object} run — parsed fabrica.run.json
 * @returns {string[]}
 */
export function validateFabPulseGate(run) {
  const errors = [];

  if (run.costs && run.costs.precision === 'unknown') {
    for (const field of ['tokens_in', 'tokens_out', 'api_calls', 'estimated_usd']) {
      if (run.costs[field] !== 'unknown') {
        errors.push(
          `costs.precision is "unknown" but costs.${field} is ${JSON.stringify(run.costs[field])} — ` +
            'must also be "unknown" to prevent invented display values',
        );
      }
    }
  }

  return errors;
}

/**
 * Validate next_action transition rules.
 *
 * Key contracts:
 *   - fab-integrate requires all app_stages to be done
 *   - fab-verify requires status to be "verifying"
 *
 * The declarative manifest prerequisites/blocks table in
 * skills/manifest.json remains the documented dependency record per ADR-003;
 * it is not evaluated here.
 *
 * @param {Object} run — parsed fabrica.run.json
 * @returns {string[]}
 */
export function validateNextActionGate(run) {
  const errors = [];

  if (!run.next_action) return errors;

  const [nextSkill] = run.next_action.slice(1).split(' ');

  if (nextSkill === 'fab-integrate') {
    const pending = (run.app_stages || []).filter((s) => s.status !== 'done');
    if (pending.length > 0) {
      errors.push(
        `next_action "/fab-integrate" requires all app_stages to be done, but ${pending.length} stage(s) ` +
          `have status other than "done": ${pending.map((s) => `"${s.name}"(${s.status})`).join(', ')}`,
      );
    }
  }

  if (nextSkill === 'fab-verify' && run.status !== 'verifying') {
    errors.push(`next_action "/fab-verify" requires status "verifying", but current status is "${run.status}"`);
  }

  return errors;
}

/**
 * Validate human_decisions timestamp ordering.
 *
 * Key contracts:
 *   - resolved_at must not be earlier than triggered_at
 *
 * @param {Object} run — parsed fabrica.run.json
 * @returns {string[]}
 */
export function validateTimestampOrderGate(run) {
  const errors = [];

  for (const [i, d] of (run.human_decisions || []).entries()) {
    if (d.triggered_at && d.resolved_at) {
      const triggered = new Date(d.triggered_at).getTime();
      const resolved = new Date(d.resolved_at).getTime();
      if (!isNaN(triggered) && !isNaN(resolved) && resolved < triggered) {
        errors.push(
          `human_decisions[${i}] resolved_at (${d.resolved_at}) is earlier than ` + `triggered_at (${d.triggered_at})`,
        );
      }
    }
  }

  return errors;
}

/**
 * Validate cost-precision state integrity.
 *
 * Key contracts:
 *   - precision "measured" with concrete values then downgraded to "unknown"
 *     must not retain stale numeric values (checked by validateFabPulseGate)
 *   - precision must be one of: "unknown", "estimated", "measured"
 *
 * @param {Object} run — parsed fabrica.run.json
 * @returns {string[]}
 */
export function validateCostPrecisionGate(run) {
  const errors = [];
  const validPrecisions = ['unknown', 'estimated', 'measured'];

  if (run.costs && !validPrecisions.includes(run.costs.precision)) {
    errors.push(
      `costs.precision "${run.costs.precision}" is not valid (must be one of: ${validPrecisions.join(', ')})`,
    );
  }

  return errors;
}

/**
 * Resolve the effective gate level for a skill invocation.
 *
 * `--auto` is an explicit opt-in override: it downgrades overridable
 * `checkpoint` gates (fab-spec, fab-plan) to `auto` so approval waits are
 * skipped. Non-overridable skills always keep their manifest `default_gate`
 * under `--auto` (`fab-status` is `overridable: false` with
 * `default_gate: "auto"`, so the flag changes nothing there). The locked
 * approval stops are `fab-verify` (`review`) and `fab-decide` (`full`).
 *
 * @param {string} skillId — manifest skill id (used only for error context)
 * @param {{default_gate: string, overridable: boolean}} manifestEntry
 * @param {boolean} autoMode — true when invoked with `--auto`
 * @returns {string} effective gate level
 */
export function resolveGateLevel(skillId, manifestEntry, autoMode) {
  if (!manifestEntry.overridable) {
    return manifestEntry.default_gate;
  }
  if (autoMode && manifestEntry.default_gate === 'checkpoint') {
    return 'auto';
  }
  return manifestEntry.default_gate;
}

/**
 * Run all gate validators against a run object.
 * @param {Object} run
 * @returns {string[]} all gate violations found
 */
export function validateAllGates(run) {
  return [
    ...validateFabLaunchGate(run),
    ...validateFabSignalGate(run),
    ...validateFabCheckGate(run),
    ...validateFabPulseGate(run),
    ...validateNextActionGate(run),
    ...validateTimestampOrderGate(run),
    ...validateCostPrecisionGate(run),
  ];
}
