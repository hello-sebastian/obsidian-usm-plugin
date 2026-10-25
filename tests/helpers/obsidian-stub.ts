/**
 * Runtime stub for the `obsidian` package (test-only).
 *
 * The `obsidian` npm package is types-only (`main: ""`, no runtime JS), so
 * Vite cannot resolve it at runtime. Most test modules import `obsidian`
 * types only (elided by the bundler), but `board-view.ts` has real value
 * imports — `TextFileView` (extended), `FileView` (`instanceof`), and
 * `setIcon` (called). This stub provides that minimal runtime surface so the
 * real `BoardView` / `BoardRenderer` code can run under jsdom.
 *
 * It is wired in via a `resolve.alias` in `vitest.config.ts` (dev-only, zero
 * runtime impact on the plugin). The stub mirrors the subset of the
 * `View`/`TextFileView` API the board view actually uses.
 *
 * Structural types are declared locally (not imported from `obsidian`) so the
 * stub has no self-referential import under the alias.
 */

/** Minimal structural `App` (only the members the board view touches). */
interface AppLike {
	metadataCache: {
		getFileCache: (file: TFileLike) => unknown;
		getFirstLinkpathDest: (
			link: string,
			sourcePath?: string,
		) => TFileLike | null;
		on: (event: string, cb: (file: TFileLike) => void) => unknown;
	};
	vault: {
		on: (event: string, cb: (file: TFileLike) => void) => unknown;
		write: (path: string, data: string) => Promise<void>;
	};
	workspace: {
		openLinkText: (link: string, sourcePath: string) => Promise<void>;
	};
}

/** Minimal structural `TFile`. */
interface TFileLike {
	path: string;
	basename: string;
}

/**
 * Minimal `FileView` base. Provides the constructor state and the
 * lifecycle / registration hooks `BoardView` calls via `super`.
 */
export class FileView {
	file: TFileLike | null = null;
	app: AppLike;
	leaf: unknown;
	containerEl: HTMLElement;
	contentEl: HTMLElement;
	icon = '';
	navigation = true;
	allowNoFile = false;
	scope: unknown = null;

	constructor(leaf: { app: AppLike }) {
		this.leaf = leaf;
		this.app = leaf.app;
		this.containerEl = document.createElement('div');
		this.contentEl = document.createElement('div');
		this.containerEl.appendChild(this.contentEl);
	}

	registerEvent(_event: unknown): void {}
	registerDomEvent(_el: unknown, _type: string, _handler: unknown): void {}

	addAction(
		_icon: string,
		tooltip: string,
		callback: (e: MouseEvent) => void,
	): HTMLElement {
		const el = document.createElement('div');
		el.className = 'view-action';
		el.setAttribute('aria-label', tooltip);
		el.title = tooltip;
		const iconEl = document.createElement('span');
		iconEl.className = 'view-action-icon';
		el.appendChild(iconEl);
		el.addEventListener('click', callback);
		return el;
	}

	async onload(): Promise<void> {}
	async onOpen(): Promise<void> {}
	async onClose(): Promise<void> {}
	async onLoadFile(_file: TFileLike): Promise<void> {}
	async onUnloadFile(_file: TFileLike): Promise<void> {}
	async onRename(_file: TFileLike): Promise<void> {}

	getViewType(): string {
		return 'file';
	}
	getDisplayText(): string {
		return this.file?.basename ?? '';
	}
	canAcceptExtension(_ext: string): boolean {
		return true;
	}
	getState(): Record<string, unknown> {
		return {};
	}
	setState(_state: Record<string, unknown>): void {}
}

/**
 * Minimal `TextFileView` base (kept for backward compatibility with any
 * remaining references). Extends `FileView` with a `data` buffer.
 */
export class TextFileView extends FileView {
	data = '';

	async save(_clear?: boolean): Promise<void> {}

	getViewData(): string {
		return this.data;
	}
	setViewData(data: string, _clear: boolean): void {
		this.data = data;
	}
	clear(): void {
		this.data = '';
	}
}

/**
 * Minimal `MarkdownView` base. Provides `getMode()` so the view-switch
 * detection (`detectCurrentView`) can distinguish "Edit MD" (source) from
 * "View MD" (preview).
 */
export class MarkdownView extends FileView {
	private mode: 'source' | 'preview' = 'source';

	/**
	 * The native source/preview toggle button (mirrors Obsidian's internal
	 * `modeButtonEl`, created in the real `MarkdownView` constructor via
	 * `addAction`). Present so the plugin's `setNativeModeToggleVisible`
	 * helper can be exercised in tests (Defect 4).
	 */
	modeButtonEl: HTMLElement = document.createElement('div');

	getMode(): 'source' | 'preview' {
		return this.mode;
	}

	/** Test helper: flip the mode (mirrors `markdown-toggle-preview`). */
	setMode(mode: 'source' | 'preview'): void {
		this.mode = mode;
	}
}

/** No-op icon setter (the stub has no icon font). */
export function setIcon(_el: HTMLElement, _icon: string): void {}

/**
 * Minimal `Menu` base (test-only). Provides the surface
 * `showViewSwitchMenu` uses: `addItem`, `load`, `showAtMouseEvent`.
 * `addItem` invokes the callback with a mock item (whose methods return the
 * item for chaining) so the menu-building code runs without error. Tests can
 * spy on `load` / `showAtMouseEvent` to assert the menu is loaded before it
 * is shown (Defect 2a).
 */
export class Menu {
	addItem(cb: (item: Record<string, unknown>) => unknown): this {
		const item: Record<string, unknown> = {};
		for (const method of ['setTitle', 'setIcon', 'setChecked', 'onClick']) {
			item[method] = () => item;
		}
		cb(item);
		return this;
	}
	addSeparator(): this {
		return this;
	}
	load(): void {}
	showAtMouseEvent(_evt: MouseEvent): this {
		return this;
	}
	showAtPosition(_pos: unknown, _doc?: Document): this {
		return this;
	}
	hide(): this {
		return this;
	}
	close(): void {}
	onHide(_cb: () => unknown): void {}
}

/** Placeholder classes for type-only imports that may not be elided. */
export class App {}
export class TFile {}
export class WorkspaceLeaf {}
export class Plugin {}
