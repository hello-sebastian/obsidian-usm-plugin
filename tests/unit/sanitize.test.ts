/**
 * XSS sanitization unit tests (T033, FR-016, quickstart Q8).
 *
 * Covers both layers of the plugin's XSS defense (research R-05):
 * 1. **Primary** — text-node insertion: note-derived strings are placed via
 *    `setText` / `createEl({ text })`, which the DOM treats as inert text.
 *    Verified by building real DOM nodes under jsdom and asserting that
 *    malicious payloads never become elements.
 * 2. **Fallback** — `escapeHtml` / `escapeAttr` from `src/utils/sanitize.ts`:
 *    the five HTML-significant characters are escaped so that, in the rare
 *    case markup must be constructed from note data, the result renders as
 *    inert text and never executes.
 *
 * A static audit additionally asserts that the rendering modules never
 * assign `innerHTML` / `outerHTML` or call `insertAdjacentHTML` (FR-016).
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml, escapeAttr } from '../../src/utils/sanitize';
import { patchHTMLElement } from '../helpers/dom-patch';

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');

/** Note-derived payloads that must never execute (quickstart Q8). */
const PAYLOADS = [
	'<img src=x onerror=alert(1)>',
	'<script>alert(1)</script>',
	'<a href="#" onclick="alert(1)">click</a>',
	'<svg onload=alert(1)>',
	'" onmouseover="alert(1)" x="',
];

describe('escapeHtml (fallback defense)', () => {
	it('escapes the five HTML-significant characters', () => {
		expect(escapeHtml('<')).toBe('&lt;');
		expect(escapeHtml('>')).toBe('&gt;');
		expect(escapeHtml('&')).toBe('&amp;');
		expect(escapeHtml('"')).toBe('&quot;');
		expect(escapeHtml("'")).toBe('&#39;');
	});

	it('escapes & first so entities are not double-escaped', () => {
		expect(escapeHtml('<&>')).toBe('&lt;&amp;&gt;');
	});

	it('leaves plain text unchanged', () => {
		expect(escapeHtml('Login flow v2 (auth)')).toBe('Login flow v2 (auth)');
	});

	it.each(PAYLOADS)('neutralizes %s', (payload) => {
		const escaped = escapeHtml(payload);
		expect(escaped).not.toMatch(/</);
		expect(escaped).not.toMatch(/>/);
	});

	it('renders escaped payloads as inert text, never as elements', () => {
		for (const payload of PAYLOADS) {
			const host = document.createElement('div');
			// Intentional: the value is already escaped by escapeHtml, and the
			// point of this test is to prove the escaped markup parses as inert
			// text (no child elements), never as live HTML.
			// eslint-disable-next-line no-unsanitized/property -- escaped payload must be assigned to innerHTML to prove it renders as inert text
			host.innerHTML = escapeHtml(payload);
			expect(host.textContent).toBe(payload);
			expect(host.children.length).toBe(0);
		}
	});
});

describe('escapeAttr (attribute contexts)', () => {
	it('escapes quotes and markup for attribute embedding', () => {
		expect(escapeAttr('"')).toBe('&quot;');
		expect(escapeAttr("'")).toBe('&#39;');
		expect(escapeAttr('<img src=x onerror=alert(1)>')).not.toMatch(/</);
	});
});

describe('text-node insertion path (primary defense)', () => {
	beforeAll(() => {
		patchHTMLElement();
	});

	it('setText inserts note-derived markup as inert text', () => {
		const el = document.createElement('div');
		el.setText('<img src=x onerror=alert(1)>');
		expect(el.textContent).toBe('<img src=x onerror=alert(1)>');
		expect(el.children.length).toBe(0);
		expect(el.querySelector('img')).toBeNull();
	});

	it('createEl with a text option inserts inert text', () => {
		const host = document.createElement('div');
		host.createEl('pre', { text: '<script>alert(1)</script>' });
		const pre = host.firstChild as HTMLElement;
		expect(pre.textContent).toBe('<script>alert(1)</script>');
		expect(pre.children.length).toBe(0);
	});
});

describe('static audit: no innerHTML with note data (FR-016)', () => {
	const files = [
		'board/board-renderer.ts',
		'story/story-card.ts',
		'board/board-view.ts',
	];

	it.each(files)('src/%s never assigns innerHTML/outerHTML or uses insertAdjacentHTML', (file) => {
		const source = readFileSync(join(SRC_DIR, file), 'utf8');
		expect(source).not.toMatch(/\binnerHTML\s*=/);
		expect(source).not.toMatch(/\bouterHTML\s*=/);
		expect(source).not.toMatch(/insertAdjacentHTML/);
	});
});
