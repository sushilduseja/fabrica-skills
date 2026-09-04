/**
 * Deprecated Skill id aliases (0.3.x only).
 *
 * Maps pre-rename `fab-*` ids to their canonical post-rename ids so that
 * run objects written before PR-2 still validate (with a deprecation
 * warning). Writers must only document canonical ids.
 */

export const SKILL_ALIASES = {
  'fab-intake': 'fab-spec',
  'fab-blueprint': 'fab-plan',
  'fab-frame': 'fab-scaffold',
  'fab-forge': 'fab-build',
  'fab-check': 'fab-eval',
  'fab-pulse': 'fab-status',
  'fab-passport': 'fab-handoff',
  'fab-trace': 'fab-fix',
  'fab-weave': 'fab-integrate',
  'fab-launch': 'fab-verify',
  'fab-signal': 'fab-decide',
};

/**
 * Map a possibly-deprecated Skill id to its canonical id.
 * @param {string} id Skill id from a run object.
 * @returns {string} Canonical Skill id (unchanged when already canonical).
 */
export function canonicalSkillId(id) {
  if (!id) return id;
  return SKILL_ALIASES[id] || id;
}
