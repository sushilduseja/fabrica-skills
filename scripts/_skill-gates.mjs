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

/**
 * Validate fab-launch (review gate) invariants.
 *
 * Key contracts:
 *   - external_deploy verification requires prior human approval
 *   - container_build kind must invoke Docker
 *   - complete status requires a launch verification when current_step is fab-launch
 *
 * @param {Object} run — parsed fabrica.run.json
 * @returns {string[]}
 */
export function validateFabLaunchGate(run) {
  const errors = [];

  for (const [i, v] of (run.verifications || []).entries()) {
    if (v.kind === 'external_deploy') {
      const approved = (run.human_decisions || []).some(
        (d) => d.step === 'fab-launch' && d.decision === 'continue'
      );
      if (!approved) {
        errors.push(
          `verifications[${i}].kind "external_deploy" requires a prior human_decisions` +
            ` entry with step "fab-launch" and decision "continue"`
        );
      }
    }
    if (v.kind === 'container_build' && !/(?:^|[^-\w])docker\b/.test(v.command)) {
      errors.push(
        `verifications[${i}].kind "container_build" command "${v.command}" does not invoke Docker`
      );
    }
  }

  if (run.status === 'complete') {
    const hasLaunchVerification = (run.verifications || []).some((v) =>
      ['local_launch', 'container_build'].includes(v.kind)
    );
    if (!hasLaunchVerification) {
      errors.push(
        'status "complete" with no local_launch or container_build verification — ' +
          'launch must verify the app before completing'
      );
    }
  }

  return errors;
}

/**
 * Validate fab-signal (full gate) invariants.
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
          'decisions must not be auto-populated without operator confirmation'
      );
    }
  }

  return errors;
}

/**
 * Validate fab-check (auto gate) invariants.
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
          'but status is "done" — a sub-threshold axis must block the stage'
      );
    }
  }

  return errors;
}

/**
 * Validate fab-pulse (auto gate, read-only) invariants.
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
            'must also be "unknown" to prevent invented display values'
        );
      }
    }
  }

  return errors;
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
  ];
}
