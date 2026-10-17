/**
 * No-network regression guard (spec SC-007: "Note content never leaves the
 * local machine — 100% local operation, no data sent externally").
 *
 * The plugin is required to operate entirely offline: it reads board and
 * story data from the local vault via `metadataCache` and never transmits
 * anything to a network endpoint. This test enforces that guarantee by
 * scanning every TypeScript file under `src/` and failing when any outbound
 * network API is referenced.
 *
 * Flagged tokens (outbound network / external-data APIs):
 * - `fetch(`         — global fetch
 * - `XMLHttpRequest` — legacy XHR
 * - `WebSocket`      — real-time sockets
 * - `sendBeacon`     — navigator.sendBeacon (telemetry)
 * - `EventSource`    — server-sent events
 * - `requestUrl`     — Obsidian's HTTP request API
 *
 * Local-compute APIs (e.g. Web Workers) are intentionally NOT flagged: a
 * worker does not, by itself, send data off the machine.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_DIR = join(
	dirname(fileURLToPath(import.meta.url)),
	'..',
	'..',
	'src',
);

/** Recursively list all `.ts` files under `dir`. */
function listTsFiles(dir: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			files.push(...listTsFiles(full));
		} else if (entry.endsWith('.ts')) {
			files.push(full);
		}
	}
	return files;
}

const TS_FILES = listTsFiles(SRC_DIR);

/** Outbound network / external-data API tokens that must never appear. */
const NETWORK_TOKENS: Array<{ label: string; pattern: RegExp }> = [
	{ label: 'fetch(', pattern: /\bfetch\(/g },
	{ label: 'XMLHttpRequest', pattern: /XMLHttpRequest/g },
	{ label: 'WebSocket', pattern: /\bWebSocket\b/g },
	{ label: 'sendBeacon', pattern: /sendBeacon/g },
	{ label: 'EventSource', pattern: /\bEventSource\b/g },
	{ label: 'requestUrl', pattern: /\brequestUrl\b/g },
];

describe('SC-007 — 100% local operation, no network (no-network guard)', () => {
	it('scans a non-empty set of source files', () => {
		expect(TS_FILES.length).toBeGreaterThan(0);
	});

	it('never references an outbound network API', () => {
		const offenders: string[] = [];
		for (const file of TS_FILES) {
			const source = readFileSync(file, 'utf8');
			for (const { label, pattern } of NETWORK_TOKENS) {
				for (const match of source.matchAll(pattern)) {
					const line =
						source.slice(0, match.index ?? 0).split('\n').length;
					offenders.push(`${file}:${line} — ${label}`);
				}
			}
		}
		expect(offenders).toEqual([]);
	});
});
