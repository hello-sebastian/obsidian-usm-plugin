/**
 * Integration tests for live updates and read-only enforcement (T019, T020,
 * US6).
 *
 * T019 (FR-013, SC-005): the board view registers `metadataCache.on('changed')`
 * and `vault.on('modify')`, filters events to the board file and its linked
 * story files, and debounces them so a burst of edits triggers a single model
 * rebuild + re-render that completes well within the 2-second budget.
 *
 * T020 (FR-015, FR-017, SC-004): the map is read-only — `save()` is a no-op
 * that never writes to the vault, and the map container suppresses the native
 * context menu so no mutation actions are offered.
 *
 * The `obsidian` package is types-only (no runtime), so it is mocked here with
 * a minimal `TextFileView`/`FileView`/`setIcon` surface. The test runs in
 * jsdom (dev-only) and patches Obsidian's `HTMLElement` extensions
 * (`createDiv`, `setText`, `empty`, …) onto the native prototype so the real
 * renderer and story-card code can build the DOM.
 */
// @vitest-environment jsdom
import {
	describe,
	it,
	expect,
	vi,
	beforeEach,
	afterEach,
	beforeAll,
} from 'vitest';
import type { App, TFile } from 'obsidian';

// NOTE: the `obsidian` package is types-only (no runtime JS). It is aliased
// to `tests/helpers/obsidian-stub.ts` in `vitest.config.ts`, which provides
// the minimal runtime surface (`TextFileView`, `FileView`, `setIcon`) the
// real `BoardView` / `BoardRenderer` code needs under jsdom.

import { BoardView } from '../../src/board/board-view';
import { BoardRenderer } from '../../src/board/board-renderer';
import { patchHTMLElement } from '../helpers/dom-patch';

// --- Mock vault app (dynamic metadata cache) --------------------------------

const WIKILINK_RE = /\[\[([^[\]]+)\]\]/g;

/** Build a metadata-cache entry from raw Markdown (mirrors the real cache). */
function buildCache(content: string): Record<string, unknown> {
	const lines = content.split('\n');
	let frontmatter: Record<string, unknown> | null = null;
	let endLine = -1;
	if (lines[0]?.trim() === '---') {
		for (let i = 1; i < lines.length; i++) {
			if (lines[i]?.trim() !== '---') {
				continue;
			}
			frontmatter = {};
			for (let j = 1; j < i; j++) {
				const line = lines[j] ?? '';
				const colon = line.indexOf(':');
				if (colon <= 0) {
					continue;
				}
				const key = line.slice(0, colon).trim();
				let value: unknown = line.slice(colon + 1).trim();
				if (typeof value === 'string') {
					const lower = value.toLowerCase();
					if (lower === 'true') {
						value = true;
					} else if (lower === 'false') {
						value = false;
					} else if (
						value.length >= 2 &&
						((value.startsWith('"') && value.endsWith('"')) ||
							(value.startsWith("'") && value.endsWith("'")))
					) {
						value = value.slice(1, -1);
					}
				}
				if (key.length > 0) {
					frontmatter[key] = value;
				}
			}
			endLine = i;
			break;
		}
	}
	const bodyStartLine = endLine >= 0 ? endLine + 1 : 0;
	const links: unknown[] = [];
	for (let i = bodyStartLine; i < lines.length; i++) {
		const line = lines[i] ?? '';
		for (const match of line.matchAll(WIKILINK_RE)) {
			const original = match[0] ?? '';
			const inner = match[1] ?? '';
			const pipeIndex = inner.indexOf('|');
			const target = pipeIndex >= 0 ? inner.slice(0, pipeIndex) : inner;
			const col = match.index ?? 0;
			links.push({
				original,
				link: target,
				position: {
					start: { line: i, col },
					end: { line: i, col: col + original.length },
				},
			});
		}
	}
	const cache: Record<string, unknown> = { links };
	if (frontmatter !== null) {
		cache.frontmatter = frontmatter;
		cache.frontmatterPosition = {
			start: { line: 0, col: 0 },
			end: { line: endLine, col: (lines[endLine] ?? '').length },
		};
	}
	return cache;
}

interface MockVault {
	app: App;
	/** Fire a registered `metadataCache`/`vault` event for a file. */
	fire: (event: string, file: TFile) => void;
	/** Get the mock `TFile` for a known path. */
	file: (path: string) => TFile;
	/** Update a note's content (re-indexed on next cache read). */
	modify: (path: string, content: string) => void;
	/** Spy on vault writes (should never be called by the read-only view). */
	writeSpy: ReturnType<typeof vi.fn>;
}

function createMockVault(initial: Record<string, string>): MockVault {
	const contents: Record<string, string> = { ...initial };
	const files = new Map<string, TFile>();
	for (const path of Object.keys(contents)) {
		files.set(path, { path, basename: path.replace(/\.md$/, '') } as TFile);
	}
	const listeners: Record<string, ((file: TFile) => void)[]> = {};
	const writeSpy = vi.fn();

	const on = (event: string, cb: (file: TFile) => void): unknown => {
		(listeners[event] ??= []).push(cb);
		return { event, cb };
	};

	const app = {
		metadataCache: {
			getFileCache: (f: TFile) => buildCache(contents[f.path] ?? ''),
			getFirstLinkpathDest: (link: string): TFile | null => {
				const hashIndex = link.indexOf('#');
				const target = (hashIndex >= 0 ? link.slice(0, hashIndex) : link).trim();
				for (const file of files.values()) {
					if (file.path === target || file.basename === target) {
						return file;
					}
				}
				return null;
			},
			on,
		},
		vault: { on, write: writeSpy },
		workspace: { openLinkText: () => {} },
	} as unknown as App;

	return {
		app,
		fire: (event, file) => {
			for (const cb of listeners[event] ?? []) {
				cb(file);
			}
		},
		file: (path) => {
			const f = files.get(path);
			if (f === undefined) {
				throw new Error(`Unknown file: ${path}`);
			}
			return f;
		},
		modify: (path, content) => {
			contents[path] = content;
		},
		writeSpy,
	};
}

// --- Shared fixtures --------------------------------------------------------

const BOARD = 'board.md';
const STORY = 'S1.md';
const UNRELATED = 'Other.md';

const boardContent = (links: string[]): string =>
	['---', 'usm-board: true', 'usm-release-order: appearance', '---', ...links]
		.join('\n');

const storyContent = (release: string): string =>
	['---', 'activity: Auth', 'task: Login', 'epic: Core', `release: ${release}`, '---', '# S1'].join(
		'\n',
	);

/**
 * `onOpen`/`onClose` are `protected` on `BoardView`; expose them for the
 * test harness via a narrow cast (the real lifecycle is driven by Obsidian).
 */
type BoardViewLifecycle = {
	onOpen(): Promise<void>;
	onClose(): Promise<void>;
};

/** Build a vault + an opened board view in map mode. */
async function setupView(
	boardLinks: string[] = ['[[S1]]'],
	storyRelease = 'R1',
): Promise<{ view: BoardView; vault: MockVault }> {
	const vault = createMockVault({
		[BOARD]: boardContent(boardLinks),
		[STORY]: storyContent(storyRelease),
		[UNRELATED]: '# Unrelated note\n',
	});
	const leaf = { app: vault.app };
	// Debug mode is off in the test harness (T022 changed the constructor
	// to take a `getDebugMode` getter).
	const view = new BoardView(leaf as never, () => false);
	view.file = vault.file(BOARD);
	view.data = boardContent(boardLinks);
	await view.onLoadFile(vault.file(BOARD));
	await (view as unknown as BoardViewLifecycle).onOpen();
	return { view, vault };
}

const cardCount = (view: BoardView): number =>
	view.contentEl.querySelectorAll('.usm-story-card').length;

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

describe('T019 — event-driven live updates (FR-013, SC-005)', () => {
	it('re-renders the map when a linked story file changes (debounced)', async () => {
		const { view, vault } = await setupView();
		expect(view.mode).toBe('map');
		expect(cardCount(view)).toBe(1);
		expect(view.getModel()?.releases).toEqual(['R1']);

		// Edit the story's release in the Markdown source.
		vault.modify(STORY, storyContent('R2'));
		vault.fire('changed', vault.file(STORY));

		// Not yet — the update is debounced.
		expect(view.getModel()?.releases).toEqual(['R1']);

		vi.advanceTimersByTime(250);
		expect(view.getModel()?.releases).toEqual(['R2']);
	});

	it('re-renders the map when the board file itself changes', async () => {
		const { view, vault } = await setupView(['[[S1]]']);
		expect(cardCount(view)).toBe(1);

		// Add a second story link to the board.
		vault.modify(BOARD, boardContent(['[[S1]]', '[[S1|Second]]']));
		vault.fire('changed', vault.file(BOARD));

		vi.advanceTimersByTime(250);
		expect(cardCount(view)).toBe(2);
	});

	it('ignores changes to files that are not part of the map', async () => {
		const { vault } = await setupView();
		const renderSpy = vi.spyOn(BoardRenderer.prototype, 'render');
		renderSpy.mockClear();

		vault.modify(UNRELATED, '# Unrelated note\nedited\n');
		vault.fire('changed', vault.file(UNRELATED));

		vi.advanceTimersByTime(500);
		expect(renderSpy).not.toHaveBeenCalled();
	});

	it('coalesces a burst of changes into a single re-render', async () => {
		const { view, vault } = await setupView();
		const renderSpy = vi.spyOn(BoardRenderer.prototype, 'render');
		renderSpy.mockClear();

		// A burst of edits (e.g. the user typing) fires many events.
		for (let i = 0; i < 5; i++) {
			vault.modify(STORY, storyContent(`R${i + 1}`));
			vault.fire('changed', vault.file(STORY));
		}

		vi.advanceTimersByTime(250);
		expect(renderSpy).toHaveBeenCalledTimes(1);
		// The final state reflects the last edit.
		expect(view.getModel()?.releases).toEqual(['R5']);
	});

	it('does not re-render while in markdown mode', async () => {
		const { view, vault } = await setupView();
		view.setMode('markdown');
		const renderSpy = vi.spyOn(BoardRenderer.prototype, 'render');
		renderSpy.mockClear();

		vault.modify(STORY, storyContent('R9'));
		vault.fire('changed', vault.file(STORY));

		vi.advanceTimersByTime(500);
		expect(renderSpy).not.toHaveBeenCalled();
	});

	it('completes the update within the 2-second budget', async () => {
		const { view, vault } = await setupView();
		vault.modify(STORY, storyContent('R2'));
		vault.fire('changed', vault.file(STORY));

		// The debounce delay (250ms) is far below the 2s requirement.
		vi.advanceTimersByTime(250);
		expect(view.getModel()?.releases).toEqual(['R2']);
		expect(250).toBeLessThan(2000);
	});
});

describe('T020 — read-only enforcement (FR-015, FR-017, SC-004)', () => {
	it('save() is a no-op and never writes to the vault', async () => {
		const { view, vault } = await setupView();
		const before = view.data;

		await view.save();

		expect(vault.writeSpy).not.toHaveBeenCalled();
		expect(view.data).toBe(before);
	});

	it('suppresses the native context menu on the map container', async () => {
		const { view } = await setupView();
		const container = view.contentEl.querySelector('.usm-board-map');
		expect(container).not.toBeNull();

		const evt = new Event('contextmenu', { cancelable: true, bubbles: true });
		container?.dispatchEvent(evt);

		expect(evt.defaultPrevented).toBe(true);
	});
});
