/**
 * XSS sanitization utility (research R-05, FR-016).
 *
 * The PRIMARY defense against XSS in this plugin is text-node insertion:
 * every note-derived string is placed into the DOM via `setText` /
 * `createEl` (see `board-renderer.ts` and `story-card.ts`), which the
 * browser treats as inert text. This module provides an explicit
 * HTML-escape function as the FALLBACK for the rare case where markup
 * must be constructed from note-derived data.
 */

/**
 * Escape a string so it can be safely embedded in HTML markup.
 *
 * Neutralizes the five characters that carry meaning in HTML:
 * `&`, `<`, `>`, `"`, `'`.
 */
export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/**
 * Escape a string for safe use inside a double-quoted HTML attribute.
 * Delegates to {@link escapeHtml} (which also escapes `"`).
 */
export function escapeAttr(value: string): string {
	return escapeHtml(value);
}
