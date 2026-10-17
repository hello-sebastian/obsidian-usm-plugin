/**
 * Integration tests for the full data pipeline (T032, US5).
 *
 * Exercises the complete pipeline end to end — board file →
 * `readBoardConfig` + `parseBoardEntries` (which reads each story's
 * attributes via `readStoryAttributes` and resolves titles) →
 * `buildGridModel` — against the versioned fixtures (T028) and in-memory
 * notes:
 * - stories with missing attributes land in `UNASSIGNED` cells at the
 *   correct level — FR-011
 * - broken links produce `isBroken` entries with the correct grid position
 *   — FR-018 edge case
 * - stories with no frontmatter are fully unassigned — FR-011
 * - the resulting `GridModel` matches the expected structure (cell keys,
 *   order, unassigned flags) — SC-002, SC-003
 *
 * No Obsidian runtime is required: the fixture harness builds a mock
 * `metadataCache` from plain-Markdown notes (research R-02, R-13).
 */
import { describe, it, expect } from 'vitest';
import {
	readBoardConfig,
	parseBoardEntries,
} from '../../src/obsidian/board-parser';
import { buildGridModel } from '../../src/domain/board-model';
import {
	loadFixtureApp,
	buildAppFromContents,
	type FixtureApp,
} from '../helpers/fixture-app';
import { UNASSIGNED, cellKey } from '../../src/domain/types';
import type { BoardConfig, GridModel, StoryEntry } from '../../src/domain/types';

/**
 * Run the complete data pipeline for a board file:
 * config → entries (with per-story attributes + titles) → grid model.
 */
function runPipeline(fixture: FixtureApp, boardPath: string): {
	config: BoardConfig;
	entries: StoryEntry[];
	model: GridModel;
} {
	const boardFile = fixture.file(boardPath);
	const config = readBoardConfig(fixture.app, boardFile);
	const entries = parseBoardEntries(fixture.app, boardFile);
	const model = buildGridModel(config, entries);
	return { config, entries, model };
}

describe('pipeline — fixture board end to end (SC-002, SC-003)', () => {
	it('parses the board config from the fixture frontmatter (FR-001, FR-006)', () => {
		const { config } = runPipeline(loadFixtureApp(), 'board.md');
		expect(config).toEqual({ isBoard: true, releaseRowOrder: 'appearance' });
	});

	it('produces one entry per wikilink occurrence, in order (FR-003, FR-018)', () => {
		const { entries } = runPipeline(loadFixtureApp(), 'board.md');
		expect(entries).toHaveLength(8);
		expect(entries.map((e) => e.id)).toEqual([
			'board.md::0',
			'board.md::1',
			'board.md::2',
			'board.md::3',
			'board.md::4',
			'board.md::5',
			'board.md::6',
			'board.md::7',
		]);
	});

	it('resolves each story\'s attributes and title through the pipeline (FR-004, FR-009, FR-012)', () => {
		const { entries } = runPipeline(loadFixtureApp(), 'board.md');
		// S1 — complete story, English field names, wikilink epic value.
		expect(entries[0]?.attributes).toEqual({
			activity: { text: 'Onboarding' },
			task: { text: 'First run' },
			epic: { text: 'Onboarding flow' },
			release: { text: '1.0 MVP' },
		});
		expect(entries[0]?.title).toBe('Create first board');
		// S4 — Polish field names normalize onto the same canonical axes.
		expect(entries[3]?.attributes).toEqual({
			activity: { text: 'Logowanie' },
			task: { text: 'Login' },
			epic: { text: 'Auth' },
			release: { text: '2.0' },
		});
		expect(entries[3]?.title).toBe('Historia po polsku');
		// S3 — no frontmatter → all attributes null, title falls back to
		// the file name (FR-009 cascade, step 4).
		expect(entries[2]?.attributes).toEqual({
			activity: null,
			task: null,
			epic: null,
			release: null,
		});
		expect(entries[2]?.title).toBe('S3');
	});

	it('builds the expected GridModel structure (cell keys, order, flags)', () => {
		const { model } = runPipeline(loadFixtureApp(), 'board.md');

		// Column hierarchy in first-appearance order (FR-005).
		expect(model.activities.map((a) => a.activity)).toEqual([
			'Onboarding',
			UNASSIGNED,
			'Logowanie',
		]);
		expect(model.activities[0]?.tasks.map((t) => t.task)).toEqual([
			'First run',
		]);
		expect(model.activities[0]?.tasks[0]?.epics).toEqual([
			'Onboarding flow',
			UNASSIGNED,
		]);
		expect(model.activities[1]?.tasks.map((t) => t.task)).toEqual([
			UNASSIGNED,
			'first run',
		]);
		expect(model.activities[1]?.tasks[0]?.epics).toEqual([UNASSIGNED]);
		expect(model.activities[1]?.tasks[1]?.epics).toEqual(['Onboarding flow']);
		expect(model.activities[2]?.tasks.map((t) => t.task)).toEqual(['Login']);
		expect(model.activities[2]?.tasks[0]?.epics).toEqual(['Auth']);

		// Release rows in first-appearance order (FR-006).
		expect(model.releases).toEqual(['1.0 MVP', UNASSIGNED, '2.0']);

		// Every level has an "Unassigned" section (FR-011).
		expect(model.unassigned).toEqual({
			activity: true,
			task: true,
			epic: true,
			release: true,
		});

		// Exactly the six expected cells, holding all 8 entries.
		expect([...model.cells.keys()].sort()).toEqual(
			[
				cellKey('onboarding', 'first run', 'onboarding flow', '1.0 mvp'),
				cellKey('onboarding', 'first run', 'onboarding flow', UNASSIGNED),
				cellKey('onboarding', 'first run', UNASSIGNED, '1.0 mvp'),
				cellKey(UNASSIGNED, 'first run', 'onboarding flow', '2.0'),
				cellKey(UNASSIGNED, UNASSIGNED, UNASSIGNED, UNASSIGNED),
				cellKey('logowanie', 'login', 'auth', '2.0'),
			].sort(),
		);
		const total = [...model.cells.values()].reduce(
			(sum, bucket) => sum + bucket.length,
			0,
		);
		expect(total).toBe(8);

		// The fixture's wikilink attribute values ([[Onboarding flow]],
		// [[Auth]]) do not resolve to fixture notes → no clickable headers.
		expect(model.headerLinks.size).toBe(0);
	});

	it('keeps the duplicate S1 link as a separate entry in the same cell (FR-018)', () => {
		const { model, entries } = runPipeline(loadFixtureApp(), 'board.md');
		const cell = model.cells.get(
			cellKey('onboarding', 'first run', 'onboarding flow', '1.0 mvp'),
		);
		expect(cell).toHaveLength(2);
		expect(cell?.map((e) => e.id)).toEqual([
			entries[0]?.id,
			entries[6]?.id,
		]);
		expect(cell?.map((e) => e.linkText)).toEqual([
			'S1',
			'Create first board (duplicate)',
		]);
	});

	it('completes without error on a board full of incomplete data (SC-003)', () => {
		// The fixture board contains every edge case at once: missing
		// attributes at each level, no frontmatter, duplicates, and a
		// broken link. The pipeline must complete and place every entry.
		const { entries, model } = runPipeline(loadFixtureApp(), 'board.md');
		const placed = [...model.cells.values()].reduce(
			(sum, bucket) => sum + bucket.length,
			0,
		);
		expect(placed).toBe(entries.length);
	});
});

describe('pipeline — missing attributes land in UNASSIGNED cells (FR-011)', () => {
	it('places S2 (missing epic) in the UNASSIGNED epic cell only', () => {
		const { model, entries } = runPipeline(loadFixtureApp(), 'board.md');
		const s2 = entries[1];
		const cell = model.cells.get(
			cellKey('onboarding', 'first run', UNASSIGNED, '1.0 mvp'),
		);
		expect(cell).toHaveLength(1);
		expect(cell?.[0]?.id).toBe(s2?.id);
		// The other three levels are assigned.
		expect(s2?.attributes.activity?.text).toBe('Onboarding');
		expect(s2?.attributes.task?.text).toBe('First run');
		expect(s2?.attributes.epic).toBeNull();
		expect(s2?.attributes.release?.text).toBe('1.0 MVP');
	});

	it('places S5 (missing activity) in the UNASSIGNED activity group', () => {
		const { model, entries } = runPipeline(loadFixtureApp(), 'board.md');
		const s5 = entries[4];
		const cell = model.cells.get(
			cellKey(UNASSIGNED, 'first run', 'onboarding flow', '2.0'),
		);
		expect(cell).toHaveLength(1);
		expect(cell?.[0]?.id).toBe(s5?.id);
		expect(s5?.attributes.activity).toBeNull();
		// Task/epic still group case-insensitively with S1's values.
		expect(s5?.attributes.task?.text).toBe('first run');
		expect(s5?.attributes.epic?.text).toBe('Onboarding flow');
	});

	it('places S6 (missing release) in the UNASSIGNED row', () => {
		const { model, entries } = runPipeline(loadFixtureApp(), 'board.md');
		const s6 = entries[5];
		const cell = model.cells.get(
			cellKey('onboarding', 'first run', 'onboarding flow', UNASSIGNED),
		);
		expect(cell).toHaveLength(1);
		expect(cell?.[0]?.id).toBe(s6?.id);
		expect(s6?.attributes.release).toBeNull();
	});
});

describe('pipeline — broken links (FR-018 edge case)', () => {
	it('produces an isBroken entry with null target and no attributes', () => {
		const { entries } = runPipeline(loadFixtureApp(), 'board.md');
		const broken = entries[7];
		expect(broken?.isBroken).toBe(true);
		expect(broken?.targetPath).toBeNull();
		// The link text is kept as the placeholder card's title.
		expect(broken?.linkText).toBe('Missing story');
		expect(broken?.title).toBe('Missing story');
		expect(broken?.attributes).toEqual({
			activity: null,
			task: null,
			epic: null,
			release: null,
		});
	});

	it('places the broken link in the fully unassigned cell (correct grid position)', () => {
		const { model, entries } = runPipeline(loadFixtureApp(), 'board.md');
		const broken = entries[7];
		const cell = model.cells.get(
			cellKey(UNASSIGNED, UNASSIGNED, UNASSIGNED, UNASSIGNED),
		);
		expect(cell).toHaveLength(2);
		// S3 (no frontmatter) appears before the broken link in the board.
		expect(cell?.map((e) => e.id)).toEqual([entries[2]?.id, broken?.id]);
	});
});

describe('pipeline — no frontmatter (FR-011)', () => {
	it('treats S3 as fully unassigned at every level', () => {
		const { model, entries } = runPipeline(loadFixtureApp(), 'board.md');
		const s3 = entries[2];
		expect(s3?.isBroken).toBe(false);
		expect(s3?.targetPath).toBe('S3.md');
		expect(s3?.attributes).toEqual({
			activity: null,
			task: null,
			epic: null,
			release: null,
		});
		const cell = model.cells.get(
			cellKey(UNASSIGNED, UNASSIGNED, UNASSIGNED, UNASSIGNED),
		);
		expect(cell?.some((e) => e.id === s3?.id)).toBe(true);
	});
});

describe('pipeline — release row ordering through the full pipeline (FR-006)', () => {
	it('sorts rows alphabetically and pins Unassigned last', () => {
		const fixture = buildAppFromContents({
			'b.md': [
				'---',
				'usm-board: true',
				'usm-release-order: alphabetical',
				'---',
				'',
				'- [[A]]',
				'- [[B]]',
				'- [[C]]',
				'- [[D]]',
			].join('\n'),
			'A.md': '---\nrelease: "2.0"\n---\n',
			'B.md': '---\nrelease: "1.0 MVP"\n---\n',
			'C.md': 'No frontmatter at all.\n',
			'D.md': '---\nrelease: "1.5"\n---\n',
		});
		const { config, model } = runPipeline(fixture, 'b.md');
		expect(config.releaseRowOrder).toBe('alphabetical');
		// Appearance order would be: 2.0, 1.0 MVP, UNASSIGNED, 1.5.
		expect(model.releases).toEqual(['1.0 MVP', '1.5', '2.0', UNASSIGNED]);
	});
});

describe('pipeline — board file is the single source of truth (FR-003)', () => {
	it('excludes stories not linked from the board', () => {
		const fixture = buildAppFromContents({
			'b.md': '---\nusm-board: true\n---\n\n- [[A]]\n',
			'A.md': '---\nactivity: Alpha\n---\n',
			'B.md': '---\nactivity: Beta\n---\n',
		});
		const { entries, model } = runPipeline(fixture, 'b.md');
		expect(entries).toHaveLength(1);
		expect(entries[0]?.targetPath).toBe('A.md');
		expect(model.activities.map((a) => a.activity)).toEqual(['Alpha']);
	});
});
