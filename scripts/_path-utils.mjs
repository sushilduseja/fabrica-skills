/**
 * Shared path-safety utilities for fabrica-skills scripts.
 *
 * All functions in this module terminate the process on validation failure
 * (via errorExit). They are not try-catch wrappers — callers that need
 * recovery should copy the logic rather than catch the exit.
 */
import { existsSync, lstatSync, readFileSync } from 'fs';
import { relative, resolve, sep } from 'path';

/**
 * Convert an absolute path to a repo-root-relative path with forward slashes.
 * @param {string} root Absolute path to the repository root.
 * @param {string} absPath Absolute path to convert.
 * @returns {string} Forward-slash-delimited path relative to root.
 */
export function toRepoRelative(root, absPath) {
  return relative(root, absPath).split(sep).join('/');
}

/**
 * Assert that an absolute path does not escape the repository root.
 * Terminates the process if it does.
 * @param {string} root Absolute path to the repository root.
 * @param {string} label Human-readable label for error messages.
 * @param {string} absPath Path to check.
 */
export function assertInsideRoot(root, label, absPath) {
  const rel = relative(root, absPath);
  if (rel === '..' || rel.startsWith(`..${sep}`) || resolve(absPath) === resolve(root, '..')) {
    errorExit(`${label} resolves outside repository root: ${absPath}`);
  }
}

/**
 * Assert that a repo-relative path is safe (no traversal, no absolute, forward slashes).
 * Optionally validate layout via a regex pattern. Terminates on failure.
 * @param {string} root Absolute path to the repository root.
 * @param {string} label Human-readable label for error messages.
 * @param {string} relPath The repo-relative path to validate.
 * @param {RegExp} [pattern] Optional regex that relPath must match.
 * @returns {string} Resolved absolute path.
 */
export function assertSafeRelPath(root, label, relPath, pattern) {
  if (typeof relPath !== 'string' || relPath.trim() === '') {
    errorExit(`${label} must be a non-empty repository-relative path`);
  }
  if (relPath.includes('\\')) {
    errorExit(`${label} must use forward slashes, not backslashes: ${relPath}`);
  }
  if (relPath.startsWith('/') || /^[A-Za-z]:\//.test(relPath)) {
    errorExit(`${label} must not be absolute: ${relPath}`);
  }
  if (relPath.split('/').includes('..')) {
    errorExit(`${label} must not contain path traversal (..): ${relPath}`);
  }
  if (pattern && !pattern.test(relPath)) {
    errorExit(`${label} has invalid layout: ${relPath}`);
  }

  const absPath = resolve(root, relPath);
  assertInsideRoot(root, label, absPath);
  return absPath;
}

/**
 * lstat a path, returning null on ENOENT and throwing on other errors.
 * @param {string} path
 * @returns {import('fs').Stats | null}
 */
export function lstatIfPresent(path) {
  try {
    return lstatSync(path);
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    throw err;
  }
}

/**
 * Assert that path is an existing directory that is not a symlink or junction.
 * @param {string} label Human-readable label for error messages.
 * @param {string} absPath Absolute path to check.
 */
export function assertDirectoryNotSymlink(label, absPath) {
  const stat = lstatIfPresent(absPath);
  if (!stat) {
    errorExit(`${label} not found: ${absPath}`);
  }
  if (stat.isSymbolicLink()) {
    errorExit(`${label} must not be a symlink or junction: ${absPath}`);
  }
  if (!stat.isDirectory()) {
    errorExit(`${label} is not a directory: ${absPath}`);
  }
}

/**
 * Read and parse a JSON file. Terminates on failure.
 * @param {string} path Absolute path to the file.
 * @param {string} label Human-readable label for error messages.
 * @returns {any}
 */
export function readJsonFile(path, label) {
  let raw;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch (err) {
    errorExit(`Cannot read ${label}: ${err.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    errorExit(`Invalid JSON in ${label}: ${err.message}`);
  }
}

/**
 * Log an error and exit the process.
 * @param {string} msg
 */
export function errorExit(msg) {
  console.error(`[gstack] ERROR: ${msg}`);
  process.exit(1);
}

/**
 * Pretty-print an object as JSON with trailing newline.
 * @param {any} data
 * @returns {string}
 */
export function stringifyJson(data) {
  return JSON.stringify(data, null, 2) + '\n';
}
