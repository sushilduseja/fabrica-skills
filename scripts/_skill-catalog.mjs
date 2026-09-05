/**
 * Skill-catalog integrity checks for fabrica-skills.
 *
 * Owns one interpretation of the Skill catalog (skills/manifest.json plus the
 * on-disk Skill layout): catalog shape, file layout, Skill frontmatter, error
 * metadata, and Run-object field ownership. The generated-artifact projection
 * (scripts/_artifact-projection.mjs) and the `sync-manifest.mjs` command both
 * build on this single interpretation.
 *
 * Filesystem reads stay inside this module (the adapter at the seam). Rule
 * violations are reported by throwing the first diagnostic; the command
 * surface prints it.
 */
import { existsSync, readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import {
  assertSafeRelPath,
  assertDirectoryNotSymlink,
  lstatIfPresent,
  readJsonFile,
  SKILL_ID_RE,
  SKILL_PATH_RE,
} from './_path-utils.mjs';

export const VALID_GATES = ['auto', 'checkpoint', 'review', 'full'];
export const VALID_CATEGORIES = ['core', 'prototype', 'standalone'];
export const ERRORS_PATH_RE = /^skills\/(core|prototype|standalone)\/(?:fab|fabrica)-[a-z0-9-]+\/errors\.json$/;

/**
 * Run-object fields that are legitimately written by more than one skill.
 * Anything not on this list must be owned by exactly one skill.
 */
export const MULTI_WRITER_FIELDS = new Set([
  'updated_at',
  'current_step',
  'next_action',
  'last_error',
  'status',
  'app_stages',
  'verifications',
  'human_decisions',
  'experiment_phase',
  'current_app_stage',
  'blueprint_path',
]);

export const RUN_OBJECT_FIELDS = [
  'schema_version',
  'id',
  'name',
  'experiment_phase',
  'created_at',
  'updated_at',
  'status',
  'current_step',
  'current_app_stage',
  'next_action',
  'last_error',
  'spec_path',
  'blueprint_path',
  'app_stages',
  'costs',
  'verifications',
  'human_decisions',
  'gate_levels',
];

/**
 * Check the Skill catalog at a repository root.
 * @param {string} root Absolute path to the repository root.
 * @returns {{manifest: any, schema: any, validErrorTypes: string[], skillIds: string[]}}
 * @throws {Error} The first catalog diagnostic.
 */
export function checkSkillCatalog(root) {
  const fail = (msg) => {
    throw new Error(msg);
  };

  const MANIFEST_PATH = resolve(root, 'skills/manifest.json');
  const SCHEMA_PATH = resolve(root, 'schemas/run-object.schema.json');

  if (!existsSync(MANIFEST_PATH)) {
    fail(`Manifest not found at ${MANIFEST_PATH}`);
  }

  const manifest = readJsonFile(MANIFEST_PATH, 'skills/manifest.json');

  if (typeof manifest.schema_version !== 'string') fail('manifest missing schema_version');
  if (typeof manifest.repo_version !== 'string') fail('manifest missing repo_version');
  if (!Array.isArray(manifest.skills)) fail('manifest.skills must be an array');
  if (manifest.skills.length === 0) fail('manifest.skills is empty');

  const schema = readJsonFile(SCHEMA_PATH, 'schemas/run-object.schema.json');
  const lastErrorSchema = schema?.properties?.last_error?.oneOf?.[1]?.properties?.type?.enum;
  if (!Array.isArray(lastErrorSchema)) {
    fail('schemas/run-object.schema.json does not expose last_error.type enum');
  }
  const validErrorTypes = lastErrorSchema;

  const fieldOwners = {};
  const seenIds = new Set();
  const seenPaths = new Set();
  const seenAliases = new Set();
  const skillIds = [];

  for (let index = 0; index < manifest.skills.length; index += 1) {
    const skill = manifest.skills[index];
    if (!skill || typeof skill !== 'object' || Array.isArray(skill)) {
      fail(`skill at index ${index} must be an object`);
    }

    if (!SKILL_ID_RE.test(skill.id || '')) {
      fail(`skill at index ${index} has invalid id: ${skill.id}`);
    }
    if (seenIds.has(skill.id)) fail(`duplicate skill id: "${skill.id}"`);
    seenIds.add(skill.id);
    skillIds.push(skill.id);

    if (!VALID_CATEGORIES.includes(skill.category)) {
      fail(`skill "${skill.id}" has invalid category "${skill.category}"`);
    }
    if (!Number.isInteger(skill.phase) || skill.phase < 0 || skill.phase > 2) {
      fail(`skill "${skill.id}" phase must be integer 0, 1, or 2`);
    }
    if (!VALID_GATES.includes(skill.default_gate)) {
      fail(`skill "${skill.id}" invalid default_gate "${skill.default_gate}"`);
    }
    if (typeof skill.overridable !== 'boolean') {
      fail(`skill "${skill.id}" overridable must be boolean`);
    }
    if (typeof skill.read_only !== 'boolean') {
      fail(`skill "${skill.id}" read_only must be boolean`);
    }

    const skillDir = assertSafeRelPath(root, `skill "${skill.id}" path`, skill.path, SKILL_PATH_RE);
    const pathCategory = skill.path.split('/')[1];
    if (pathCategory !== skill.category) {
      fail(`skill "${skill.id}" path category "${pathCategory}" does not match manifest category "${skill.category}"`);
    }
    if (typeof skill.description !== 'string' || skill.description.trim() === '') {
      fail(`skill "${skill.id}" missing description`);
    }
    const expectedSkillName = skill.path.split('/').pop();
    if (expectedSkillName !== skill.id) {
      fail(`skill "${skill.id}" path basename "${expectedSkillName}" does not match id`);
    }
    if (seenPaths.has(skill.path)) fail(`duplicate skill path "${skill.path}" for "${skill.id}"`);
    seenPaths.add(skill.path);

    assertDirectoryNotSymlink(`skill "${skill.id}" path`, skillDir);

    const skillFile = resolve(skillDir, 'SKILL.md');
    if (!lstatIfPresent(skillFile)) {
      fail(`skill "${skill.id}" missing SKILL.md at ${skill.path}/SKILL.md`);
    }

    const errPath = assertSafeRelPath(
      root,
      `skill "${skill.id}" error_metadata_path`,
      skill.error_metadata_path,
      ERRORS_PATH_RE,
    );
    if (skill.error_metadata_path !== `${skill.path}/errors.json`) {
      fail(`skill "${skill.id}" error_metadata_path must be ${skill.path}/errors.json`);
    }
    if (!lstatIfPresent(errPath)) {
      fail(`skill "${skill.id}" error_metadata_path not found: ${skill.error_metadata_path}`);
    }

    let skillContent;
    try {
      skillContent = readFileSync(skillFile, 'utf-8');
    } catch (err) {
      fail(`Cannot read ${skill.path}/SKILL.md: ${err.message}`);
    }
    // Normalize CRLF so frontmatter/field parsing is identical on Windows fresh clones.
    skillContent = skillContent.replace(/\r\n/g, '\n');
    const fmMatch = skillContent.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) {
      fail(`skill "${skill.id}" missing YAML frontmatter`);
    }
    const fm = fmMatch[1];
    const fmName = fm.match(/^name:\s*(.*)$/m);
    if (!fmName || fmName[1] !== skill.id) {
      fail(`skill "${skill.id}" frontmatter name does not match manifest id`);
    }
    const fmDescription = fm.match(/^description:\s*(.*)$/m);
    if (!fmDescription || fmDescription[1] !== skill.description) {
      fail(`skill "${skill.id}" frontmatter description does not match manifest description`);
    }
    const fmCategory = fm.match(/^category:\s*(.*)$/m);
    if (!fmCategory || fmCategory[1] !== skill.category) {
      fail(`skill "${skill.id}" frontmatter category does not match manifest category "${skill.category}"`);
    }
    const fmPhase = fm.match(/^phase:\s*(.*)$/m);
    if (!fmPhase || Number(fmPhase[1]) !== skill.phase) {
      fail(`skill "${skill.id}" frontmatter phase does not match manifest phase "${skill.phase}"`);
    }
    const fmDisableModel = fm.match(/^disable-model-invocation:\s*(.*)$/m);
    if (!fmDisableModel || fmDisableModel[1] !== 'true') {
      fail(`skill "${skill.id}" frontmatter disable-model-invocation must be true`);
    }
    const fmGate = fm.match(/^default_gate:\s*(.*)$/m);
    if (!fmGate || fmGate[1] !== skill.default_gate) {
      fail(`skill "${skill.id}" frontmatter default_gate does not match manifest default_gate "${skill.default_gate}"`);
    }
    const fmOverridable = fm.match(/^overridable:\s*(.*)$/m);
    if (!fmOverridable || fmOverridable[1] !== String(skill.overridable)) {
      fail(`skill "${skill.id}" frontmatter overridable does not match manifest overridable "${skill.overridable}"`);
    }

    if (!Array.isArray(skill.prerequisites)) {
      fail(`skill "${skill.id}" prerequisites must be an array`);
    }
    for (const prereq of skill.prerequisites) {
      if (!SKILL_ID_RE.test(prereq || '')) {
        fail(`skill "${skill.id}" prerequisite has invalid id "${prereq}"`);
      }
      if (!seenIds.has(prereq) && !manifest.skills.some((s) => s.id === prereq)) {
        fail(`skill "${skill.id}" prerequisite "${prereq}" not found in manifest`);
      }
    }

    if (!Array.isArray(skill.blocks)) {
      fail(`skill "${skill.id}" blocks must be an array`);
    }
    for (const blocked of skill.blocks) {
      if (!SKILL_ID_RE.test(blocked || '')) {
        fail(`skill "${skill.id}" block has invalid id "${blocked}"`);
      }
      if (!manifest.skills.some((s) => s.id === blocked)) {
        fail(`skill "${skill.id}" blocks "${blocked}" not found in manifest`);
      }
    }

    if (skill.aliases !== undefined) {
      if (!Array.isArray(skill.aliases)) {
        fail(`skill "${skill.id}" aliases must be an array`);
      }
      for (const alias of skill.aliases) {
        if (typeof alias !== 'string' || !SKILL_ID_RE.test(alias)) {
          fail(`skill "${skill.id}" alias has invalid id "${alias}"`);
        }
        if (alias === skill.id) {
          fail(`skill "${skill.id}" alias must not equal its own id`);
        }
        if (manifest.skills.some((s) => s.id === alias)) {
          fail(`skill "${skill.id}" alias "${alias}" collides with a manifest skill id`);
        }
        if (seenAliases.has(alias)) {
          fail(`duplicate skill alias "${alias}"`);
        }
        seenAliases.add(alias);
      }
    }

    const errMeta = readJsonFile(errPath, skill.error_metadata_path);
    if (errMeta.skill_id !== skill.id) {
      fail(`skill "${skill.id}" errors.json skill_id mismatch: "${errMeta.skill_id}"`);
    }
    if (!Array.isArray(errMeta.errors) || errMeta.errors.length === 0) {
      fail(`skill "${skill.id}" errors.json.errors must be a non-empty array`);
    }
    const errorTypesInMeta = new Set();
    for (const e of errMeta.errors) {
      if (!e || typeof e !== 'object' || Array.isArray(e)) {
        fail(`skill "${skill.id}" errors.json contains a non-object error entry`);
      }
      if (!validErrorTypes.includes(e.type)) {
        fail(`skill "${skill.id}" errors.json has invalid error type "${e.type}"`);
      }
      if (!e.trigger) fail(`skill "${skill.id}" errors.json error "${e.type}" missing trigger`);
      if (!e.diagnosis) fail(`skill "${skill.id}" errors.json error "${e.type}" missing diagnosis`);
      if (!e.rescue_action) fail(`skill "${skill.id}" errors.json error "${e.type}" missing rescue_action`);
      if (!e.user_message) fail(`skill "${skill.id}" errors.json error "${e.type}" missing user_message`);
      errorTypesInMeta.add(e.type);
    }

    // Cross-reference: every backtick error type mentioned in the Error Handling section must exist in errors.json.
    const errorSectionMatch = skillContent.match(/## Error Handling\n([\s\S]*?)(?=\n## |\n---|$)/);
    if (errorSectionMatch) {
      const errorSection = errorSectionMatch[1];
      const mentionedTypes = new Set([...errorSection.matchAll(/`([a-z_]+)`/g)].map((m) => m[1]));
      for (const mentioned of mentionedTypes) {
        if (validErrorTypes.includes(mentioned) && !errorTypesInMeta.has(mentioned)) {
          fail(
            `skill "${skill.id}" Error Handling section mentions "${mentioned}" but it is not defined in errors.json`,
          );
        }
      }
      // Reverse direction: every error type in errors.json must be mentioned in the Error Handling section.
      for (const errorType of errorTypesInMeta) {
        const quoted = '`' + errorType + '`';
        if (!errorSection.includes(quoted)) {
          fail(
            `skill "${skill.id}" errors.json defines "${errorType}" but it is not mentioned in the SKILL.md Error Handling section`,
          );
        }
      }
    }

    if (skill.read_only) {
      if (skill.writes_fields && skill.writes_fields.length > 0) {
        fail(`skill "${skill.id}" is read_only but writes_fields is non-empty`);
      }
    } else if (!Array.isArray(skill.writes_fields)) {
      fail(`skill "${skill.id}" missing writes_fields array`);
    } else if (skill.writes_fields.length === 0) {
      fail(`skill "${skill.id}" is not read_only but writes_fields is empty`);
    }

    for (const f of skill.writes_fields || []) {
      if (!RUN_OBJECT_FIELDS.includes(f)) {
        fail(`skill "${skill.id}" writes unknown run object field "${f}"`);
      }
      if (!fieldOwners[f]) fieldOwners[f] = [];
      fieldOwners[f].push(skill.id);
    }
  }

  for (const field of RUN_OBJECT_FIELDS) {
    const owners = fieldOwners[field] || [];
    if (owners.length === 0) {
      fail(`run object field "${field}" has no owning skill`);
    }
    if (owners.length > 1 && !MULTI_WRITER_FIELDS.has(field)) {
      fail(
        `run object field "${field}" is written by multiple skills (${owners.join(', ')}) but is not in the multi-writer whitelist`,
      );
    }
  }

  for (const category of VALID_CATEGORIES) {
    const categoryDir = resolve(root, 'skills', category);
    if (!existsSync(categoryDir)) continue;
    for (const entry of readdirSync(categoryDir)) {
      const skillDirPath = `skills/${category}/${entry}`;
      if (seenPaths.has(skillDirPath)) continue;
      if (lstatIfPresent(resolve(categoryDir, entry, 'SKILL.md'))) {
        fail(`orphan skill directory ${skillDirPath} exists on disk but is not listed in skills/manifest.json`);
      }
    }
  }

  return { manifest, schema, validErrorTypes, skillIds };
}
