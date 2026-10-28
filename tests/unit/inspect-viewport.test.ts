/**
 * Argument-parsing tests for the `viewport` operation of `e2e/inspect.mjs`
 * (bug fix: `emulate-mobile-viewport-gap`).
 *
 * The e2e tooling is a CLI whose actual override effect can only be confirmed
 * against a live Obsidian instance; these tests pin down the argument-parsing
 * / fail-fast contract only:
 *   - invalid input  → exit 2 with a parse-error message (before any CDP
 *     connection is attempted);
 *   - valid input    → parsing succeeds, and the process fails only at the
 *     connection step (exit 2, "No CDP page targets") against a port where no
 *     CDP instance is listening.
 *
 * No live instance is required; the tests spawn the CLI against a dead port.
 */
import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const INSPECT = join(REPO_ROOT, 'e2e', 'inspect.mjs');
// A port where no CDP instance is expected to be listening.
const DEAD_PORT = '47823';

interface RunResult {
	code: number | null;
	stdout: string;
	stderr: string;
}

/** Spawn `node e2e/inspect.mjs <args> --port <DEAD_PORT>` and capture the result. */
function runInspect(args: string[]): Promise<RunResult> {
	return new Promise((resolve) => {
		execFile(
			'node',
			[INSPECT, ...args, '--port', DEAD_PORT],
			{ timeout: 15_000 },
			(err, stdout, stderr) => {
				resolve({
					code: err && typeof err.code === 'number' ? err.code : null,
					stdout: String(stdout),
					stderr: String(stderr),
				});
			},
		);
	});
}

describe('inspect.mjs viewport operation — argument parsing (bug: emulate-mobile-viewport-gap)', () => {
	it('exits 2 with a parse error when no argument is given', async () => {
		const r = await runInspect(['viewport']);
		expect(r.code).toBe(2);
		expect(r.stderr).toContain('viewport requires <WxH> or \'reset\'');
	});

	it('exits 2 with a parse error for a malformed size', async () => {
		const r = await runInspect(['viewport', '375']);
		expect(r.code).toBe(2);
		expect(r.stderr).toContain('Invalid viewport size');
	});

	it('exits 2 with a parse error for a non-numeric size', async () => {
		const r = await runInspect(['viewport', 'abcxdef']);
		expect(r.code).toBe(2);
		expect(r.stderr).toContain('Invalid viewport size');
	});

	it('exits 2 with a parse error for an unknown flag', async () => {
		const r = await runInspect(['viewport', '375x667', '--bogus']);
		expect(r.code).toBe(2);
		expect(r.stderr).toContain('Unknown viewport argument');
	});

	it('exits 2 with a parse error for a non-positive --scale', async () => {
		const r = await runInspect(['viewport', '375x667', '--scale', '0']);
		expect(r.code).toBe(2);
		expect(r.stderr).toContain('Invalid --scale value');
	});

	it('exits 2 with a parse error for a missing --scale value', async () => {
		const r = await runInspect(['viewport', '375x667', '--scale']);
		expect(r.code).toBe(2);
		expect(r.stderr).toContain('Invalid --scale value');
	});

	it('parses a valid WxH + --mobile and fails only at the connection step', async () => {
		const r = await runInspect(['viewport', '375x667', '--mobile']);
		expect(r.code).toBe(2);
		expect(r.stderr).toContain('No CDP page targets');
		expect(r.stderr).not.toContain('Invalid viewport size');
	});

	it('parses a valid WxH + --scale and fails only at the connection step', async () => {
		const r = await runInspect(['viewport', '375x667', '--scale', '2']);
		expect(r.code).toBe(2);
		expect(r.stderr).toContain('No CDP page targets');
	});

	it('parses `viewport reset` and fails only at the connection step', async () => {
		const r = await runInspect(['viewport', 'reset']);
		expect(r.code).toBe(2);
		expect(r.stderr).toContain('No CDP page targets');
	});
});

describe('inspect.mjs --viewport flag on eval/screenshot (bug: emulate-mobile-viewport-gap)', () => {
	it('eval: parses --viewport WxH + --mobile and fails only at the connection step', async () => {
		const r = await runInspect(['eval', 'window.innerWidth', '--viewport', '375x667', '--mobile']);
		expect(r.code).toBe(2);
		expect(r.stderr).toContain('No CDP page targets');
		expect(r.stderr).not.toContain('Invalid --viewport');
	});

	it('eval: exits 2 with a parse error for a malformed --viewport size', async () => {
		const r = await runInspect(['eval', 'window.innerWidth', '--viewport', '375']);
		expect(r.code).toBe(2);
		expect(r.stderr).toContain('Invalid --viewport value');
	});

	it('eval: exits 2 with a parse error for a missing --viewport value', async () => {
		const r = await runInspect(['eval', 'window.innerWidth', '--viewport']);
		expect(r.code).toBe(2);
		expect(r.stderr).toContain('Invalid --viewport value');
	});

	it('eval: exits 2 with a parse error for a non-positive --scale', async () => {
		const r = await runInspect(['eval', 'window.innerWidth', '--viewport', '375x667', '--scale', '0']);
		expect(r.code).toBe(2);
		expect(r.stderr).toContain('Invalid --scale value');
	});

	it('screenshot: parses --viewport WxH + --mobile and fails only at the connection step', async () => {
		const r = await runInspect(['screenshot', 'e2e/output/test.png', '--viewport', '375x667', '--mobile']);
		expect(r.code).toBe(2);
		expect(r.stderr).toContain('No CDP page targets');
		expect(r.stderr).not.toContain('Invalid --viewport');
	});

	it('screenshot: exits 2 with a parse error for a malformed --viewport size', async () => {
		const r = await runInspect(['screenshot', 'e2e/output/test.png', '--viewport', 'abc']);
		expect(r.code).toBe(2);
		expect(r.stderr).toContain('Invalid --viewport value');
	});

	it('screenshot: exits 2 with a parse error for an unknown flag', async () => {
		const r = await runInspect(['screenshot', 'e2e/output/test.png', '--bogus']);
		expect(r.code).toBe(2);
		expect(r.stderr).toContain('Unknown screenshot argument');
	});
});
