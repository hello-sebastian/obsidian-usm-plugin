/**
 * Fixture-based mock `App` for the automated test suite (T029–T032).
 *
 * Builds a minimal `App`-shaped object whose `metadataCache` is derived
 * from plain-Markdown notes — either the versioned fixtures in
 * `tests/fixtures/` (T028) or in-memory contents. No Obsidian runtime is
 * required (FR-022, FR-023).
 *
 * The mock mirrors the subset of the metadata cache the core pipeline
 * actually uses (research R-02):
 * - `getFileCache(file)` → `{ frontmatter?, frontmatterPosition?, links? }`
 * - `getFirstLinkpathDest(link, sourcePath)` → resolved note or `null`
 *
 * Wikilink extraction follows Obsidian's behavior: `links` contains body
 * links only (frontmatter values are not link references), each with its
 * document position so order-of-appearance logic is testable.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { App, TFile } from 'obsidian';

const FIXTURES_DIR = join(
	dirname(fileURLToPath(import.meta.url)),
	'..',
	'fixtures',
);

/** A fixture note: vault-relative path, note name, raw Markdown content. */
export interface FixtureFile {
	path: string;
	basename: string;
	content: string;
}

interface Position {
	line: number;
	col: number;
}

interface Range {
	start: Position;
	end: Position;
}

interface MockLinkCache {
	original: string;
	link: string;
	position: Range;
}

interface MockCache {
	frontmatter?: Record<string, unknown>;
	frontmatterPosition?: Range;
	links?: MockLinkCache[];
}

/** A mock `App` plus accessors for its fixture files. */
export interface FixtureApp {
	app: App;
	/** Get the mock `TFile` for a known path (throws when unknown). */
	file: (path: string) => TFile;
	files: ReadonlyMap<string, FixtureFile>;
}

/** Matches a full wikilink: `[[target]]`, `[[target|alias]]`, `[[target#heading]]`. */
const WIKILINK_RE = /\[\[([^[\]]+)\]\]/g;

/**
 * Parse an inline YAML array value: `[a, b, "c"]`.
 * Items are trimmed and unquoted (the `aliases` list is the only array
 * the pipeline reads — see the title cascade in `story-attributes.ts`).
 */
function parseInlineArray(value: string): string[] {
	const inner = value.slice(1, -1).trim();
	if (inner.length === 0) {
		return [];
	}
	return inner.split(',').map((item) => {
		let s = item.trim();
		if (
			s.length >= 2 &&
			((s.startsWith('"') && s.endsWith('"')) ||
				(s.startsWith("'") && s.endsWith("'")))
		) {
			s = s.slice(1, -1);
		}
		return s;
	});
}

/**
 * Parse a simple `key: value` frontmatter block.
 *
 * Supports the subset of YAML the fixtures use: scalar strings (optionally
 * quoted), booleans (`true`/`false`), and inline arrays (`[a, b]`).
 * Returns the closing `---` line index (`-1` when the file has no
 * frontmatter).
 */
function parseFrontmatter(lines: string[]): {
	frontmatter: Record<string, unknown> | null;
	endLine: number;
} {
	if (lines[0]?.trim() !== '---') {
		return { frontmatter: null, endLine: -1 };
	}
	for (let i = 1; i < lines.length; i++) {
		if (lines[i]?.trim() !== '---') {
			continue;
		}
		const frontmatter: Record<string, unknown> = {};
		for (let j = 1; j < i; j++) {
			const line = lines[j] ?? '';
			const colon = line.indexOf(':');
			if (colon <= 0) {
				continue;
			}
			const key = line.slice(0, colon).trim();
			let value: unknown = line.slice(colon + 1).trim();
			if (
				typeof value === 'string' &&
				value.startsWith('[') &&
				value.endsWith(']')
			) {
				value = parseInlineArray(value);
			} else if (
				typeof value === 'string' &&
				value.length >= 2 &&
				((value.startsWith('"') && value.endsWith('"')) ||
					(value.startsWith("'") && value.endsWith("'")))
			) {
				value = value.slice(1, -1);
			} else if (typeof value === 'string') {
				// YAML parses booleans case-insensitively (true/TRUE/True).
				const lower = value.toLowerCase();
				if (lower === 'true') {
					value = true;
				} else if (lower === 'false') {
					value = false;
				}
			}
			if (key.length > 0) {
				frontmatter[key] = value;
			}
		}
		return { frontmatter, endLine: i };
	}
	// Unterminated frontmatter block → treat as no frontmatter.
	return { frontmatter: null, endLine: -1 };
}

/**
 * Extract body wikilinks with document positions (Obsidian's `links`
 * reference list). `link` carries the target without the display alias
 * (heading/block references preserved, as in the real cache).
 */
function extractBodyLinks(
	lines: string[],
	bodyStartLine: number,
): MockLinkCache[] {
	const links: MockLinkCache[] = [];
	for (let i = bodyStartLine; i < lines.length; i++) {
		const line = lines[i] ?? '';
		for (const match of line.matchAll(WIKILINK_RE)) {
			const original = match[0] ?? '';
			const inner = match[1] ?? '';
			const pipeIndex = inner.indexOf('|');
			const target =
				pipeIndex >= 0 ? inner.slice(0, pipeIndex) : inner;
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
	return links;
}

/** Build a mock metadata-cache entry for one note's content. */
function buildCache(content: string): MockCache {
	const lines = content.split('\n');
	const { frontmatter, endLine } = parseFrontmatter(lines);
	const bodyStartLine = endLine >= 0 ? endLine + 1 : 0;
	const cache: MockCache = {
		links: extractBodyLinks(lines, bodyStartLine),
	};
	if (frontmatter !== null) {
		cache.frontmatter = frontmatter;
		cache.frontmatterPosition = {
			start: { line: 0, col: 0 },
			end: { line: endLine, col: (lines[endLine] ?? '').length },
		};
	}
	return cache;
}

/**
 * Resolve a wikilink target to a fixture note, mirroring Obsidian's
 * name-based resolution for a flat vault: heading/block references are
 * stripped, then the target is matched against note paths and names.
 */
function resolveLink(
	link: string,
	files: Map<string, FixtureFile>,
): TFile | null {
	const hashIndex = link.indexOf('#');
	const target = (hashIndex >= 0 ? link.slice(0, hashIndex) : link).trim();
	if (target.length === 0) {
		return null;
	}
	for (const file of files.values()) {
		if (file.path === target || file.basename === target) {
			return toTFile(file);
		}
	}
	return null;
}

function toTFile(file: FixtureFile): TFile {
	return { path: file.path, basename: file.basename } as unknown as TFile;
}

function buildFixtureApp(files: Map<string, FixtureFile>): FixtureApp {
	const caches = new Map<string, MockCache>();
	for (const file of files.values()) {
		caches.set(file.path, buildCache(file.content));
	}
	const app = {
		metadataCache: {
			getFileCache: (f: TFile) => caches.get(f.path) ?? null,
			getFirstLinkpathDest: (link: string) => resolveLink(link, files),
		},
	} as unknown as App;
	return {
		app,
		files,
		file: (path: string) => {
			const fixture = files.get(path);
			if (fixture === undefined) {
				throw new Error(`Unknown fixture file: ${path}`);
			}
			return toTFile(fixture);
		},
	};
}

/** Load all Markdown fixtures from `tests/fixtures/` (T028). */
export function loadFixtureApp(): FixtureApp {
	const files = new Map<string, FixtureFile>();
	for (const name of readdirSync(FIXTURES_DIR)) {
		if (!name.endsWith('.md')) {
			continue;
		}
		const content = readFileSync(join(FIXTURES_DIR, name), 'utf8');
		files.set(name, {
			path: name,
			basename: name.replace(/\.md$/, ''),
			content,
		});
	}
	return buildFixtureApp(files);
}

/** Build an app from in-memory note contents (vault path → Markdown). */
export function buildAppFromContents(
	contents: Record<string, string>,
): FixtureApp {
	const files = new Map<string, FixtureFile>();
	for (const [path, content] of Object.entries(contents)) {
		files.set(path, {
			path,
			basename: path.replace(/\.md$/, ''),
			content,
		});
	}
	return buildFixtureApp(files);
}
