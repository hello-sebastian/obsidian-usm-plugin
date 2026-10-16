/**
 * Board view (T010) — dual-mode view for board notes (research R-01).
 *
 * Subclasses `TextFileView` with a custom view type (`usm-board-view`).
 * When the opened file is a board note (`usm-board: true`), the view
 * renders the visual map container instead of the raw Markdown source.
 * A pane header icon and command-palette commands toggle between the two
 * modes within the same leaf without ever modifying the file (FR-001,
 * FR-002, SC-004).
 *
 * The map is read-only (FR-015): the "markdown" mode renders the raw
 * source as inert text so the file content is never changed by the view.
 *
 * T019 adds event-driven live updates: `metadataCache.on('changed')` and
 * `vault.on('modify')` are filtered to the board file and its linked story
 * files, then debounced so a burst of edits triggers a single model rebuild
 * + re-render within 2 seconds (FR-013, SC-005; research R-03).
 *
 * T020 enforces read-only behavior: `save()` is a no-op so the view never
 * writes to the vault, and the map exposes no editing affordances (FR-015,
 * FR-017, SC-004).
 *
 * NOTE: The full 2D grid rendering is provided by T011
 * (`board-renderer.ts`); this view creates the map container and a
 * placeholder that T011 replaces.
 */
import {
	App,
	FileView,
	Plugin,
	TextFileView,
	TAbstractFile,
	TFile,
	WorkspaceLeaf,
	setIcon,
} from 'obsidian';
import { t } from '../i18n/en';
import { readBoardConfig, parseBoardEntries } from './board-parser';
import { buildGridModel } from './board-model';
import { BoardRenderer } from './board-renderer';
import { debounce, type DebouncedFn } from '../utils/debounce';
import type { GridModel } from '../types';

/** Custom view type for the board view (stable once released). */
export const BOARD_VIEW_TYPE = 'usm-board-view';

/** The two display modes of the board view. */
export type BoardViewMode = 'map' | 'markdown';

/**
 * Dual-mode view for board notes. See the module doc for the design.
 */
export class BoardView extends TextFileView {
	/** Current display mode. */
	mode: BoardViewMode = 'markdown';

	/** The map container element (present only in map mode). */
	private mapContainerEl: HTMLElement | null = null;

	/** The last built grid model (used by the renderer / debug panel). */
	private model: GridModel | null = null;

	/** The pane header toggle action element (for icon/title updates). */
	private toggleActionEl: HTMLElement | null = null;

	/**
	 * Debounced map refresh (T019, FR-013). Coalesces bursts of
	 * metadata/vault change events into a single model rebuild + re-render.
	 */
	private refreshDebounced: DebouncedFn<[]>;

	/**
	 * Paths of the notes that affect this map: the board file plus every
	 * linked story file (T019). Used to filter change events so edits to
	 * unrelated notes never trigger a re-render.
	 */
	private relevantPaths: Set<string> = new Set();

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		this.icon = 'layout-dashboard';
		this.refreshDebounced = debounce(() => this.refreshMap(), 250);
	}

	getViewType(): string {
		return BOARD_VIEW_TYPE;
	}

	getDisplayText(): string {
		return this.file?.basename ?? t('view.board');
	}

	// --- TextFileView abstract members (no real editor; data is inert) ---

	getViewData(): string {
		return this.data;
	}

	setViewData(data: string, clear: boolean): void {
		if (clear) {
			this.clear();
		}
		this.data = data;
	}

	clear(): void {
		this.data = '';
		this.model = null;
		this.relevantPaths = new Set();
		this.mapContainerEl?.empty();
		this.mapContainerEl = null;
	}

	/**
	 * Read-only enforcement (T020, FR-015, FR-017): the view never writes
	 * to the vault. `TextFileView.save()` would persist `this.data` back to
	 * the file, but the map is a read-only projection — all editing happens
	 * in the standard Markdown editor. Overriding `save()` as a no-op
	 * guarantees the board note and story notes are never modified by the
	 * plugin, so the board note remains a readable, bulleted list of links
	 * in standard Markdown even after the plugin is disabled.
	 */
	async save(_clear?: boolean): Promise<void> {
		// Intentionally empty — the view is read-only.
	}

	// --- Lifecycle ---

	protected async onOpen(): Promise<void> {
		await super.onOpen();
		this.registerToggleAction();
		this.registerLiveUpdateEvents();
	}

	protected async onClose(): Promise<void> {
		this.refreshDebounced.cancel();
		this.toggleActionEl = null;
		this.mapContainerEl = null;
		await super.onClose();
	}

	async onLoadFile(file: TFile): Promise<void> {
		await super.onLoadFile(file);
		this.applyModeForFile(file);
	}

	async onUnloadFile(_file: TFile): Promise<void> {
		this.resetToMarkdownMode();
		await super.onUnloadFile(_file);
	}

	async onRename(file: TFile): Promise<void> {
		await super.onRename(file);
		if (this.file === file) {
			this.applyModeForFile(file);
		}
	}

	// --- Board detection ---

	/**
	 * Whether a file is a board note (`usm-board: true`). Reads the board
	 * config from the metadata cache (research R-02).
	 */
	isBoardFile(file: TFile | null): boolean {
		if (file === null) {
			return false;
		}
		return readBoardConfig(this.app, file).isBoard;
	}

	/**
	 * Choose the display mode for a file: board notes open in map mode,
	 * everything else in markdown mode (the plugin does not interfere with
	 * non-board notes — spec US1 scenario 2).
	 */
	applyModeForFile(file: TFile): void {
		this.setMode(this.isBoardFile(file) ? 'map' : 'markdown');
	}

	// --- Mode control ---

	/**
	 * Set the display mode and re-render. Setting map mode on a non-board
	 * file is a no-op (defensive).
	 */
	setMode(mode: BoardViewMode): void {
		if (this.file === null) {
			return;
		}
		if (mode === 'map' && !this.isBoardFile(this.file)) {
			return;
		}
		this.mode = mode;
		this.render();
		this.updateToggleAction();
	}

	/** Toggle between map and markdown mode (pane header icon). */
	toggleMode(): void {
		if (this.file === null) {
			return;
		}
		if (this.mode === 'map') {
			this.setMode('markdown');
		} else if (this.isBoardFile(this.file)) {
			this.setMode('map');
		}
	}

	private resetToMarkdownMode(): void {
		this.mode = 'markdown';
		this.model = null;
		this.relevantPaths = new Set();
		this.mapContainerEl = null;
		this.render();
		this.updateToggleAction();
	}

	// --- Rendering ---

	private render(): void {
		if (this.file === null) {
			this.contentEl.empty();
			return;
		}
		if (this.mode === 'map') {
			this.renderMap();
		} else {
			this.renderMarkdown();
		}
	}

	/**
	 * Render the raw Markdown source as inert text (read-only, FR-015).
	 * The file content is never modified by the view (SC-004).
	 */
	private renderMarkdown(): void {
		this.contentEl.empty();
		this.mapContainerEl = null;
		this.contentEl.createEl('pre', {
			cls: 'usm-board-source',
			text: this.data,
		});
	}

	/**
	 * Render the visual map container. Builds the grid model from the
	 * metadata cache, creates the map scroll container, and renders the
	 * grid of story cards via {@link BoardRenderer} (T011).
	 */
	private renderMap(): void {
		const file = this.file;
		if (file === null) {
			return;
		}
		const config = readBoardConfig(this.app, file);
		const entries = parseBoardEntries(this.app, file);
		this.model = buildGridModel(config, entries);

		// Track the board file + every linked story file so live-update
		// events can be filtered to only the notes that affect this map
		// (T019, FR-013). Broken links have no targetPath and are skipped.
		this.relevantPaths = new Set([file.path]);
		for (const entry of entries) {
			if (entry.targetPath !== null) {
				this.relevantPaths.add(entry.targetPath);
			}
		}

		this.contentEl.empty();
		const container = this.contentEl.createDiv({ cls: 'usm-board-map' });
		this.mapContainerEl = container;

		// Read-only (T020, FR-015): suppress the native context menu on the
		// map so no mutation actions (cut/copy/paste, etc.) are offered.
		// The map is a navigation surface; editing happens in the standard
		// Markdown editor.
		container.addEventListener('contextmenu', (evt) => {
			evt.preventDefault();
		});

		// Wikilink attribute headers open their linked note (FR-007). The
		// source path is the board file so relative link targets resolve.
		const openLink = (linkPath: string): void => {
			if (this.file === null) {
				return;
			}
			void this.app.workspace.openLinkText(linkPath, this.file.path);
		};
		new BoardRenderer(container, openLink).render(this.model);
	}

	// --- Live updates (T019, FR-013, SC-005) ---

	/**
	 * Register the change events that drive live map updates (T019).
	 *
	 * `metadataCache.on('changed')` fires when a note's metadata is
	 * re-indexed (the primary signal); `vault.on('modify')` is a fallback
	 * for content changes. Both are filtered to the board file and its
	 * linked story files, then debounced so a burst of edits triggers a
	 * single model rebuild + re-render (research R-03, FR-013).
	 */
	private registerLiveUpdateEvents(): void {
		this.registerEvent(
			this.app.metadataCache.on('changed', (file) => {
				this.handleFileChange(file);
			}),
		);
		this.registerEvent(
			this.app.vault.on('modify', (file) => {
				this.handleFileChange(file);
			}),
		);
	}

	/**
	 * Handle a file change: if the changed note affects this map and the
	 * map is visible, schedule a debounced refresh (T019).
	 *
	 * `vault.on('modify')` passes a `TAbstractFile` (which may be a folder),
	 * so the parameter is widened to `TAbstractFile`; only the `path` is read.
	 */
	private handleFileChange(file: TAbstractFile): void {
		if (this.mode !== 'map') {
			return;
		}
		if (this.file === null) {
			return;
		}
		if (!this.relevantPaths.has(file.path)) {
			return;
		}
		this.refreshDebounced();
	}

	/**
	 * Rebuild the grid model from the metadata cache and re-render the map
	 * (T019). The model is rebuilt from scratch — cheap, in-memory only —
	 * and the DOM is re-rendered (research R-03).
	 */
	private refreshMap(): void {
		if (this.mode !== 'map') {
			return;
		}
		if (this.file === null) {
			return;
		}
		if (!this.isBoardFile(this.file)) {
			return;
		}
		this.renderMap();
	}

	// --- Pane header toggle ---

	private registerToggleAction(): void {
		this.toggleActionEl = this.addAction(
			this.toggleIcon(),
			this.toggleTooltip(),
			(_evt: MouseEvent) => {
				this.toggleMode();
			},
		);
		this.updateToggleAction();
	}

	private updateToggleAction(): void {
		if (this.toggleActionEl === null) {
			return;
		}
		// Update the icon and tooltip to reflect the mode we would switch to.
		const tooltip = this.toggleTooltip();
		this.toggleActionEl.setAttribute('aria-label', tooltip);
		this.toggleActionEl.title = tooltip;
		const iconContainer = this.toggleActionEl.querySelector(
			'.view-action-icon',
		);
		if (iconContainer instanceof HTMLElement) {
			setIcon(iconContainer, this.toggleIcon());
		}
	}

	/** Icon shown in the header: the mode we would switch TO. */
	private toggleIcon(): string {
		return this.mode === 'map' ? 'file-text' : 'layout-dashboard';
	}

	/** Tooltip for the header icon: the mode we would switch TO. */
	private toggleTooltip(): string {
		return this.mode === 'map'
			? t('view.tooltip.open-markdown')
			: t('view.tooltip.open-map');
	}

	/** The last built grid model (for the renderer / debug panel). */
	getModel(): GridModel | null {
		return this.model;
	}
}

/**
 * Find the active BoardView, if any (the most recent leaf's view).
 */
export function getActiveBoardView(app: App): BoardView | null {
	const leaf = app.workspace.getMostRecentLeaf();
	if (leaf === null) {
		return null;
	}
	const view = leaf.view;
	return view instanceof BoardView ? view : null;
}

/**
 * Register the command-palette commands that toggle the board view mode
 * (T010). Called from the plugin lifecycle (T012).
 */
export function registerBoardViewCommands(plugin: Plugin): void {
	plugin.addCommand({
		id: 'usm-open-as-map',
		name: t('command.open-as-map'),
		callback: () => {
			const view = getActiveBoardView(plugin.app);
			if (view !== null) {
				view.setMode('map');
			}
		},
	});
	plugin.addCommand({
		id: 'usm-open-as-markdown',
		name: t('command.open-as-markdown'),
		callback: () => {
			const view = getActiveBoardView(plugin.app);
			if (view !== null) {
				view.setMode('markdown');
			}
		},
	});
}

/**
 * Route board notes (`usm-board: true`) to the board view (T012).
 *
 * When a board note is opened in a non-board view (e.g., the standard
 * Markdown view), the leaf is re-routed to the board view so the note
 * displays as a visual map (US1 acceptance scenario 1). Non-board notes
 * are never touched (US1 acceptance scenario 2). The re-route preserves
 * the file and is idempotent: a file already in the board view is left
 * alone, so the map/markdown toggle (T010) is never overridden.
 */
export function registerBoardFileRouting(plugin: Plugin): void {
	const app = plugin.app;
	plugin.registerEvent(
		app.workspace.on('file-open', (file) => {
			if (file === null) {
				return;
			}
			if (!readBoardConfig(app, file).isBoard) {
				return;
			}
			const leaf = findLeafWithFile(app, file);
			if (leaf === null) {
				return;
			}
			if (leaf.view instanceof BoardView) {
				return;
			}
			const state = leaf.getViewState();
			void leaf.setViewState({
				type: BOARD_VIEW_TYPE,
				state: state.state,
			});
		}),
	);
}

/**
 * Find the leaf that currently has `file` open in a file-backed view
 * (Markdown or board). Returns `null` when no such leaf is found.
 */
function findLeafWithFile(app: App, file: TFile): WorkspaceLeaf | null {
	const leaves = [
		...app.workspace.getLeavesOfType('markdown'),
		...app.workspace.getLeavesOfType(BOARD_VIEW_TYPE),
	];
	for (const leaf of leaves) {
		const view = leaf.view;
		if (view instanceof FileView && view.file === file) {
			return leaf;
		}
	}
	return null;
}
