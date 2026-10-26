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

## Visual layer structure (Iteration 2, V-01)

The domain model (E-01–E-06) is **unchanged** in Iteration 2. This section defines the visual-layer structure the renderer emits from the same `GridModel` (research R-17–R-22, refactor-concept.md section 4).

### DOM tree

```text
.usm-board-map                      # single scroll container (overflow: auto, both axes)
└── .usm-board                      # width: max-content inner wrapper
    ├── .usm-board-header           # sticky top (z-index above sections), CSS Grid, 3 rows
    │   ├── .usm-header-row--activity   # row 1: .usm-header-cell--activity (spans its Task children)
    │   │   └── [RESERVED: DnD handle, add/remove buttons — invisible, inert]
    │   ├── .usm-header-row--task       # row 2: .usm-header-cell--task (spans its Epic children)
    │   │   └── [RESERVED: DnD handle, add/remove buttons — invisible, inert]
    │   └── .usm-header-row--epic       # row 3: .usm-header-cell--epic (leaf, 1 column each)
    │       └── [RESERVED: DnD handle, add/remove buttons — invisible, inert]
    └── .usm-board-releases
        └── section.usm-release        # one per release row, in order: UNASSIGNED first, then releaseRowOrder
            ├── .usm-release-header    # horizontal row (NOT sticky), top divider
            │   ├── button.usm-release-toggle   # chevron — VISIBLE, inert (no handler, no aria-expanded)
            │   ├── .usm-release-title          # release label (text node, sanitized)
            │   └── [RESERVED: DnD handle, add/remove buttons — invisible, inert]
            └── .usm-release-body
                └── .usm-release-grid   # CSS Grid, identical template to .usm-board-header
                    └── .usm-epic-column        # one per Epic leaf column
                        └── .usm-epic-column-cards
                            └── .usm-story-card # .usm-story-card-header / .usm-story-card-footer
                                └── [RESERVED: DnD handle — invisible, inert]
```

### Shared grid template (alignment guarantee, R-18)

- Every grid (`.usm-board-header` and each `.usm-release-grid`) uses the identical template: `grid-template-columns: repeat(N, var(--usm-col-w))`, where `N` = number of Epic leaf columns.
- **Observation mechanism (A-01)**: the renderer sets the template as an inline CSS custom property `--usm-grid-cols: repeat(N, var(--usm-col-w))` on **each** grid element (`.usm-board-header` and every `.usm-release-grid`). The stylesheet maps it: `grid-template-columns: var(--usm-grid-cols)`. The structural DOM test (T002) reads `el.style.getPropertyValue('--usm-grid-cols')` from each grid and asserts the value is non-empty, **identical across all grids**, and matches `repeat(N, var(--usm-col-w))` with `N` = Epic leaf column count. This is reliable in jsdom (inline custom properties round-trip via `style.setProperty`/`getPropertyValue`); computed `grid-template-columns` is NOT observable in jsdom (no layout engine, no `var()` resolution).
- `--usm-col-w` is set once on the board root: ~240 px desktop, ~160 px mobile (media query). Fixed width is a design decision, not a user setting.
- Header cells span their children: Activity cell `grid-column: span k` (k = number of Task children), Task cell `span m` (m = number of Epic children), Epic cell = 1 column.
- Alignment across all grids is guaranteed by construction — no JS geometry (R-04, R-18).

### Section ordering (R-22)

- Release sections render in `GridModel` row order with the `UNASSIGNED` release row mapped to a dedicated "Unassigned" section rendered **first** (top of the board, directly below the sticky header block).
- A release row with no stories renders an empty grid (defensive guarantee; with the current domain model, release rows are derived from stories, so this is reachable only via a synthetic model — release mechanics are deferred to a later iteration).
- "Unassigned" groups at the Activity/Task/Epic levels remain "Unassigned" column groups in the header block (unchanged, FR-011).

### Reserved elements (R-21)

| Element | Visibility | Interactivity |
|---------|-----------|---------------|
| `button.usm-release-toggle` (chevron) | visible (per Figma) | inert — no click handler, no `aria-expanded`, no action |
| DnD handles (story cards, header cells, release headers) | invisible | inert — no listeners |
| Add/remove button slots (header cells, release headers) | invisible | inert — no listeners |

### Styling contract (R-20, R-24)

- Colors: L2 Obsidian variables only (`--background-secondary`, `--background-modifier-border`, `--background-primary-alt`, `--text-normal`, `--text-muted`); accent shades via `color-mix(in oklch, var(--interactive-accent) X%, var(--background-primary))`. No hard-coded hex/rgb literals (enforced by the static guard test, R-24).
- Geometry: `--usm-*` custom properties only (per constitution v1.6.1 clarification); no inline JS visual styling.

## Validation rules (summary)

1. Board flag missing → file is not a board; no map (FR-001).
2. Non-wikilink lines → ignored (FR-003).
3. Broken wikilink → placeholder card, no crash (spec edge case).
4. Missing attribute at any level → "Unassigned" bucket, no error (FR-011).
5. Unknown config attribute → ignored, defaults apply (spec edge case).
6. All note-derived strings are sanitized before DOM insertion (FR-016).
