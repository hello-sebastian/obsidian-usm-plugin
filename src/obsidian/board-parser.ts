/**
 * Board file parsing (T008) per contracts/board-file-format.md.
 *
 * Reads the board note exclusively through `app.metadataCache`
 * (research R-02). The body is an ordered list of wikilinks; every
 * non-wikilink line is ignored (FR-003). Duplicates are preserved as
 * separate entries in order of appearance (FR-018). Broken links are
 * marked `isBroken: true` (FR-018 edge case).
 */
import { App, TFile, type LinkCache } from 'obsidian';
import type { BoardConfig, StoryEntry, StoryAttributes } from '../domain/types';
import {
	readStoryAttributes,
	resolveStoryTitle,
	parseWikilink,
} from './story-attributes';

/** Empty attribute set — used for broken links (no note to read). */
const EMPTY_ATTRIBUTES: StoryAttributes = {
	activity: null,
	task: null,
	epic: null,
	release: null,
};

/**
 * Read the board-level configuration from the board file frontmatter.
 *
 * - `usm-board` (boolean, case-insensitive) gates map rendering (FR-001).
 * - `usm-release-order` (`appearance` default / `alphabetical`); unknown
 *   values fall back to `appearance` (spec edge case).
 * - `usm-view` (`map` default / `edit` / `preview`); missing or
 *   unrecognized values fall back to `map` (FR-026, spec edge case).
 * Unknown attributes are ignored — they never cause an error.
 */
export function readBoardConfig(app: App, file: TFile): BoardConfig {
	const config: BoardConfig = {
		isBoard: false,
		releaseRowOrder: 'appearance',
		usmView: 'map',
	};
	const cache = app.metadataCache.getFileCache(file);
	const frontmatter = cache?.frontmatter;
	if (frontmatter === null || frontmatter === undefined) {
		return config;
	}
	for (const [rawKey, rawValue] of Object.entries(frontmatter)) {
		const key = rawKey.trim().toLowerCase();
		if (key === 'usm-board') {
			config.isBoard = rawValue === true || rawValue === 'true';
		} else if (key === 'usm-release-order') {
			if (typeof rawValue === 'string') {
				const order = rawValue.trim().toLowerCase();
				if (order === 'alphabetical') {
					config.releaseRowOrder = 'alphabetical';
				}
				// 'appearance' and any unknown value → default.
			}
		} else if (key === 'usm-view') {
			if (typeof rawValue === 'string') {
				const view = rawValue.trim().toLowerCase();
				if (view === 'map' || view === 'edit' || view === 'preview') {
					config.usmView = view;
				}
				// Any other value → default 'map' (FR-026 edge case).
			}
		}
		// All other attributes are ignored (spec edge case).
	}
	return config;
}

/**
 * Compute the display text of a wikilink: the alias when present
 * (`[[Note|alias]]` → `alias`), otherwise the note name with any
 * heading/block reference stripped.
 */
function wikilinkDisplayText(link: LinkCache): string {
	const parsed = parseWikilink(link.original);
	if (parsed !== null) {
		return parsed.alias.length > 0 ? parsed.alias : parsed.target;
	}
	// Fallback: strip heading/block from the resolved destination.
	const hashIndex = link.link.indexOf('#');
	const target = hashIndex >= 0 ? link.link.slice(0, hashIndex) : link.link;
	return target.trim();
}

/**
 * Parse the ordered list of story entries from a board file.
 *
 * Uses the metadata cache's `links` reference list (document order),
 * restricted to the body — links inside the frontmatter block are
 * excluded so config values never leak into the story list.
 */
export function parseBoardEntries(app: App, boardFile: TFile): StoryEntry[] {
	const cache = app.metadataCache.getFileCache(boardFile);
	if (cache === null || cache === undefined) {
		return [];
	}
	const links = cache.links ?? [];
	// Frontmatter occupies lines [0 .. frontmatterPosition.end.line];
	// only body links (after that range) are story references.
	const frontmatterEndLine = cache.frontmatterPosition?.end.line ?? -1;

	// Sort by document position to guarantee order of appearance.
	const ordered = [...links]
		.filter((link) => link.position.start.line > frontmatterEndLine)
		.sort(
			(a, b) =>
				a.position.start.line - b.position.start.line ||
				a.position.start.col - b.position.start.col,
		);

	const entries: StoryEntry[] = [];
	ordered.forEach((link, index) => {
		const dest = app.metadataCache.getFirstLinkpathDest(
			link.link,
			boardFile.path,
		);
		const id = `${boardFile.path}::${index}`;
		const linkText = wikilinkDisplayText(link);
		if (dest === null) {
			// Broken link → placeholder entry (FR-018 edge case).
			entries.push({
				id,
				targetPath: null,
				linkText,
				attributes: EMPTY_ATTRIBUTES,
				title: linkText,
				isBroken: true,
			});
			return;
		}
		entries.push({
			id,
			targetPath: dest.path,
			linkText,
			attributes: readStoryAttributes(app, dest),
			title: resolveStoryTitle(app, dest),
			isBroken: false,
		});
	});
	return entries;
}
