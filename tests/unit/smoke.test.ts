/**
 * Test infrastructure smoke test (T027).
 *
 * This is NOT a feature test — it verifies that the Vitest harness runs,
 * that TypeScript source modules transform and resolve under the `node`
 * environment, and that the pure core modules behave as expected. The real
 * feature tests live in T029–T032.
 */
import { describe, it, expect } from 'vitest';
import { buildGridModel } from '../../src/domain/board-model';
import { UNASSIGNED, cellKey, normalizeKey } from '../../src/domain/types';
import type { BoardConfig, StoryEntry } from '../../src/domain/types';

const CONFIG: BoardConfig = { isBoard: true, releaseRowOrder: 'appearance', usmView: 'map' };

describe('test infrastructure smoke test (T027)', () => {
	it('resolves pure source modules under the node environment', () => {
		// normalizeKey lower-cases non-empty values and maps empty/null to UNASSIGNED.
		expect(normalizeKey('Login')).toBe('login');
		expect(normalizeKey('  ')).toBe(UNASSIGNED);
		expect(normalizeKey(null)).toBe(UNASSIGNED);
	});

	it('builds an empty grid model from no entries', () => {
		const model = buildGridModel(CONFIG, []);
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

	it('places a fully-unassigned story in the UNASSIGNED cell', () => {
		const entry: StoryEntry = {
			id: 'board.md::0',
			targetPath: 'S3.md',
			linkText: 'S3',
			attributes: { activity: null, task: null, epic: null, release: null },
			title: 'S3',
			isBroken: false,
		};
		const model = buildGridModel(CONFIG, [entry]);
		const key = cellKey(UNASSIGNED, UNASSIGNED, UNASSIGNED, UNASSIGNED);
		expect(model.cells.get(key)).toHaveLength(1);
		expect(model.unassigned).toEqual({
			activity: true,
			task: true,
			epic: true,
			release: true,
		});
	});
});
