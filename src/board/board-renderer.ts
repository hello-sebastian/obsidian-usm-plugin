/**
 * Map renderer (T011, extended by T013, T014, T016).
 *
 * Renders a {@link GridModel} into the board view's map container: a
 * single scroll container (`overflow: auto` on both axes) holding a CSS
 * Grid (research R-04, FR-008).
 *
 * T013 provides the full 2D hierarchical grid:
 * - nested column headers — Activity (spanning its Task sub-columns),
 *   Task (spanning its Epic columns), Epic (one column each) — in
 *   first-appearance order (FR-005);
 * - one row per Release, ordered per `releaseRowOrder` (FR-006);
 * - each story card placed in the cell at the intersection of its Epic
 *   column and Release row, resolved via the `GridModel.cells` keys
 *   (FR-008, SC-002).
 *
 * T014 renders attribute headers with wikilink support: a wikilink value
 * makes the header a clickable, keyboard-accessible link that opens the
 * linked note; a plain-text value renders as an inert visual label (FR-007).
 *
 * T016 replaces the base card with the full story card from
 * `story-card.ts` (T015): clamped title, Release badge, click-to-open,
 * keyboard access (FR-009, FR-010, FR-019).
 *
 * Scope boundaries (later tasks extend this renderer):
 * - T017 adds sticky headers; T018 adds "Unassigned" sections and
 *   broken-link placeholders.
 *
 * All note-derived strings are inserted as text nodes (FR-016) — never
 * via `innerHTML` — so note content can never execute as markup.
 */
import type { GridModel, StoryEntry } from '../types';
import { UNASSIGNED, cellKey, normalizeKey } from '../types';
import { t } from '../i18n/en';
import { createStoryCard } from '../story/story-card';

/**
 * One leaf column of the grid: a single Epic under a Task under an
 * Activity, with the normalized keys used to look up `GridModel.cells`.
 */
interface EpicColumn {
	activityKey: string;
	taskKey: string;
	epicKey: string;
}

/** 1-based CSS grid row of the first Release row (after 3 header rows). */
const FIRST_RELEASE_ROW = 4;

/** The four header levels that can carry a wikilink value (FR-007). */
type HeaderLevel = 'activity' | 'task' | 'epic' | 'release';

/**
 * Renders a {@link GridModel} into a scroll container as a CSS Grid of
 * story cards.
 */
export class BoardRenderer {
	private readonly containerEl: HTMLElement;

	/** Opens a note by its resolved path (provided by the view, FR-007). */
	private readonly openLink: (linkPath: string) => void;

	/** The current grid element (recreated on each render). */
	private gridEl: HTMLElement | null = null;

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
		const grid = this.containerEl.createDiv({ cls: 'usm-board-grid' });
		this.gridEl = grid;
		if (model.activities.length === 0 || model.releases.length === 0) {
			return;
		}
		this.renderGrid(model, grid);
	}

	/**
	 * Build the 2D grid: three header rows (Activity / Task / Epic), a
	 * row-header column, one column per Epic, and one row per Release.
	 *
	 * The grid is dynamic (column/row counts depend on the model), so the
	 * layout is driven by CSS custom properties set per element
	 * (`--usm-col` / `--usm-row` / `--usm-grid-cols` / `--usm-grid-rows`);
	 * the stylesheet in `styles.css` maps them onto the grid properties
	 * (research R-04: CSS Grid, no manual geometry).
	 */
	private renderGrid(model: GridModel, grid: HTMLElement): void {
		const epicColumns = this.flattenEpicColumns(model);
		grid.setCssProps({
			'--usm-grid-cols': `minmax(140px, auto) repeat(${epicColumns.length}, minmax(160px, 1fr))`,
			'--usm-grid-rows': `repeat(3, auto) repeat(${model.releases.length}, auto)`,
		});

		// Corner cell spanning the three header rows (T017 pins it).
		grid.createDiv({ cls: 'usm-grid-corner' });

		// Column headers: Activity → Task → Epic (FR-005).
		let column = 2;
		for (const activity of model.activities) {
			const activitySpan = activity.tasks.reduce(
				(sum, task) => sum + task.epics.length,
				0,
			);
			const activityHeader = grid.createDiv({
				cls: 'usm-grid-activity-header',
			});
			activityHeader.setCssProps({
				'--usm-col': `${column} / span ${activitySpan}`,
				'--usm-row': '1',
			});
			this.renderHeader(activityHeader, 'activity', activity.activity, model);

			for (const task of activity.tasks) {
				const taskHeader = grid.createDiv({ cls: 'usm-grid-task-header' });
				taskHeader.setCssProps({
					'--usm-col': `${column} / span ${task.epics.length}`,
					'--usm-row': '2',
				});
				this.renderHeader(taskHeader, 'task', task.task, model);

				for (const epic of task.epics) {
					const epicHeader = grid.createDiv({
						cls: 'usm-grid-epic-header',
					});
					epicHeader.setCssProps({
						'--usm-col': `${column}`,
						'--usm-row': '3',
					});
					this.renderHeader(epicHeader, 'epic', epic, model);
					column += 1;
				}
			}
		}

		// Release row headers + cells (FR-006, FR-008).
		model.releases.forEach((releaseLabel, rowIndex) => {
			const releaseKey = normalizeKey(releaseLabel);
			const row = FIRST_RELEASE_ROW + rowIndex;

			const releaseHeader = grid.createDiv({
				cls: 'usm-grid-release-header',
			});
			releaseHeader.setCssProps({
				'--usm-col': '1',
				'--usm-row': `${row}`,
			});
			this.renderHeader(releaseHeader, 'release', releaseLabel, model);

			epicColumns.forEach((epicColumn, columnIndex) => {
				const cell = grid.createDiv({ cls: 'usm-grid-cell' });
				cell.setCssProps({
					'--usm-col': `${columnIndex + 2}`,
					'--usm-row': `${row}`,
				});
				const key = cellKey(
					epicColumn.activityKey,
					epicColumn.taskKey,
					epicColumn.epicKey,
					releaseKey,
				);
				const entries = model.cells.get(key);
				if (entries !== undefined) {
					for (const entry of entries) {
						this.renderCard(cell, entry);
					}
				}
			});
		});
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
	 * Fill a header cell with its content (FR-007). When the value is a
	 * wikilink (a link path is recorded in `model.headerLinks`), the header
	 * becomes a clickable, keyboard-accessible link that opens the linked
	 * note. Otherwise it renders as an inert visual label.
	 *
	 * The header element is the grid item (its `--usm-col` / `--usm-row`
	 * placement is already set by the caller); this only fills its content
	 * and, for wikilinks, wires up the interaction.
	 */
	private renderHeader(
		headerEl: HTMLElement,
		level: HeaderLevel,
		label: string,
		model: GridModel,
	): void {
		const linkPath = model.headerLinks.get(
			`${level}:${normalizeKey(label)}`,
		);
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
