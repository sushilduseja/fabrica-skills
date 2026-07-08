#!/usr/bin/env node

import {
  cpSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from 'fs';
import { join, relative, resolve, sep } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');
const globalInstall = process.argv.includes('--global');
const homeRoot = homedir();
const targetBase = globalInstall ? join(homeRoot, '.fabrica-skills') : root;
const targetDir = globalInstall ? join(targetBase, '.skills') : resolve(root, '.skills');
const isWindows = process.platform === 'win32';
const SKILL_PATH_RE = /^skills\/(core|prototype)\/fab-[a-z0-9-]+$/;

function fail(msg) {
  console.error(`[link-skills] ERROR: ${msg}`);
  process.exit(1);
}

function warn(msg) {
  console.warn(`[link-skills] WARN: ${msg}`);
}

function toRepoRelative(absPath) {
  return relative(root, absPath).split(sep).join('/');
}

function lstatIfPresent(path) {
  try {
    return lstatSync(path);
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    fail(`Cannot inspect ${path}: ${err.message}`);
  }
}

function assertInsideRoot(label, absPath) {
  const rel = relative(root, absPath);
  if (rel === '..' || rel.startsWith(`..${sep}`) || resolve(absPath) === resolve(root, '..')) {
    fail(`${label} resolves outside repository root: ${absPath}`);
  }
}

function assertSafeSkillPath(skill) {
  if (!skill || typeof skill !== 'object' || Array.isArray(skill)) {
    fail('Manifest contains a non-object skill entry');
  }
  if (typeof skill.id !== 'string' || !/^fab-[a-z0-9-]+$/.test(skill.id)) {
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
  assertInsideRoot(`skill "${skill.id}" path`, skillPath);
  return skillPath;
}

function loadManifest() {
  const manifestPath = resolve(root, 'skills/manifest.json');
  let raw;
  try {
    raw = readFileSync(manifestPath, 'utf-8');
  } catch (err) {
    fail(`Cannot read skills/manifest.json: ${err.message}`);
  }

  try {
    const manifest = JSON.parse(raw);
    if (!Array.isArray(manifest.skills) || manifest.skills.length === 0) {
      fail('skills/manifest.json must contain a non-empty skills array');
    }
    return manifest;
  } catch (err) {
    fail(`Invalid JSON in skills/manifest.json: ${err.message}`);
  }
}

function assertExistingDirectoryIsSafe(path, label) {
  const stat = lstatIfPresent(path);
  if (!stat) return;
  if (stat.isSymbolicLink()) {
    fail(`${label} must not be a symlink or junction: ${path}`);
  }
  if (!stat.isDirectory()) {
    fail(`${label} exists but is not a directory: ${path}`);
  }
}

function ensureSafeDirectory(path, label) {
  assertExistingDirectoryIsSafe(path, label);
  try {
    mkdirSync(path, { recursive: true });
  } catch (err) {
    fail(`Cannot create ${label}: ${err.message}`);
  }
  assertExistingDirectoryIsSafe(path, label);
}

function preflightSkill(skill) {
  const skillPath = assertSafeSkillPath(skill);
  const skillName = skill.id;

  const stat = lstatIfPresent(skillPath);
  if (!stat) {
    fail(`Source directory not found for ${skillName}: ${toRepoRelative(skillPath)}`);
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    fail(`Source for ${skillName} must be a real directory, not a file, symlink, or junction`);
  }
  if (!lstatIfPresent(join(skillPath, 'SKILL.md'))) {
    fail(`SKILL.md missing for ${skillName}: ${toRepoRelative(join(skillPath, 'SKILL.md'))}`);
  }

  return { skillName, skillPath };
}

function removeExistingManagedSkill(linkDest, skillName) {
  const stat = lstatIfPresent(linkDest);
  if (!stat) return;
  try {
    rmSync(linkDest, { recursive: true, force: true });
    console.log(`[link-skills] CLEAN  ${skillName}`);
  } catch (err) {
    fail(`Cannot remove existing managed entry ${skillName}: ${err.message}`);
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

if (globalInstall) {
  console.log(`[link-skills] GLOBAL install → ${targetDir}`);
  assertExistingDirectoryIsSafe(targetBase, 'global install directory');
} else {
  console.log(`[link-skills] LOCAL install → ${targetDir}`);
}

ensureSafeDirectory(targetDir, '.skills directory');

// Only remove manifest-managed entries. Do not delete arbitrary fab-* user skills.
for (const { skillName } of skills) {
  removeExistingManagedSkill(join(targetDir, skillName), skillName);
}

for (const { skillName, skillPath } of skills) {
  const linkDest = join(targetDir, skillName);

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
    if (isWindows && err.code === 'EPERM') {
      warn(`Junction blocked for ${skillName}; falling back to recursive copy. Rerun setup after source updates to refresh copied skills.`);
      copySkill(skillPath, linkDest, skillName);
    } else {
      fail(`Cannot link ${skillName}: ${err.message}`);
    }
  }
}

console.log(`[link-skills] DONE — ${skills.length} skills installed at ${targetDir}`);
