/**
 * Base map renderer (T011).
 *
 * Renders a {@link GridModel} into the board view's map container: a
 * single scroll container (`overflow: auto` on both axes) holding a CSS
 * Grid with one card element per {@link StoryEntry} (research R-04,
 * FR-008). The base card shows the story title and an empty footer.
 *
 * Scope boundaries (later tasks extend this renderer):
 * - T013 adds the full 2D hierarchical grid (nested Activity → Task →
 *   Epic column headers, Release row headers, and cell placement).
 * - T014 renders attribute headers with wikilink support.
 * - T015/T016 replace the base card with the full story card (title
 *   cascade, Release badge, click-to-open, keyboard access).
 * - T017 adds sticky headers; T018 adds "Unassigned" sections and
 *   broken-link placeholders.
 *
 * All note-derived strings are inserted as text nodes (FR-016) — never
 * via `innerHTML` — so note content can never execute as markup.
 */
import type { GridModel, StoryEntry } from '../types';

/**
 * Renders a {@link GridModel} into a scroll container as a CSS Grid of
 * story cards.
 */
export class BoardRenderer {
	private readonly containerEl: HTMLElement;

	/** The current grid element (recreated on each render). */
	private gridEl: HTMLElement | null = null;

	/**
	 * @param containerEl The map scroll container (`.usm-board-map`),
	 *   which already has `overflow: auto` on both axes (research R-04).
	 */
	constructor(containerEl: HTMLElement) {
		this.containerEl = containerEl;
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
		for (const entry of this.collectEntries(model)) {
			this.renderCard(grid, entry);
		}
	}

	/**
	 * Flatten the model's cells into a list of story entries. Every
	 * {@link StoryEntry} (including duplicate occurrences, FR-018) is
	 * rendered as a separate card. Cells are populated in order of
	 * appearance (data-model.md E-06); the base grid groups cards by
	 * cell — the full 2D placement is provided by T013.
	 */
	private collectEntries(model: GridModel): StoryEntry[] {
		const entries: StoryEntry[] = [];
		for (const bucket of model.cells.values()) {
			for (const entry of bucket) {
				entries.push(entry);
			}
		}
		return entries;
	}

	/**
	 * Render a basic story card: title (text node) + empty footer.
	 * The full card (title cascade, Release badge, click-to-open) is
	 * provided by T015 (`story-card.ts`).
	 */
	private renderCard(grid: HTMLElement, entry: StoryEntry): void {
		const card = grid.createDiv({ cls: 'usm-story-card' });
		const header = card.createDiv({ cls: 'usm-story-card-header' });
		// Text-node insertion — the note-derived title can never run as
		// markup (FR-016).
		header.setText(entry.title);
		// Empty footer; T015 adds the Release badge here.
		card.createDiv({ cls: 'usm-story-card-footer' });
	}
}
