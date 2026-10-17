/**
 * Story attribute reading (T007).
 *
 * Reads a story note's frontmatter exclusively through
 * `app.metadataCache.getFileCache()` — no disk reads (research R-02,
 * Constitution Principle V). Field names are matched case-insensitively
 * against the built-in PL/EN synonym dictionary (FR-012, research R-06);
 * values are either plain text or wikilinks (FR-007).
 *
 * The title cascade (FR-009): `Story` → `title` → first alias →
 * file name without extension (research R-12).
 */
import { App, TFile } from 'obsidian';
import type { AttributeValue, StoryAttributes } from '../types';

/** Canonical attribute names a story note can carry. */
export type CanonicalField =
	| 'activity'
	| 'task'
	| 'epic'
	| 'release'
	| 'story'
	| 'title';

/**
 * Built-in PL/EN synonym dictionary (FR-012). Keys are normalized
 * (lower-cased, trimmed) field names; values are the canonical field.
 * Not user-configurable in MVP (spec Assumptions).
 */
const FIELD_SYNONYMS: Record<string, CanonicalField> = {
	activity: 'activity',
	aktywność: 'activity',
	task: 'task',
	zadanie: 'task',
	epic: 'epic',
	epik: 'epic',
	release: 'release',
	wydanie: 'release',
	row: 'release',
	story: 'story',
	title: 'title',
};

/** Matches a full-string wikilink value: `[[target]]`, `[[target|alias]]`, `[[target#heading]]`. */
const WIKILINK_RE = /^\[\[([^[\]]+)\]\]$/;

/**
 * Parse a wikilink value into its target and display alias.
 * Returns `null` when the value is not a wikilink.
 *
 * Exported so the board parser can reuse the same wikilink grammar for
 * computing a link's display text (T008).
 */
export function parseWikilink(
	value: string,
): { target: string; alias: string } | null {
	const match = WIKILINK_RE.exec(value.trim());
	if (!match) {
		return null;
	}
	const inner = match[1];
	if (inner === undefined) {
		return null;
	}
	const pipeIndex = inner.indexOf('|');
	let target = pipeIndex >= 0 ? inner.slice(0, pipeIndex) : inner;
	const alias = pipeIndex >= 0 ? inner.slice(pipeIndex + 1) : '';
	// Strip heading / block references from the target note path.
	const hashIndex = target.indexOf('#');
	if (hashIndex >= 0) {
		target = target.slice(0, hashIndex);
	}
	target = target.trim();
	if (target.length === 0) {
		return null;
	}
	return { target, alias: alias.trim() };
}

/**
 * Case-insensitive lookup of a frontmatter value by field name.
 * Frontmatter keys are matched after trimming + lower-casing (FR-012).
 */
function getFrontmatterValue(
	frontmatter: Record<string, unknown>,
	key: string,
): unknown {
	for (const [rawKey, rawValue] of Object.entries(frontmatter)) {
		if (rawKey.trim().toLowerCase() === key) {
			return rawValue;
		}
	}
	return undefined;
}

/**
 * Normalize a raw frontmatter value into an {@link AttributeValue}.
 *
 * - Non-string / empty values → `null` (treated as missing).
 * - Wikilink values → `{ text, linkPath? }` where `linkPath` is set only
 *   when the target note actually exists (defensive: a broken wikilink
 *   value degrades to an inert label).
 * - Plain strings → `{ text }`.
 */
export function normalizeAttributeValue(
	app: App,
	raw: unknown,
	sourcePath: string,
): AttributeValue | null {
	if (typeof raw !== 'string') {
		// Numbers/booleans in frontmatter are coerced to their text form.
		if (typeof raw === 'number' || typeof raw === 'boolean') {
			return { text: String(raw) };
		}
		return null;
	}
	const trimmed = raw.trim();
	if (trimmed.length === 0) {
		return null;
	}
	const wikilink = parseWikilink(trimmed);
	if (wikilink !== null) {
		const dest = app.metadataCache.getFirstLinkpathDest(
			wikilink.target,
			sourcePath,
		);
		const value: AttributeValue = {
			text: wikilink.alias.length > 0 ? wikilink.alias : wikilink.target,
		};
		if (dest !== null) {
			value.linkPath = dest.path;
		}
		return value;
	}
	return { text: trimmed };
}

/**
 * Read and normalize all story attributes from a note's frontmatter.
 * Missing frontmatter (or missing fields) → `null` for that attribute,
 * which the grid model buckets into "Unassigned" (FR-011).
 */
export function readStoryAttributes(
	app: App,
	file: TFile,
): StoryAttributes {
	const result: StoryAttributes = {
		activity: null,
		task: null,
		epic: null,
		release: null,
	};
	const cache = app.metadataCache.getFileCache(file);
	const frontmatter = cache?.frontmatter;
	if (frontmatter === null || frontmatter === undefined) {
		return result;
	}
	for (const [rawKey, rawValue] of Object.entries(frontmatter)) {
		const canonical = FIELD_SYNONYMS[rawKey.trim().toLowerCase()];
		if (canonical === undefined) {
			// Unknown attributes are ignored (spec edge case).
			continue;
		}
		if (canonical === 'story' || canonical === 'title') {
			// Handled by the title cascade, not the grid axes.
			continue;
		}
		result[canonical] = normalizeAttributeValue(app, rawValue, file.path);
	}
	return result;
}

/**
 * Resolve the card title via the cascade (FR-009):
 * `Story` → `title` → first alias → file name without extension.
 */
export function resolveStoryTitle(
	app: App,
	file: TFile,
): string {
	const cache = app.metadataCache.getFileCache(file);
	const frontmatter = cache?.frontmatter;
	if (frontmatter !== null && frontmatter !== undefined) {
		// 1. `Story` attribute, 2. `title` attribute (first non-empty wins).
		for (const field of ['story', 'title'] as const) {
			const value = normalizeAttributeValue(
				app,
				getFrontmatterValue(frontmatter, field),
				file.path,
			);
			if (value !== null && value.text.length > 0) {
				return value.text;
			}
		}
		// 3. First alias from the frontmatter `aliases` list.
		const aliasesRaw = getFrontmatterValue(frontmatter, 'aliases');
		if (Array.isArray(aliasesRaw)) {
			for (const alias of aliasesRaw) {
				if (typeof alias === 'string' && alias.trim().length > 0) {
					return alias.trim();
				}
			}
		}
	}
	// 4. File name without extension.
	return file.basename;
}
