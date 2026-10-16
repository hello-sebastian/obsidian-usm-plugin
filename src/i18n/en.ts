/**
 * English label dictionary (single locale for MVP).
 *
 * All user-facing strings MUST come from this dictionary — code never
 * hardcodes UI text (research R-09). The flat `Record<string, string>`
 * keyed by semantic string IDs is the agreed foundation for future
 * multilingual support (additional locale files in later iterations).
 */
export const en: Record<string, string> = {
	// "Unassigned" section label (per-level: column group / sub-column / row)
	'unassigned': 'Unassigned',

	// Command names
	'command.open-as-map': 'Open as User Story Map',
	'command.open-as-markdown': 'Open as Markdown',

	// Pane header icon tooltips
	'view.tooltip.open-map': 'Open as User Story Map',
	'view.tooltip.open-markdown': 'Open as Markdown',

	// View display text (tab title suffix / aria)
	'view.board': 'User Story Map',

	// Debug panel labels (used by the debug/dev mode, FR-020)
	'debug.fps': 'FPS',
	'debug.stories': 'Stories',
	'debug.render': 'Render (ms)',

	// Broken-link placeholder card
	'card.broken': 'Missing note',
};

/**
 * Resolve a semantic string ID to its English label.
 * Falls back to the ID itself when a key is missing so a missing
 * translation never renders as an empty string.
 */
export function t(id: string): string {
	return en[id] ?? id;
}
