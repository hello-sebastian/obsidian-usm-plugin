#!/usr/bin/env node
/**
 * e2e/verify.mjs — Automated visual & DOM verification over CDP.
 *
 * Part of the E2E test environment (specs/002-e2e-test-env, US-03 /
 * FR-010…FR-014, FR-016). Connects to a running, debuggable Obsidian
 * instance (launched by `e2e:launch`), opens the board in map view, runs the
 * standard checks, and emits a machine-readable JSON report
 * (contracts/verification-report.md).
 *
 * Uses ONLY Node built-ins (Node 22+) — no NPM dependencies (research.md R4).
 * The CDP transport is the minimal client in `./cdp.mjs`.
 *
 * Invocation:
 *   npm run e2e:verify                 # default port 9222
 *   npm run e2e:verify -- --port 9333  # alternate port
 *
 * Exit codes (contracts/verification-report.md):
 *   0 — status "pass" (every check passed)
 *   1 — status "fail" (one or more checks failed)
 *   2 — environment error before checks ran (CDP unreachable, build
 *       missing/outdated)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { probe, connect } from './cdp.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN_ID = 'obsidian-usm-plugin';
const TEST_VAULT = join(REPO_ROOT, 'test-vault');
const PLUGIN_DIR = join(TEST_VAULT, '.obsidian', 'plugins', PLUGIN_ID);

const DEFAULT_PORT = 9222;
const BOARD_WAIT_MS = 15_000; // bounded wait for .usm-board to render
const BOARD_POLL_MS = 200;
const REACTIVITY_BOUND_MS = 5000; // SC-006 reactivity bound
const REACTIVITY_POLL_MS = 100;
const OUTPUT_DIR = join(REPO_ROOT, 'e2e', 'output');
const SCREENSHOT_REL = 'e2e/output/board.png';
const REPORT_REL = 'e2e/output/report.json';

/** Parse `--port <number>` from the argument list (default 9222). */
function parsePort(argv) {
	let port = DEFAULT_PORT;
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === '--port') {
			const raw = argv[i + 1];
			const value = Number(raw);
			if (!Number.isInteger(value) || value < 1 || value > 65535) {
				console.error(
					`✖ Invalid --port value: ${raw ?? '(missing)'}. Expected an integer 1–65535.`,
				);
				process.exit(2);
			}
			port = value;
		}
	}
	return port;
}

/**
 * Pre-flight build check (contracts/launch-cli.md): the test vault's
 * `main.js` must exist and its `manifest.json` version must equal the
 * repository `manifest.json` version. Returns the version on success, throws
 * an Error with an actionable message on failure.
 */
function checkBuild() {
	const mainJs = join(PLUGIN_DIR, 'main.js');
	const vaultManifest = join(PLUGIN_DIR, 'manifest.json');
	const repoManifest = join(REPO_ROOT, 'manifest.json');
	if (!existsSync(mainJs)) {
		throw new Error(
			`Plugin build missing in the test vault: ${mainJs}\n  run npm run e2e:setup`,
		);
	}
	if (!existsSync(vaultManifest) || !existsSync(repoManifest)) {
		throw new Error(
			'manifest.json missing (test vault or repository) — run npm run e2e:setup',
		);
	}
	const vaultVersion = JSON.parse(readFileSync(vaultManifest, 'utf8')).version;
	const repoVersion = JSON.parse(readFileSync(repoManifest, 'utf8')).version;
	if (vaultVersion !== repoVersion) {
		throw new Error(
			`Plugin build outdated: test vault ${vaultVersion} ≠ repository ${repoVersion}\n` +
				'  run npm run e2e:setup',
		);
	}
	return vaultVersion;
}

/** Promise-based sleep. */
function sleep(ms) {
	return new Promise((r) => setTimeout(r, ms));
}

/**
 * Poll (via CDP `evaluate`) until `document.querySelector(selector)` is
 * non-null, or the timeout elapses. Returns true when found.
 */
async function waitForSelector(session, selector, timeoutMs) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const found = await session.evaluate(
			`document.querySelector(${JSON.stringify(selector)}) !== null`,
		);
		if (found) {
			return true;
		}
		await sleep(BOARD_POLL_MS);
	}
	return false;
}

/**
 * Open the board in map view (FR-010).
 *
 * Navigates the page to the `Board.md` note via the `obsidian://` URI scheme.
 * The plugin's routing (`usm-view: map` frontmatter) then renders the board
 * in map view. If the board does not appear (the view may be edit/preview),
 * falls back to clicking the dedicated view-switch control
 * (`button[aria-label="Change view"]` → menu item "USM board").
 *
 * Throws when `.usm-board` is not present after the bounded wait.
 */
async function openBoardInMapView(session) {
	// Navigate to the board note. The path is vault-relative.
	await session.evaluate(`location.href = 'obsidian://open?path=Board.md'`);

	// Wait for the board to render in map view.
	if (await waitForSelector(session, '.usm-board', BOARD_WAIT_MS)) {
		return;
	}

	// Fallback: the view may be edit/preview. Switch to map view via the
	// dedicated view-switch button (FR-010).
	const openedMenu = await session.evaluate(`
		(() => {
			const btn = document.querySelector('button[aria-label="Change view"]');
			if (btn) { btn.click(); return true; }
			return false;
		})()
	`);
	if (openedMenu) {
		await sleep(300); // let the menu render its DOM
		await session.evaluate(`
			(() => {
				const items = Array.from(document.querySelectorAll('.menu-item'));
				const target = items.find((el) => el.textContent.trim() === 'USM board');
				if (target) { target.click(); return true; }
				return false;
			})()
		`);
		if (await waitForSelector(session, '.usm-board', BOARD_WAIT_MS)) {
			return;
		}
	}

	throw new Error(
		'The board did not render in map view — expected .usm-board in the DOM ' +
			'after opening Board.md (and switching to the "USM board" view).',
	);
}

/** Build a failed check object (used when a check throws). */
function failedCheck(id, name, expected, detail) {
	return { id, name, passed: false, actual: null, expected, detail };
}

/**
 * Check 1 (FR-011, SC-004): count the task columns.
 * Counts `.usm-board-header .usm-header-cell--task` elements; expected 4
 * (contracts/test-vault-structure.md).
 */
async function checkTaskColumns(session) {
	const count = await session.evaluate(
		`document.querySelectorAll('.usm-board-header .usm-header-cell--task').length`,
	);
	return {
		id: 'task-columns',
		name: 'Task column count',
		passed: count === 4,
		actual: count,
		expected: 4,
		detail: 'Counted .usm-header-cell--task elements in .usm-board-header',
	};
}

/**
 * Check 2 (FR-012, SC-005): capture a screenshot of the map.
 * Writes the PNG to e2e/output/board.png.
 */
async function checkScreenshot(session) {
	const outPath = join(OUTPUT_DIR, 'board.png');
	await session.screenshot(outPath);
	return {
		id: 'screenshot',
		name: 'Map screenshot captured',
		passed: existsSync(outPath),
		actual: SCREENSHOT_REL,
		expected: 'image file written',
		detail: 'Page.captureScreenshot of the map view',
	};
}

/**
 * Check 3 (FR-013, SC-006): the map reacts to a source change.
 * Records the baseline card count, appends a new story link to Board.md,
 * polls the card count until it changes or the 5000 ms bound elapses,
 * records the delay, then restores Board.md to its committed content so the
 * vault stays reproducible.
 */
async function checkReactivity(session) {
	const boardPath = join(TEST_VAULT, 'Board.md');
	const original = readFileSync(boardPath, 'utf8');
	const baseline = await session.evaluate(
		`document.querySelectorAll('.usm-story-card').length`,
	);

	// Append a new (broken) story link → a new placeholder card.
	const modified =
		(original.endsWith('\n') ? original : original + '\n') +
		'- [[E2E reactivity probe]]\n';
	writeFileSync(boardPath, modified);

	let detected = false;
	let delayMs = REACTIVITY_BOUND_MS;
	try {
		const start = Date.now();
		const deadline = start + REACTIVITY_BOUND_MS;
		while (Date.now() < deadline) {
			const count = await session.evaluate(
				`document.querySelectorAll('.usm-story-card').length`,
			);
			if (count !== baseline) {
				detected = true;
				delayMs = Date.now() - start;
				break;
			}
			await sleep(REACTIVITY_POLL_MS);
		}
	} finally {
		// Always restore the fixture (FR-013, reproducibility).
		writeFileSync(boardPath, original);
	}

	return {
		check: {
			id: 'reactivity',
			name: 'Map reacts to source change',
			passed: detected,
			actual: delayMs,
			expected: '<= 5000',
			detail: detected
				? `Card count changed after modifying a story note; delayMs=${delayMs}`
				: 'Card count did not change within the 5000 ms bound',
		},
		reactivity: { detected, delayMs, boundMs: REACTIVITY_BOUND_MS },
	};
}

/**
 * Build the JSON report exactly per contracts/verification-report.md.
 * `status` is "pass" only when every check passed; otherwise "fail".
 */
function buildReport(port, checks, taskColumns, screenshot, reactivity, errors) {
	const status =
		checks.length > 0 && checks.every((c) => c.passed) ? 'pass' : 'fail';
	return {
		status,
		port,
		timestamp: new Date().toISOString(),
		checks,
		taskColumns,
		screenshot,
		reactivity,
		errors,
	};
}

/**
 * Write the report to e2e/output/report.json and print it to stdout (FR-014).
 * Returns the report object.
 */
function emitReport(port, checks, taskColumns, screenshot, reactivity, errors) {
	const report = buildReport(port, checks, taskColumns, screenshot, reactivity, errors);
	mkdirSync(OUTPUT_DIR, { recursive: true });
	writeFileSync(join(REPO_ROOT, REPORT_REL), JSON.stringify(report, null, 2));
	console.log(JSON.stringify(report, null, 2));
	return report;
}

/**
 * Emit a report for an environment error that occurred before any check ran
 * (CDP unreachable, build missing/outdated, board would not render). Per the
 * contract, status is "fail" and errors explains why; the exit code is 2.
 */
function emitEnvError(port, message) {
	emitReport(
		port,
		[],
		null,
		null,
		{ detected: false, delayMs: null, boundMs: REACTIVITY_BOUND_MS },
		[message],
	);
	process.exit(2);
}

async function main() {
	const port = parsePort(process.argv.slice(2));

	// Pre-flight 1: the CDP endpoint must be reachable (else exit 2 with a
	// connection-failure hint).
	const info = await probe(port);
	if (!info) {
		emitEnvError(
			port,
			`CDP unreachable on port ${port} — is the instance running? ` +
				`run npm run e2e:launch (or: npm run e2e:launch -- --port ${port})`,
		);
	}

	// Pre-flight 2: the plugin build must exist and be current (else exit 2).
	let version;
	try {
		version = checkBuild();
	} catch (err) {
		emitEnvError(port, err.message);
	}
	console.log(`✔ Plugin build current in the test vault (version ${version}).`);

	// Connect to the first page target.
	let session;
	try {
		session = await connect(port);
	} catch (err) {
		emitEnvError(port, err.message);
	}

	// Open the board in map view and wait for it to render.
	try {
		await openBoardInMapView(session);
	} catch (err) {
		session.close();
		emitEnvError(port, err.message);
	}

	console.log('✔ Board opened in map view (.usm-board present).');

	// Run the standard checks (T011) and collect the top-level report fields.
	const checks = [];
	const errors = [];
	let taskColumns = null;
	let screenshot = null;
	let reactivity = { detected: false, delayMs: null, boundMs: REACTIVITY_BOUND_MS };

	// Check 1: task-columns (FR-011, SC-004).
	try {
		const c = await checkTaskColumns(session);
		checks.push(c);
		taskColumns = c.actual;
	} catch (err) {
		checks.push(failedCheck('task-columns', 'Task column count', 4, err.message));
		errors.push(`task-columns: ${err.message}`);
	}

	// Check 2: screenshot (FR-012, SC-005).
	try {
		const c = await checkScreenshot(session);
		checks.push(c);
		screenshot = c.actual;
	} catch (err) {
		checks.push(
			failedCheck('screenshot', 'Map screenshot captured', 'image file written', err.message),
		);
		errors.push(`screenshot: ${err.message}`);
	}

	// Check 3: reactivity (FR-013, SC-006).
	try {
		const { check, reactivity: r } = await checkReactivity(session);
		checks.push(check);
		reactivity = r;
	} catch (err) {
		checks.push(
			failedCheck('reactivity', 'Map reacts to source change', '<= 5000', err.message),
		);
		errors.push(`reactivity: ${err.message}`);
	}

	session.close();

	// Emit the JSON report and set the exit code (T012, FR-014):
	// 0 = pass, 1 = one or more checks failed.
	const report = emitReport(port, checks, taskColumns, screenshot, reactivity, errors);
	process.exit(report.status === 'pass' ? 0 : 1);
}

main().catch((err) => {
	console.error(`✖ Unexpected error: ${err?.message ?? err}`);
	process.exit(2);
});
