/**
 * First-party installer for fabrica-skills (consumer path).
 *
 * Projects the packaged Skill catalog into standard agent skill directories
 * (project or global scope) using copy mode. Every managed skill directory
 * carries a `.fabrica-managed.json` marker; update/uninstall only touch
 * marked directories and never foreign skills.
 *
 * The source-repo contributor workflow (`npm run setup` + `.skills/`) is
 * unchanged and stays in scripts/link-skills.mjs.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { dirname, isAbsolute, join, relative, sep } from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';
import { spawnSync } from 'child_process';
import { SKILL_ID_RE, SKILL_PATH_RE, assertWithinRoot, lstatIfPresent, readJsonFile } from './_path-utils.mjs';
import { resolveGateLevel } from './_skill-gates.mjs';

export const HARNESS = {
  agents: {
    project: (cwd) => join(cwd, '.agents', 'skills'),
    global: () => join(homedir(), '.agents', 'skills'),
  },
  claude: {
    project: (cwd) => join(cwd, '.claude', 'skills'),
    global: () => join(homedir(), '.claude', 'skills'),
  },
  cursor: {
    project: (cwd) => join(cwd, '.cursor', 'skills'),
    global: () => join(homedir(), '.cursor', 'skills'),
  },
  codex: {
    project: (cwd) => join(cwd, '.codex', 'skills'),
    global: () => join(homedir(), '.codex', 'skills'),
  },
  opencode: {
    project: (cwd) => join(cwd, '.opencode', 'skills'),
    global: () => join(homedir(), '.config', 'opencode', 'skills'),
  },
};

export const DEFAULT_AGENTS = ['agents', 'claude', 'cursor', 'codex', 'opencode'];

const MANAGED_FILENAME = '.fabrica-managed.json';

/**
 * Log a CLI error and exit nonzero (no stack traces).
 * @param {string} msg
 */
function fail(msg) {
  console.error(`[fabrica-skills] ERROR: ${msg}`);
  process.exit(1);
}

/**
 * Log a CLI warning and continue.
 * @param {string} msg
 */
function warn(msg) {
  console.error(`[fabrica-skills] WARN: ${msg}`);
}

function parseFlags(argv) {
  const flags = {
    global: false,
    orphans: false,
    agents: null, // null = default full set
    migrateRun: null,
    name: null,
    out: null,
    force: false,
    auto: false,
    positional: [],
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--global' || a === '-g') flags.global = true;
    else if (a === '--orphans') flags.orphans = true;
    else if (a === '--force') flags.force = true;
    else if (a === '--auto') flags.auto = true;
    else if (a === '--name') {
      const value = argv[i + 1];
      if (!value || value.startsWith('-')) {
        throw new Error('--name requires a slug value');
      }
      flags.name = value;
      i += 1;
    } else if (a === '--out') {
      const value = argv[i + 1];
      if (!value || value.startsWith('-')) {
        throw new Error('--out requires a run-object path');
      }
      flags.out = value;
      i += 1;
    } else if (a === '--migrate-run') {
      const value = argv[i + 1];
      if (!value || value.startsWith('-')) {
        throw new Error('--migrate-run requires a run-object path');
      }
      flags.migrateRun = value;
      i += 1;
    } else if (a.startsWith('--agent=')) {
      flags.agents = a
        .slice('--agent='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (a.startsWith('-')) {
      throw new Error(`Unknown flag: ${a}`);
    } else {
      flags.positional.push(a);
    }
  }
  return flags;
}

// Project install: use package skills/ as source (pkgRoot/skills)
// Global install: copy skills tree to ~/.fabrica-skills/catalog/<version>/ then link from there
function catalogRoot({ global, pkgRoot, version }) {
  if (!global) return join(pkgRoot, 'skills');
  return join(homedir(), '.fabrica-skills', 'catalog', version, 'skills');
}

function loadManifest(pkgRoot) {
  const manifestPath = join(pkgRoot, 'skills/manifest.json');
  const manifest = readJsonFile(manifestPath, 'skills/manifest.json', '[fabrica-skills]');
  if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.skills) || manifest.skills.length === 0) {
    fail('skills/manifest.json must contain a non-empty skills array');
  }
  return manifest;
}

function writeMarker(skillDir, { skillId, version, scope }) {
  writeFileSync(
    join(skillDir, MANAGED_FILENAME),
    JSON.stringify(
      {
        managed_by: 'fabrica-skills',
        skill_id: skillId,
        package_version: version,
        install_scope: scope,
        installed_at: new Date().toISOString(),
      },
      null,
      2,
    ) + '\n',
  );
}

function readMarker(skillDir) {
  const p = join(skillDir, MANAGED_FILENAME);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Resolve requested agent keys to harness roots for a scope.
 */
function resolveHarnessRoots({ agents, global, cwd }) {
  const keys = agents || DEFAULT_AGENTS;
  const scope = global ? 'global' : 'project';
  return keys.map((key) => {
    if (!HARNESS[key]) {
      fail(`Unknown agent: ${key} (expected one of: ${Object.keys(HARNESS).join(', ')})`);
    }
    return { key, root: HARNESS[key][scope](cwd) };
  });
}

/**
 * Copy the packaged skills tree into the versioned global catalog and record CURRENT.
 */
function ensureGlobalCatalog(pkgRoot, version) {
  const dest = join(homedir(), '.fabrica-skills', 'catalog', version);
  try {
    assertWithinRoot(dest, homedir());
  } catch (err) {
    fail(err.message);
  }
  try {
    rmSync(dest, { recursive: true, force: true });
    mkdirSync(dest, { recursive: true });
    cpSync(join(pkgRoot, 'skills'), join(dest, 'skills'), { recursive: true });
    cpSync(join(pkgRoot, 'schemas'), join(dest, 'schemas'), { recursive: true });
    writeFileSync(join(dest, 'CURRENT'), `${version}\n`, 'utf8');
  } catch (err) {
    fail(`Cannot stage global catalog at ${dest}: ${err.message}`);
  }
  return dest;
}

function installSkillProjection({ sourceSkillDir, destSkillDir, harnessRoot, skillId, version, scope }) {
  if (!SKILL_ID_RE.test(skillId || '')) {
    fail(`Refusing to install skill with invalid id: ${skillId}`);
  }
  const rel = relative(harnessRoot, destSkillDir);
  if (rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    fail(`Refusing to install outside harness root ${harnessRoot}: ${destSkillDir}`);
  }
  const parentStat = lstatIfPresent(harnessRoot);
  if (parentStat && parentStat.isSymbolicLink()) {
    fail(`Harness root must not be a symlink or junction: ${harnessRoot}`);
  }
  if (existsSync(destSkillDir)) {
    const marker = readMarker(destSkillDir);
    if (marker && marker.managed_by === 'fabrica-skills') {
      rmSync(destSkillDir, { recursive: true, force: true });
    } else {
      warn(`Skipping ${destSkillDir}: exists without a fabrica-skills marker; left untouched`);
      return 'skipped';
    }
  }
  if (!existsSync(sourceSkillDir)) {
    fail(`Source directory not found: ${sourceSkillDir}`);
  }
  try {
    mkdirSync(harnessRoot, { recursive: true });
    cpSync(sourceSkillDir, destSkillDir, { recursive: true });
    writeMarker(destSkillDir, { skillId, version, scope });
  } catch (err) {
    fail(`Cannot install ${skillId} into ${destSkillDir}: ${err.message}`);
  }
  return 'installed';
}

function projectAllSkills({ manifest, catalog, roots, version, scope }) {
  let skipped = 0;
  for (const skill of manifest.skills) {
    if (
      !skill ||
      typeof skill !== 'object' ||
      typeof skill.path !== 'string' ||
      skill.path.includes('\\') ||
      skill.path.startsWith('/') ||
      skill.path.split('/').includes('..') ||
      !SKILL_PATH_RE.test(skill.path)
    ) {
      fail(`Refusing to install skill with unsafe path: ${skill && skill.id}`);
    }
    const relSkillPath = skill.path.replace(/^skills\//, '');
    const sourceSkillDir = join(catalog, relSkillPath);
    for (const { root } of roots) {
      const outcome = installSkillProjection({
        sourceSkillDir,
        destSkillDir: join(root, skill.id),
        harnessRoot: root,
        skillId: skill.id,
        version,
        scope,
      });
      if (outcome === 'skipped') skipped += 1;
      for (const alias of Array.isArray(skill.aliases) ? skill.aliases : []) {
        const aliasOutcome = installSkillProjection({
          sourceSkillDir,
          destSkillDir: join(root, alias),
          harnessRoot: root,
          skillId: skill.id,
          version,
          scope,
        });
        if (aliasOutcome === 'skipped') skipped += 1;
      }
    }
  }
  return skipped;
}

function cmdInstallOrUpdate({ pkgRoot, version, cwd, flags, verb }) {
  const scope = flags.global ? 'global' : 'project';
  if (flags.global) ensureGlobalCatalog(pkgRoot, version);
  const catalog = catalogRoot({ global: flags.global, pkgRoot, version });
  const manifest = loadManifest(pkgRoot);
  const roots = resolveHarnessRoots({ agents: flags.agents, global: flags.global, cwd });
  projectAllSkills({ manifest, catalog, roots, version, scope });
  console.log(`[fabrica-skills] ${verb} ${manifest.skills.length} skills × ${roots.length} harness roots (${scope})`);
}

function cmdUninstall({ pkgRoot, cwd, flags }) {
  const scope = flags.global ? 'global' : 'project';
  const manifestIds = new Set(loadManifest(pkgRoot).skills.map((s) => s.id));
  const roots = resolveHarnessRoots({ agents: flags.agents, global: flags.global, cwd });
  let removed = 0;
  for (const { root } of roots) {
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root)) {
      const child = join(root, entry);
      const marker = readMarker(child);
      if (!marker || marker.managed_by !== 'fabrica-skills') continue;
      if (!manifestIds.has(marker.skill_id) && !flags.orphans) continue;
      rmSync(child, { recursive: true, force: true });
      removed += 1;
    }
  }
  console.log(`[fabrica-skills] uninstalled ${removed} skills (${scope})`);
}

function cmdStatus({ pkgRoot, version, cwd, flags }) {
  const scope = flags.global ? 'global' : 'project';
  const manifestIds = loadManifest(pkgRoot).skills.map((s) => s.id);
  const roots = resolveHarnessRoots({ agents: null, global: flags.global, cwd });
  console.log('fabrica-skills status');
  console.log(`scope: ${scope}`);
  console.log(`package: ${version}`);
  console.log('harness:');
  for (const { key, root } of roots) {
    let present = 0;
    if (existsSync(root)) {
      for (const id of manifestIds) {
        const marker = readMarker(join(root, id));
        if (marker && marker.managed_by === 'fabrica-skills') present += 1;
      }
    }
    console.log(`  ${key}  ${present}/${manifestIds.length}  ${present === 0 ? '(not installed)' : root}`);
  }
  const runPath = join(cwd, 'fabrica.run.json');
  if (existsSync(runPath)) {
    try {
      const run = JSON.parse(readFileSync(runPath, 'utf8'));
      const next = typeof run.next_action === 'string' ? run.next_action : '(none)';
      const nextId = typeof run.next_action === 'string' ? run.next_action.slice(1).split(' ')[0] : null;
      const gate = nextId && run.gate_levels ? run.gate_levels[nextId] : undefined;
      const hint =
        gate === 'auto'
          ? ' (proceed without approval)'
          : gate === 'checkpoint' || gate === 'review' || gate === 'full'
            ? ' (approval required)'
            : '';
      console.log('run:');
      console.log(`  name   ${run.name}`);
      console.log(`  state  ${run.status} / ${run.current_step} -> ${next}`);
      console.log(`  gate   ${nextId}: ${gate}${hint}`);
    } catch {
      console.log('run: (fabrica.run.json present but unparseable)');
    }
  }
}

function readRunObjectNamePattern(pkgRoot) {
  const schemaPath = join(pkgRoot, 'schemas/run-object.schema.json');
  const schema = readJsonFile(schemaPath, 'schemas/run-object.schema.json', '[fabrica-skills]');
  const pattern = schema?.properties?.name?.pattern;
  if (typeof pattern !== 'string') {
    fail('Cannot determine run-object name pattern from schemas/run-object.schema.json');
  }
  return new RegExp(pattern);
}

function cmdInitRun({ pkgRoot, cwd, flags }) {
  const name = flags.name || 'app';
  if (!readRunObjectNamePattern(pkgRoot).test(name)) {
    fail(`Invalid --name "${name}": must be a lowercase slug (letters, digits, ., _, -)`);
  }
  const outPath = isAbsolute(flags.out || '') ? flags.out : join(cwd, flags.out || 'fabrica.run.json');
  if (existsSync(outPath) && !flags.force) {
    fail(`Refusing to overwrite existing ${outPath} (use --force to overwrite)`);
  }
  const manifest = loadManifest(pkgRoot);
  const now = new Date().toISOString();
  const gate_levels = {};
  for (const skill of manifest.skills) {
    gate_levels[skill.id] = resolveGateLevel(skill.id, skill, flags.auto);
  }
  const runObject = {
    schema_version: '0.2',
    id: randomUUID(),
    name,
    experiment_phase: 'phase_0_spec',
    created_at: now,
    updated_at: now,
    status: 'designing',
    current_step: 'fab-spec',
    current_app_stage: null,
    next_action: '/fab-spec',
    last_error: null,
    spec_path: null,
    blueprint_path: null,
    app_stages: [],
    costs: {
      precision: 'unknown',
      tokens_in: 'unknown',
      tokens_out: 'unknown',
      api_calls: 'unknown',
      estimated_usd: 'unknown',
      budget_usd: null,
      by_step: {},
    },
    verifications: [],
    human_decisions: [],
    gate_levels,
    preferred_stack: { frontend: null, backend: null, database: null },
  };
  // NOTE: outPath is deliberately NOT root-guarded — it is an explicit
  // operator choice (--out), not a derived install target. Guarding it
  // against anything but CWD would break the documented feature.
  try {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(runObject, null, 2)}\n`, 'utf8');
  } catch (err) {
    fail(`Cannot write ${outPath}: ${err.message}`);
  }
  console.log(`[fabrica-skills] wrote ${outPath}`);
  if (flags.auto) {
    console.log(
      'next: /fab-spec proceeds without approval through plan and integrate; /fab-verify and /fab-decide still stop for you',
    );
  } else {
    console.log('next: open this file after /fab-spec');
  }
}

function cmdValidate({ pkgRoot, flags }) {
  if (flags.migrateRun) {
    const result = spawnSync(
      process.execPath,
      [join(pkgRoot, 'scripts', 'migrate-run-skill-ids.mjs'), flags.migrateRun],
      { stdio: 'inherit' },
    );
    process.exit(result.status === null ? 1 : result.status);
  }
  const target = flags.positional[0];
  if (!target) {
    fail('validate requires a run-object path (e.g. fabrica-skills validate fabrica.run.json)');
  }
  const result = spawnSync(process.execPath, [join(pkgRoot, 'scripts', 'validate-run.mjs'), target], {
    stdio: 'inherit',
  });
  process.exit(result.status === null ? 1 : result.status);
}

/**
 * Run the fabrica-skills CLI command.
 * @param {string} cmd install | update | uninstall | status | validate | init-run
 * @param {string[]} argv Flags and positionals after the command.
 * @param {{pkgRoot: string, version: string}} ctx Package context.
 */
export async function runCli(cmd, argv, ctx) {
  const { pkgRoot, version } = ctx;
  let flags;
  try {
    flags = parseFlags(argv);
  } catch (err) {
    fail(err.message);
  }
  const cwd = process.cwd();
  switch (cmd) {
    case 'install':
      cmdInstallOrUpdate({ pkgRoot, version, cwd, flags, verb: 'installed' });
      break;
    case 'update':
      cmdInstallOrUpdate({ pkgRoot, version, cwd, flags, verb: 'updated' });
      break;
    case 'uninstall':
      cmdUninstall({ pkgRoot, cwd, flags });
      break;
    case 'status':
      cmdStatus({ pkgRoot, version, cwd, flags });
      break;
    case 'validate':
      cmdValidate({ pkgRoot, flags });
      break;
    case 'init-run':
      cmdInitRun({ pkgRoot, cwd, flags });
      break;
    default:
      fail(`Unknown command: ${cmd} (expected install, update, uninstall, status, validate, or init-run)`);
      break;
  }
}
