#!/usr/bin/env node

import { mkdirSync, readdirSync, existsSync, symlinkSync, copyFileSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, '..');
const targetDir = join(root, '.skills');

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

try {
  mkdirSync(targetDir, { recursive: true });
} catch {
  // directory exists
}

for (const dir of SKILL_DIRS) {
  const skillPath = join(root, dir);
  if (!existsSync(skillPath)) {
    console.warn(`[link-skills] SKIP ${dir} — not found`);
    continue;
  }
  const skillName = dir.split('/').pop();
  const linkPath = join(targetDir, skillName);
  try {
    const rel = relative(targetDir, skillPath).replace(/\\/g, '/');
    if (process.platform === 'win32') {
      copyFileSync(join(skillPath, 'SKILL.md'), join(targetDir, `${skillName}.md`));
    } else {
      symlinkSync(rel, linkPath, 'junction');
    }
    console.log(`[link-skills] LINK ${skillName} → .skills/`);
  } catch (err) {
    console.error(`[link-skills] FAIL ${skillName}: ${err.message}`);
  }
}
