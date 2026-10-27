#!/usr/bin/env node
/**
 * e2e/cdp.mjs — Minimal Chrome DevTools Protocol (CDP) client.
 *
 * Part of the E2E test environment (specs/002-e2e-test-env, US-03 / FR-016).
 *
 * Uses ONLY Node built-ins (global `fetch` + global `WebSocket`, Node 22+) —
 * no NPM dependencies (research.md R4). It exposes the small, fixed set of
 * operations the verification script and the agent need:
 *
 *   - probe(port)        → GET /json/version (readiness probe) → info | null
 *   - listTargets(port)  → GET /json → page targets with webSocketDebuggerUrl
 *   - connect(port)      → attach a WebSocket to the first page target and
 *                          expose:
 *                            evaluate(expression)  (Runtime.evaluate, returnByValue)
 *                            screenshot(filePath)  (Page.captureScreenshot → PNG)
 *                            close()
 *
 * Every failure rejects with a diagnostic message that includes a
 * connection-failure hint (spec edge case: "browser tool cannot connect").
 *
 * This is a module (imported by verify.mjs). It is not a CLI.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const PROBE_TIMEOUT_MS = 2_000;
const COMMAND_TIMEOUT_MS = 10_000;

/**
 * GET a CDP HTTP endpoint with a timeout. Returns the parsed JSON body, or
 * null on any failure (connection refused, timeout, non-2xx, non-JSON body).
 */
async function fetchJson(url, timeoutMs = PROBE_TIMEOUT_MS) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
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

/**
 * Readiness probe: GET http://127.0.0.1:<port>/json/version.
 * Returns the version info object when a CDP endpoint is serving, else null.
 */
export async function probe(port) {
	const info = await fetchJson(`http://127.0.0.1:${port}/json/version`);
	return info && (info.Browser || info.webSocketDebuggerUrl) ? info : null;
}

/**
 * List page targets: GET http://127.0.0.1:<port>/json.
 * Returns only targets of type "page" that expose a webSocketDebuggerUrl.
 */
export async function listTargets(port) {
	const targets = await fetchJson(`http://127.0.0.1:${port}/json`);
	if (!Array.isArray(targets)) {
		return [];
	}
	return targets.filter(
		(t) => t && t.type === 'page' && typeof t.webSocketDebuggerUrl === 'string',
	);
}

/**
 * Attach a WebSocket to the first page target on the given port.
 *
 * Resolves to a session object:
 *   { evaluate(expression), screenshot(filePath), close(), target }
 *
 * Rejects (with a connection-failure hint) when no page target exists or the
 * WebSocket cannot be established within COMMAND_TIMEOUT_MS.
 */
export async function connect(port) {
	const targets = await listTargets(port);
	if (targets.length === 0) {
		throw new Error(
			`No CDP page targets on port ${port} — is the instance running? ` +
				`(run npm run e2e:launch)`,
		);
	}
	const target = targets[0];
	const ws = new WebSocket(target.webSocketDebuggerUrl);

	const pending = new Map();
	let nextId = 1;
	let closedByUs = false;

	const failAll = (message) => {
		for (const p of pending.values()) {
			p.reject(new Error(message));
		}
		pending.clear();
	};

	ws.addEventListener('message', (event) => {
		let msg;
		try {
			msg = JSON.parse(String(event.data));
		} catch {
			return; // ignore non-JSON frames
		}
		if (msg.id !== undefined && pending.has(msg.id)) {
			const p = pending.get(msg.id);
			pending.delete(msg.id);
			if (msg.error) {
				p.reject(
					new Error(`CDP error ${msg.error.code}: ${msg.error.message}`),
				);
			} else {
				p.resolve(msg.result);
			}
		}
	});
	ws.addEventListener('error', () => {
		failAll(
			`CDP WebSocket error on port ${port} — check that the instance is ` +
				`running (npm run e2e:launch).`,
		);
	});
	ws.addEventListener('close', () => {
		if (!closedByUs) {
			failAll(`CDP WebSocket closed unexpectedly on port ${port}.`);
		}
	});

	// Wait for the socket to open (bounded).
	await new Promise((resolve, reject) => {
		const timer = setTimeout(
			() =>
				reject(
					new Error(
						`Timed out connecting to the CDP target on port ${port} — ` +
							`is the instance running? (run npm run e2e:launch)`,
					),
				),
			COMMAND_TIMEOUT_MS,
		);
		ws.addEventListener(
			'open',
			() => {
				clearTimeout(timer);
				resolve();
			},
			{ once: true },
		);
		ws.addEventListener(
			'error',
			() => {
				clearTimeout(timer);
				reject(
					new Error(
						`Could not connect to the CDP target on port ${port} — ` +
							`is the instance running? (run npm run e2e:launch)`,
					),
				);
			},
			{ once: true },
		);
	});

	/** Send a CDP command and resolve with its `result` (or reject). */
	function send(method, params = {}) {
		const id = nextId++;
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				pending.delete(id);
				reject(
					new Error(
						`CDP command ${method} timed out after ${COMMAND_TIMEOUT_MS} ms.`,
					),
				);
			}, COMMAND_TIMEOUT_MS);
			pending.set(id, {
				resolve: (value) => {
					clearTimeout(timer);
					resolve(value);
				},
				reject: (err) => {
					clearTimeout(timer);
					reject(err);
				},
			});
			ws.send(JSON.stringify({ id, method, params }));
		});
	}

	/**
	 * Evaluate a JavaScript expression in the page and return its value
	 * (Runtime.evaluate, returnByValue: true, awaitPromise: true).
	 */
	async function evaluate(expression) {
		const result = await send('Runtime.evaluate', {
			expression,
			returnByValue: true,
			awaitPromise: true,
		});
		if (result && result.exceptionDetails) {
			throw new Error(
				`Page evaluation failed: ${
					result.exceptionDetails.text ?? 'unknown exception'
				}`,
			);
		}
		return result ? result.result?.value : undefined;
	}

	/**
	 * Capture a PNG screenshot of the page and write it to `filePath`
	 * (Page.captureScreenshot). Creates parent directories as needed.
	 * Returns the written path.
	 */
	async function screenshot(filePath) {
		const result = await send('Page.captureScreenshot', { format: 'png' });
		const buffer = Buffer.from(result.data, 'base64');
		mkdirSync(dirname(filePath), { recursive: true });
		writeFileSync(filePath, buffer);
		return filePath;
	}

	/** Close the WebSocket (idempotent). */
	function close() {
		closedByUs = true;
		try {
			ws.close();
		} catch {
			// already closed
		}
	}

	return { evaluate, screenshot, close, target };
}
