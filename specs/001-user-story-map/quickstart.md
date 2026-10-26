# Quickstart: User Story Map Board View

**Feature**: `001-user-story-map` | **Date**: 2026-10-15 (updated 2026-10-26, Iteration 2)

Runnable validation scenarios that prove the feature works end-to-end. Prerequisites and setup are listed first; each scenario maps to a user story / success criterion from [spec.md](spec.md). File formats are defined in [contracts/board-file-format.md](contracts/board-file-format.md) and [contracts/story-file-format.md](contracts/story-file-format.md) — this guide references them instead of duplicating them.

## Prerequisites

- Node.js 18+ (LTS) and npm.
- A test Obsidian vault (Desktop) and, for mobile checks, an Obsidian Mobile install (iOS/Android) pointing at the same vault (e.g., via a sync folder).
- The plugin built and installed into the test vault:

```bash
npm install
npm run build
# copy artifacts into the vault (adjust the vault path):
mkdir -p "<Vault>/.obsidian/plugins/<plugin-id>"
cp main.js manifest.json styles.css "<Vault>/.obsidian/plugins/<plugin-id>/"
```

- In Obsidian: **Settings → Community plugins** → enable the plugin (turn off Restricted mode if prompted).

## Test fixture (minimal board)

Create in the vault:

1. `board.md` — a board note with the flag, one config attribute, and four story links (one duplicated, one broken):

```markdown
---
usm-board: true
usm-release-order: appearance
---

- [[S1]]
- [[S2]]
- [[S1]]
- [[S4-missing]]
```

2. `S1.md`:

```markdown
---
activity: Onboarding
task: First run
epic: Setup
release: "1.0 MVP"
story: Create first board
---
Body text (not rendered on the map in MVP).
```

3. `S2.md` (missing Epic and Release → exercises "Unassigned"):

```markdown
---
activity: onboarding
task: First run
---
```

4. `S3.md` (not linked from the board — must NOT appear on the map):

```markdown
---
activity: Billing
release: "2.0"
---
```

## Scenarios

### Q1 — Board renders as a map (User Story 1, FR-001, SC-004)

1. Open `board.md` in Obsidian (first open — no `usm-view` attribute yet).
2. **Expected**: the note opens in the visual map view (not raw Markdown) — the default when `usm-view` is absent (FR-001, FR-026).
3. Open a non-board note (e.g., `S1.md`). **Expected**: plain Markdown view; the plugin does not interfere.
4. Close the `board.md` tab and reopen it (same session). **Expected**: it opens in the visual map view again (not raw Markdown) — the first-open routing is robust to the leaf-readiness race (defect 1).

### Q1b — Three-view menu, switching, and `usm-view` persistence (User Story 1, FR-002/FR-026/FR-027, SC-004)

1. With `board.md` open in the map view, click the pane header **view-switch button** (a distinct icon, not the "…" context-menu button) to open the view-switch menu.
2. **Expected**: the menu shows exactly three view options — **"USM board"** (checked, the current view), **"Edit MD"**, **"View MD"** — all visible at a glance (FR-027). No other plugin-provided entries appear.
3. Select **"Edit MD"**. **Expected**: the note switches to Obsidian's standard Markdown editor (the same editor used for any other note); the file content is unchanged (compare before/after — no bytes modified beyond the `usm-view` attribute).
4. Open `board.md` in a text editor (or inspect the frontmatter). **Expected**: the frontmatter now contains `usm-view: edit` (FR-026). No other frontmatter attribute was added or modified.
5. **Button in the Markdown view**: while the note is in the standard Markdown editor, verify the pane header still shows the **view-switch button** (the plugin adds it to the native Markdown view). Click it. **Expected**: the same three-option menu appears, with **"Edit MD"** checked (FR-027, amended).
6. Select **"View MD"** via the view-switch button. **Expected**: the note switches to Obsidian's standard Markdown preview; content unchanged. Frontmatter now reads `usm-view: preview`.
7. Select **"USM board"** via the view-switch button. **Expected**: the note switches back to the visual map; identical map, no content drift. Frontmatter now reads `usm-view: map`.
8. Close the note and reopen it. **Expected**: it reopens in the visual map view (the last-selected view, `usm-view: map`) (FR-026).
9. Switch to **"Edit MD"**, close, and reopen. **Expected**: it reopens in the standard Markdown editor (last-selected view restored).
10. **Multi-pane**: open `board.md` in two panes (e.g., split view). Switch pane A to **"Edit MD"**. **Expected**: pane A shows the editor; pane B is unaffected (still shows its current view). The frontmatter reads `usm-view: edit` (last switch wins). Switch pane B to **"View MD"**. **Expected**: pane B shows the preview; pane A is unaffected. Frontmatter now reads `usm-view: preview`. Close both panes and reopen the note. **Expected**: it reopens in the preview (the last switch won) (FR-026, spec edge case).
11. **Unrecognized value**: manually set `usm-view: bogus` in the frontmatter, save, and reopen the note. **Expected**: it opens in the visual map view (default fallback) (FR-026, spec edge case).
12. **View-switch button, not a command**: verify the pane header shows the dedicated **view-switch button** (a distinct icon, not "…") in all three view states, and that the command palette contains **no** plugin command for switching views (FR-002, amended). The "…" button remains the native context menu (unchanged).
13. **Tab label**: verify the tab and breadcrumbs show the note's file name (e.g., "board"), not a constant "USM board" label — the tab stays consistent with the file list (FR-027).

### Q2 — 2D grid grouping and ordering (User Story 2, FR-005/FR-006, SC-002)

1. With the map open, inspect the layout.
2. **Expected**:
   - One column group `Onboarding` → sub-column `First run` → column `Setup`; `S1` appears twice (duplicate link) in the `1.0 MVP` row.
   - `S2` appears in the `Unassigned` row (missing Release) under the same Activity/Task, with `Unassigned` Epic column.
   - `S3` does **not** appear (not linked from the board).
   - The broken link `[[S4-missing]]` renders a dimmed placeholder card in the `Unassigned` sections.
3. Change `usm-release-order` in `board.md` frontmatter to `alphabetical`, save.
4. **Expected**: rows re-sort alphabetically within ~2 seconds (SC-005), no manual reload.

### Q3 — Card titles and badge (User Story 3, FR-009/FR-010)

1. **Expected**: `S1` cards show the title "Create first board" (from the `Story` attribute) and a footer badge with `1.0 MVP`.
2. Rename `S1.md`'s `story` attribute away and add `title: Fallback title`. **Expected**: card title becomes "Fallback title".
3. Remove both. **Expected**: card title falls back to the file name (`S1`).
4. Click a card. **Expected**: the story note opens in the standard view (FR-019).

### Q4 — 2D navigation with sticky headers (User Story 4, FR-014, SC-006)

1. Extend the fixture: add stories covering ≥ 10 columns (Activity/Task/Epic combinations) and ≥ 5 releases.
2. Scroll horizontally and vertically.
3. **Expected**: all columns/rows reachable; column and row headers remain visible while scrolling (sticky).

### Q5 — Incomplete data resilience (User Story 5, FR-011, SC-003)

1. Create a story with **no frontmatter at all** and link it from the board.
2. **Expected**: it appears in "Unassigned" at every level; no error, no crash, no intrusive notification.

### Q6 — Live updates (User Story 6, FR-013, SC-005)

1. With the map open, edit a story's `release` value in Markdown.
2. **Expected**: the card moves to the new row within 2 seconds, without touching the map.
3. Add a new wikilink to `board.md`. **Expected**: the new card appears automatically.
4. Attempt to edit a card on the map (drag, double-click, context menu). **Expected**: no editing affordances — the map is read-only (FR-015).

### Q7 — Debug/dev mode (FR-020, SC-001)

1. Enable debug mode in the plugin settings.
2. Open the map. **Expected**: a metrics panel shows fps, rendered story count, and last render duration.
3. Disable debug mode. **Expected**: the panel disappears; no measurable overhead remains.

### Q8 — Security (FR-016)

1. Create a story whose `story` attribute contains `<img src=x onerror=alert(1)>` and a story whose body contains a script tag.
2. **Expected**: the attribute value renders as inert text on the card; nothing executes; no alert appears.

### Q9 — Portability (Principle VI, FR-021)

1. Disable the plugin. **Expected**: `board.md` is a plain, readable bulleted list of links.
2. Copy the vault (or just the notes) to a fresh Obsidian install without the plugin, then install the plugin.
3. **Expected**: the map renders identically to the original — configuration survived from the board file alone.

### Q10 — Mobile smoke test

1. Open the board on a phone/tablet.
2. **Expected**: the map renders, scrolls in both axes with sticky headers, cards are tappable (open the note), and debug metrics are available. No desktop-only behavior.

## Iteration 2 scenarios (Visual Layer Refactor)

The MVP scenarios Q1–Q10 (incl. Q1b) remain valid and MUST still pass after the refactor (SC-015). The scenarios below verify the new section-based layout.

### Q11 — Release sections and sticky header block (FR-029, FR-030, US8)

1. Open a board with at least two releases (e.g., `usm-release-order: appearance` with stories in two different releases).
2. **Expected**: the board shows a sticky column-header block (Activity/Task/Epic, three rows) at the top; below it, each release renders as a self-contained section with a horizontal header row (chevron + release title + top divider) and its own grid of Epic columns. The release header is **not** sticky — it scrolls away with its section; the column-header block stays pinned at the top while scrolling vertically.
3. Scroll horizontally. **Expected**: the sticky header block scrolls horizontally with the content (columns stay aligned); no sticky left column exists anymore.

### Q12 — Unassigned release section first (FR-011, FR-031, US8 scenario 4)

1. Use a board where at least one story has no `release` attribute (and at least one story has a release).
2. **Expected**: a dedicated "Unassigned" release section renders as the **first section** (top of the board, directly below the sticky header block), containing the stories without a Release. Other release sections follow in the configured order. "Unassigned" groups at the Activity/Task/Epic levels still appear as "Unassigned" column groups in the header block.

### Q13 — Column alignment and fixed width (FR-032, SC-012)

1. Open a board with several Epic columns of differing content lengths (short and long titles, varying card counts per release).
2. **Expected**: columns are perfectly aligned across the header block and every release section — the same fixed width in every grid (no per-grid divergence). Long titles wrap/clamp within the column width.

### Q14 — Mobile layout (FR-030, SC-011, US7)

1. Open the board on a phone (~375 px wide) or narrow the Obsidian window to ~375 px.
2. **Expected**: the release header occupies ≤ 32 px of vertical space (compact horizontal row); the column-header block is sticky at the top; the board scrolls in both axes; columns use the mobile width (~160 px); no sticky left column.

### Q15 — Themes and reserved DOM (FR-033, FR-034, SC-013, US9, US10)

1. Switch Obsidian between light and dark themes (Settings → Appearance). **Expected**: the board renders correctly in both themes — no hard-coded colors, no unreadable text, accent shades adapt automatically (no reload needed).
2. Inspect the DOM (DevTools). **Expected**: every `.usm-release-header` contains a visible, inert `button.usm-release-toggle` (chevron) — clicking it does nothing; DnD handles and add/remove button slots are present in the DOM but invisible; no reserved element responds to any interaction.
3. **Expected**: the chevron is visible (per the Figma design) but non-interactive — no collapse, no DnD, no add/remove behavior in this iteration.

## Automated test suite (FR-022, FR-023, FR-024, SC-009, SC-010)

The automated suite runs in Node.js (no Obsidian instance required) against the versioned fixtures in `tests/fixtures/`:

```bash
npm test                # full suite: unit + integration + performance
npm run test:unit       # core logic only (parser, attributes, model, sanitize)
npm run test:integration  # full pipeline: board + story fixtures → GridModel (SC-002, SC-003)
npm run test:perf       # render performance on a defined board size (FR-024, SC-001)
```

**Expected**:
- All unit tests pass: flag detection, config parsing, link extraction (duplicates, broken links), PL/EN synonym matching, title cascade, grid model (column hierarchy, row order, Unassigned grouping, case-insensitive values), XSS neutralization.
- Integration tests pass: the fixture board + story notes produce the expected `GridModel` (correct cells, order, Unassigned flags).
- Performance tests pass: render time and story count on the defined board size are within the thresholds recorded by the test run (thresholds are established by the first passing run and then enforced).
- The full suite completes in under 2 minutes on a clean environment (SC-010).

The manual scenarios Q1–Q10 (incl. Q1b) cover the user-facing behavior that requires the real Obsidian environment (three-view picker, `usm-view` persistence, 2D navigation, live updates, mobile). The Iteration 2 scenarios Q11–Q15 cover the section-based layout (release sections, Unassigned-first, column alignment, mobile header height, themes, reserved DOM).

## Pass criteria

All automated tests pass (unit + integration + performance, under 2 minutes) **and** all manual scenarios Q1–Q15 pass on Desktop; Q10 and Q14 pass on at least one mobile device. Any failure blocks `/speckit-tasks` completion for the affected requirement.
