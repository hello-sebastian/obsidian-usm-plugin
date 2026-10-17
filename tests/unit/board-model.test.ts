/**
 * Unit tests for grid model building (T030, US2).
 *
 * Covers `buildGridModel` from `src/domain/board-model.ts` against
 * in-memory story entries and the versioned fixtures (T028):
 * - column hierarchy (Activity → Task → Epic) in order of first appearance — FR-005
 * - row order (appearance and alphabetical) — FR-006
 * - `UNASSIGNED` key placement for missing attributes — FR-011
 * - case-insensitive value grouping (`Login` and `login` → same column) — spec edge case
 * - `cells` map key format and population — data-model.md E-06
 * - `unassigned` per-level flags — data-model.md E-06
 */
import { describe, it, expect } from 'vitest';
import { buildGridModel } from '../../src/domain/board-model';
import {
	readBoardConfig,
	parseBoardEntries,
} from '../../src/obsidian/board-parser';
import { loadFixtureApp } from '../helpers/fixture-app';
import { UNASSIGNED, cellKey } from '../../src/domain/types';
import type {
	BoardConfig,
	StoryAttributes,
	StoryEntry,
} from '../../src/domain/types';

const APPEARANCE: BoardConfig = {
	isBoard: true,
	releaseRowOrder: 'appearance',
};
const ALPHABETICAL: BoardConfig = {
	isBoard: true,
	releaseRowOrder: 'alphabetical',
};

/** Build a story entry with sensible defaults (all attributes missing). */
function entry(id: string, overrides: Partial<StoryEntry> = {}): StoryEntry {
	return {
		id,
		targetPath: null,
		linkText: id,
		attributes: { activity: null, task: null, epic: null, release: null },
		title: id,
		isBroken: false,
		...overrides,
	};
}

/** Build a partial attribute set (missing fields stay `null`). */
function attrs(partial: Partial<StoryAttributes>): StoryAttributes {
	return {
		activity: null,
		task: null,
		epic: null,
		release: null,
		...partial,
	};
}

describe('buildGridModel — column hierarchy (FR-005)', () => {
	it('orders activities by first appearance', () => {
		const model = buildGridModel(APPEARANCE, [
			entry('e1', { attributes: attrs({ activity: { text: 'A2' } }) }),
			entry('e2', { attributes: attrs({ activity: { text: 'A1' } }) }),
			entry('e3', { attributes: attrs({ activity: { text: 'A2' } }) }),
		]);
		expect(model.activities.map((a) => a.activity)).toEqual(['A2', 'A1']);
	});

	it('orders tasks by first appearance within each activity', () => {
		const model = buildGridModel(APPEARANCE, [
			entry('e1', {
				attributes: attrs({
					activity: { text: 'A' },
					task: { text: 'T2' },
				}),
			}),
			entry('e2', {
				attributes: attrs({
					activity: { text: 'A' },
					task: { text: 'T1' },
				}),
			}),
			entry('e3', {
				attributes: attrs({
					activity: { text: 'B' },
					task: { text: 'T1' },
				}),
			}),
		]);
		expect(model.activities[0]?.tasks.map((t) => t.task)).toEqual([
			'T2',
			'T1',
		]);
		expect(model.activities[1]?.tasks.map((t) => t.task)).toEqual(['T1']);
	});

	it('orders epics by first appearance within each task', () => {
		const model = buildGridModel(APPEARANCE, [
			entry('e1', {
				attributes: attrs({
					activity: { text: 'A' },
					task: { text: 'T' },
					epic: { text: 'E2' },
				}),
			}),
			entry('e2', {
				attributes: attrs({
					activity: { text: 'A' },
					task: { text: 'T' },
					epic: { text: 'E1' },
				}),
			}),
		]);
		expect(model.activities[0]?.tasks[0]?.epics).toEqual(['E2', 'E1']);
	});

	it('keeps the original casing of the first occurrence as the label', () => {
		const model = buildGridModel(APPEARANCE, [
			entry('e1', { attributes: attrs({ activity: { text: 'Login' } }) }),
			entry('e2', { attributes: attrs({ activity: { text: 'login' } }) }),
		]);
		expect(model.activities).toHaveLength(1);
		expect(model.activities[0]?.activity).toBe('Login');
	});
});

describe('buildGridModel — release rows (FR-006)', () => {
	it('orders rows by first appearance by default', () => {
		const model = buildGridModel(APPEARANCE, [
			entry('e1', { attributes: attrs({ release: { text: 'R2' } }) }),
			entry('e2', { attributes: attrs({ release: { text: 'R1' } }) }),
			entry('e3', { attributes: attrs({ release: { text: 'R2' } }) }),
		]);
		expect(model.releases).toEqual(['R2', 'R1']);
	});

	it('sorts rows alphabetically when configured', () => {
		const model = buildGridModel(ALPHABETICAL, [
			entry('e1', { attributes: attrs({ release: { text: 'R2' } }) }),
			entry('e2', { attributes: attrs({ release: { text: 'R1' } }) }),
			entry('e3', { attributes: attrs({ release: { text: 'R3' } }) }),
		]);
		expect(model.releases).toEqual(['R1', 'R2', 'R3']);
	});

	it('sorts alphabetically case-insensitively', () => {
		const model = buildGridModel(ALPHABETICAL, [
			entry('e1', { attributes: attrs({ release: { text: 'beta' } }) }),
			entry('e2', { attributes: attrs({ release: { text: 'Alpha' } }) }),
		]);
		expect(model.releases).toEqual(['Alpha', 'beta']);
	});

	it('pins the Unassigned row to the end in alphabetical order', () => {
		const model = buildGridModel(ALPHABETICAL, [
			entry('e1', { attributes: attrs({ release: { text: 'B' } }) }),
			entry('e2'),
			entry('e3', { attributes: attrs({ release: { text: 'A' } }) }),
		]);
		expect(model.releases).toEqual(['A', 'B', UNASSIGNED]);
	});

	it('keeps appearance order (including Unassigned) in appearance mode', () => {
		const model = buildGridModel(APPEARANCE, [
			entry('e1'),
			entry('e2', { attributes: attrs({ release: { text: 'B' } }) }),
		]);
		expect(model.releases).toEqual([UNASSIGNED, 'B']);
	});
});

describe('buildGridModel — UNASSIGNED placement (FR-011)', () => {
	it('maps a fully missing attribute set to UNASSIGNED at every level', () => {
		const model = buildGridModel(APPEARANCE, [entry('e1')]);
		expect(model.activities[0]?.activity).toBe(UNASSIGNED);
		expect(model.activities[0]?.tasks[0]?.task).toBe(UNASSIGNED);
		expect(model.activities[0]?.tasks[0]?.epics).toEqual([UNASSIGNED]);
		expect(model.releases).toEqual([UNASSIGNED]);
		expect(model.cells.get(cellKey(UNASSIGNED, UNASSIGNED, UNASSIGNED, UNASSIGNED)))
			?.toHaveLength(1);
	});

	it('treats empty-string attribute values as missing', () => {
		const model = buildGridModel(APPEARANCE, [
			entry('e1', {
				attributes: attrs({ activity: { text: '   ' } }),
			}),
		]);
		expect(model.activities[0]?.activity).toBe(UNASSIGNED);
		expect(model.unassigned.activity).toBe(true);
	});

	it('sets the unassigned flag per level', () => {
		const model = buildGridModel(APPEARANCE, [
			// Missing activity only.
			entry('e1', {
				attributes: attrs({
					task: { text: 'T' },
					epic: { text: 'E' },
					release: { text: 'R' },
				}),
			}),
			// Missing release only.
			entry('e2', {
				attributes: attrs({
					activity: { text: 'A' },
					task: { text: 'T' },
					epic: { text: 'E' },
				}),
			}),
		]);
		expect(model.unassigned).toEqual({
			activity: true,
			task: false,
			epic: false,
			release: true,
		});
	});

	it('leaves all unassigned flags false when every attribute is present', () => {
		const model = buildGridModel(APPEARANCE, [
			entry('e1', {
				attributes: attrs({
					activity: { text: 'A' },
					task: { text: 'T' },
					epic: { text: 'E' },
					release: { text: 'R' },
				}),
			}),
		]);
		expect(model.unassigned).toEqual({
			activity: false,
			task: false,
			epic: false,
			release: false,
		});
	});
});

describe('buildGridModel — case-insensitive grouping (spec edge case)', () => {
	it('groups Login and login into a single activity column', () => {
		const model = buildGridModel(APPEARANCE, [
			entry('e1', { attributes: attrs({ activity: { text: 'Login' } }) }),
			entry('e2', { attributes: attrs({ activity: { text: 'login' } }) }),
		]);
		expect(model.activities).toHaveLength(1);
		// Both entries land in the same (normalized) cell key.
		const key = cellKey(
			'login',
			UNASSIGNED,
			UNASSIGNED,
			UNASSIGNED,
		);
		expect(model.cells.get(key)).toHaveLength(2);
	});

	it('groups case variants at the task and epic levels', () => {
		const model = buildGridModel(APPEARANCE, [
			entry('e1', {
				attributes: attrs({
					activity: { text: 'A' },
					task: { text: 'First Run' },
					epic: { text: 'Epic A' },
				}),
			}),
			entry('e2', {
				attributes: attrs({
					activity: { text: 'A' },
					task: { text: 'first run' },
					epic: { text: 'epic a' },
				}),
			}),
		]);
		expect(model.activities[0]?.tasks).toHaveLength(1);
		expect(model.activities[0]?.tasks[0]?.epics).toHaveLength(1);
	});

	it('groups case- and whitespace-variant release values into one row', () => {
		const model = buildGridModel(APPEARANCE, [
			entry('e1', { attributes: attrs({ release: { text: '2.0' } }) }),
			entry('e2', { attributes: attrs({ release: { text: ' 2.0 ' } }) }),
		]);
		expect(model.releases).toEqual(['2.0']);
	});
});

describe('buildGridModel — cells map (data-model.md E-06)', () => {
	it('uses the ${activity}::${task}::${epic}::${release} key format with normalized keys', () => {
		const model = buildGridModel(APPEARANCE, [
			entry('e1', {
				attributes: attrs({
					activity: { text: 'Act' },
					task: { text: 'Task' },
					epic: { text: 'Epic' },
					release: { text: 'Rel' },
				}),
			}),
		]);
		expect(model.cells.size).toBe(1);
		expect([...model.cells.keys()]).toEqual([
			cellKey('act', 'task', 'epic', 'rel'),
		]);
	});

	it('preserves entries in order of appearance within a cell', () => {
		const attributes = attrs({
			activity: { text: 'A' },
			task: { text: 'T' },
			epic: { text: 'E' },
			release: { text: 'R' },
		});
		const model = buildGridModel(APPEARANCE, [
			entry('e1', { attributes }),
			entry('e2', { attributes }),
			entry('e3', { attributes }),
		]);
		const bucket = model.cells.get(cellKey('a', 't', 'e', 'r'));
		expect(bucket?.map((e) => e.id)).toEqual(['e1', 'e2', 'e3']);
	});

	it('keeps duplicate entries as separate cards in the same cell', () => {
		const attributes = attrs({
			activity: { text: 'A' },
			task: { text: 'T' },
			epic: { text: 'E' },
			release: { text: 'R' },
		});
		const model = buildGridModel(APPEARANCE, [
			entry('dup-1', { attributes }),
			entry('dup-2', { attributes }),
		]);
		const bucket = model.cells.get(cellKey('a', 't', 'e', 'r'));
		expect(bucket).toHaveLength(2);
		expect(bucket?.[0]?.id).toBe('dup-1');
		expect(bucket?.[1]?.id).toBe('dup-2');
	});

	it('places entries differing in one attribute into different cells', () => {
		const model = buildGridModel(APPEARANCE, [
			entry('e1', {
				attributes: attrs({
					activity: { text: 'A' },
					task: { text: 'T' },
					epic: { text: 'E' },
					release: { text: 'R1' },
				}),
			}),
			entry('e2', {
				attributes: attrs({
					activity: { text: 'A' },
					task: { text: 'T' },
					epic: { text: 'E' },
					release: { text: 'R2' },
				}),
			}),
		]);
		expect(model.cells.size).toBe(2);
		expect(model.cells.has(cellKey('a', 't', 'e', 'r1'))).toBe(true);
		expect(model.cells.has(cellKey('a', 't', 'e', 'r2'))).toBe(true);
	});

	it('returns an empty model for an empty entry list', () => {
		const model = buildGridModel(APPEARANCE, []);
		expect(model.activities).toEqual([]);
		expect(model.releases).toEqual([]);
		expect(model.cells.size).toBe(0);
		expect(model.unassigned).toEqual({
			activity: false,
			task: false,
			epic: false,
			release: false,
		});
	});
});

describe('buildGridModel — fixture board (T028)', () => {
	it('builds the expected grid from the fixture board (SC-002)', () => {
		const { app, file } = loadFixtureApp();
		const config = readBoardConfig(app, file('board.md'));
		const entries = parseBoardEntries(app, file('board.md'));
		const model = buildGridModel(config, entries);

		// Activities in first-appearance order: S1 (Onboarding), S3 (missing),
		// S4 (Logowanie).
		expect(model.activities.map((a) => a.activity)).toEqual([
			'Onboarding',
			UNASSIGNED,
			'Logowanie',
		]);

		// Onboarding → single task "First run" (S1, S2, S5, S6 group
		// case-insensitively) with epics in first-appearance order:
		// "Onboarding flow" (S1) then UNASSIGNED (S2).
		const onboarding = model.activities[0];
		expect(onboarding?.tasks.map((t) => t.task)).toEqual(['First run']);
		expect(onboarding?.tasks[0]?.epics).toEqual(['Onboarding flow', UNASSIGNED]);

		// The Unassigned activity group holds S3 + the broken link (fully
		// unassigned) and S5 (missing activity, but task/epic present).
		const unassignedGroup = model.activities[1];
		expect(unassignedGroup?.tasks.map((t) => t.task)).toEqual([
			UNASSIGNED,
			'first run',
		]);
		expect(unassignedGroup?.tasks[0]?.epics).toEqual([UNASSIGNED]);
		expect(unassignedGroup?.tasks[1]?.epics).toEqual(['Onboarding flow']);

		// Logowanie → task "Login" → epic "Auth" (Polish field names, S4).
		const logowanie = model.activities[2];
		expect(logowanie?.tasks.map((t) => t.task)).toEqual(['Login']);
		expect(logowanie?.tasks[0]?.epics).toEqual(['Auth']);

		// Release rows in first-appearance order: "1.0 MVP" (S1), UNASSIGNED
		// (S3, which appears before S4's "2.0"), "2.0" (S4).
		expect(model.releases).toEqual(['1.0 MVP', UNASSIGNED, '2.0']);

		// Every level has at least one unassigned story.
		expect(model.unassigned).toEqual({
			activity: true,
			task: true,
			epic: true,
			release: true,
		});

		// Cell population: 8 entries across 6 cells.
		expect(model.cells.size).toBe(6);
		const total = [...model.cells.values()].reduce(
			(sum, bucket) => sum + bucket.length,
			0,
		);
		expect(total).toBe(8);

		// S1 + its duplicate share one cell (FR-018).
		const s1Cell = model.cells.get(
			cellKey('onboarding', 'first run', 'onboarding flow', '1.0 mvp'),
		);
		expect(s1Cell).toHaveLength(2);
		expect(s1Cell?.map((e) => e.linkText)).toEqual([
			'S1',
			'Create first board (duplicate)',
		]);

		// S2: missing epic → UNASSIGNED epic under Onboarding / First run.
		expect(
			model.cells.get(
				cellKey('onboarding', 'first run', UNASSIGNED, '1.0 mvp'),
			),
		)?.toHaveLength(1);

		// S3 (no frontmatter) + the broken link share the fully unassigned cell.
		const fullyUnassigned = model.cells.get(
			cellKey(UNASSIGNED, UNASSIGNED, UNASSIGNED, UNASSIGNED),
		);
		expect(fullyUnassigned).toHaveLength(2);
		expect(fullyUnassigned?.some((e) => e.isBroken)).toBe(true);

		// S4: Polish attributes resolve to their own column group.
		expect(
			model.cells.get(cellKey('logowanie', 'login', 'auth', '2.0')),
		)?.toHaveLength(1);

		// S5: missing activity → UNASSIGNED group, but the task/epic values
		// still group case-insensitively with S1's.
		expect(
			model.cells.get(
				cellKey(UNASSIGNED, 'first run', 'onboarding flow', '2.0'),
			),
		)?.toHaveLength(1);

		// S6: missing release → UNASSIGNED row, activity groups with S1's.
		expect(
			model.cells.get(
				cellKey('onboarding', 'first run', 'onboarding flow', UNASSIGNED),
			),
		)?.toHaveLength(1);
	});
});
