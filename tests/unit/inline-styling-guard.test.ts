/**
 * Inline-styling regression guard (Constitution Principle VII,
 * "No Inline JS Styling", clarified in v1.6.1).
 *
 * The constitution forbids direct manipulation of `element.style` for
 * visual presentation: all visual styling MUST live in `styles.css`
 * (CSS classes + Obsidian CSS variables). Setting CSS custom properties
 * to encode *structural geometry* (grid item positions, spans, track
 * counts) is permitted (v1.6.1 clarification) — but only project-prefixed
 * `--usm-*` custom properties, so geometry data and visual styling stay
 * cleanly separated.
 *
 * This test scans every TypeScript file under `src/` and fails when:
 * 1. any `.style.<property>` access appears (direct style manipulation);
 * 2. a `style` attribute is set via `setAttribute`;
 * 3. any `setCssProps` call sets a key that is not a `--usm-*` custom
 *    property (i.e., a visual style property leaks into JS).
 *
 * Note: the `setCssProps` guard matches the project's call pattern
 * (`el.setCssProps({ ... });` with an inline object literal). A call that
 * passes a pre-built variable is not matched — keep the inline-object
 * pattern so the guard stays effective.
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

describe('Constitution Principle VII — No Inline JS Styling (v1.6.1)', () => {
	it('scans a non-empty set of source files', () => {
		expect(TS_FILES.length).toBeGreaterThan(0);
	});

	it('never accesses element.style properties directly', () => {
		const offenders: string[] = [];
		for (const file of TS_FILES) {
			const source = readFileSync(file, 'utf8');
			for (const match of source.matchAll(/\.style\.[A-Za-z_$][\w$]*/g)) {
				offenders.push(`${file}: ${match[0]}`);
			}
		}
		expect(offenders).toEqual([]);
	});

	it('never sets a style attribute via setAttribute', () => {
		const offenders: string[] = [];
		for (const file of TS_FILES) {
			const source = readFileSync(file, 'utf8');
			if (/setAttribute\(\s*(['"])style\1/.test(source)) {
				offenders.push(file);
			}
		}
		expect(offenders).toEqual([]);
	});

	it('only sets --usm-* CSS custom properties via setCssProps', () => {
		const offenders: string[] = [];
		for (const file of TS_FILES) {
			const source = readFileSync(file, 'utf8');
			for (const call of source.matchAll(
				/setCssProps\(\{([\s\S]*?)\}\);/g,
			)) {
				const body = call[1] ?? '';
				for (const keyMatch of body.matchAll(/(['"])([^'"]+)\1\s*:/g)) {
					const key = keyMatch[2] ?? '';
					if (!key.startsWith('--usm-')) {
						offenders.push(`${file}: setCssProps key "${key}"`);
					}
				}
			}
		}
		expect(offenders).toEqual([]);
	});
});
