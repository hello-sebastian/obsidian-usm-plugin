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

/** Base file view (used for `instanceof` checks in the routing helper). */
export class FileView {
	file: TFileLike | null = null;
}

/**
 * Minimal `TextFileView` base. Provides the constructor state and the
 * lifecycle / registration hooks `BoardView` calls via `super`.
 */
export class TextFileView extends FileView {
	app: AppLike;
	leaf: unknown;
	containerEl: HTMLElement;
	contentEl: HTMLElement;
	data = '';
	icon = '';
	navigation = true;
	scope: unknown = null;

	constructor(leaf: { app: AppLike }) {
		super();
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

	async onOpen(): Promise<void> {}
	async onClose(): Promise<void> {}
	async onLoadFile(_file: TFileLike): Promise<void> {}
	async onUnloadFile(_file: TFileLike): Promise<void> {}
	async onRename(_file: TFileLike): Promise<void> {}
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

/** No-op icon setter (the stub has no icon font). */
export function setIcon(_el: HTMLElement, _icon: string): void {}

/** Placeholder classes for type-only imports that may not be elided. */
export class App {}
export class TFile {}
export class WorkspaceLeaf {}
export class Plugin {}
