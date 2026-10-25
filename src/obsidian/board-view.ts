/**
 * Board view (T045) — map-only FileView for board notes (research R-01, R-14).
 *
 * Subclasses `FileView` with a custom view type (`usm-board-view`). The view
 * renders ONLY the visual map — no plugin-provided text display (FR-025).
 * Text display and editing are always Obsidian's standard Markdown view
 * ("Edit MD" / "View MD"). View switching is offered through a dedicated
 * pane-header view-switch button (a distinct icon, not "…") that presents
 * the three options "USM board", "Edit MD", and "View MD" (FR-027, amended);
 * the button is available in all three view states. No command-palette
 * command is provided (FR-002, amended). See {@link ensureViewSwitchAction}.
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
	Menu,
	Plugin,
	TAbstractFile,
	TFile,
	WorkspaceLeaf,
	type IconName,
} from 'obsidian';
import { t } from '../ui/en';
import {
	readBoardConfig,
	parseBoardEntries,
	parseBoardConfigFromContent,
} from './board-parser';
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
 * The dedicated view-switch button icon (FR-027, amended). A distinct icon
 * (not "…") so the pane header's "…" remains the native context menu.
 */
const VIEW_SWITCH_ICON: IconName = 'columns-2';

/**
 * Bounded retry for first-open routing (defect 1). On every fresh open the
 * leaf may not be ready for `setViewState` when `file-open` fires, so the
 * routing retries a bounded number of times until the view settles.
 */
const ROUTE_MAX_ATTEMPTS = 5;
const ROUTE_RETRY_DELAY_MS = 50;

/**
 * Tracks `MarkdownView` instances that already have the dedicated
 * view-switch button (FR-027, amended), so repeated `file-open` events do
 * not add a duplicate action. The set is marked synchronously (before the
 * deferred `addAction`) so concurrent events cannot schedule duplicate adds.
 */
const markdownViewsWithSwitchAction = new WeakSet<MarkdownView>();

/**
 * Maps each `MarkdownView` to the `HTMLElement` returned by
 * `view.addAction(...)` for the dedicated view-switch button (FR-027,
 * amended). Provides the handle needed to remove the button when the view
 * later shows a non-board note (Defect 5). Present only while the button is
 * actually added (the add is deferred behind an async board check).
 */
const markdownViewSwitchActionEls = new WeakMap<MarkdownView, HTMLElement>();

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

	/**
	 * The dedicated view-switch button element (FR-027, amended). Present
	 * once per view instance; null until {@link ensureViewSwitchAction}
	 * adds it.
	 */
	private viewSwitchActionEl: HTMLElement | null = null;

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
	 * The tab / breadcrumb label. Returns the file name when a file is
	 * loaded so the tab stays consistent with the file list and
	 * breadcrumbs (a constant "USM board" label previously overrode the
	 * file name). Falls back to the view label when no file is loaded.
	 */
	getDisplayText(): string {
		return this.file !== null ? this.file.basename : t('view.board');
	}

	/**
	 * Whether this view can accept a file with the given extension.
	 *
	 * Returns `false` for every extension (Defect 1). The board view must
	 * NOT claim `.md` files for leaf reuse: doing so made Obsidian reuse the
	 * board leaf when opening a regular `.md` note, which left an empty panel
	 * (the board view renders nothing for non-board files). Board notes are
	 * routed into the board view by the `file-open` handler
	 * (`handleBoardFileOpen` → `restoreView` → `setViewState`), which works
	 * regardless of `canAcceptExtension`.
	 */
	canAcceptExtension(_ext: string): boolean {
		return false;
	}

	/**
	 * Ensure the dedicated view-switch button is present in the pane
	 * header (FR-027, amended). The button is added once per view instance
	 * (guarded by {@link viewSwitchActionEl}); it opens a menu with the
	 * three view options, the current one checked. "…" remains the native
	 * context menu.
	 */
	private ensureViewSwitchAction(): void {
		if (this.viewSwitchActionEl !== null) {
			return;
		}
		this.viewSwitchActionEl = this.addAction(
			VIEW_SWITCH_ICON,
			t('view.switch'),
			(evt) => {
				const file = this.file;
				if (file === null) {
					return;
				}
				showViewSwitchMenu(evt, this.currentView(), (view) =>
					this.switchView(file, view),
				);
			},
		);
	}

	/**
	 * The current view for this leaf (FR-027). Used to mark the active
	 * option in the view-switch menu.
	 */
	private currentView(): UsmView {
		return detectCurrentView(this) ?? 'map';
	}

	/**
	 * Switch this leaf to the given view and persist the choice (FR-026).
	 * Used by the dedicated view-switch button (see
	 * {@link ensureViewSwitchAction}).
	 */
	private switchView(file: TFile, view: UsmView): void {
		restoreView(this.leaf, file, view);
		void writeUsmView(this.app, file, view);
	}

	// --- FileView lifecycle ---

	onload(): void {
		super.onload();
		this.registerLiveUpdateEvents();
		this.ensureViewSwitchAction();
	}

	protected async onClose(): Promise<void> {
		this.refreshDebounced.cancel();
		this.debugPanel?.stop();
		this.debugPanel = null;
		this.mapContainerEl = null;
		this.model = null;
		this.relevantPaths = new Set();
		this.viewSwitchActionEl = null;
		await super.onClose();
	}

	async onLoadFile(file: TFile): Promise<void> {
		await super.onLoadFile(file);
		// The view-switch button is added in onload; re-ensure it here as a
		// safety net in case the action was added before the view finished
		// loading (FR-027, amended).
		this.ensureViewSwitchAction();
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
			// Ensure the dedicated view-switch button is present in the
			// active view (FR-027, amended): the plugin's own board view
			// adds it in onload; the native Markdown view needs it added
			// here (the plugin cannot extend its pane menu).
			ensureViewSwitchActionForLeaf(app, file);
			void handleBoardFileOpen(app, file);
		}),
	);
	// Iteration 3: `file-open` fires only when the active file changes.
	// A view-type switch (board → Markdown) for the same file does NOT
	// fire `file-open`, so the button is never added to the new
	// MarkdownView. `active-leaf-change` fires on every active-leaf
	// change, including view-type switches (confirmed by bundle analysis
	// of Obsidian 1.14.5: `setViewState` → `requestActiveLeafEvents()` →
	// `trigger("active-leaf-change", leaf)`), so we use it to ensure the
	// button is present after a switch. The handler does NOT call
	// `handleBoardFileOpen` (the routing logic is already handled by the
	// `file-open` listener; calling it here would cause unwanted view
	// switches on tab re-activation).
	plugin.registerEvent(
		app.workspace.on('active-leaf-change', (leaf) => {
			if (leaf === null) {
				return;
			}
			const view = leaf.view;
			if (view instanceof FileView) {
				const file = view.file;
				if (file !== null) {
					ensureViewSwitchActionForLeaf(app, file);
					// Defect 4: sync the native source/preview toggle
					// visibility (hidden for board notes, restored for
					// non-board notes). Defect 5: also removes the plugin's
					// view-switch button when the current file is non-board.
					if (view instanceof MarkdownView) {
						void syncNativeModeToggle(app, view, file);
					}
				}
			}
		}),
	);
}

/**
 * Route a board file on open (T047). Reads the board config from the
 * metadata cache; when the cache has not indexed the frontmatter yet
 * (first-open race), falls back to a direct vault read so a board note is
 * routed to the map view even before the cache is warm (Bug 1). Then
 * restores the last-selected view or persists the current one, per the
 * restore-vs-persist logic.
 *
 * The routing is tolerant of the leaf not being ready (defect 1): on every
 * fresh open Obsidian fires `file-open` while the new leaf's view is still
 * initializing, so a single `setViewState` can be dropped. The routing
 * therefore retries a bounded number of times (see
 * {@link scheduleRouteRetry}) until the view settles.
 *
 * @param app - The Obsidian app.
 * @param file - The board file.
 */
export async function handleBoardFileOpen(
	app: App,
	file: TFile,
): Promise<void> {
	await routeBoardFileOpen(app, file, 1);
}

/**
 * One routing attempt for a board file (defect 1). Returns `true` when the
 * routing is complete (the view matches the frontmatter, or the file is not
 * a board note) and `false` when the leaf is not ready yet and a retry
 * should be scheduled.
 */
async function routeBoardFileOpen(
	app: App,
	file: TFile,
	attempt: number,
): Promise<boolean> {
	let config = readBoardConfig(app, file);
	if (!config.isBoard) {
		// The metadata cache may not have indexed the frontmatter yet on
		// the first open. Fall back to a direct vault read so a board note
		// is routed correctly even before the cache is warm.
		const data = await app.vault.read(file);
		config = parseBoardConfigFromContent(data);
		if (!config.isBoard) {
			return true; // Not a board note — nothing to route.
		}
	}
	const desiredView = config.usmView;
	const leaf = findLeafWithFile(app, file);
	if (leaf === null) {
		// The leaf is not registered yet (fresh open). Retry until the
		// bounded budget is exhausted.
		return scheduleRouteRetry(app, file, desiredView, attempt);
	}
	const currentView = detectCurrentView(leaf.view);

	// If the current view matches the frontmatter, the routing is complete.
	if (currentView === desiredView) {
		return true;
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
		// The `setViewState` may be dropped if the leaf is still
		// initializing (defect 1). Retry until the view actually settles.
		return scheduleRouteRetry(app, file, desiredView, attempt);
	}

	// Otherwise, the user switched to a non-default view (map/preview)
	// (step c). Persist the current view.
	void writeUsmView(app, file, currentView);
	return true;
}

/**
 * Schedule a bounded retry of the routing (defect 1). Returns `true` when
 * the retry budget is exhausted (no more retries) and `false` when a retry
 * has been scheduled. The retry stops early when the view already matches
 * the desired view or the file is no longer a board note, so a mere tab
 * re-activation (view already correct) never triggers a switch or a
 * spurious write (expected behavior #1).
 */
function scheduleRouteRetry(
	app: App,
	file: TFile,
	desiredView: UsmView,
	attempt: number,
): boolean {
	if (attempt >= ROUTE_MAX_ATTEMPTS) {
		return true; // Budget exhausted — stop retrying.
	}
	window.setTimeout(() => {
		void (async (): Promise<void> => {
			// Stop early if the view already matches the desired view.
			const leaf = findLeafWithFile(app, file);
			if (leaf !== null && detectCurrentView(leaf.view) === desiredView) {
				return;
			}
			// Stop early if the file is no longer a board note (e.g. the
			// user removed the flag while the retry was pending).
			if (!(await isBoardFileContent(app, file))) {
				return;
			}
			await routeBoardFileOpen(app, file, attempt + 1);
		})();
	}, ROUTE_RETRY_DELAY_MS);
	return false;
}

/**
 * Whether the file's content marks it as a board note (`usm-board: true`),
 * reading the metadata cache first and falling back to a direct vault read
 * (defect 1 retry guard).
 */
async function isBoardFileContent(app: App, file: TFile): Promise<boolean> {
	if (readBoardConfig(app, file).isBoard) {
		return true;
	}
	const data = await app.vault.read(file);
	return parseBoardConfigFromContent(data).isBoard;
}

/**
 * Remove the plugin's view-switch button from a `MarkdownView` (Defect 5).
 * Obsidian has no public `removeAction`, so the element returned by
 * `addAction` is removed directly from the DOM and dropped from the
 * tracking structures. Clearing the set lets a later navigation back to a
 * board note re-add the button (the guard re-enters the add path).
 *
 * @param view - The MarkdownView whose plugin button to remove.
 */
function removeViewSwitchAction(view: MarkdownView): void {
	const el = markdownViewSwitchActionEls.get(view);
	if (el !== undefined) {
		el.remove();
	}
	markdownViewSwitchActionEls.delete(view);
	markdownViewsWithSwitchAction.delete(view);
}

/**
 * Hide or show the native MarkdownView source/preview toggle
 * (`modeButtonEl`). The property is internal to Obsidian (not in
 * `obsidian.d.ts`), so access is defensive: a structural cast with an
 * optional check, and a silent no-op when the element is absent (e.g. a
 * future Obsidian version renames the property).
 *
 * @param view - The MarkdownView whose native toggle to toggle.
 * @param visible - Whether the native toggle should be visible.
 */
function setNativeModeToggleVisible(
	view: MarkdownView,
	visible: boolean,
): void {
	const el = (view as unknown as { modeButtonEl?: HTMLElement }).modeButtonEl;
	if (el === undefined || el === null) {
		return;
	}
	if (visible) {
		el.show();
	} else {
		el.hide();
	}
}

/**
 * Synchronize the native MarkdownView source/preview toggle visibility
 * with the current file's board status. The native toggle is hidden when
 * the view has the plugin's view-switch button AND the current file is a
 * board note (to avoid two overlapping view-switch buttons, Defect 4);
 * it is restored (shown) otherwise.
 *
 * @param app - The Obsidian app.
 * @param view - The MarkdownView to synchronize.
 * @param file - The file currently shown in the view.
 */
async function syncNativeModeToggle(
	app: App,
	view: MarkdownView,
	file: TFile,
): Promise<void> {
	const isBoard = await isBoardFileContent(app, file);
	const hasPluginButton = markdownViewsWithSwitchAction.has(view);
	// Defect 5: when the view no longer shows a board note, remove the
	// plugin's view-switch button (it would be inert) so only the native
	// toggle remains. The delete also clears the tracking structures so a
	// later navigation back to a board note re-adds the button.
	if (!isBoard && hasPluginButton) {
		removeViewSwitchAction(view);
	}
	setNativeModeToggleVisible(view, !(hasPluginButton && isBoard));
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
export function findLeafWithFile(
	app: App,
	file: TFile,
): WorkspaceLeaf | null {
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

/**
 * Show the view-switch menu for a board note (FR-027, amended). The menu
 * lists the three view options with the current one checked. Selecting an
 * option invokes `onSelect` with the chosen view.
 *
 * @param evt - The mouse event that triggered the menu (used to position
 *     it).
 * @param current - The current view (used to mark the active option).
 * @param onSelect - Callback invoked with the chosen view.
 */
function showViewSwitchMenu(
	evt: MouseEvent,
	current: UsmView,
	onSelect: (view: UsmView) => void,
): void {
	// Build the menu, add the items, then load and show it (Defect 2a).
	// `Menu.forEvent` (the one-liner) requires Obsidian 1.6.0, so we use
	// `new Menu()` + `showAtMouseEvent` (available since 0.12.6, below the
	// 1.1.0 minAppVersion). Two things matter for the menu to actually
	// appear: the items must be added BEFORE the menu is shown (`addItem`
	// only works while the menu is not shown yet), and `load()` must be
	// called so the menu builds its DOM — without it, `showAtMouseEvent`
	// positions an empty menu and nothing is displayed.
	const menu = new Menu();
	const options: Array<{ view: UsmView; label: string; icon: IconName }> = [
		{ view: 'map', label: t('view.board'), icon: 'layout-dashboard' },
		{ view: 'edit', label: t('view.edit'), icon: 'pencil' },
		{ view: 'preview', label: t('view.preview'), icon: 'eye' },
	];
	for (const option of options) {
		menu.addItem((item) => {
			item
				.setTitle(option.label)
				.setIcon(option.icon)
				.setChecked(option.view === current)
				.onClick(() => onSelect(option.view));
		});
	}
	menu.load();
	menu.showAtMouseEvent(evt);
}

/**
 * Ensure the dedicated view-switch button is present in the active view
 * for a board file (FR-027, amended). The plugin's own board view adds the
 * button in `onload`; the native `MarkdownView` (used for "Edit MD" /
 * "View MD") needs it added here because the plugin cannot extend its pane
 * menu. The button is added once per view instance (tracked in
 * {@link markdownViewsWithSwitchAction}) so repeated `file-open` events do
 * not duplicate it.
 *
 * The action's callback reads the view's current file at click time and
 * only offers the switch when that file is a board note (a defensive
 * fallback). When the view later shows a non-board note, the button is
 * removed entirely (see {@link syncNativeModeToggle}, Defect 5), so the
 * inert-click path is rarely reached.
 *
 * @param app - The Obsidian app.
 * @param file - The board file.
 */
export function ensureViewSwitchActionForLeaf(
	app: App,
	file: TFile,
): void {
	const leaf = findLeafWithFile(app, file);
	if (leaf === null) {
		return;
	}
	const view = leaf.view;
	if (view instanceof BoardView) {
		// The board view manages its own button (added in onload).
		return;
	}
	if (
		view instanceof MarkdownView &&
		!markdownViewsWithSwitchAction.has(view)
	) {
		// Mark the view synchronously so concurrent `file-open` events do not
		// schedule duplicate adds (Defect 2b). The actual `addAction` is
		// deferred behind an async board check (the metadata cache may not
		// have indexed the frontmatter yet on the first open).
		markdownViewsWithSwitchAction.add(view);
		void (async (): Promise<void> => {
			// Only add the button for board notes (Defect 2b): non-board notes
			// keep only Obsidian's native source/preview toggle.
			if (!(await isBoardFileContent(app, file))) {
				return;
			}
			const actionEl = view.addAction(
				VIEW_SWITCH_ICON,
				t('view.switch'),
				async (evt) => {
					const currentFile = view.file;
					if (currentFile === null) {
						return;
					}
					// Defensive re-check at click time (guards against a race
					// where the file changes between the event and the click;
					// normally the button is already removed for non-board
					// files, Defect 5).
					if (!(await isBoardFileContent(app, currentFile))) {
						return;
					}
					const current = detectCurrentView(view) ?? 'edit';
					showViewSwitchMenu(evt, current, (chosen) => {
						restoreView(leaf, currentFile, chosen);
						void writeUsmView(app, currentFile, chosen);
					});
				},
			);
			// Store the element so it can be removed when the view later
			// shows a non-board note (Defect 5).
			markdownViewSwitchActionEls.set(view, actionEl);
			// Defect 4: hide the native source/preview toggle — the
			// plugin's button replaces it for board notes.
			setNativeModeToggleVisible(view, false);
		})();
	}
}
