/**
 * Integration tests for board-note view routing (T047) and the dedicated
 * view-switch button (FR-027, amended).
 *
 * Defect 1 (leaf-readiness race): on every fresh open of a board note,
 * Obsidian fires `file-open` while the new leaf's view is still
 * initializing, so a single `setViewState` can be dropped. The routing
 * retries a bounded number of times until the view settles. These tests
 * lock in:
 * - the routing retries until the leaf is ready, then switches to the map
 *   view (defect 1);
 * - a mere tab re-activation (view already correct) triggers no switch and
 *   no spurious `usm-view` write (expected behavior #1);
 * - `findLeafWithFile` returns `null` when no leaf is registered yet.
 *
 * Defect 2 (dedicated view-switch button): the button is added via
 * `ItemView.addAction` and is available in all three view states. These
 * tests lock in:
 * - the button is added to the native `MarkdownView` once (no duplicate
 *   across repeated `file-open` events);
 * - the button is added to the plugin's `BoardView` once (no duplicate
 *   across repeated `onload` calls).
 *
 * The `obsidian` package is types-only (no runtime), so it is aliased to
 * `tests/helpers/obsidian-stub.ts` in `vitest.config.ts`, which provides
 * the minimal `FileView`/`MarkdownView` runtime surface. The test runs in
 * jsdom (dev-only).
 */
// @vitest-environment jsdom
import {
	describe,
	it,
	expect,
	vi,
	beforeAll,
	beforeEach,
	afterEach,
} from 'vitest';
import type { App, Plugin, TFile } from 'obsidian';
import { MarkdownView, Menu } from 'obsidian';
import {
	BoardView,
	handleBoardFileOpen,
	findLeafWithFile,
	ensureViewSwitchActionForLeaf,
	registerBoardViewRouting,
} from '../../src/obsidian/board-view';
import { patchHTMLElement } from '../helpers/dom-patch';

const BOARD = 'board.md';

// --- Mock app ---------------------------------------------------------------

/** A mock workspace leaf whose `setViewState` simulates Obsidian swapping the view. */
interface MockLeaf {
	view: unknown;
	setViewState: ReturnType<typeof vi.fn>;
}

/** The view type a leaf reports for `getLeavesOfType` (mirrors Obsidian). */
function viewTypeOf(view: unknown): string {
	if (view instanceof BoardView) {
		return 'usm-board-view';
	}
	if (view instanceof MarkdownView) {
		return 'markdown';
	}
	return '';
}

interface MockApp {
	app: App;
	/** The mock `TFile` for the board note. */
	file: TFile;
	/** Replace the set of open leaves. */
	setLeaves: (leaves: MockLeaf[]) => void;
	/** Spy on `vault.process` (the only sanctioned board-file write). */
	processSpy: ReturnType<typeof vi.fn>;
	/** Spy on `vault.read` (the metadata-cache fallback). */
	readSpy: ReturnType<typeof vi.fn>;
	/** Captured workspace event handlers (for the active-leaf-change test). */
	workspaceHandlers: Map<string, (arg: unknown) => void>;
}

/**
 * Build a mock `App` whose metadata cache reports the board note as a board
 * (`usm-board: true`, `usm-view: map`) so the routing does not fall back to
 * a direct vault read.
 */
function createMockApp(): MockApp {
	const file = { path: BOARD, basename: 'board' } as TFile;
	const boardContent = '---\nusm-board: true\nusm-view: map\n---\n# Board\n';
	const plainContent = '# Plain note\n';
	const processSpy = vi.fn(async () => '');
	// Path-aware: board content for the board note, plain content otherwise
	// (so the non-board Defect 2b test is not mis-detected as a board via the
	// vault.read fallback).
	const readSpy = vi.fn(async (f: TFile) =>
		f.path === BOARD ? boardContent : plainContent,
	);
	let leaves: MockLeaf[] = [];
	const workspaceHandlers = new Map<string, (arg: unknown) => void>();
	const app = {
		metadataCache: {
			getFileCache: (f: TFile) =>
				f.path === BOARD
					? { frontmatter: { 'usm-board': true, 'usm-view': 'map' } }
					: null,
			on: () => ({}),
		},
		vault: {
			read: readSpy,
			process: processSpy,
			on: () => ({}),
		},
		workspace: {
			getLeavesOfType: (type: string) =>
				leaves.filter((l) => viewTypeOf(l.view) === type),
			on: (evt: string, cb: (arg: unknown) => void) => {
				workspaceHandlers.set(evt, cb);
				return {};
			},
		},
	} as unknown as App;
	return {
		app,
		file,
		setLeaves: (l) => {
			leaves = l;
		},
		processSpy,
		readSpy,
		workspaceHandlers,
	};
}

/**
 * Build a mock leaf whose `setViewState` simulates Obsidian swapping the
 * leaf's view: a `usm-board-view` state produces a `BoardView`, a
 * `markdown` state produces a `MarkdownView` in the requested mode.
 */
/** The stub `MarkdownView` exposes `setMode` and `modeButtonEl` (test-only; the real type does not). */
type MarkdownViewStub = MarkdownView & {
	setMode(mode: 'source' | 'preview'): void;
	modeButtonEl: HTMLElement;
};

/** Create a stub `MarkdownView` showing `file` in the given mode. */
function makeMarkdownView(
	app: App,
	file: TFile,
	mode: 'source' | 'preview',
): MarkdownViewStub {
	const view = new MarkdownView({ app } as never) as MarkdownViewStub;
	view.file = file;
	view.setMode(mode);
	return view;
}

/** A mock leaf plus its `setViewState` spy (kept separate so tests can assert on the spy without referencing the method property). */
interface MockLeafResult {
	leaf: MockLeaf;
	setViewStateSpy: ReturnType<typeof vi.fn>;
}

function makeLeaf(view: unknown, app: App, file: TFile): MockLeafResult {
	const setViewStateSpy = vi.fn((state: {
		type: string;
		state: { file: string; mode?: string };
	}) => {
		// Synchronous so the view swap is visible as soon as the retry
		// reaches it (the real setViewState is async, but the test only
		// needs the effect to be observable).
		if (state.type === 'usm-board-view') {
			const boardView = new BoardView({ app } as never, () => false);
			boardView.file = file;
			leaf.view = boardView;
		} else if (state.type === 'markdown') {
			leaf.view = makeMarkdownView(
				app,
				file,
				state.state.mode === 'preview' ? 'preview' : 'source',
			);
		}
	});
	const leaf: MockLeaf = { view, setViewState: setViewStateSpy };
	return { leaf, setViewStateSpy };
}

/**
 * Flush the microtask queue. `ensureViewSwitchActionForLeaf` defers
 * `addAction` behind an async board check (Defect 2b), so tests must let
 * that settle before asserting on `addAction`.
 */
async function flushMicrotasks(): Promise<void> {
	for (let i = 0; i < 10; i += 1) {
		await Promise.resolve();
	}
}

// --- Tests ------------------------------------------------------------------

beforeAll(() => {
	patchHTMLElement();
});

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('defect 1 — first-open routing retry (leaf-readiness race)', () => {
	it('retries until the leaf is ready, then switches to the map view', async () => {
		const { app, file, setLeaves, processSpy } = createMockApp();
		// Initially no leaf is registered (the fresh leaf is not ready yet).
		setLeaves([]);

		void handleBoardFileOpen(app, file);

		// The leaf becomes ready after the first retry tick: a native
		// MarkdownView in source mode (the default fresh-open state).
		const mdView = makeMarkdownView(app, file, 'source');
		const { leaf: mockLeaf, setViewStateSpy } = makeLeaf(mdView, app, file);
		setLeaves([mockLeaf]);

		// Advance through the bounded retry window (≤5 attempts, 50 ms apart).
		for (let i = 0; i < 5; i += 1) {
			await vi.advanceTimersByTimeAsync(50);
		}
		// Final flush: ensure any pending microtasks (the retry's async
		// chain) have settled.
		await vi.advanceTimersByTimeAsync(0);

		// The leaf's view is now the board view (the switch took effect).
		const leaf = findLeafWithFile(app, file);
		expect(leaf).not.toBeNull();
		expect(leaf?.view).toBeInstanceOf(BoardView);
		// The switch was issued via setViewState with the board view type.
		expect(setViewStateSpy).toHaveBeenCalledWith({
			type: 'usm-board-view',
			state: { file: BOARD },
		});
		// No spurious usm-view write (the routing only restores, does not
		// persist on a fresh open).
		expect(processSpy).not.toHaveBeenCalled();
	});

	it('does not switch or write on a mere tab re-activation (view already correct)', async () => {
		const { app, file, setLeaves, processSpy } = createMockApp();
		// The leaf is already the board view (the user re-activated the tab).
		const boardView = new BoardView({ app } as never, () => false);
		boardView.file = file;
		const { leaf, setViewStateSpy } = makeLeaf(boardView, app, file);
		setLeaves([leaf]);

		await handleBoardFileOpen(app, file);

		// No view switch and no write (expected behavior #1).
		expect(setViewStateSpy).not.toHaveBeenCalled();
		expect(processSpy).not.toHaveBeenCalled();
		// The view is unchanged.
		expect(leaf.view).toBe(boardView);
	});

	it('findLeafWithFile returns null when no leaf is registered', () => {
		const { app, file, setLeaves } = createMockApp();
		setLeaves([]);
		expect(findLeafWithFile(app, file)).toBeNull();
	});
});

describe('defect 2 — dedicated view-switch button', () => {
	it('adds the button to the native Markdown view once (no duplicate)', async () => {
		const { app, file, setLeaves } = createMockApp();
		const mdView = makeMarkdownView(app, file, 'source');
		setLeaves([makeLeaf(mdView, app, file).leaf]);

		const addActionSpy = vi
			.spyOn(mdView, 'addAction')
			.mockReturnValue(document.createElement('div'));

		ensureViewSwitchActionForLeaf(app, file);
		// The addAction is deferred behind an async board check (Defect 2b).
		await flushMicrotasks();
		expect(addActionSpy).toHaveBeenCalledTimes(1);
		expect(addActionSpy).toHaveBeenCalledWith(
			'columns-2',
			'Change view',
			expect.any(Function),
		);

		// A second file-open for the same view must not duplicate the action.
		ensureViewSwitchActionForLeaf(app, file);
		await flushMicrotasks();
		expect(addActionSpy).toHaveBeenCalledTimes(1);
	});

	it('adds the button to the board view once (no duplicate)', () => {
		const minimalApp = {
			metadataCache: { on: () => ({}) },
			vault: { on: () => ({}) },
		} as unknown as App;
		const view = new BoardView({ app: minimalApp } as never, () => false);
		const addActionSpy = vi
			.spyOn(view, 'addAction')
			.mockReturnValue(document.createElement('div'));

		view.onload();
		expect(addActionSpy).toHaveBeenCalledTimes(1);
		expect(addActionSpy).toHaveBeenCalledWith(
			'columns-2',
			'Change view',
			expect.any(Function),
		);

		// A second onload must not duplicate the action.
		view.onload();
		expect(addActionSpy).toHaveBeenCalledTimes(1);
	});
});

describe('defect 1 — board view must not claim non-board files', () => {
	it('does not claim .md files for leaf reuse', () => {
		const minimalApp = {
			metadataCache: { on: () => ({}) },
			vault: { on: () => ({}) },
		} as unknown as App;
		const view = new BoardView({ app: minimalApp } as never, () => false);
		// The board view must not claim .md files: doing so made Obsidian
		// reuse the board leaf for regular notes, leaving an empty panel.
		expect(view.canAcceptExtension('md')).toBe(false);
	});
});

describe('defect 2b — view-switch button only on board notes', () => {
	it('does not add the button to a non-board Markdown view', async () => {
		const { app, setLeaves } = createMockApp();
		const nonBoardFile = { path: 'plain.md', basename: 'plain' } as TFile;
		const mdView = makeMarkdownView(app, nonBoardFile, 'source');
		setLeaves([makeLeaf(mdView, app, nonBoardFile).leaf]);

		const addActionSpy = vi
			.spyOn(mdView, 'addAction')
			.mockReturnValue(document.createElement('div'));

		ensureViewSwitchActionForLeaf(app, nonBoardFile);
		await flushMicrotasks();

		// Non-board notes keep only the native source/preview toggle.
		expect(addActionSpy).not.toHaveBeenCalled();
	});
});

describe('defect 3 — button present after view-type switch', () => {
	it('adds the button to the Markdown view when active-leaf-change fires after a view-type switch', async () => {
		const { app, file, setLeaves, workspaceHandlers } = createMockApp();
		const plugin = { app, registerEvent: vi.fn() } as unknown as Plugin;
		registerBoardViewRouting(plugin);

		// The active-leaf-change handler must be registered (the fix).
		const onActiveLeafChange = workspaceHandlers.get('active-leaf-change');
		expect(onActiveLeafChange).toBeTypeOf('function');
		if (onActiveLeafChange === undefined) {
			return;
		}

		// Start with the board view (the initial state for a board note).
		const boardView = new BoardView({ app } as never, () => false);
		boardView.file = file;
		const { leaf: mockLeaf } = makeLeaf(boardView, app, file);
		setLeaves([mockLeaf]);

		// Simulate a view-type switch: the user clicks "Edit MD" in the
		// view-switch menu, which calls restoreView to switch to the
		// Markdown view. This replaces the leaf's view with a MarkdownView.
		// `file-open` does NOT fire (the file did not change), but
		// `active-leaf-change` does.
		const mdView = makeMarkdownView(app, file, 'source');
		mockLeaf.view = mdView;

		const addActionSpy = vi
			.spyOn(mdView, 'addAction')
			.mockReturnValue(document.createElement('div'));

		// Fire the active-leaf-change handler (this is what Obsidian does
		// after setViewState swaps the view).
		onActiveLeafChange(mockLeaf);
		await flushMicrotasks();

		// The button is added to the new MarkdownView.
		expect(addActionSpy).toHaveBeenCalledTimes(1);
		expect(addActionSpy).toHaveBeenCalledWith(
			'columns-2',
			'Change view',
			expect.any(Function),
		);
	});
});

describe('defect 4 — native source/preview toggle hidden for board notes', () => {
	it('hides the native toggle when the plugin button is added to a board Markdown view', async () => {
		const { app, file, setLeaves } = createMockApp();
		const mdView = makeMarkdownView(app, file, 'source');
		setLeaves([makeLeaf(mdView, app, file).leaf]);

		vi.spyOn(mdView, 'addAction').mockReturnValue(
			document.createElement('div'),
		);

		ensureViewSwitchActionForLeaf(app, file);
		await flushMicrotasks();

		// The plugin button is added AND the native toggle is hidden.
		expect(mdView.modeButtonEl.style.display).toBe('none');
	});

	it('restores the native toggle and removes the plugin button when the active file is a non-board note', async () => {
		const { app, file, setLeaves, workspaceHandlers } = createMockApp();
		const plugin = { app, registerEvent: vi.fn() } as unknown as Plugin;
		registerBoardViewRouting(plugin);
		const onActiveLeafChange = workspaceHandlers.get('active-leaf-change');
		expect(onActiveLeafChange).toBeTypeOf('function');
		if (onActiveLeafChange === undefined) {
			return;
		}

		// Start with a board note in the Markdown view: the plugin button is
		// added and the native toggle is hidden.
		const mdView = makeMarkdownView(app, file, 'source');
		const { leaf: mockLeaf } = makeLeaf(mdView, app, file);
		setLeaves([mockLeaf]);
		let actionEl: HTMLElement | null = null;
		vi.spyOn(mdView, 'addAction').mockImplementation(() => {
			actionEl = document.createElement('div');
			mdView.containerEl.appendChild(actionEl);
			return actionEl;
		});
		onActiveLeafChange(mockLeaf);
		await flushMicrotasks();
		expect(mdView.modeButtonEl.style.display).toBe('none');
		// The plugin button is present in the header.
		expect(actionEl).not.toBeNull();
		expect(mdView.containerEl.contains(actionEl)).toBe(true);

		// The user navigates to a non-board note in the same view: the
		// native toggle must be restored AND the plugin button removed
		// (Defect 5 — it would be inert for a non-board file).
		const nonBoardFile = { path: 'plain.md', basename: 'plain' } as TFile;
		mdView.file = nonBoardFile;
		onActiveLeafChange(mockLeaf);
		await flushMicrotasks();
		expect(mdView.modeButtonEl.style.display).toBe('');
		// The plugin button is gone from the header.
		expect(mdView.containerEl.contains(actionEl)).toBe(false);
	});

	it('re-adds the plugin button and hides the native toggle when navigating back to a board note (round-trip)', async () => {
		const { app, file, setLeaves, workspaceHandlers } = createMockApp();
		const plugin = { app, registerEvent: vi.fn() } as unknown as Plugin;
		registerBoardViewRouting(plugin);
		const onActiveLeafChange = workspaceHandlers.get('active-leaf-change');
		expect(onActiveLeafChange).toBeTypeOf('function');
		if (onActiveLeafChange === undefined) {
			return;
		}

		const mdView = makeMarkdownView(app, file, 'source');
		const { leaf: mockLeaf } = makeLeaf(mdView, app, file);
		setLeaves([mockLeaf]);
		const addActionSpy = vi
			.spyOn(mdView, 'addAction')
			.mockImplementation(() => {
				const el = document.createElement('div');
				mdView.containerEl.appendChild(el);
				return el;
			});

		// Board note: button added, native toggle hidden.
		onActiveLeafChange(mockLeaf);
		await flushMicrotasks();
		expect(addActionSpy).toHaveBeenCalledTimes(1);
		expect(mdView.modeButtonEl.style.display).toBe('none');

		// Navigate to a non-board note: button removed, native toggle shown.
		const nonBoardFile = { path: 'plain.md', basename: 'plain' } as TFile;
		mdView.file = nonBoardFile;
		onActiveLeafChange(mockLeaf);
		await flushMicrotasks();
		expect(addActionSpy).toHaveBeenCalledTimes(1); // removed, not re-added
		expect(mdView.modeButtonEl.style.display).toBe('');

		// Navigate back to the board note: button re-added, native toggle hidden.
		mdView.file = file;
		onActiveLeafChange(mockLeaf);
		await flushMicrotasks();
		expect(addActionSpy).toHaveBeenCalledTimes(2); // re-added
		expect(mdView.modeButtonEl.style.display).toBe('none');
	});

	it('no-ops safely when modeButtonEl is absent (future Obsidian rename)', async () => {
		const { app, file, setLeaves } = createMockApp();
		const mdView = makeMarkdownView(app, file, 'source');
		setLeaves([makeLeaf(mdView, app, file).leaf]);

		// Simulate a future Obsidian version that renamed the property.
		delete (mdView as unknown as { modeButtonEl?: HTMLElement }).modeButtonEl;
		vi.spyOn(mdView, 'addAction').mockReturnValue(
			document.createElement('div'),
		);

		// Must not throw.
		ensureViewSwitchActionForLeaf(app, file);
		await flushMicrotasks();
	});
});

describe('defect 2a — view-switch menu is loaded before shown', () => {
	it('loads the menu before showing it', () => {
		const minimalApp = {
			metadataCache: { on: () => ({}) },
			vault: { on: () => ({}) },
		} as unknown as App;
		const view = new BoardView({ app: minimalApp } as never, () => false);
		view.file = { path: 'board.md', basename: 'board' } as TFile;
		const addActionSpy = vi
			.spyOn(view, 'addAction')
			.mockReturnValue(document.createElement('div'));

		view.onload();
		// Capture the button callback (3rd arg to addAction).
		const callback = addActionSpy.mock.calls[0]?.[2] as
			| ((e: MouseEvent) => void)
			| undefined;
		expect(callback).toBeTypeOf('function');
		if (callback === undefined) {
			return;
		}

		const loadSpy = vi.spyOn(Menu.prototype, 'load');
		const showSpy = vi.spyOn(Menu.prototype, 'showAtMouseEvent');

		callback({} as MouseEvent);

		expect(loadSpy).toHaveBeenCalledTimes(1);
		expect(showSpy).toHaveBeenCalledTimes(1);
		// load() must run before showAtMouseEvent (Defect 2a).
		const loadOrder = loadSpy.mock.invocationCallOrder[0];
		const showOrder = showSpy.mock.invocationCallOrder[0];
		expect(loadOrder).toBeTypeOf('number');
		expect(showOrder).toBeTypeOf('number');
		if (loadOrder === undefined || showOrder === undefined) {
			return;
		}
		expect(loadOrder).toBeLessThan(showOrder);
	});
});
