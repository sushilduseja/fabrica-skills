#!/usr/bin/env node
/**
 * Fabrica Skills CLI
 * Usage:
 *   fabrica-skills install [--global] [--agent=agents,claude,cursor,codex,opencode]
 *   fabrica-skills update  [--global]
 *   fabrica-skills uninstall [--global] [--orphans]
 *   fabrica-skills status  [--global]
 *   fabrica-skills validate [path/to/fabrica.run.json]
 *   fabrica-skills --version | --help
 */
import { pathToFileURL } from 'url';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8'));

const args = process.argv.slice(2);
const cmd = args[0];

if (args.includes('--version') || args.includes('-v')) {
  console.log(pkg.version);
  process.exit(0);
}

if (!cmd || args.includes('--help') || args.includes('-h')) {
  console.log(`fabrica-skills ${pkg.version}

Usage:
  fabrica-skills install [--global] [--agent=list]
  fabrica-skills update [--global]
  fabrica-skills uninstall [--global] [--orphans]
  fabrica-skills status [--global]
  fabrica-skills validate [fabrica.run.json]
`);
  process.exit(cmd ? 0 : 1);
}

const { runCli } = await import(pathToFileURL(join(pkgRoot, 'scripts/install-cli.mjs')).href);
await runCli(cmd, args.slice(1), { pkgRoot, version: pkg.version });
