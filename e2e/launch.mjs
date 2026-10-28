#!/usr/bin/env node
/**
 * e2e/launch.mjs — Open Obsidian on the isolated test vault with a CDP
 * remote-debugging port.
 *
 * Part of the E2E test environment (specs/002-e2e-test-env, US-002-02 / FR-002-006…FR-002-009).
 *
 * What it does (per contracts/launch-cli.md):
 *   1. Parses `--port <number>` (default 9222).
 *   2. Pre-flight build check: the test vault's `main.js` must exist and its
 *      `manifest.json` version must equal the repository `manifest.json`
 *      version. On failure, prints `run npm run e2e:setup` and exits non-zero
 *      (FR-002-015, SC-002-008).
 *   3. Idempotency probe: `fetch http://127.0.0.1:<port>/json/version` with a
 *      short timeout. If it responds, prints "Instance already available on
 *      port <port>" and exits 0 without launching (FR-002-007, SC-002-007).
 *   4. Launches Obsidian on the test vault:
 *        open -a Obsidian --args --remote-debugging-port=<port> <absolute test-vault path>
 *      The vault path is passed explicitly so the instance always targets the
 *      test vault, never a private vault (spec edge case).
 *   5. Bounded readiness poll of `/json/version` (<= 30 s, SC-002-003).
 *   6. Port-conflict detection: if the port is bound but does not serve a CDP
 *      endpoint after launch, prints an actionable error suggesting
 *      `--port <alternate>` and exits non-zero (spec edge case).
 *
 * Requires Node 22+ (plain Node ESM, built-ins only — no NPM dependencies).
 * macOS only (uses `open -a`).
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import net from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listTargets } from './cdp.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN_ID = 'obsidian-usm-plugin';
const TEST_VAULT = join(REPO_ROOT, 'test-vault');
const PLUGIN_DIR = join(TEST_VAULT, '.obsidian', 'plugins', PLUGIN_ID);

const DEFAULT_PORT = 9222;
const READINESS_TIMEOUT_MS = 30_000; // SC-002-003 bounded wait
const READINESS_POLL_MS = 500;
const PROBE_TIMEOUT_MS = 2_000;

function fail(message, code = 1) {
	console.error(`✖ ${message}`);
	process.exit(code);
}

/** Parse `--port <number>` from the argument list (default 9222). */
function parsePort(argv) {
	let port = DEFAULT_PORT;
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === '--port') {
			const raw = argv[i + 1];
			const value = Number(raw);
			if (!Number.isInteger(value) || value < 1 || value > 65535) {
				fail(`Invalid --port value: ${raw ?? '(missing)'}. Expected an integer 1–65535.`);
			}
			port = value;
		}
	}
	return port;
}

/**
 * GET a CDP endpoint with a timeout. Returns the parsed JSON body when the
 * endpoint responds with valid JSON, otherwise null (connection refused,
 * timeout, non-2xx, or non-JSON body).
 */
async function probeCdp(port, path = '/json/version') {
	const url = `http://127.0.0.1:${port}${path}`;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
	try {
		const res = await fetch(url, { signal: controller.signal });
		if (!res.ok) {
			return null;
		}
		return await res.json();
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}

/** True when the response identifies a Chromium/Electron CDP endpoint. */
function isCdpInfo(info) {
	return Boolean(info && (info.Browser || info.webSocketDebuggerUrl));
}

/** True when something is listening on 127.0.0.1:<port> (any protocol). */
function isPortBound(port) {
	return new Promise((resolveBound) => {
		const socket = net.connect({ port, host: '127.0.0.1' });
		const done = (result) => {
			socket.destroy();
			resolveBound(result);
		};
		socket.once('connect', () => done(true));
		socket.once('error', () => done(false));
		setTimeout(() => done(false), PROBE_TIMEOUT_MS);
	});
}

/** Pre-flight: the test vault's plugin build must exist and be current. */
function checkBuild() {
	const mainJs = join(PLUGIN_DIR, 'main.js');
	const vaultManifest = join(PLUGIN_DIR, 'manifest.json');
	const repoManifest = join(REPO_ROOT, 'manifest.json');
	if (!existsSync(mainJs)) {
		fail(`Plugin build missing in the test vault: ${mainJs}\n  run npm run e2e:setup`);
	}
	if (!existsSync(vaultManifest) || !existsSync(repoManifest)) {
		fail('manifest.json missing (test vault or repository) — run npm run e2e:setup');
	}
	const vaultVersion = JSON.parse(readFileSync(vaultManifest, 'utf8')).version;
	const repoVersion = JSON.parse(readFileSync(repoManifest, 'utf8')).version;
	if (vaultVersion !== repoVersion) {
		fail(
			`Plugin build outdated: test vault ${vaultVersion} ≠ repository ${repoVersion}\n` +
				'  run npm run e2e:setup',
		);
	}
	return vaultVersion;
}

/** Bounded readiness poll of /json/version after launch. */
async function waitForReady(port) {
	const deadline = Date.now() + READINESS_TIMEOUT_MS;
	while (Date.now() < deadline) {
		const info = await probeCdp(port);
		if (isCdpInfo(info)) {
			return info;
		}
		await new Promise((r) => setTimeout(r, READINESS_POLL_MS));
	}
	return null;
}

/**
 * Bounded poll for a CDP page target to appear (windowless recovery, T002-016).
 * Returns true when at least one page target is listed, else false.
 */
async function waitForPageTarget(port) {
	const deadline = Date.now() + READINESS_TIMEOUT_MS;
	while (Date.now() < deadline) {
		const targets = await listTargets(port);
		if (targets.length > 0) {
			return true;
		}
		await new Promise((r) => setTimeout(r, READINESS_POLL_MS));
	}
	return false;
}

const port = parsePort(process.argv.slice(2));

// Step 1: pre-flight build check (FR-002-015, SC-002-008).
const version = checkBuild();
console.log(`✔ Plugin build current in the test vault (version ${version}).`);

// Step 2: idempotency probe (FR-002-007, SC-002-007).
const existing = await probeCdp(port);
if (isCdpInfo(existing)) {
	const targets = await listTargets(port);
	if (targets.length > 0) {
		console.log(`Instance already available on port ${port}`);
		process.exit(0);
	}
	// Alive but windowless (T002-016): the app is running in the background with
	// no window, so there are no page targets to attach to. Open the test
	// vault window, then wait for a page target to appear instead of exiting 0.
	console.log(`→ Instance alive on port ${port} but no window — opening the test vault…`);
	const open = spawnSync('open', ['-a', 'Obsidian', TEST_VAULT], { stdio: 'inherit' });
	if (open.status !== 0) {
		fail(`open exited with code ${open.status ?? 'unknown'} — could not open the test vault window.`);
	}
	const targetReady = await waitForPageTarget(port);
	if (targetReady) {
		console.log(`✔ Test vault window available on port ${port}.`);
		console.log(`  http://127.0.0.1:${port}/json/version`);
		process.exit(0);
	}
	fail(
		`Opened the test vault but no CDP page target appeared on port ${port} ` +
			`within ${READINESS_TIMEOUT_MS / 1000} s.`,
	);
}

// Step 3: launch Obsidian on the test vault (FR-002-006).
console.log(`→ Launching Obsidian on the test vault (port ${port})…`);
console.log(`  vault: ${TEST_VAULT}`);
const launch = spawnSync(
	'open',
	['-a', 'Obsidian', '--args', `--remote-debugging-port=${port}`, TEST_VAULT],
	{ stdio: 'inherit' },
);
if (launch.status !== 0) {
	fail(`open exited with code ${launch.status ?? 'unknown'} — could not launch Obsidian.`);
}

// Step 4: bounded readiness poll (SC-002-003).
console.log(`→ Waiting for the CDP endpoint (up to ${READINESS_TIMEOUT_MS / 1000} s)…`);
const ready = await waitForReady(port);
if (ready) {
	console.log(`✔ CDP ready on port ${port} (${ready.Browser ?? 'unknown'}).`);
	console.log(`  http://127.0.0.1:${port}/json/version`);
	process.exit(0);
}

// Step 5: diagnose the failure (port conflict vs. launch no-op).
const bound = await isPortBound(port);
if (bound) {
	fail(
		`Port ${port} is bound but does not serve a CDP endpoint.\n` +
			`  Another process owns it — try: npm run e2e:launch -- --port <alternate>`,
	);
}
fail(
	`Obsidian did not open a CDP endpoint on port ${port} within ${READINESS_TIMEOUT_MS / 1000} s.\n` +
		'  If Obsidian was already running (e.g. on a private vault), macOS `open` only\n' +
		'  focuses the existing instance and ignores --args. Quit Obsidian and re-run,\n' +
		'  or use --port <alternate>.',
);
