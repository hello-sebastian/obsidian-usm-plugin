# Data Model: User Story Map Board View

**Feature**: `001-user-story-map` | **Date**: 2026-10-15 (updated 2026-10-23)

The plugin owns **no persistent data of its own**. All entities below are in-memory representations derived from Markdown files via `app.metadataCache`. The only persisted state is the plugin setting `debugMode` (via `saveData`). The single sanctioned board-file write is the `usm-view` frontmatter attribute (last-selected view, FR-026) — board-level state lives in the board file, not in plugin storage (FR-028).

## E-01: Board Note (source)

Markdown file in the vault.

| Aspect | Rule |
|--------|------|
| Flag | Frontmatter attribute `usm-board: true` (boolean). Without it, the file is a plain note — the plugin does not interfere (FR-001). |
| Story list | Ordered list of wikilinks in the file body. Every non-wikilink line (headers, text, comments) is ignored (FR-003). |
| Duplicates | Each wikilink occurrence produces a separate card, in order of appearance (FR-018). |
| Config | Board-level attributes in frontmatter (see E-02). Unknown attributes are ignored. |
| Portability | The file must remain a readable, plain bulleted list of links when the plugin is disabled (FR-017) and self-describing without the plugin (Principle VI). |

## E-02: BoardConfig (in-memory)

Parsed from the board file frontmatter.

| Field | Type | Source attribute | Default | Notes |
|-------|------|------------------|---------|-------|
| `isBoard` | `boolean` | `usm-board` | `false` | Gate for map rendering. |
| `releaseRowOrder` | `'appearance' \| 'alphabetical'` | board config attribute (see `contracts/board-file-format.md`) | `'appearance'` | FR-006: row ordering strategy. |
| `usmView` | `'map' \| 'edit' \| 'preview'` | `usm-view` | `'map'` | FR-026: last-selected view type. Read when the board note is opened (restores the view); written back via `vault.process()` when the user switches views. Missing or unrecognized values fall back to `'map'`. |

Validation: unknown/invalid values fall back to defaults; no errors are raised (spec edge case: unknown config attributes are ignored).

## E-03: Story Note (source)

Markdown file referenced by a wikilink in the board file.

| Aspect | Rule |
|--------|------|
| Attributes | Frontmatter fields matched case-insensitively against the PL/EN synonym dictionary (FR-012): Activity (`activity`/`aktywność`), Task (`task`/`zadanie`), Epic (`epic`/`epik`), Release (`release`/`wydanie`/`row`), plus `Story` and `title`. |
| Value types | Plain text or wikilink. A wikilink value makes the rendered header clickable (opens the linked note); plain text renders as a visual label only (FR-007). |
| Missing frontmatter | All attributes treated as missing → story is bucketed into "Unassigned" sections (FR-011, spec edge case). |
| Title cascade | `Story` → `title` → first alias → file name (FR-009). |

## E-04: StoryEntry (in-memory)

One entry per wikilink occurrence in the board file (duplicates are distinct entries).

| Field | Type | Derivation |
|-------|------|-----------|
| `id` | `string` | Stable per-occurrence key (board file path + occurrence index). |
| `targetPath` | `string \| null` | Resolved note path; `null` for broken links. |
| `linkText` | `string` | Display text of the wikilink (fallback for broken links). |
| `attributes` | `StoryAttributes` | Normalized attributes (E-05); all fields optional. |
| `title` | `string` | Resolved via the title cascade (E-03). |
| `isBroken` | `boolean` | `true` when the wikilink resolves to no note. |

## E-05: StoryAttributes (in-memory)

| Field | Type | Notes |
|-------|------|-------|
| `activity` | `{ text: string; linkPath?: string } \| null` | `null` → "Unassigned" column group. |
| `task` | `{ text: string; linkPath?: string } \| null` | `null` → "Unassigned" sub-column. |
| `epic` | `{ text: string; linkPath?: string } \| null` | `null` → "Unassigned" column. |
| `release` | `{ text: string; linkPath?: string } \| null` | `null` → "Unassigned" row; also drives the card badge (FR-010: badge shows the Release value only in MVP). |

Normalization: values are trimmed; matching of *field names* is case-insensitive with PL/EN synonyms; *values* are compared case-insensitively so that e.g. `Login` and `logowanie`-style variants of the same value group together (spec edge case: case-insensitive value matching).

## E-06: GridModel (in-memory)

Built by `board-model.ts` from `BoardConfig` + `StoryEntry[]`.

| Field | Type | Notes |
|-------|------|-------|
| `activities` | `ColumnGroup[]` | Ordered by first appearance in the board file (FR-005). |
| `releases` | `string[]` | Row labels, ordered per `BoardConfig.releaseRowOrder` (FR-006). |
| `cells` | `Map<string, StoryEntry[]>` | Key: `${activityKey}::${taskKey}::${epicKey}::${releaseKey}` (missing levels use the reserved `UNASSIGNED` key). |
| `headerLinks` | `Map<string, string>` | Link paths for header values that are wikilinks (FR-007). Key: `${level}:${normalizedKey}` where `level` is `activity` \| `task` \| `epic` \| `release`. Absent for plain-text values and `UNASSIGNED`. Lets the renderer make a header clickable without re-reading the cache. |
| `unassigned` | `boolean` flag per level | Whether an "Unassigned" section exists for columns/rows. |

### ColumnGroup

| Field | Type | Notes |
|-------|------|-------|
| `activity` | `string` | Activity label (or `UNASSIGNED`). |
| `tasks` | `TaskGroup[]` | Nested Task level, ordered by first appearance. |

### TaskGroup

| Field | Type | Notes |
|-------|------|-------|
| `task` | `string` | Task label (or `UNASSIGNED`). |
| `epics` | `string[]` | Epic labels (or `UNASSIGNED`), ordered by first appearance. |

### State transitions

The model has no lifecycle of its own — it is rebuilt from scratch on every (debounced) update event. View selection is not part of the model: the plugin's `usm-board-view` renders the map only (FR-025), while "Edit MD" / "View MD" are Obsidian's native `MarkdownView` (source/preview modes). The last-selected view is persisted as the `usm-view` frontmatter attribute (FR-026): read on open (default `map`), written on switch (last switch wins across panes; other open panes are unaffected until reopened).

## Validation rules (summary)

1. Board flag missing → file is not a board; no map (FR-001).
2. Non-wikilink lines → ignored (FR-003).
3. Broken wikilink → placeholder card, no crash (spec edge case).
4. Missing attribute at any level → "Unassigned" bucket, no error (FR-011).
5. Unknown config attribute → ignored, defaults apply (spec edge case).
6. All note-derived strings are sanitized before DOM insertion (FR-016).
