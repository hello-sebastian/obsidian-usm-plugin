/**
 * Unit tests for story attribute reading (T031, US3).
 *
 * Covers `readStoryAttributes`, `resolveStoryTitle`,
 * `normalizeAttributeValue`, and `parseWikilink` from
 * `src/story/story-attributes.ts` against the versioned fixtures (T028)
 * and in-memory notes:
 * - PL/EN synonym matching (activity/aktywność, task/zadanie,
 *   epic/epik, release/wydanie/row) — FR-012
 * - case-insensitive field name matching — FR-012
 * - plain-text vs. wikilink value distinction (`{ text, linkPath? }`) — FR-007
 * - title cascade (`Story` → `title` → first alias → file name) — FR-009
 * - missing frontmatter → all attributes `null` — FR-011
 */
import { describe, it, expect } from 'vitest';
import {
	parseWikilink,
	normalizeAttributeValue,
	readStoryAttributes,
	resolveStoryTitle,
} from '../../src/story/story-attributes';
import { loadFixtureApp, buildAppFromContents } from '../helpers/fixture-app';

describe('readStoryAttributes — PL/EN synonyms (T031)', () => {
	it('reads English field names from the S1 fixture (FR-012)', () => {
		const { app, file } = loadFixtureApp();
		expect(readStoryAttributes(app, file('S1.md'))).toEqual({
			activity: { text: 'Onboarding' },
			task: { text: 'First run' },
			epic: { text: 'Onboarding flow' },
			release: { text: '1.0 MVP' },
		});
	});

	it('reads Polish field names from the S4 fixture (FR-012)', () => {
		const { app, file } = loadFixtureApp();
		expect(readStoryAttributes(app, file('S4.md'))).toEqual({
			activity: { text: 'Logowanie' },
			task: { text: 'Login' },
			epic: { text: 'Auth' },
			release: { text: '2.0' },
		});
	});

	it('maps every synonym to its canonical field (FR-012)', () => {
		const { app, file } = buildAppFromContents({
			's.md': [
				'---',
				'aktywność: A1',
				'zadanie: T1',
				'epik: E1',
				'row: R1',
				'---',
				'body',
			].join('\n'),
		});
		expect(readStoryAttributes(app, file('s.md'))).toEqual({
			activity: { text: 'A1' },
			task: { text: 'T1' },
			epic: { text: 'E1' },
			release: { text: 'R1' },
		});
	});

	it('matches field names case-insensitively (FR-012)', () => {
		const { app, file } = buildAppFromContents({
			's.md': [
				'---',
				'ACTIVITY: A1',
				'Task: T1',
				'EpIc: E1',
				'Release: R1',
				'---',
				'body',
			].join('\n'),
		});
		expect(readStoryAttributes(app, file('s.md'))).toEqual({
			activity: { text: 'A1' },
			task: { text: 'T1' },
			epic: { text: 'E1' },
			release: { text: 'R1' },
		});
	});

	it('ignores unknown frontmatter attributes (spec edge case)', () => {
		const { app, file } = buildAppFromContents({
			's.md': [
				'---',
				'activity: A1',
				'status: In Progress',
				'priority: high',
				'---',
				'body',
			].join('\n'),
		});
		expect(readStoryAttributes(app, file('s.md'))).toEqual({
			activity: { text: 'A1' },
			task: null,
			epic: null,
			release: null,
		});
	});

	it('does not leak story/title fields into the grid attributes (FR-009)', () => {
		const { app, file } = buildAppFromContents({
			's.md': [
				'---',
				'story: My story',
				'title: My title',
				'---',
				'body',
			].join('\n'),
		});
		expect(readStoryAttributes(app, file('s.md'))).toEqual({
			activity: null,
			task: null,
			epic: null,
			release: null,
		});
	});
});

describe('readStoryAttributes — value types (T031)', () => {
	it('returns plain-text values without a linkPath (FR-007)', () => {
		const { app, file } = loadFixtureApp();
		const attrs = readStoryAttributes(app, file('S1.md'));
		expect(attrs.activity).toEqual({ text: 'Onboarding' });
		expect(attrs.activity?.linkPath).toBeUndefined();
	});

	it('returns wikilink values with a linkPath when the target exists (FR-007)', () => {
		const { app, file } = buildAppFromContents({
			's.md': '---\nepic: "[[Auth]]"\n---\nbody\n',
			'Auth.md': 'auth note\n',
		});
		expect(readStoryAttributes(app, file('s.md')).epic).toEqual({
			text: 'Auth',
			linkPath: 'Auth.md',
		});
	});

	it('uses the wikilink alias as the display text (FR-007)', () => {
		const { app, file } = buildAppFromContents({
			's.md': '---\nepic: "[[Auth|Authentication epic]]"\n---\nbody\n',
			'Auth.md': 'auth note\n',
		});
		expect(readStoryAttributes(app, file('s.md')).epic).toEqual({
			text: 'Authentication epic',
			linkPath: 'Auth.md',
		});
	});

	it('strips heading references from wikilink value targets (FR-007)', () => {
		const { app, file } = buildAppFromContents({
			's.md': '---\nepic: "[[Auth#Details]]"\n---\nbody\n',
			'Auth.md': 'auth note\n\n## Details\n',
		});
		expect(readStoryAttributes(app, file('s.md')).epic).toEqual({
			text: 'Auth',
			linkPath: 'Auth.md',
		});
	});

	it('degrades a broken wikilink value to an inert label (FR-007)', () => {
		const { app, file } = loadFixtureApp();
		// S1's epic `[[Onboarding flow]]` has no matching fixture note.
		const attrs = readStoryAttributes(app, file('S1.md'));
		expect(attrs.epic).toEqual({ text: 'Onboarding flow' });
		expect(attrs.epic?.linkPath).toBeUndefined();
	});

	it('coerces non-string scalars to their text form', () => {
		const { app } = buildAppFromContents({
			's.md': 'body\n',
		});
		expect(normalizeAttributeValue(app, 2, 's.md')).toEqual({ text: '2' });
		expect(normalizeAttributeValue(app, true, 's.md')).toEqual({
			text: 'true',
		});
	});

	it('treats empty and non-scalar values as missing', () => {
		const { app } = buildAppFromContents({
			's.md': 'body\n',
		});
		expect(normalizeAttributeValue(app, '', 's.md')).toBeNull();
		expect(normalizeAttributeValue(app, '   ', 's.md')).toBeNull();
		expect(normalizeAttributeValue(app, null, 's.md')).toBeNull();
		expect(normalizeAttributeValue(app, undefined, 's.md')).toBeNull();
	});

	it('treats an empty-string frontmatter value as missing (FR-011)', () => {
		const { app, file } = buildAppFromContents({
			's.md': '---\nactivity: ""\n---\nbody\n',
		});
		expect(readStoryAttributes(app, file('s.md')).activity).toBeNull();
	});
});

describe('readStoryAttributes — missing attributes (T031)', () => {
	it('returns null for a missing epic (S2 fixture) (FR-011)', () => {
		const { app, file } = loadFixtureApp();
		expect(readStoryAttributes(app, file('S2.md'))).toEqual({
			activity: { text: 'Onboarding' },
			task: { text: 'First run' },
			epic: null,
			release: { text: '1.0 MVP' },
		});
	});

	it('returns null for a missing activity (S5 fixture) (FR-011)', () => {
		const { app, file } = loadFixtureApp();
		expect(readStoryAttributes(app, file('S5.md'))).toEqual({
			activity: null,
			task: { text: 'first run' },
			epic: { text: 'Onboarding flow' },
			release: { text: '2.0' },
		});
	});

	it('returns null for a missing release (S6 fixture) (FR-011)', () => {
		const { app, file } = loadFixtureApp();
		expect(readStoryAttributes(app, file('S6.md'))).toEqual({
			activity: { text: 'onboarding' },
			task: { text: 'First run' },
			epic: { text: 'Onboarding flow' },
			release: null,
		});
	});

	it('returns all-null attributes for a note with no frontmatter (S3 fixture) (FR-011)', () => {
		const { app, file } = loadFixtureApp();
		expect(readStoryAttributes(app, file('S3.md'))).toEqual({
			activity: null,
			task: null,
			epic: null,
			release: null,
		});
	});

	it('returns all-null attributes for a file with no cache entry (FR-011)', () => {
		const { app } = buildAppFromContents({
			's.md': 'body\n',
		});
		const unknown = { path: 'unknown.md', basename: 'unknown' } as never;
		expect(readStoryAttributes(app, unknown)).toEqual({
			activity: null,
			task: null,
			epic: null,
			release: null,
		});
	});
});

describe('resolveStoryTitle — title cascade (T031)', () => {
	it('prefers the Story attribute (S1 fixture) (FR-009)', () => {
		const { app, file } = loadFixtureApp();
		expect(resolveStoryTitle(app, file('S1.md'))).toBe('Create first board');
	});

	it('falls back to the title attribute (S2 fixture) (FR-009)', () => {
		const { app, file } = loadFixtureApp();
		expect(resolveStoryTitle(app, file('S2.md'))).toBe('First login');
	});

	it('falls back to the title attribute with Polish fields (S4 fixture) (FR-009)', () => {
		const { app, file } = loadFixtureApp();
		expect(resolveStoryTitle(app, file('S4.md'))).toBe('Historia po polsku');
	});

	it('falls back to the file name when no frontmatter exists (S3 fixture) (FR-009)', () => {
		const { app, file } = loadFixtureApp();
		expect(resolveStoryTitle(app, file('S3.md'))).toBe('S3');
	});

	it('falls back to the first alias when story and title are absent (FR-009)', () => {
		const { app, file } = buildAppFromContents({
			's.md': [
				'---',
				'aliases: [First alias, Second alias]',
				'---',
				'body',
			].join('\n'),
		});
		expect(resolveStoryTitle(app, file('s.md'))).toBe('First alias');
	});

	it('prefers Story over title and aliases (FR-009)', () => {
		const { app, file } = buildAppFromContents({
			's.md': [
				'---',
				'story: Story wins',
				'title: Title loses',
				'aliases: [Alias loses too]',
				'---',
				'body',
			].join('\n'),
		});
		expect(resolveStoryTitle(app, file('s.md'))).toBe('Story wins');
	});

	it('prefers title over aliases (FR-009)', () => {
		const { app, file } = buildAppFromContents({
			's.md': [
				'---',
				'title: Title wins',
				'aliases: [Alias loses]',
				'---',
				'body',
			].join('\n'),
		});
		expect(resolveStoryTitle(app, file('s.md'))).toBe('Title wins');
	});

	it('skips an empty Story value and uses title (FR-009)', () => {
		const { app, file } = buildAppFromContents({
			's.md': '---\nstory: ""\ntitle: Fallback title\n---\nbody\n',
		});
		expect(resolveStoryTitle(app, file('s.md'))).toBe('Fallback title');
	});

	it('skips empty aliases and falls back to the file name (FR-009)', () => {
		const { app, file } = buildAppFromContents({
			's.md': [
				'---',
				'aliases: ["", "   "]',
				'---',
				'body',
			].join('\n'),
		});
		expect(resolveStoryTitle(app, file('s.md'))).toBe('s');
	});

	it('matches story/title/aliases field names case-insensitively (FR-009, FR-012)', () => {
		const { app, file } = buildAppFromContents({
			's.md': [
				'---',
				'STORY: Uppercase story',
				'Aliases: [First alias]',
				'---',
				'body',
			].join('\n'),
		});
		expect(resolveStoryTitle(app, file('s.md'))).toBe('Uppercase story');
	});

	it('falls back to the file name for a file with no cache entry (FR-009)', () => {
		const { app } = buildAppFromContents({
			's.md': 'body\n',
		});
		const unknown = { path: 'unknown.md', basename: 'unknown' } as never;
		expect(resolveStoryTitle(app, unknown)).toBe('unknown');
	});
});

describe('parseWikilink (T031)', () => {
	it('parses a plain wikilink target', () => {
		expect(parseWikilink('[[Target]]')).toEqual({
			target: 'Target',
			alias: '',
		});
	});

	it('parses a wikilink with a display alias', () => {
		expect(parseWikilink('[[Target|Alias]]')).toEqual({
			target: 'Target',
			alias: 'Alias',
		});
	});

	it('strips heading references from the target', () => {
		expect(parseWikilink('[[Target#Heading]]')).toEqual({
			target: 'Target',
			alias: '',
		});
	});

	it('parses a wikilink with both heading and alias', () => {
		expect(parseWikilink('[[Target#Heading|Alias]]')).toEqual({
			target: 'Target',
			alias: 'Alias',
		});
	});

	it('trims surrounding whitespace', () => {
		expect(parseWikilink('  [[Target]]  ')).toEqual({
			target: 'Target',
			alias: '',
		});
	});

	it('returns null for plain text', () => {
		expect(parseWikilink('plain text')).toBeNull();
	});

	it('returns null for an empty target', () => {
		expect(parseWikilink('[[ ]]')).toBeNull();
	});
});
