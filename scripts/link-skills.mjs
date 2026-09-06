#!/usr/bin/env node

/**
 * Create or refresh a flat .skills/ directory by linking (junction or symlink)
 * or copying each skill from skills/manifest.json.
 *
 * Local install: creates .skills/ at the repo root.
 * Global install: creates ~/.fabrica-skills/.skills/.
 *
 * Prevents symlink/junction attacks by rejecting symlinked source
 * directories and symlinked target directories.
 *
 * Usage:
 *   node scripts/link-skills.mjs
 *   node scripts/link-skills.mjs --global
 */
import { cpSync, mkdirSync, rmSync, rmdirSync, symlinkSync } from 'fs';
import { join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import {
  assertInsideRoot,
  assertWithinRoot,
  lstatIfPresent,
  readJsonFile,
  SKILL_ID_RE,
  SKILL_PATH_RE,
  toRepoRelative,
} from './_path-utils.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');
const globalInstall = process.argv.includes('--global');
const homeRoot = homedir();
const targetBase = globalInstall ? join(homeRoot, '.fabrica-skills') : root;
const targetDir = globalInstall ? join(targetBase, '.skills') : resolve(root, '.skills');
const isWindows = process.platform === 'win32';

/**
 * Log a link error and exit.
 * @param {string} msg
 */
function fail(msg) {
  console.error(`[link-skills] ERROR: ${msg}`);
  process.exit(1);
}

/**
 * Log a warning without exiting.
 * @param {string} msg
 */
function warn(msg) {
  console.warn(`[link-skills] WARN: ${msg}`);
}

function statIfPresent(path) {
  try {
    return lstatIfPresent(path);
  } catch (err) {
    fail(`Cannot inspect ${path}: ${err.message}`);
  }
}

/**
 * Validate a manifest skill entry's path for safety and layout.
 * Returns the resolved absolute path on success; calls fail() on error.
 * @param {{ id: string, path: string }} skill
 * @returns {string} Resolved absolute path to the skill directory.
 */
function assertSafeSkillPath(skill) {
  if (!skill || typeof skill !== 'object' || Array.isArray(skill)) {
    fail('Manifest contains a non-object skill entry');
  }
  if (typeof skill.id !== 'string' || !SKILL_ID_RE.test(skill.id)) {
    fail(`Manifest skill has invalid id: ${skill.id}`);
  }
  if (typeof skill.path !== 'string' || skill.path.trim() === '') {
    fail(`Manifest skill "${skill.id}" has empty path`);
  }
  if (skill.path.includes('\\') || skill.path.startsWith('/') || skill.path.split('/').includes('..')) {
    fail(`Manifest skill "${skill.id}" path is unsafe: ${skill.path}`);
  }
  if (!SKILL_PATH_RE.test(skill.path)) {
    fail(`Manifest skill "${skill.id}" path must match skills/<core|prototype>/fab-* layout: ${skill.path}`);
  }
  if (skill.path.split('/').pop() !== skill.id) {
    fail(`Manifest skill "${skill.id}" path basename does not match id: ${skill.path}`);
  }

  const skillPath = resolve(root, skill.path);
  assertInsideRoot(root, `skill "${skill.id}" path`, skillPath);
  return skillPath;
}

/**
 * Read and parse skills/manifest.json. Calls fail() on error.
 * @returns {{ skills: Array<{ id: string, path: string }> }}
 */
function loadManifest() {
  const manifestPath = resolve(root, 'skills/manifest.json');
  const manifest = readJsonFile(manifestPath, 'skills/manifest.json', '[link-skills]');
  if (!Array.isArray(manifest.skills) || manifest.skills.length === 0) {
    fail('skills/manifest.json must contain a non-empty skills array');
  }
  return manifest;
}

/**
 * Check that a path either does not exist or is a real (non-symlink) directory.
 * Calls fail() if it exists and is a symlink or non-directory.
 * @param {string} path
 * @param {string} label
 */
function assertExistingDirectoryIsSafe(path, label) {
  const stat = statIfPresent(path);
  if (!stat) return;
  if (stat.isSymbolicLink()) {
    fail(`${label} must not be a symlink or junction: ${path}`);
  }
  if (!stat.isDirectory()) {
    fail(`${label} exists but is not a directory: ${path}`);
  }
}

/**
 * Create a directory if it does not exist, verifying the result is a
 * real (non-symlink) directory. Calls fail() on creation failure.
 * @param {string} path
 * @param {string} label
 */
function ensureSafeDirectory(path, label) {
  assertExistingDirectoryIsSafe(path, label);
  try {
    mkdirSync(path, { recursive: true });
  } catch (err) {
    fail(`Cannot create ${label}: ${err.message}`);
  }
  assertExistingDirectoryIsSafe(path, label);
}

/**
 * Validate that a manifest skill's source exists and is a real directory
 * with a SKILL.md inside.
 * @param {{ id: string, path: string, aliases?: string[] }} skill
 * @returns {{ skillName: string, skillPath: string, aliases: string[] }}
 */
function preflightSkill(skill) {
  const skillPath = assertSafeSkillPath(skill);
  const skillName = skill.id;
  if (skill.aliases !== undefined && !Array.isArray(skill.aliases)) {
    fail(`Manifest skill "${skill.id}" aliases must be an array`);
  }
  const aliases = skill.aliases || [];
  for (const alias of aliases) {
    if (typeof alias !== 'string' || !SKILL_ID_RE.test(alias)) {
      fail(`Manifest skill "${skill.id}" has invalid alias: ${alias}`);
    }
  }

  const stat = statIfPresent(skillPath);
  if (!stat) {
    fail(`Source directory not found for ${skillName}: ${toRepoRelative(root, skillPath)}`);
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    fail(`Source for ${skillName} must be a real directory, not a file, symlink, or junction`);
  }
  if (!statIfPresent(join(skillPath, 'SKILL.md'))) {
    fail(`SKILL.md missing for ${skillName}: ${toRepoRelative(root, join(skillPath, 'SKILL.md'))}`);
  }

  return { skillName, skillPath, aliases };
}

function removeExistingManagedSkill(linkDest, skillName) {
  const stat = statIfPresent(linkDest);
  if (!stat) return;
  try {
    rmSync(linkDest, { recursive: true, force: true });
    console.log(`[link-skills] CLEAN  ${skillName}`);
  } catch (err) {
    if (err.code === 'ENOTEMPTY') {
      try {
        rmdirSync(linkDest);
        console.log(`[link-skills] CLEAN  ${skillName}`);
      } catch (retryErr) {
        fail(
          `Cannot remove existing managed entry ${skillName} (${retryErr.code || retryErr.message}). Manually clear .skills/${skillName} before rerunning setup.`,
        );
      }
    } else {
      fail(
        `Cannot remove existing managed entry ${skillName}: ${err.message}. Manually clear .skills/${skillName} before rerunning setup.`,
      );
    }
  }
}

function copySkill(skillPath, linkDest, skillName) {
  try {
    cpSync(skillPath, linkDest, {
      recursive: true,
      errorOnExist: true,
      force: false,
      verbatimSymlinks: true,
    });
    console.log(`[link-skills] COPY   ${skillName} → .skills/ (junction fallback)`);
  } catch (err) {
    fail(`Cannot copy ${skillName} to ${linkDest}: ${err.message}`);
  }
}

if (process.argv.some((arg) => arg !== process.argv[0] && arg !== process.argv[1] && arg !== '--global')) {
  fail('Usage: node scripts/link-skills.mjs [--global]');
}

const manifest = loadManifest();
const skills = manifest.skills.map(preflightSkill);
const skillNames = new Set(skills.map((s) => s.skillName));
if (skillNames.size !== skills.length) {
  fail('skills/manifest.json contains duplicate skill ids');
}
const aliasNames = new Set();
for (const { skillName, aliases } of skills) {
  for (const alias of aliases) {
    if (skillNames.has(alias) || aliasNames.has(alias)) {
      fail(`skills/manifest.json contains colliding skill alias "${alias}" (skill "${skillName}")`);
    }
    aliasNames.add(alias);
  }
}
// Link targets: one entry per skill plus one per alias, all pointing at the
// same source directory so aliases invoke identically to their canonical skill.
const targets = [];
for (const { skillName, skillPath, aliases } of skills) {
  targets.push({ name: skillName, source: skillPath });
  for (const alias of aliases) {
    targets.push({ name: alias, source: skillPath });
  }
}

if (globalInstall) {
  console.log(`[link-skills] GLOBAL install → ${targetDir}`);
  assertExistingDirectoryIsSafe(targetBase, 'global install directory');
} else {
  console.log(`[link-skills] LOCAL install → ${targetDir}`);
}

ensureSafeDirectory(targetDir, '.skills directory');

// Only remove manifest-managed entries. Do not delete arbitrary fab-* user skills.
for (const { name: skillName } of targets) {
  removeExistingManagedSkill(join(targetDir, skillName), skillName);
}

for (const { name: skillName, source: skillPath } of targets) {
  const linkDest = join(targetDir, skillName);
  try {
    assertWithinRoot(linkDest, targetDir);
  } catch (err) {
    fail(err.message);
  }

  try {
    if (isWindows) {
      // Junctions on Windows require an absolute source path and usually do not require elevation.
      symlinkSync(skillPath, linkDest, 'junction');
      console.log(`[link-skills] LINK   ${skillName} → .skills/ (junction)`);
    } else {
      // Unix/macOS: relative symlink keeps repo relocatable.
      const rel = relative(targetDir, skillPath);
      symlinkSync(rel, linkDest, 'dir');
      console.log(`[link-skills] LINK   ${skillName} → .skills/ (symlink)`);
    }
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'EACCES' || err.code === 'ENOTSUP') {
      warn(
        `Link blocked for ${skillName} (${err.code}); falling back to recursive copy. Rerun setup after source updates to refresh copied skills.`,
      );
      copySkill(skillPath, linkDest, skillName);
    } else {
      fail(`Cannot link ${skillName}: ${err.message}`);
    }
  }
}

console.log(`[link-skills] DONE — ${skills.length} skills installed at ${targetDir}`);
