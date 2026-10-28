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
 *   eval <expression> [--viewport <WxH>] [--mobile] [--scale N]
 *                                        Evaluate JS in the page; print the
 *                                        value as one-line JSON to stdout.
 *   wait <css-selector> [--timeout <ms>] Poll until the selector matches
 *                                        (default 15000 ms, 200 ms poll).
 *   screenshot <path> [--viewport <WxH>] [--mobile] [--scale N]
 *                                        Capture a PNG to <path> (parent dirs
 *                                        are created); print the written path.
 *   viewport <WxH> [--scale N] [--mobile] Override the device viewport via
 *                                        CDP Emulation.setDeviceMetricsOverride.
 *   viewport reset                       Clear any active viewport override.
 *
 * Viewport flags (--viewport, --mobile, --scale) on eval/screenshot:
 *   Apply the override for the duration of the operation only (set before,
 *   cleared after). This is required because the CDP device-metrics override
 *   is session-scoped — it is cleared when the setting connection closes.
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
	if (!op || !['eval', 'wait', 'screenshot', 'viewport'].includes(op)) {
		fail(
			`Unknown or missing operation: ${op ? `'${op}'` : '(none)'}. ` +
				`Expected one of: eval, wait, screenshot, viewport. ${LAUNCH_HINT}`,
			2,
		);
	}

	// Resolve the operation's arguments (invalid arguments → exit 2).
	let expression = null;
	let selector = null;
	let waitTimeout = DEFAULT_WAIT_TIMEOUT_MS;
	let shotPath = null;
	let viewportReset = false;
	let viewportWidth = 0;
	let viewportHeight = 0;
	let viewportScale = 1;
	let viewportMobile = false;

	if (op === 'eval') {
		const exprParts = [];
		for (let i = 1; i < rest.length; i++) {
			if (rest[i] === '--viewport') {
				const raw = rest[i + 1];
				const m = /^(\d+)x(\d+)$/.exec(raw ?? '');
				if (!m) {
					fail(
						`Invalid --viewport value: '${raw ?? '(missing)'}'. ` +
							`Expected <WxH> (e.g. 375x667). ${LAUNCH_HINT}`,
						2,
					);
				}
				viewportWidth = Number(m[1]);
				viewportHeight = Number(m[2]);
				i++;
			} else if (rest[i] === '--mobile') {
				viewportMobile = true;
			} else if (rest[i] === '--scale') {
				const raw = rest[i + 1];
				const value = Number(raw);
				if (!Number.isFinite(value) || value <= 0) {
					fail(
						`Invalid --scale value: ${raw ?? '(missing)'}. ` +
							`Expected a positive number. ${LAUNCH_HINT}`,
						2,
					);
				}
				viewportScale = value;
				i++;
			} else {
				exprParts.push(rest[i]);
			}
		}
		expression = exprParts.join(' ');
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
		for (let i = 2; i < rest.length; i++) {
			if (rest[i] === '--viewport') {
				const raw = rest[i + 1];
				const m = /^(\d+)x(\d+)$/.exec(raw ?? '');
				if (!m) {
					fail(
						`Invalid --viewport value: '${raw ?? '(missing)'}'. ` +
							`Expected <WxH> (e.g. 375x667). ${LAUNCH_HINT}`,
						2,
					);
				}
				viewportWidth = Number(m[1]);
				viewportHeight = Number(m[2]);
				i++;
			} else if (rest[i] === '--mobile') {
				viewportMobile = true;
			} else if (rest[i] === '--scale') {
				const raw = rest[i + 1];
				const value = Number(raw);
				if (!Number.isFinite(value) || value <= 0) {
					fail(
						`Invalid --scale value: ${raw ?? '(missing)'}. ` +
							`Expected a positive number. ${LAUNCH_HINT}`,
						2,
					);
				}
				viewportScale = value;
				i++;
			} else {
				fail(`Unknown screenshot argument: '${rest[i]}'. ${LAUNCH_HINT}`, 2);
			}
		}
	} else if (op === 'viewport') {
		const vpArgs = rest.slice(1);
		if (vpArgs.length === 0) {
			fail(`viewport requires <WxH> or 'reset'. ${LAUNCH_HINT}`, 2);
		}
		if (vpArgs[0] === 'reset') {
			viewportReset = true;
		} else {
			const m = /^(\d+)x(\d+)$/.exec(vpArgs[0]);
			if (!m) {
				fail(
					`Invalid viewport size: '${vpArgs[0]}'. ` +
						`Expected <WxH> (e.g. 375x667) or 'reset'. ${LAUNCH_HINT}`,
					2,
				);
			}
			viewportWidth = Number(m[1]);
			viewportHeight = Number(m[2]);
			for (let i = 1; i < vpArgs.length; i++) {
				if (vpArgs[i] === '--scale') {
					const raw = vpArgs[i + 1];
					const value = Number(raw);
					if (!Number.isFinite(value) || value <= 0) {
						fail(
							`Invalid --scale value: ${raw ?? '(missing)'}. ` +
								`Expected a positive number. ${LAUNCH_HINT}`,
							2,
						);
					}
					viewportScale = value;
					i++; // consume the value
				} else if (vpArgs[i] === '--mobile') {
					viewportMobile = true;
				} else {
					fail(`Unknown viewport argument: '${vpArgs[i]}'. ${LAUNCH_HINT}`, 2);
				}
			}
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
	// When --viewport is used, the override is applied before the action and
	// cleared after (session-scoped: it would be lost when the connection
	// closes, so it must live within the same connection as the action).
	try {
		if (viewportWidth > 0) {
			await session.setViewport(viewportWidth, viewportHeight, viewportScale, viewportMobile);
		}
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
		} else if (op === 'viewport') {
			if (viewportReset) {
				await session.clearViewport();
				console.log('ok: viewport override cleared');
			} else {
				await session.setViewport(viewportWidth, viewportHeight, viewportScale, viewportMobile);
				console.log(
					`ok: viewport set to ${viewportWidth}x${viewportHeight} ` +
						`(scale ${viewportScale}, mobile ${viewportMobile})`,
				);
			}
		}
	} catch (err) {
		fail(err.message, 1);
	} finally {
		if (viewportWidth > 0) {
			try {
				await session.clearViewport();
			} catch {
				// best-effort cleanup; the override is session-scoped and
				// will be cleared when the connection closes anyway
			}
		}
		session.close();
	}
}

main();
