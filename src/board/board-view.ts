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
 * NOTE: The full 2D grid rendering is provided by T011
 * (`board-renderer.ts`); this view creates the map container and a
 * placeholder that T011 replaces.
 */
import {
	App,
	Plugin,
	TextFileView,
	TFile,
	WorkspaceLeaf,
	setIcon,
} from 'obsidian';
import { t } from '../i18n/en';
import { readBoardConfig, parseBoardEntries } from './board-parser';
import { buildGridModel } from './board-model';
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

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		this.icon = 'layout-dashboard';
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
		this.mapContainerEl?.empty();
		this.mapContainerEl = null;
	}

	// --- Lifecycle ---

	protected async onOpen(): Promise<void> {
		await super.onOpen();
		this.registerToggleAction();
	}

	protected async onClose(): Promise<void> {
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
	 * metadata cache and creates the map container. The full 2D grid is
	 * rendered by T011 (`board-renderer.ts`); until then a placeholder
	 * (story count) is shown.
	 */
	private renderMap(): void {
		const file = this.file;
		if (file === null) {
			return;
		}
		const config = readBoardConfig(this.app, file);
		const entries = parseBoardEntries(this.app, file);
		this.model = buildGridModel(config, entries);

		this.contentEl.empty();
		const container = this.contentEl.createDiv({ cls: 'usm-board-map' });
		this.mapContainerEl = container;

		// Placeholder until T011 (board-renderer.ts) provides the full grid.
		const heading = container.createDiv({ cls: 'usm-board-map-heading' });
		heading.setText(
			`${t('view.board')} — ${entries.length} ${t('debug.stories').toLowerCase()}`,
		);
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
