#!/usr/bin/env node

import {
  mkdirSync, readdirSync, existsSync,
  symlinkSync, cpSync, rmSync,
} from 'fs';
import { join, resolve, relative } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');
const global = process.argv.includes('--global');
const targetDir = global
  ? join(homedir(), '.fabrica-skills', '.skills')
  : resolve(root, '.skills');

if (global) {
  console.log(`[link-skills] GLOBAL install → ${targetDir}`);
} else {
  console.log(`[link-skills] LOCAL install → ${targetDir}`);
}
const isWindows = process.platform === 'win32';

const SKILL_DIRS = [
  'skills/core/fab-intake',
  'skills/core/fab-blueprint',
  'skills/core/fab-frame',
  'skills/core/fab-forge',
  'skills/core/fab-check',
  'skills/core/fab-pulse',
  'skills/core/fab-passport',
  'skills/prototype/fab-trace',
  'skills/prototype/fab-weave',
  'skills/prototype/fab-launch',
  'skills/prototype/fab-ledger',
  'skills/prototype/fab-signal',
  'skills/prototype/fab-retro',
];

const FAB_NAMES = new Set(SKILL_DIRS.map(d => d.split('/').pop()));

// Ensure .skills/ exists — do NOT wipe it
mkdirSync(targetDir, { recursive: true });

// Remove only fab-* entries — unrelated skills are untouched
if (existsSync(targetDir)) {
  for (const entry of readdirSync(targetDir)) {
    if (FAB_NAMES.has(entry) || entry.startsWith('fab-')) {
      rmSync(join(targetDir, entry), { recursive: true, force: true });
      console.log(`[link-skills] CLEAN  ${entry}`);
    }
  }
}

// Link each skill into .skills/
for (const dir of SKILL_DIRS) {
  const skillPath = resolve(root, dir);
  const skillName = dir.split('/').pop();
  const linkDest = join(targetDir, skillName);

  if (!existsSync(skillPath)) {
    console.warn(`[link-skills] SKIP   ${skillName} — source directory not found`);
    continue;
  }

  if (!existsSync(join(skillPath, 'SKILL.md'))) {
    console.warn(`[link-skills] SKIP   ${skillName} — SKILL.md missing`);
    continue;
  }

  try {
    if (isWindows) {
      // Junctions on Windows: require absolute path, no elevated privileges needed
      symlinkSync(skillPath, linkDest, 'junction');
      console.log(`[link-skills] LINK   ${skillName} → .skills/ (junction)`);
    } else {
      // Unix/macOS: relative symlink keeps repo relocatable
      const rel = relative(targetDir, skillPath);
      symlinkSync(rel, linkDest, 'dir');
      console.log(`[link-skills] LINK   ${skillName} → .skills/ (symlink)`);
    }
  } catch (err) {
    if (isWindows && err.code === 'EPERM') {
      // Junction blocked (rare) — fall back to full recursive copy
      // Requires Node >= 16.7.0
      cpSync(skillPath, linkDest, { recursive: true });
      console.log(`[link-skills] COPY   ${skillName} → .skills/ (junction fallback)`);
    } else {
      console.error(`[link-skills] FAIL   ${skillName}: ${err.message}`);
    }
  }
}