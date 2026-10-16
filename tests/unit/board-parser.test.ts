/**
 * Unit tests for board file parsing (T029, US1).
 *
 * Covers `readBoardConfig` and `parseBoardEntries` from
 * `src/board/board-parser.ts` against the versioned fixtures (T028) and
 * in-memory notes:
 * - flag detection (`usm-board: true`, case-insensitive) — FR-001
 * - config attribute reading (`usm-release-order`) — FR-006
 * - wikilink extraction (ordered list, non-link lines ignored) — FR-003
 * - duplicate links preserved as separate entries — FR-018
 * - broken links marked `isBroken: true` — FR-018
 * - unknown config values fall back to defaults — spec edge case
 * - board config stored in the file header (self-describing) — FR-021
 */
import { describe, it, expect } from 'vitest';
import { readBoardConfig, parseBoardEntries } from '../../src/board/board-parser';
import { loadFixtureApp, buildAppFromContents } from '../helpers/fixture-app';

describe('readBoardConfig (T029)', () => {
	it('detects usm-board: true in the fixture board (FR-001)', () => {
		const { app, file } = loadFixtureApp();
		const config = readBoardConfig(app, file('board.md'));
		expect(config.isBoard).toBe(true);
	});

	it('detects the flag case-insensitively (FR-001)', () => {
		const { app, file } = buildAppFromContents({
			'b.md': '---\nUSM-Board: TRUE\n---\n\n- [[S1]]\n',
			'S1.md': 'story\n',
		});
		expect(readBoardConfig(app, file('b.md')).isBoard).toBe(true);
	});

	it('treats a missing flag as a non-board (FR-001)', () => {
		const { app, file } = buildAppFromContents({
			'b.md': '---\ntitle: notes\n---\n\n- [[S1]]\n',
			'S1.md': 'story\n',
		});
		expect(readBoardConfig(app, file('b.md')).isBoard).toBe(false);
	});

	it('treats usm-board: false as a non-board (FR-001)', () => {
		const { app, file } = buildAppFromContents({
			'b.md': '---\nusm-board: false\n---\n\n- [[S1]]\n',
			'S1.md': 'story\n',
		});
		expect(readBoardConfig(app, file('b.md')).isBoard).toBe(false);
	});

	it('reads usm-release-order: appearance from the fixture board (FR-006)', () => {
		const { app, file } = loadFixtureApp();
		const config = readBoardConfig(app, file('board.md'));
		expect(config.releaseRowOrder).toBe('appearance');
	});

	it('reads usm-release-order: alphabetical (FR-006)', () => {
		const { app, file } = buildAppFromContents({
			'b.md': '---\nusm-board: true\nusm-release-order: alphabetical\n---\n\n- [[S1]]\n',
			'S1.md': 'story\n',
		});
		expect(readBoardConfig(app, file('b.md')).releaseRowOrder).toBe(
			'alphabetical',
		);
	});

	it('falls back to appearance when usm-release-order is missing (FR-006)', () => {
		const { app, file } = buildAppFromContents({
			'b.md': '---\nusm-board: true\n---\n\n- [[S1]]\n',
			'S1.md': 'story\n',
		});
		expect(readBoardConfig(app, file('b.md')).releaseRowOrder).toBe(
			'appearance',
		);
	});

	it('falls back to appearance for unknown usm-release-order values (spec edge case)', () => {
		const { app, file } = buildAppFromContents({
			'b.md': '---\nusm-board: true\nusm-release-order: random\n---\n\n- [[S1]]\n',
			'S1.md': 'story\n',
		});
		expect(readBoardConfig(app, file('b.md')).releaseRowOrder).toBe(
			'appearance',
		);
	});

	it('ignores unknown frontmatter attributes without error (spec edge case)', () => {
		const { app, file } = buildAppFromContents({
			'b.md': '---\nusm-board: true\nsome-other-attr: hello\n---\n\n- [[S1]]\n',
			'S1.md': 'story\n',
		});
		const config = readBoardConfig(app, file('b.md'));
		expect(config).toEqual({ isBoard: true, releaseRowOrder: 'appearance' });
	});

	it('returns defaults for a file with no frontmatter (FR-021)', () => {
		const { app, file } = buildAppFromContents({
			'b.md': '- [[S1]]\n',
			'S1.md': 'story\n',
		});
		expect(readBoardConfig(app, file('b.md'))).toEqual({
			isBoard: false,
			releaseRowOrder: 'appearance',
		});
	});
});

describe('parseBoardEntries (T029)', () => {
	it('extracts the ordered wikilink list from the fixture board (FR-003)', () => {
		const { app, file } = loadFixtureApp();
		const entries = parseBoardEntries(app, file('board.md'));
		// 8 wikilinks in the fixture board body, in order of appearance.
		expect(entries).toHaveLength(8);
		expect(entries.map((e) => e.linkText)).toEqual([
			'S1',
			'S2',
			'S3',
			'S4',
			'S5',
			'S6',
			'Create first board (duplicate)',
			'Missing story',
		]);
	});

	it('ignores non-wikilink lines (headers, text, empty lines) (FR-003)', () => {
		const { app, file } = buildAppFromContents({
			'b.md': [
				'---',
				'usm-board: true',
				'---',
				'',
				'# A header line',
				'',
				'Just a paragraph of text.',
				'- [[S1]]',
				'plain line with no link',
				'- [[S2]]',
				'',
			].join('\n'),
			'S1.md': 'story one\n',
			'S2.md': 'story two\n',
		});
		const entries = parseBoardEntries(app, file('b.md'));
		expect(entries).toHaveLength(2);
		expect(entries.map((e) => e.linkText)).toEqual(['S1', 'S2']);
	});

	it('preserves duplicate links as separate entries in order (FR-018)', () => {
		const { app, file } = loadFixtureApp();
		const entries = parseBoardEntries(app, file('board.md'));
		const first = entries[0];
		const duplicate = entries[6];
		expect(first).toBeDefined();
		expect(duplicate).toBeDefined();
		// Both occurrences resolve to the same note…
		expect(first?.targetPath).toBe('S1.md');
		expect(duplicate?.targetPath).toBe('S1.md');
		// …but are distinct entries with distinct ids and link text.
		expect(duplicate?.id).not.toBe(first?.id);
		expect(duplicate?.linkText).toBe('Create first board (duplicate)');
		expect(first?.linkText).toBe('S1');
	});

	it('marks broken links with isBroken: true and null target (FR-018)', () => {
		const { app, file } = loadFixtureApp();
		const entries = parseBoardEntries(app, file('board.md'));
		const broken = entries[7];
		expect(broken).toBeDefined();
		expect(broken?.isBroken).toBe(true);
		expect(broken?.targetPath).toBeNull();
		// The link text is kept for the placeholder card.
		expect(broken?.linkText).toBe('Missing story');
		// Broken links carry no attributes (no note to read).
		expect(broken?.attributes).toEqual({
			activity: null,
			task: null,
			epic: null,
			release: null,
		});
	});

	it('resolves valid links to their target notes with attributes (FR-004)', () => {
		const { app, file } = loadFixtureApp();
		const entries = parseBoardEntries(app, file('board.md'));
		const s1 = entries[0];
		expect(s1).toBeDefined();
		expect(s1?.isBroken).toBe(false);
		expect(s1?.targetPath).toBe('S1.md');
		// S1 carries all four attributes (English names, wikilink epic).
		expect(s1?.attributes.activity?.text).toBe('Onboarding');
		expect(s1?.attributes.task?.text).toBe('First run');
		expect(s1?.attributes.epic?.text).toBe('Onboarding flow');
		expect(s1?.attributes.release?.text).toBe('1.0 MVP');
		// Title cascade: the `story` attribute wins.
		expect(s1?.title).toBe('Create first board');
	});

	it('returns an empty list for a board with no links (FR-003)', () => {
		const { app, file } = buildAppFromContents({
			'b.md': '---\nusm-board: true\n---\n\n# Empty board\n\nNo links here.\n',
		});
		expect(parseBoardEntries(app, file('b.md'))).toEqual([]);
	});

	it('returns an empty list when the file has no cache entry', () => {
		const { app } = buildAppFromContents({
			'b.md': '---\nusm-board: true\n---\n',
		});
		// A file the mock cache knows nothing about.
		const unknown = { path: 'unknown.md', basename: 'unknown' } as never;
		expect(parseBoardEntries(app, unknown)).toEqual([]);
	});

	it('excludes wikilinks inside the frontmatter from the story list (FR-021)', () => {
		const { app, file } = buildAppFromContents({
			'b.md': [
				'---',
				'usm-board: true',
				'note: "[[S2]] is not a story reference"',
				'---',
				'- [[S1]]',
			].join('\n'),
			'S1.md': 'story one\n',
			'S2.md': 'story two\n',
		});
		const entries = parseBoardEntries(app, file('b.md'));
		expect(entries).toHaveLength(1);
		expect(entries[0]?.targetPath).toBe('S1.md');
	});

	it('keeps heading references out of the resolved target (FR-003)', () => {
		const { app, file } = buildAppFromContents({
			'b.md': '---\nusm-board: true\n---\n\n- [[S1#Details]]\n',
			'S1.md': 'story\n\n## Details\n',
		});
		const entries = parseBoardEntries(app, file('b.md'));
		expect(entries).toHaveLength(1);
		expect(entries[0]?.targetPath).toBe('S1.md');
		expect(entries[0]?.isBroken).toBe(false);
	});
});
