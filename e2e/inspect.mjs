#!/usr/bin/env node
/**
 * e2e/inspect.mjs — Ad-hoc inspection CLI for the E2E test environment.
 *
 * Part of feature specs/002-e2e-test-env (US-003-02 / FR-003-005…FR-003-007).
 *
 * A thin CLI over the existing CDP client (./cdp.mjs). It introduces no new
 * external dependencies (Node 22+ built-ins only).
 *
 * Operations:
 *   eval <expression>                    Evaluate JS in the page; print the
 *                                        value as one-line JSON to stdout.
 *   wait <css-selector> [--timeout <ms>] Poll until the selector matches
 *                                        (default 15000 ms, 200 ms poll).
 *   screenshot <path>                    Capture a PNG to <path> (parent dirs
 *                                        are created); print the written path.
 *
 * Common options:
 *   --port <number>   CDP port (default 9222, integer 1–65535).
 *
 * Exit codes:
 *   0  Operation succeeded.
 *   1  Operation failed (wait timeout, page evaluation exception, or a CDP
 *      command error).
 *   2  Environment error before the operation ran (no CDP instance on the
 *      port, invalid arguments). Every environment error includes the hint
 *      "(run npm run e2e:launch)".
 *
 * Contract: specs/002-e2e-test-env/contracts/inspect-cli.md
 */

import { connect } from './cdp.mjs';

const DEFAULT_PORT = 9222;
const DEFAULT_WAIT_TIMEOUT_MS = 15_000;
const WAIT_POLL_MS = 200;
const LAUNCH_HINT = '(run npm run e2e:launch)';

/** Print an error to stderr and exit with the given code. */
function fail(message, code) {
	console.error(`✖ ${message}`);
	process.exit(code);
}

/** Sleep for the given number of milliseconds. */
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse `--port <number>` out of the argument list. Returns the resolved port
 * and the remaining (non-port) arguments. Exits 2 on an invalid port value.
 */
function parsePort(argv) {
	let port = DEFAULT_PORT;
	const rest = [];
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === '--port') {
			const raw = argv[i + 1];
			const value = Number(raw);
			if (!Number.isInteger(value) || value < 1 || value > 65535) {
				fail(
					`Invalid --port value: ${raw ?? '(missing)'}. ` +
						`Expected an integer 1–65535. ${LAUNCH_HINT}`,
					2,
				);
			}
			port = value;
			i++; // consume the value
		} else {
			rest.push(argv[i]);
		}
	}
	return { port, rest };
}

async function main() {
	const { port, rest } = parsePort(process.argv.slice(2));

	const op = rest[0];
	if (!op || !['eval', 'wait', 'screenshot'].includes(op)) {
		fail(
			`Unknown or missing operation: ${op ? `'${op}'` : '(none)'}. ` +
				`Expected one of: eval, wait, screenshot. ${LAUNCH_HINT}`,
			2,
		);
	}

	// Resolve the operation's arguments (invalid arguments → exit 2).
	let expression = null;
	let selector = null;
	let waitTimeout = DEFAULT_WAIT_TIMEOUT_MS;
	let shotPath = null;

	if (op === 'eval') {
		expression = rest.slice(1).join(' ');
		if (!expression) {
			fail(`eval requires an <expression> argument. ${LAUNCH_HINT}`, 2);
		}
	} else if (op === 'wait') {
		const positional = [];
		for (let i = 1; i < rest.length; i++) {
			if (rest[i] === '--timeout') {
				const raw = rest[i + 1];
				const value = Number(raw);
				if (!Number.isInteger(value) || value <= 0) {
					fail(
						`Invalid --timeout value: ${raw ?? '(missing)'}. ` +
							`Expected a positive integer (ms). ${LAUNCH_HINT}`,
						2,
					);
				}
				waitTimeout = value;
				i++; // consume the value
			} else {
				positional.push(rest[i]);
			}
		}
		selector = positional[0];
		if (!selector) {
			fail(`wait requires a <css-selector> argument. ${LAUNCH_HINT}`, 2);
		}
	} else if (op === 'screenshot') {
		shotPath = rest[1];
		if (!shotPath) {
			fail(`screenshot requires a <path> argument. ${LAUNCH_HINT}`, 2);
		}
	}

	// Connect to the CDP instance (environment error → exit 2).
	let session;
	try {
		session = await connect(port);
	} catch (err) {
		fail(err.message, 2);
	}

	// Run the operation (operation failure → exit 1).
	try {
		if (op === 'eval') {
			const value = await session.evaluate(expression);
			console.log(JSON.stringify(value));
		} else if (op === 'wait') {
			const check = `document.querySelector(${JSON.stringify(selector)}) !== null`;
			const deadline = Date.now() + waitTimeout;
			let found = false;
			for (;;) {
				found = await session.evaluate(check);
				if (found) break;
				if (Date.now() >= deadline) break;
				await sleep(WAIT_POLL_MS);
			}
			if (found) {
				console.log(`ok: ${selector} found`);
			} else {
				fail(`timeout: ${selector} not found within ${waitTimeout} ms`, 1);
			}
		} else if (op === 'screenshot') {
			const written = await session.screenshot(shotPath);
			console.log(written);
		}
	} catch (err) {
		fail(err.message, 1);
	} finally {
		session.close();
	}
}

main();
