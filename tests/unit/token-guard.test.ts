/**
 * Static token guard (FR-033, research R-24, Constitution Principle I).
 *
 * The board stylesheet MUST derive every color from Obsidian CSS variables
 * (or `color-mix()` over them) so light/dark themes adapt automatically and
 * no color is hard-coded. This test reads `styles.css` as text and fails when:
 *   1. any hard-coded hex / rgb / rgba / hsl / hsla color literal appears;
 *   2. a color declaration does not use `var(--...)`, `color-mix(... var(...) ...)`,
 *      or an allowed CSS color keyword (transparent, currentColor, inherit, ...).
 *
 * The test must pass against the final stylesheet (T010). It is a regression
 * guard, not a feature test: it passes on the current token-only stylesheet
 * and must keep passing as the Figma visual design (T010) is applied.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const STYLES_CSS = join(
	dirname(fileURLToPath(import.meta.url)),
	'..',
	'..',
	'styles.css',
);

const RAW = readFileSync(STYLES_CSS, 'utf8');
/** Strip CSS comments so commented-out colors are not flagged. */
const CSS = RAW.replace(/\/\*[\s\S]*?\*\//g, '');

/** Properties whose value carries a color. */
const COLOR_PROPERTIES = new Set([
	'color',
	'background-color',
	'border-color',
	'border',
	'border-top',
	'border-right',
	'border-bottom',
	'border-left',
	'outline',
	'outline-color',
	'background',
	'box-shadow',
	'fill',
	'stroke',
	'text-decoration-color',
	'caret-color',
	'accent-color',
]);

/** Allowed bare color keywords (no token reference needed). */
const COLOR_KEYWORDS = new Set([
	'transparent',
	'currentcolor',
	'inherit',
	'none',
	'initial',
	'unset',
]);

/** All `property: value` declarations in the stylesheet. */
function declarations(): Array<{ prop: string; value: string }> {
	const out: Array<{ prop: string; value: string }> = [];
	for (const m of CSS.matchAll(/([a-zA-Z-]+)\s*:\s*([^;{}]+);/g)) {
		const prop = m[1];
		const value = m[2];
		if (prop !== undefined && value !== undefined) {
			out.push({ prop: prop.toLowerCase(), value: value.trim() });
		}
	}
	return out;
}

describe('Constitution Principle I / FR-033 — no hard-coded colors in styles.css', () => {
	it('reads a non-empty stylesheet', () => {
		expect(RAW.length).toBeGreaterThan(0);
	});

	it('contains no hard-coded hex color literals', () => {
		const offenders = [...CSS.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0]);
		expect(offenders).toEqual([]);
	});

	it('contains no hard-coded rgb/rgba/hsl/hsla color literals', () => {
		const offenders = [
			...CSS.matchAll(/\b(?:rgb|rgba|hsl|hsla)\s*\(/gi),
		].map((m) => m[0]);
		expect(offenders).toEqual([]);
	});

	it('derives every color declaration from a token or an allowed keyword', () => {
		const offenders: string[] = [];
		for (const { prop, value } of declarations()) {
			if (!COLOR_PROPERTIES.has(prop)) continue;
			const usesVar = /var\(--[a-zA-Z0-9-]+\)/.test(value);
			const usesColorMix = /color-mix\(/.test(value) && /var\(/.test(value);
			const isKeyword = COLOR_KEYWORDS.has(value.toLowerCase());
			if (!usesVar && !usesColorMix && !isKeyword) {
				offenders.push(`${prop}: ${value}`);
			}
		}
		expect(offenders).toEqual([]);
	});
});
