/**
 * Structural DOM tests for the Iteration 2 section-based layout (T002, TDD).
 *
 * These tests are written FIRST and MUST fail against the current
 * single-grid renderer (research R-17, R-18, R-19, R-22; data-model.md V-01).
 * They assert the structural guarantees that the refactored renderer must
 * emit — independent of pixel-level layout (which jsdom cannot compute and
 * which is covered by the manual quickstart scenarios, R-23):
 *
 * - the board is wrapped in `.usm-board-map > .usm-board` (the
 *   `width: max-content` inner wrapper, set in styles.css);
 * - a sticky column-header block (`.usm-board-header`) with exactly three
 *   rows (`.usm-header-row--activity`, `.usm-header-row--task`,
 *   `.usm-header-row--epic`);
 * - a vertical stack (`.usm-board-releases`) holding one
 *   `section.usm-release` per release row;
 * - each section has a horizontal `.usm-release-header` and a
 *   `.usm-release-body > .usm-release-grid`;
 * - every grid (the header block and all section grids) carries the
 *   identical inline `--usm-grid-cols` custom property
 *   (`repeat(N, var(--usm-col-w))`, N = number of Epic leaf columns), read
 *   via `el.style.getPropertyValue('--usm-grid-cols')` (reliable in jsdom;
 *   computed `grid-template-columns` is not observable — A-01);
 * - the UNASSIGNED release row renders as the FIRST `section.usm-release`
 *   (R-22);
 * - a release row with no stories renders an empty grid without an error
 *   (defensive case — tested with a synthetic GridModel, since the current
 *   domain model derives release rows from stories).
 *
 * The `obsidian` package is types-only (no runtime), so it is aliased to a
 * test-only stub (vitest.config.ts). The test runs in jsdom (dev-only) and
 * patches Obsidian's `HTMLElement` extensions onto the native prototype so
 * the real renderer code can build the DOM.
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import {
	readBoardConfig,
	parseBoardEntries,
} from '../../src/obsidian/board-parser';
import { buildGridModel } from '../../src/domain/board-model';
import { loadFixtureApp } from '../helpers/fixture-app';
import { patchHTMLElement } from '../helpers/dom-patch';
import { BoardRenderer } from '../../src/ui/board-renderer';
import { UNASSIGNED, cellKey } from '../../src/domain/types';
import type { GridModel, StoryEntry } from '../../src/domain/types';

beforeAll(() => {
	patchHTMLElement();
});

/** Build the GridModel for the versioned fixture board (SC-002, SC-003). */
function buildFixtureModel(): GridModel {
	const fixture = loadFixtureApp();
	const boardFile = fixture.file('board.md');
	const config = readBoardConfig(fixture.app, boardFile);
	const entries = parseBoardEntries(fixture.app, boardFile);
	return buildGridModel(config, entries);
}

/**
 * Render a model into a fresh `.usm-board-map` container (mirroring how
 * `board-view.ts` wires the renderer) and return the container.
 */
function renderModel(model: GridModel): HTMLElement {
	const container = document.createElement('div');
	container.className = 'usm-board-map';
	new BoardRenderer(container).render(model);
	return container;
}

/** Count the Epic leaf columns (the N in the shared grid template). */
function countEpicColumns(model: GridModel): number {
	return model.activities.reduce(
		(sum, activity) =>
			sum + activity.tasks.reduce((s, task) => s + task.epics.length, 0),
		0,
	);
}

describe('T002 — section-based DOM structure (R-17, R-18, R-19, R-22)', () => {
	it('emits a .usm-board-map > .usm-board wrapper', () => {
		const container = renderModel(buildFixtureModel());
		const board = container.querySelector('.usm-board');
		expect(board).not.toBeNull();
		expect(board?.parentElement).toBe(container);
	});

	it('emits a sticky column-header block with exactly three rows', () => {
		const container = renderModel(buildFixtureModel());
		const header = container.querySelector('.usm-board-header');
		expect(header).not.toBeNull();
		expect(
			header?.querySelector('.usm-header-row--activity'),
		).not.toBeNull();
		expect(header?.querySelector('.usm-header-row--task')).not.toBeNull();
		expect(header?.querySelector('.usm-header-row--epic')).not.toBeNull();
		const rows = header?.querySelectorAll(
			'.usm-header-row--activity, .usm-header-row--task, .usm-header-row--epic',
		);
		expect(rows?.length).toBe(3);
	});

	it('emits one section.usm-release per release row', () => {
		const model = buildFixtureModel();
		const container = renderModel(model);
		const sections = container.querySelectorAll('section.usm-release');
		expect(sections.length).toBe(model.releases.length);
	});

	it('gives each section a .usm-release-header and .usm-release-body > .usm-release-grid', () => {
		const container = renderModel(buildFixtureModel());
		const sections = container.querySelectorAll('section.usm-release');
		expect(sections.length).toBeGreaterThan(0);
		for (const section of Array.from(sections)) {
			expect(section.querySelector('.usm-release-header')).not.toBeNull();
			const body = section.querySelector('.usm-release-body');
			expect(body).not.toBeNull();
			expect(body?.querySelector('.usm-release-grid')).not.toBeNull();
		}
	});

	it('sets the identical --usm-grid-cols on every grid (header + all sections)', () => {
		const model = buildFixtureModel();
		const container = renderModel(model);
		const n = countEpicColumns(model);
		const expected = `repeat(${n}, var(--usm-col-w))`;
		const grids: (HTMLElement | null)[] = [
			container.querySelector<HTMLElement>('.usm-board-header'),
			...Array.from(
				container.querySelectorAll<HTMLElement>('.usm-release-grid'),
			),
		];
		// One header grid + one grid per release section.
		expect(grids.length).toBe(model.releases.length + 1);
		for (const grid of grids) {
			expect(grid).not.toBeNull();
			const value = grid?.style.getPropertyValue('--usm-grid-cols');
			expect(value).toBe(expected);
		}
	});

	it('renders the UNASSIGNED release row as the FIRST section', () => {
		const model = buildFixtureModel();
		// The fixture board has an UNASSIGNED release row (S3/S6).
		expect(model.releases).toContain(UNASSIGNED);
		const container = renderModel(model);
		const sections = Array.from(
			container.querySelectorAll('section.usm-release'),
		);
		const firstTitle =
			sections[0]?.querySelector('.usm-release-title')?.textContent;
		expect(firstTitle).toBe('Unassigned');
	});

	it('renders an empty grid for a release row with no stories (defensive)', () => {
		const entry: StoryEntry = {
			id: 'board.md::0',
			targetPath: 'S1.md',
			linkText: 'S1',
			attributes: {
				activity: { text: 'A1' },
				task: { text: 'T1' },
				epic: { text: 'E1' },
				release: { text: 'R1' },
			},
			title: 'Story 1',
			isBroken: false,
		};
		// Synthetic model: one Epic column, two release rows — 'R-empty' has
		// no stories (unreachable from the real domain model, which derives
		// release rows from stories; release mechanics are deferred).
		const model: GridModel = {
			activities: [
				{ activity: 'A1', tasks: [{ task: 'T1', epics: ['E1'] }] },
			],
			releases: ['R1', 'R-empty'],
			cells: new Map([[cellKey('a1', 't1', 'e1', 'r1'), [entry]]]),
			headerLinks: new Map(),
			unassigned: {
				activity: false,
				task: false,
				epic: false,
				release: false,
			},
		};
		// Rendering must not throw for the empty release row.
		const container = renderModel(model);
		const sections = Array.from(
			container.querySelectorAll('section.usm-release'),
		);
		expect(sections.length).toBe(2);
		// The 'R-empty' section (second) has a grid but no story cards.
		const emptySection = sections[1];
		const grid = emptySection?.querySelector<HTMLElement>('.usm-release-grid');
		expect(grid).not.toBeNull();
		expect(
			emptySection?.querySelectorAll('.usm-story-card').length,
		).toBe(0);
		// The empty grid still carries the shared template (alignment).
		expect(grid?.style.getPropertyValue('--usm-grid-cols')).toBe(
			'repeat(1, var(--usm-col-w))',
		);
	});
});

/**
 * Reserved DOM for future features (T012, TDD — FR-034, research R-21).
 *
 * These tests are written FIRST and MUST fail against the current renderer,
 * which emits no reserved elements. They assert the structural guarantees
 * that the refactored renderer must add (US10):
 *
 * - every `.usm-release-header` contains a `button.usm-release-toggle`
 *   (chevron) that is present, `aria-hidden="true"`, `tabindex="-1"`, has NO
 *   `aria-expanded` attribute, and produces no observable DOM change when
 *   clicked (inert — no collapse behavior in this iteration);
 * - story cards (`.usm-story-card`) and header cells
 *   (`.usm-header-cell--activity/--task/--epic`) contain a reserved DnD
 *   handle element (`.usm-dnd-handle`) that is present and inert;
 * - header cells and release headers contain reserved add/remove button
 *   slots (`.usm-add-remove-slot`) that are present and inert.
 *
 * "Inert" is asserted by snapshotting the affected element's `outerHTML`
 * before and after a synthetic interaction and requiring it to be unchanged
 * (no class/attribute mutation). The renderer is constructed without an
 * `openLink` callback, so any bubbled click is a no-op and cannot mutate the
 * DOM — isolating the reserved elements' own (non-existent) behavior.
 */
describe('T012 — reserved DOM for future features (FR-034, R-21)', () => {
	/** Snapshot an element's serialized markup to detect any DOM mutation. */
	const snapshot = (el: Element): string => el.outerHTML;

	it('every .usm-release-header contains an inert button.usm-release-toggle', () => {
		const container = renderModel(buildFixtureModel());
		const headers = container.querySelectorAll('.usm-release-header');
		expect(headers.length).toBeGreaterThan(0);
		for (const header of Array.from(headers)) {
			const toggle = header.querySelector<HTMLButtonElement>(
				'button.usm-release-toggle',
			);
			expect(toggle).not.toBeNull();
			expect(toggle?.getAttribute('aria-hidden')).toBe('true');
			expect(toggle?.getAttribute('tabindex')).toBe('-1');
			expect(toggle?.hasAttribute('aria-expanded')).toBe(false);
		}
	});

	it('clicking the release toggle produces no observable DOM change', () => {
		const container = renderModel(buildFixtureModel());
		const toggle = container.querySelector<HTMLButtonElement>(
			'button.usm-release-toggle',
		);
		expect(toggle).not.toBeNull();
		const header = toggle!.parentElement!;
		const before = snapshot(header);
		toggle!.click();
		expect(snapshot(header)).toBe(before);
	});

	it('story cards contain a reserved DnD handle', () => {
		const container = renderModel(buildFixtureModel());
		const cards = container.querySelectorAll('.usm-story-card');
		expect(cards.length).toBeGreaterThan(0);
		for (const card of Array.from(cards)) {
			expect(card.querySelector('.usm-dnd-handle')).not.toBeNull();
		}
	});

	it('header cells contain a reserved DnD handle', () => {
		const container = renderModel(buildFixtureModel());
		const cells = container.querySelectorAll(
			'.usm-header-cell--activity, .usm-header-cell--task, .usm-header-cell--epic',
		);
		expect(cells.length).toBeGreaterThan(0);
		for (const cell of Array.from(cells)) {
			expect(cell.querySelector('.usm-dnd-handle')).not.toBeNull();
		}
	});

	it('header cells and release headers contain reserved add/remove button slots', () => {
		const container = renderModel(buildFixtureModel());
		const cells = container.querySelectorAll(
			'.usm-header-cell--activity, .usm-header-cell--task, .usm-header-cell--epic',
		);
		expect(cells.length).toBeGreaterThan(0);
		for (const cell of Array.from(cells)) {
			expect(cell.querySelector('.usm-add-remove-slot')).not.toBeNull();
		}
		const headers = container.querySelectorAll('.usm-release-header');
		expect(headers.length).toBeGreaterThan(0);
		for (const header of Array.from(headers)) {
			expect(header.querySelector('.usm-add-remove-slot')).not.toBeNull();
		}
	});

	it('interacting with a reserved handle produces no observable DOM change', () => {
		const container = renderModel(buildFixtureModel());
		const card = container.querySelector('.usm-story-card');
		expect(card).not.toBeNull();
		const handle = card!.querySelector<HTMLElement>('.usm-dnd-handle');
		expect(handle).not.toBeNull();
		const before = snapshot(card!);
		handle!.click();
		handle!.dispatchEvent(
			new MouseEvent('mousedown', { bubbles: true }),
		);
		expect(snapshot(card!)).toBe(before);
	});
});
