#!/usr/bin/env node
/**
 * e2e/setup.mjs — Build the plugin and install it into the isolated test vault.
 *
 * Part of the E2E test environment (specs/002-e2e-test-env, US-01 / FR-005).
 *
 * What it does:
 *   1. Runs `npm run build` (tsc type check + esbuild production bundle).
 *   2. Copies main.js, manifest.json and styles.css from the repository root
 *      into test-vault/.obsidian/plugins/obsidian-usm-plugin/ (creating
 *      directories as needed).
 *   3. Verifies that the SHA-256 of each copied file matches the source file
 *      (aborts with a non-zero exit code on mismatch).
 *   4. Prints a summary (files copied, sizes, manifest version).
 *
 * Per contracts/test-vault-structure.md:
 *   - manifest.json and styles.css are committed source files, refreshed here.
 *   - main.js is a gitignored build artifact, regenerated here.
 *
 * Requires Node 22+ (plain Node ESM, built-ins only — no NPM dependencies).
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN_ID = 'obsidian-usm-plugin';
const DEST_DIR = join(REPO_ROOT, 'test-vault', '.obsidian', 'plugins', PLUGIN_ID);

/** Files copied from the repository root into the test vault plugin folder. */
const ARTIFACTS = ['main.js', 'manifest.json', 'styles.css'];

function fail(message) {
	console.error(`✖ ${message}`);
	process.exit(1);
}

/** SHA-256 hex digest of a file's on-disk content. */
function sha256(filePath) {
	return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

// Step 1: build the plugin (tsc + esbuild).
console.log('→ Building plugin (npm run build)…');
const build = spawnSync('npm', ['run', 'build'], { cwd: REPO_ROOT, stdio: 'inherit' });
if (build.status !== 0) {
	fail(`npm run build exited with code ${build.status ?? 'unknown'} — aborting setup.`);
}

// Step 2: copy artifacts into the test vault (creating directories as needed).
mkdirSync(DEST_DIR, { recursive: true });

const copied = [];
for (const name of ARTIFACTS) {
	const source = join(REPO_ROOT, name);
	if (!existsSync(source)) {
		fail(`Source file missing: ${source} — the build did not produce it.`);
	}
	const destination = join(DEST_DIR, name);
	cpSync(source, destination);

	// Step 3: verify the copy byte-for-byte via SHA-256 (both files read from disk).
	const sourceHash = sha256(source);
	const destHash = sha256(destination);
	if (sourceHash !== destHash) {
		fail(`SHA-256 mismatch for ${name} (source ${sourceHash} ≠ destination ${destHash}).`);
	}
	copied.push({ name, size: statSync(destination).size, hash: destHash });
}

// Step 4: summary.
const manifest = JSON.parse(readFileSync(join(DEST_DIR, 'manifest.json'), 'utf8'));
console.log(`✔ Plugin installed into the test vault (version ${manifest.version}):`);
for (const { name, size, hash } of copied) {
	console.log(`  ${name.padEnd(14)} ${String(size).padStart(8)} B  sha256:${hash.slice(0, 12)}…`);
}
console.log(`  destination: ${DEST_DIR}`);
