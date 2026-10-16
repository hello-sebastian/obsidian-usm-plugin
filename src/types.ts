/**
 * Shared TypeScript interfaces for the User Story Map plugin.
 *
 * These are in-memory representations derived from Markdown files via
 * `app.metadataCache` (data-model.md E-02 … E-06). The plugin owns no
 * persistent data — the only persisted state is the `debugMode` setting.
 *
 * Strict mode, no `any` (Constitution Principle III).
 */

/**
 * Reserved key used at any hierarchy level (Activity / Task / Epic /
 * Release) when a story is missing that attribute. The renderer draws a
 * dedicated "Unassigned" section for it (FR-011).
 *
 * NOTE: kept all-lowercase so that {@link normalizeKey} (which lower-cases
 * non-empty values) is idempotent on the sentinel — i.e.
 * `normalizeKey(UNASSIGNED) === UNASSIGNED`. This keeps key lookups
 * consistent whether the key came from a missing attribute or from the
 * stored display label.
 */
export const UNASSIGNED = '__usm_unassigned__';

/**
 * Normalize a hierarchy value to its grouping key.
 *
 * Values are compared case-insensitively so that e.g. `Login` and
 * `login` group together (spec edge case). A missing/empty value maps
 * to the reserved {@link UNASSIGNED} key.
 */
export function normalizeKey(value: string | null | undefined): string {
	if (value === null || value === undefined) {
		return UNASSIGNED;
	}
	const trimmed = value.trim();
	if (trimmed.length === 0) {
		return UNASSIGNED;
	}
	return trimmed.toLowerCase();
}

/**
 * Build the composite key for a grid cell:
 * `${activityKey}::${taskKey}::${epicKey}::${releaseKey}`
 * (data-model.md E-06). Missing levels use the reserved UNASSIGNED key.
 */
export function cellKey(
	activityKey: string,
	taskKey: string,
	epicKey: string,
	releaseKey: string,
): string {
	return `${activityKey}::${taskKey}::${epicKey}::${releaseKey}`;
}

/**
 * Board-level configuration parsed from the board file frontmatter
 * (data-model.md E-02, contracts/board-file-format.md).
 */
export interface BoardConfig {
	/** Gate for map rendering — only `true` activates the map view (FR-001). */
	isBoard: boolean;
	/**
	 * Release row ordering strategy (FR-006).
	 * `appearance` (default): order of first appearance among the board's
	 * stories. `alphabetical`: case-insensitive sort of Release labels.
	 * Unknown values fall back to `appearance`.
	 */
	releaseRowOrder: 'appearance' | 'alphabetical';
}

/**
 * A single attribute value: either plain text or a wikilink.
 * A wikilink value (`linkPath` set) makes the rendered header clickable
 * (opens the linked note); plain text renders as an inert visual label
 * (FR-007).
 */
export interface AttributeValue {
	/** Display text of the value (link alias for wikilinks). */
	text: string;
	/** Resolved note path when the value is a wikilink; absent for plain text. */
	linkPath?: string;
}

/**
 * Normalized story attributes (data-model.md E-05).
 * Each field is `null` when the attribute is missing → the story is
 * bucketed into the "Unassigned" section at that level (FR-011).
 */
export interface StoryAttributes {
	activity: AttributeValue | null;
	task: AttributeValue | null;
	epic: AttributeValue | null;
	/** Also drives the card footer badge (FR-010: Release value only in MVP). */
	release: AttributeValue | null;
}

/**
 * One entry per wikilink occurrence in the board file. Duplicates are
 * distinct entries, each rendered as a separate card in order of
 * appearance (FR-018, data-model.md E-04).
 */
export interface StoryEntry {
	/** Stable per-occurrence key (board file path + occurrence index). */
	id: string;
	/** Resolved note path; `null` for broken links. */
	targetPath: string | null;
	/** Display text of the wikilink (fallback for broken links). */
	linkText: string;
	/** Normalized attributes; all fields `null` for broken links. */
	attributes: StoryAttributes;
	/** Resolved via the title cascade (FR-009). */
	title: string;
	/** `true` when the wikilink resolves to no note (FR-018 edge case). */
	isBroken: boolean;
}

/**
 * Third-level column (Epic) nested under a Task (data-model.md E-06).
 */
export interface TaskGroup {
	/** Task label (or {@link UNASSIGNED}). */
	task: string;
	/** Epic labels (or {@link UNASSIGNED}), ordered by first appearance. */
	epics: string[];
}

/**
 * Top-level column group (Activity) (data-model.md E-06).
 */
export interface ColumnGroup {
	/** Activity label (or {@link UNASSIGNED}). */
	activity: string;
	/** Nested Task level, ordered by first appearance. */
	tasks: TaskGroup[];
}

/**
 * The in-memory grid model built from `BoardConfig` + `StoryEntry[]`
 * (data-model.md E-06). Rebuilt from scratch on every (debounced)
 * update event — it has no lifecycle of its own.
 */
export interface GridModel {
	/** Column hierarchy, ordered by first appearance in the board file (FR-005). */
	activities: ColumnGroup[];
	/** Row labels (Release values), ordered per `releaseRowOrder` (FR-006). */
	releases: string[];
	/**
	 * Cell contents keyed by `${activityKey}::${taskKey}::${epicKey}::${releaseKey}`.
	 * Keys use normalized (lower-cased) values; missing levels use UNASSIGNED.
	 */
	cells: Map<string, StoryEntry[]>;
	/**
	 * Per-level flag indicating whether an "Unassigned" section exists at
	 * that level (so the renderer knows which sections to draw).
	 */
	unassigned: {
		activity: boolean;
		task: boolean;
		epic: boolean;
		release: boolean;
	};
}
