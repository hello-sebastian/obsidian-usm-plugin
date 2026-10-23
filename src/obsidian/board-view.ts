/**
 * Board view (T045) — map-only FileView for board notes (research R-01, R-14).
 *
 * Subclasses `FileView` with a custom view type (`usm-board-view`). The view
 * renders ONLY the visual map — no plugin-provided text display (FR-025).
 * Text display and editing are always Obsidian's standard Markdown view
 * ("Edit MD" / "View MD"). The plugin provides no pane header icon and no
 * command-palette command for switching (FR-002); view switching uses
 * Obsidian's native "change view" picker, which presents exactly three
 * options for a board note: "USM board", "Edit MD", "View MD" (FR-027).
 *
 * The last-selected view is persisted as the `usm-view` frontmatter
 * attribute (`map` / `edit` / `preview`, default `map`) and restored when
 * the note is reopened (FR-026). See {@link writeUsmView} and
 * {@link registerBoardViewRouting}.
 *
 * Live updates (T019): `metadataCache.on('changed')` and `vault.on('modify')`
 * are filtered to the board file and its linked story files, then debounced
 * so a burst of edits triggers a single model rebuild + re-render within 2
 * seconds (FR-013, SC-005; research R-03).
 *
 * Read-only (T049): the map exposes no editing affordances; the only
 * board-file mutation is the `usm-view` attribute (FR-026, FR-028).
 */
import {
	App,
	FileView,
	MarkdownView,
	Plugin,
	TAbstractFile,
	TFile,
	WorkspaceLeaf,
} from 'obsidian';
import { t } from '../ui/en';
import { readBoardConfig, parseBoardEntries } from './board-parser';
import { buildGridModel } from '../domain/board-model';
import { BoardRenderer } from '../ui/board-renderer';
import { DebugPanel } from '../ui/debug-panel';
import { debounce, type DebouncedFn } from '../domain/debounce';
import type { GridModel } from '../domain/types';

/** Custom view type for the board view (stable once released). */
export const BOARD_VIEW_TYPE = 'usm-board-view';

/** The three view types (FR-026). */
export type UsmView = 'map' | 'edit' | 'preview';

/**
 * Dual-mode view for board notes. See the module doc for the design.
 */
export class BoardView extends FileView {
	/** The map container element (present only while the map is rendered). */
	private mapContainerEl: HTMLElement | null = null;

	/** The last built grid model (used by the renderer / debug panel). */
	private model: GridModel | null = null;

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

	/**
	 * Returns whether debug mode is enabled (T022). Injected by the plugin
	 * so the view reacts to the setting without a hard dependency on the
	 * settings module.
	 */
	private readonly getDebugMode: () => boolean;

	/** The debug metrics panel (present only while active, T022). */
	private debugPanel: DebugPanel | null = null;

	/** Duration of the last map render in ms (reported to the panel). */
	private lastRenderMs = 0;

	constructor(leaf: WorkspaceLeaf, getDebugMode: () => boolean) {
		super(leaf);
		this.icon = 'layout-dashboard';
		// The view can be opened without a file (e.g. an empty leaf); the
		// map simply renders nothing until a board note is opened.
		this.allowNoFile = true;
		this.getDebugMode = getDebugMode;
		this.refreshDebounced = debounce(() => this.refreshMap(), 250);
	}

	getViewType(): string {
		return BOARD_VIEW_TYPE;
	}

	/**
	 * The label shown in Obsidian's native "change view" picker (FR-027)
	 * and as the tab fallback.
	 */
	getDisplayText(): string {
		return t('view.board');
	}

	/**
	 * Whether this view can accept a file with the given extension.
	 * Board notes are Markdown files.
	 */
	canAcceptExtension(ext: string): boolean {
		return ext === 'md';
	}

	// --- FileView lifecycle ---

	onload(): void {
		super.onload();
		this.registerLiveUpdateEvents();
	}

	protected async onClose(): Promise<void> {
		this.refreshDebounced.cancel();
		this.debugPanel?.stop();
		this.debugPanel = null;
		this.mapContainerEl = null;
		this.model = null;
		this.relevantPaths = new Set();
		await super.onClose();
	}

	async onLoadFile(file: TFile): Promise<void> {
		await super.onLoadFile(file);
		this.render();
	}

	async onUnloadFile(_file: TFile): Promise<void> {
		this.cleanupRender();
		await super.onUnloadFile(_file);
	}

	async onRename(file: TFile): Promise<void> {
		await super.onRename(file);
		if (this.file === file) {
			this.render();
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

	// --- Rendering ---

	/**
	 * Render the view content. The view renders ONLY the visual map
	 * (FR-025). If the current file is not a board note, nothing is
	 * rendered (the user should switch to the standard Markdown view via
	 * the native picker).
	 */
	private render(): void {
		if (this.file === null) {
			this.contentEl.empty();
			return;
		}
		if (this.isBoardFile(this.file)) {
			this.renderMap();
		} else {
			this.cleanupRender();
		}
	}

	/**
	 * Clean up the renderer, debug panel, and model.
	 */
	private cleanupRender(): void {
		this.model = null;
		this.relevantPaths = new Set();
		this.mapContainerEl?.empty();
		this.mapContainerEl = null;
		this.debugPanel?.stop();
		this.debugPanel = null;
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
		// Measure the render duration for the debug panel (T022, FR-020).
		const renderStart = performance.now();
		new BoardRenderer(container, openLink).render(this.model);
		this.lastRenderMs = performance.now() - renderStart;
		this.syncDebugPanel();
	}

	/**
	 * Sync the debug metrics panel with the current state (T022, FR-020).
	 * The panel is shown only while debug mode is enabled AND the map is
	 * rendered; otherwise it is stopped and removed so there is no
	 * overhead when disabled (research R-07, quickstart Q7).
	 */
	private syncDebugPanel(): void {
		const shouldShow = this.mapContainerEl !== null && this.getDebugMode();
		if (shouldShow) {
			if (this.debugPanel === null) {
				this.debugPanel = new DebugPanel(this.containerEl, () =>
					this.contentEl.querySelectorAll('.usm-story-card').length,
				);
			}
			this.debugPanel.start();
			this.debugPanel.setRenderMs(this.lastRenderMs);
		} else if (this.debugPanel !== null) {
			this.debugPanel.stop();
			this.debugPanel = null;
		}
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
		if (this.mapContainerEl === null) {
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
		if (this.file === null) {
			return;
		}
		if (!this.isBoardFile(this.file)) {
			return;
		}
		this.renderMap();
	}

	/** The last built grid model (for the renderer / debug panel). */
	getModel(): GridModel | null {
		return this.model;
	}

	/**
	 * Re-sync the debug panel with the current `debugMode` setting (T022).
	 * Called when the setting changes so the panel appears/disappears
	 * immediately without waiting for the next render (quickstart Q7).
	 */
	refreshDebugPanel(): void {
		this.syncDebugPanel();
	}
}

/**
 * Re-sync the debug panel on every open board view (T022). Called by the
 * settings tab when `debugMode` changes so the metrics overlay appears or
 * disappears immediately (quickstart Q7).
 */
export function refreshBoardDebugPanels(app: App): void {
	for (const leaf of app.workspace.getLeavesOfType(BOARD_VIEW_TYPE)) {
		if (leaf.view instanceof BoardView) {
			leaf.view.refreshDebugPanel();
		}
	}
}

/**
 * Write the `usm-view` value to the board file frontmatter (T046, FR-026).
 *
 * Uses `vault.process()` for an atomic read-modify-write. Skips the write
 * when the new value equals the current frontmatter value (no-op writes
 * avoided, R-15). The write is the only frontmatter mutation the plugin
 * performs (FR-028).
 *
 * @param app - The Obsidian app.
 * @param file - The board file.
 * @param view - The view value to write.
 */
export async function writeUsmView(
	app: App,
	file: TFile,
	view: UsmView,
): Promise<void> {
	const config = readBoardConfig(app, file);
	if (config.usmView === view) {
		return; // No-op: the value is already correct.
	}
	await app.vault.process(file, (data) =>
		updateUsmViewInContent(data, view),
	);
}

/**
 * Update the `usm-view` value in the raw file content (T046).
 *
 * If the file has frontmatter, the `usm-view` line is updated (or added).
 * If the file has no frontmatter, a new frontmatter block is prepended.
 *
 * @param data - The raw file content.
 * @param view - The view value to write.
 * @returns The updated file content.
 */
function updateUsmViewInContent(data: string, view: UsmView): string {
	const viewLine = `usm-view: ${view}`;
	const fmMatch = data.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (fmMatch === null) {
		// No frontmatter: prepend a new block.
		return `---\n${viewLine}\n---\n${data}`;
	}
	const lines = (fmMatch[1] ?? '').split(/\r?\n/);
	let replaced = false;
	for (let i = 0; i < lines.length; i += 1) {
		if (/^\s*usm-view\s*:/i.test(lines[i] ?? '')) {
			lines[i] = viewLine;
			replaced = true;
			break;
		}
	}
	if (!replaced) {
		lines.unshift(viewLine);
	}
	const newFm = `---\n${lines.join('\n')}\n---`;
	return data.replace(fmMatch[0], newFm);
}

/**
 * Register the file-open handler that restores and persists the
 * `usm-view` for board notes (T047, FR-026, FR-027).
 *
 * On each activation of a board note:
 * (a) read `usm-view` from the frontmatter;
 * (b) if the value is `map` (or missing/unrecognized) and the active leaf
 *     is not already the custom view, switch the leaf to the
 *     `usm-board-view`; if the value is `edit`/`preview`, ensure the native
 *     `MarkdownView` is in the corresponding mode (source/preview);
 * (c) detect the currently-active view and, when it differs from the
 *     frontmatter value, call the `usm-view` write (T046).
 *
 * Called from the plugin lifecycle (T048).
 */
export function registerBoardViewRouting(plugin: Plugin): void {
	const app = plugin.app;
	plugin.registerEvent(
		app.workspace.on('file-open', (file) => {
			if (file === null) {
				return;
			}
			const config = readBoardConfig(app, file);
			if (!config.isBoard) {
				return;
			}
			const desiredView = config.usmView;
			const leaf = findLeafWithFile(app, file);
			if (leaf === null) {
				return;
			}
			const currentView = detectCurrentView(leaf.view);

			// If the current view matches the frontmatter, do nothing.
			if (currentView === desiredView) {
				return;
			}

			// A fresh open always lands in the default Markdown source view
			// ('edit'). When the frontmatter records a different view (or the
			// current view is unknown), this is the "open" case: restore the
			// last-selected view (step b). A user switch to the default 'edit'
			// view is indistinguishable from a fresh open and is treated as a
			// fresh open — a documented limitation of the event-based
			// detection (research R-16).
			if (currentView === 'edit' || currentView === null) {
				restoreView(leaf, file, desiredView);
				return;
			}

			// Otherwise, the user switched to a non-default view (map/preview)
			// (step c). Persist the current view.
			void writeUsmView(app, file, currentView);
		}),
	);
}

/**
 * Detect the current view type for a leaf (T047).
 *
 * @param view - The view in the leaf.
 * @returns The view type ('map', 'edit', or 'preview'), or null if unknown.
 */
function detectCurrentView(view: unknown): UsmView | null {
	if (view instanceof BoardView) {
		return 'map';
	}
	if (view instanceof MarkdownView) {
		return view.getMode() === 'source' ? 'edit' : 'preview';
	}
	return null;
}

/**
 * Restore the view for a board note (T047, step b).
 *
 * Sets the leaf's view state to the desired view. For `map`, the leaf is
 * switched to the custom board view; for `edit`/`preview`, the leaf is
 * switched to the native Markdown view in the corresponding mode
 * (source/preview). Using `setViewState` (rather than a command) keeps the
 * code fully typed and works regardless of the leaf's current view.
 *
 * @param leaf - The workspace leaf.
 * @param file - The board file.
 * @param view - The view to restore.
 */
function restoreView(leaf: WorkspaceLeaf, file: TFile, view: UsmView): void {
	if (view === 'map') {
		void leaf.setViewState({
			type: BOARD_VIEW_TYPE,
			state: { file: file.path },
		});
	} else {
		const mode = view === 'edit' ? 'source' : 'preview';
		void leaf.setViewState({
			type: 'markdown',
			state: { file: file.path, mode },
		});
	}
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
