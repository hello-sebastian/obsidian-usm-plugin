/**
 * Map renderer (Iteration 2 — section-based layout, T003).
 *
 * Renders a {@link GridModel} into the board view's map container
 * (`.usm-board-map`, `overflow: auto` on both axes) as a section-based
 * layout (research R-17, R-18, R-19, R-22; data-model.md V-01):
 *
 * - a sticky column-header block (`.usm-board-header`) — a CSS Grid with
 *   three rows (Activity / Task / Epic). The row elements
 *   (`.usm-header-row--*`) are `display: contents` (styles.css), so the
 *   header cells are the grid items: Activity cells span their Task
 *   children's columns, Task cells span their Epic children's columns,
 *   Epic cells are leaf columns (FR-005);
 * - a vertical stack (`.usm-board-releases`) of release sections — one
 *   `section.usm-release` per release row, with the UNASSIGNED release row
 *   rendered FIRST (R-22). Each section has a horizontal
 *   `.usm-release-header` (release title, wikilink-capable per FR-007) and
 *   a `.usm-release-body > .usm-release-grid` holding one
 *   `.usm-epic-column > .usm-epic-column-cards` per Epic leaf column
 *   (FR-008, SC-002);
 * - every grid (the header block and all section grids) carries the
 *   identical inline `--usm-grid-cols` custom property
 *   (`repeat(N, var(--usm-col-w))`, N = number of Epic leaf columns), so
 *   columns align across the header and all sections by construction —
 *   no JS geometry (R-18).
 *
 * The previous single-grid layout (one `.usm-board-grid` with a sticky
 * left release column) is removed: the release header is no longer a
 * sticky column but a horizontal section header (US7, US8).
 *
 * Preserved from the MVP:
 * - text-node insertion for all note-derived strings (FR-016) — never
 *   via `innerHTML`, so note content can never execute as markup;
 * - wikilink header clickability (FR-007): a wikilink value makes the
 *   header a clickable, keyboard-accessible link that opens the linked
 *   note; a plain-text value renders as an inert visual label;
 * - "Unassigned" headers (FR-011): the UNASSIGNED sentinel gets the
 *   `usm-header-unassigned` class (dashed border, muted text) and renders
 *   as the i18n "Unassigned" label;
 * - broken-link placeholder cards (R-11) and story-card click-to-open
 *   (FR-019) via `story-card.ts`;
 * - read-only behavior (FR-015, FR-017): the renderer emits no editing
 *   affordances — the only interactive elements are the navigation
 *   affordances (clickable wikilink headers and story cards that open
 *   their note in the standard view).
 */
import type { GridModel, StoryEntry } from '../domain/types';
import { UNASSIGNED, cellKey, normalizeKey } from '../domain/types';
import { t } from './en';
import { createStoryCard } from './story-card';

/**
 * One leaf column of the grid: a single Epic under a Task under an
 * Activity, with the normalized keys used to look up `GridModel.cells`.
 */
interface EpicColumn {
	activityKey: string;
	taskKey: string;
	epicKey: string;
}

/** The four header levels that can carry a wikilink value (FR-007). */
type HeaderLevel = 'activity' | 'task' | 'epic' | 'release';

/**
 * Renders a {@link GridModel} into a scroll container as a section-based
 * layout (sticky column-header block + one grid per release section).
 */
export class BoardRenderer {
	private readonly containerEl: HTMLElement;

	/** Opens a note by its resolved path (provided by the view, FR-007). */
	private readonly openLink: (linkPath: string) => void;

	/**
	 * @param containerEl The map scroll container (`.usm-board-map`),
	 *   which already has `overflow: auto` on both axes (research R-04).
	 * @param openLink Callback that opens a note by its resolved path. Used
	 *   to make wikilink attribute headers clickable (FR-007). When omitted,
	 *   wikilink headers still render but are inert (no-op on activation).
	 */
	constructor(
		containerEl: HTMLElement,
		openLink?: (linkPath: string) => void,
	) {
		this.containerEl = containerEl;
		this.openLink = openLink ?? (() => {});
	}

	/**
	 * Render the grid model into the container, replacing any previous
	 * render. The model is rebuilt from scratch on every (debounced)
	 * update, so a full re-render is the expected path (research R-03).
	 */
	render(model: GridModel): void {
		this.containerEl.empty();
		if (model.activities.length === 0 || model.releases.length === 0) {
			return;
		}
		const board = this.containerEl.createDiv({ cls: 'usm-board' });
		const epicColumns = this.flattenEpicColumns(model);
		// The shared grid template (R-18): every grid (the header block and
		// all section grids) uses the identical column template so columns
		// align across the header and all sections by construction. The
		// fixed column width (--usm-col-w) is defined in styles.css so a
		// mobile media query can shrink it for small screens without
		// changing this geometry logic.
		const gridCols = `repeat(${epicColumns.length}, var(--usm-col-w))`;
		this.renderHeaderBlock(board, model, gridCols);
		this.renderReleaseSections(board, model, epicColumns, gridCols);
	}

	/**
	 * Build the sticky column-header block: a CSS Grid with three rows
	 * (Activity / Task / Epic). The row elements are `display: contents`
	 * (styles.css), so the header cells are the grid items and span their
	 * children's columns via `--usm-col` (FR-005).
	 */
	private renderHeaderBlock(
		board: HTMLElement,
		model: GridModel,
		gridCols: string,
	): void {
		const header = board.createDiv({ cls: 'usm-board-header' });
		header.setCssProps({ '--usm-grid-cols': gridCols });

		// Row 1: Activity cells span their Task children's Epic columns.
		const activityRow = header.createDiv({
			cls: 'usm-header-row--activity',
		});
		for (const activity of model.activities) {
			const span = activity.tasks.reduce(
				(sum, task) => sum + task.epics.length,
				0,
			);
			const cell = activityRow.createDiv({
				cls: 'usm-header-cell--activity',
			});
			cell.setCssProps({ '--usm-col': `span ${span}`, '--usm-row': '1' });
			this.renderHeaderContent(cell, 'activity', activity.activity, model);
		}

		// Row 2: Task cells span their Epic children's columns.
		const taskRow = header.createDiv({ cls: 'usm-header-row--task' });
		for (const activity of model.activities) {
			for (const task of activity.tasks) {
				const cell = taskRow.createDiv({ cls: 'usm-header-cell--task' });
				cell.setCssProps({
					'--usm-col': `span ${task.epics.length}`,
					'--usm-row': '2',
				});
				this.renderHeaderContent(cell, 'task', task.task, model);
			}
		}

		// Row 3: Epic cells are leaf columns (one column each).
		const epicRow = header.createDiv({ cls: 'usm-header-row--epic' });
		for (const activity of model.activities) {
			for (const task of activity.tasks) {
				for (const epic of task.epics) {
					const cell = epicRow.createDiv({ cls: 'usm-header-cell--epic' });
					cell.setCssProps({ '--usm-col': 'span 1', '--usm-row': '3' });
					this.renderHeaderContent(cell, 'epic', epic, model);
				}
			}
		}
	}

	/**
	 * Build the vertical stack of release sections (one per release row).
	 * The UNASSIGNED release row is rendered FIRST (R-22); the remaining
	 * rows keep their `GridModel` order (FR-006). Each section has a
	 * horizontal header and a grid of Epic leaf columns; a release row
	 * with no stories renders an empty grid without an error (defensive
	 * guarantee — the current domain model derives release rows from
	 * stories, so this is reachable only via a synthetic model).
	 */
	private renderReleaseSections(
		board: HTMLElement,
		model: GridModel,
		epicColumns: EpicColumn[],
		gridCols: string,
	): void {
		const releases = board.createDiv({ cls: 'usm-board-releases' });
		const orderedReleases = [
			...model.releases.filter((label) => label === UNASSIGNED),
			...model.releases.filter((label) => label !== UNASSIGNED),
		];

		for (const releaseLabel of orderedReleases) {
			const section = releases.createEl('section', { cls: 'usm-release' });
			this.renderReleaseHeader(section, releaseLabel, model);

			const body = section.createDiv({ cls: 'usm-release-body' });
			const grid = body.createDiv({ cls: 'usm-release-grid' });
			grid.setCssProps({ '--usm-grid-cols': gridCols });

			const releaseKey = normalizeKey(releaseLabel);
			epicColumns.forEach((epicColumn, columnIndex) => {
				const column = grid.createDiv({ cls: 'usm-epic-column' });
				column.setCssProps({ '--usm-col': `${columnIndex + 1}` });
				const cards = column.createDiv({ cls: 'usm-epic-column-cards' });
				const key = cellKey(
					epicColumn.activityKey,
					epicColumn.taskKey,
					epicColumn.epicKey,
					releaseKey,
				);
				const entries = model.cells.get(key);
				if (entries !== undefined) {
					for (const entry of entries) {
						this.renderCard(cards, entry);
					}
				}
			});
		}
	}

	/**
	 * Build a release section's horizontal header: the release title
	 * (text node, sanitized; wikilink-capable per FR-007).
	 */
	private renderReleaseHeader(
		section: HTMLElement,
		releaseLabel: string,
		model: GridModel,
	): void {
		const header = section.createDiv({ cls: 'usm-release-header' });
		const title = header.createDiv({ cls: 'usm-release-title' });
		this.renderHeaderContent(title, 'release', releaseLabel, model);
	}

	/**
	 * Flatten the Activity → Task → Epic hierarchy into the ordered list
	 * of leaf (Epic) columns, recovering each level's normalized key from
	 * its first-appearance label. Labels are unique per key within the
	 * model, and `normalizeKey` is idempotent on the UNASSIGNED sentinel,
	 * so the label → key mapping is exact (data-model.md E-06).
	 */
	private flattenEpicColumns(model: GridModel): EpicColumn[] {
		const columns: EpicColumn[] = [];
		for (const activity of model.activities) {
			const activityKey = normalizeKey(activity.activity);
			for (const task of activity.tasks) {
				const taskKey = normalizeKey(task.task);
				for (const epic of task.epics) {
					columns.push({
						activityKey,
						taskKey,
						epicKey: normalizeKey(epic),
					});
				}
			}
		}
		return columns;
	}

	/**
	 * Map a model label to its display text: the reserved UNASSIGNED
	 * sentinel renders as the i18n "Unassigned" label (FR-011); all other
	 * labels are shown verbatim (original first-appearance casing).
	 */
	private displayLabel(label: string): string {
		return label === UNASSIGNED ? t('unassigned') : label;
	}

	/**
	 * Fill a header element with its content (FR-007). When the value is a
	 * wikilink (a link path is recorded in `model.headerLinks`), the header
	 * becomes a clickable, keyboard-accessible link that opens the linked
	 * note. Otherwise it renders as an inert visual label.
	 *
	 * Used for the column-header cells (Activity / Task / Epic) and the
	 * release section titles. The element's grid placement (if any) is set
	 * by the caller; this only fills the content and, for wikilinks, wires
	 * up the interaction.
	 */
	private renderHeaderContent(
		headerEl: HTMLElement,
		level: HeaderLevel,
		label: string,
		model: GridModel,
	): void {
		const linkPath = model.headerLinks.get(
			`${level}:${normalizeKey(label)}`,
		);
		// "Unassigned" section header (FR-011): mark it so the stylesheet
		// can render a dedicated, visually distinct section (dashed border,
		// muted text). UNASSIGNED headers are always inert — the model never
		// records a link path for the sentinel.
		if (label === UNASSIGNED) {
			headerEl.addClass('usm-header-unassigned');
		}
		if (linkPath === undefined) {
			// Plain-text value → inert visual label.
			headerEl.setText(this.displayLabel(label));
			return;
		}
		// Wikilink value → clickable, keyboard-accessible link (FR-007).
		headerEl.addClass('usm-header-link');
		headerEl.setAttribute('role', 'button');
		headerEl.setAttribute('tabindex', '0');
		headerEl.setText(this.displayLabel(label));
		headerEl.addEventListener('click', () => {
			this.openLink(linkPath);
		});
		headerEl.addEventListener('keydown', (evt) => {
			if (evt.key === 'Enter' || evt.key === ' ') {
				evt.preventDefault();
				this.openLink(linkPath);
			}
		});
	}

	/**
	 * Render a story card via the `story-card.ts` component (T015, T016):
	 * clamped title, Release badge, click-to-open, keyboard access
	 * (FR-009, FR-010, FR-019). The card's open callback reuses the
	 * renderer's `openLink` so cards and wikilink headers open notes the
	 * same way.
	 */
	private renderCard(parent: HTMLElement, entry: StoryEntry): void {
		createStoryCard(parent, entry, this.openLink);
	}
}
