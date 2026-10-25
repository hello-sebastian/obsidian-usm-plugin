# Research: User Story Map Board View

**Feature**: `001-user-story-map` | **Date**: 2026-10-15 (updated 2026-10-23)

All NEEDS CLARIFICATION items from the Technical Context were resolved during the `/speckit-clarify` sessions (10 questions total across 2026-10-15, 2026-10-22, and 2026-10-23). This document records the remaining technical decisions, their rationale, and alternatives considered. The 2026-10-22/23 clarifications (FR-025–FR-028) supersede the original dual-mode view design: the plugin now registers a single map-only view in Obsidian's native view picker and does not render the board note's text itself.

## R-01: View architecture (native view picker, map-only custom view)

- **Decision**: Register a single custom file view (a `FileView` subclass, view type `usm-board-view`) via `plugin.registerView`. This view renders **only** the visual map. It appears in Obsidian's native "change view" picker (the pane header button) alongside the standard Markdown editor ("Edit MD") and standard Markdown preview ("View MD") — the three options required by FR-027. The plugin does **not** render the board note's text itself (FR-025): text display and editing are always Obsidian's standard Markdown view. The plugin provides no pane header icon and no command palette command for switching (FR-002).
- **Rationale**: Constitution Principle I mandates reusing Obsidian's built-in view system rather than reimplementing it. Registering a `FileView` makes the map a first-class, native view in the picker (FR-027: all three options visible at a glance). Because the map view and the Markdown views are separate leaves, switching between them is exactly what the native picker does — no custom toggle UI is needed, and the note content is never touched by the plugin (SC-004).
- **Alternatives considered**:
  - *Dual-mode `TextFileView` (original design)*: rejected — it rendered the board source as inert text inside the plugin's own view (a plugin-implemented text display, an FR-025 violation) and required a custom pane header icon + command palette command to toggle (an FR-002 violation). Superseded by the 2026-10-22/23 clarifications.
  - *`ItemView` (non-file) for the map*: rejected — a non-file view loses the file context (no `file`, no file lifecycle), making it harder to bind the map to a specific board note and to coexist with the Markdown views of the same note.
  - *Overlay/iframe approach*: rejected — non-native, poor mobile behavior, harder accessibility.

## R-02: Data access strategy

- **Decision**: All board and story data is read exclusively through `app.metadataCache.getFileCache(path)` (frontmatter, links, aliases, tags). No synchronous disk reads, no `vault.read()` for map construction.
- **Rationale**: Constitution Principle V mandates `metadataCache`-only access. It is the fast, in-memory index Obsidian maintains; it also provides the `metadataCache.on('changed')` event for reactivity.
- **Alternatives considered**:
  - *`vault.read()` + manual frontmatter parsing*: rejected — synchronous disk I/O, slower, duplicates Obsidian's parser, violates the constitution.

## R-03: Reactivity and update strategy

- **Decision**: Listen to `metadataCache.on('changed')` (fires when a file's metadata is re-indexed) and `vault.on('modify')` as a fallback signal. Events are filtered to the board file and its linked story files, then debounced (single pending re-render per burst of changes). On update, the grid model is rebuilt from scratch (cheap: in-memory data only) and the DOM is re-rendered.
- **Rationale**: Rebuilding the model from the cache is simpler and less error-prone than incremental diffing, and the data volume (hundreds of stories max in practice) makes a full rebuild fast. Debouncing satisfies FR-013 ("no excessive re-rendering during active editing") and SC-005 (update within 2s).
- **Alternatives considered**:
  - *Incremental DOM diffing*: rejected for MVP — higher complexity, marginal benefit at this scale; revisit if debug metrics show a problem.
  - *Polling*: rejected — wasteful and violates the event-driven mandate.

## R-04: Grid layout mechanism

- **Decision**: CSS Grid for the 2D layout: one grid container with `grid-template-columns` generated from the Activity→Task→Epic hierarchy (nested group headers rendered as spanning header cells) and `grid-template-rows` from the Release list. The container uses `overflow: auto` in both axes; column/row header cells use `position: sticky` so they stay visible while scrolling (FR-014, SC-006).
- **Rationale**: Constitution Principle V mandates native browser layout mechanisms (CSS Grid/Flexbox, `overflow: auto`) and minimal manual geometry in JS. Sticky headers are a pure-CSS solution that works on desktop and mobile.
- **Alternatives considered**:
  - *Flexbox with nested scroll containers*: rejected — coordinating two independent scroll axes with sticky headers is more fragile than a single scroll container with CSS Grid.
  - *Manual absolute positioning*: rejected — violates the constitution, poor accessibility, expensive.

## R-05: XSS sanitization approach

- **Decision**: All note-derived strings (titles, attribute values, badges) are inserted into the DOM via `createEl`/`setText` (text nodes) rather than `innerHTML`. The only place HTML is constructed is the card skeleton, which contains no user data. A `sanitize.ts` utility provides an explicit escape function for the rare case where markup is needed (e.g., rendering a wikilink value as a clickable label).
- **Rationale**: Text-node insertion is the strongest guarantee against XSS (FR-016) and requires no external sanitizer library (constitution: minimize dependencies).
- **Alternatives considered**:
  - *DOMPurify or similar library*: rejected — adds a runtime dependency for a problem fully solved by text-node insertion.

## R-06: Field name matching (PL/EN synonyms)

- **Decision**: A built-in synonym dictionary maps normalized (lowercased, trimmed) field names to canonical attributes: `activity`/`aktywność` → Activity; `task`/`zadanie` → Task; `epic`/`epik` → Epic; `release`/`wydanie`/`row` → Release; `story` → Story; `title` → title. Matching is case-insensitive. Unknown fields are ignored.
- **Rationale**: FR-012 requires case-insensitive PL/EN matching; the spec's Assumptions state the dictionary is built-in and not user-configurable in MVP.
- **Alternatives considered**:
  - *User-configurable field mapping in plugin settings*: rejected for MVP — the spec explicitly defers this; board-file config covers board-level needs only.

## R-07: Debug/dev mode mechanism

- **Decision**: A plugin setting (`debugMode: boolean`, default `false`) toggles the debug panel. When enabled, the map view renders a small overlay/panel showing: current fps (measured via `requestAnimationFrame` deltas while the view is visible), number of rendered story cards, and last render duration (ms). Metrics are computed only while the panel is active (no overhead when disabled).
- **Rationale**: FR-020 requires fps and story-count metrics for performance measurement. A setting-based toggle is the simplest, non-intrusive mechanism; the `requestAnimationFrame` loop is registered via `registerInterval`-style cleanup (cancelled on view close / toggle off) to satisfy Principle III.
- **Alternatives considered**:
  - *Command-palette-only toggle (no persisted setting)*: rejected — a persisted setting is more discoverable and matches Obsidian plugin conventions.
  - *Always-on hidden metrics*: rejected — violates the "no overhead when unused" performance principle.

## R-08: Board file configuration attributes

- **Decision**: Board-level configuration is read from the board file frontmatter as plain attributes alongside the `usm-board: true` flag. MVP attributes: row ordering for Release (default: order of first appearance; optional: alphabetical sort) and `usm-view` (last-selected view type: `map` / `edit` / `preview`, default `map` — FR-026). Unknown attributes are ignored (edge case in spec). Exact attribute key names are defined in `contracts/board-file-format.md`.
- **Rationale**: Constitution Principle VI mandates self-describing, portable board config in the board file frontmatter.
- **Alternatives considered**:
  - *Plugin settings storage (`saveData`)*: rejected — not portable across sync/copy/reinstall, not AI-readable, violates Principle VI.

## R-09: i18n foundation

- **Decision**: All UI strings (section headers, "Unassigned" label, command names, icon tooltips, debug panel labels) are read from a single `en` dictionary module (`src/ui/en.ts`). Code never hardcodes user-facing strings. The dictionary is a flat `Record<string, string>` keyed by semantic string IDs.
- **Rationale**: Clarification session 2 (2026-10-15): MVP is English-only, but the dictionary mechanism is the agreed foundation for future multilingual support (additional locale files to be developed in later iterations).
- **Alternatives considered**:
  - *Hardcoded strings*: rejected — the user explicitly requires the dictionary foundation in MVP.
  - *Full i18n framework with locale switching*: rejected — out of MVP scope.

## R-10: Card click behavior (MVP)

- **Decision**: Clicking a story card opens the linked story note in the standard view (`app.workspace.openLinkText` / leaf open). Cards are implemented as focusable elements (`tabindex`, `role="button"`, Enter/Space key handling) for keyboard accessibility (Constitution Principle IV).
- **Rationale**: Clarification session 1: MVP opens the note; a graphical popup/dialog is explicitly deferred to a later iteration (recorded in spec Assumptions).
- **Alternatives considered**:
  - *In-map popup in MVP*: rejected — explicitly out of scope per clarification.

## R-11: Broken links and missing notes

- **Decision**: A wikilink in the board file that resolves to no existing note renders a placeholder card (dimmed, showing the link text) in the correct grid position (position is derived from the board file order; without a note, all attributes are missing → "Unassigned" sections). No error is thrown; the map never hangs.
- **Rationale**: Spec edge case: broken links show as unrecognized placeholders; the map must not crash.
- **Alternatives considered**:
  - *Skip broken links silently*: rejected — the spec requires a visible placeholder.
  - *Show a Notice per broken link*: rejected — violates the "non-intrusive errors" principle (Principle IV) for a common, non-fatal condition.

## R-12: Title cascade and line clamping

- **Decision**: Title resolution order: `Story` frontmatter attribute → `title` frontmatter attribute → first alias (from `metadataCache` aliases) → file name (without extension). Clamping to a small fixed number of lines (2–3) is done with CSS (`-webkit-line-clamp`) — a pure-CSS, zero-JS solution.
- **Rationale**: FR-009 defines the cascade; the spec's Assumptions state the exact line count is an interface detail. CSS clamping keeps it theme-adaptive and cheap.
- **Alternatives considered**:
  - *JS-based truncation*: rejected — unnecessary; CSS line-clamp is standard and mobile-compatible.

## R-13: Automated test framework and testability design

- **Decision**: Vitest as the test runner (unit + integration + performance tests). The core logic modules (`board-parser.ts`, `story-attributes.ts`, `board-model.ts`, `sanitize.ts`) are implemented as **pure functions** that take plain data (file content strings, cache-shaped objects) and return plain results — no direct `app`/`metadataCache` references inside the tested functions. A thin adapter layer in the view wires the real `metadataCache` into these functions. Tests live in `tests/` (unit, integration, performance) with versioned fixture notes in `tests/fixtures/` (FR-022, FR-023). Performance tests (FR-024) measure render time and story count on a board of a defined size (e.g., 10 columns × 5 rows × N stories) using the same metrics the debug panel exposes (R-07), establishing the thresholds referenced in SC-001. The suite must run in under 2 minutes on a clean environment (SC-010).
- **Rationale**: The spec (Testing Strategy, FR-022–FR-024, SC-009–SC-010) makes tests a first-class part of the MVP — the baseline that defines whether the goals are achieved. Vitest is chosen because it is a zero-config, fast, TypeScript-native runner that works in Node.js without a browser, which fits the pure-function design of the core logic and the constitution's dependency-minimization rule (one dev-only dependency, no runtime impact on `main.js`). Pure-function design keeps the tested logic free of Obsidian runtime dependencies, so the suite runs in CI and locally without an Obsidian instance; user-facing behavior (three-view picker, `usm-view` persistence, 2D navigation, live updates, mobile) remains covered by the manual quickstart scenarios, which require the real application environment.
- **Alternatives considered**:
  - *Jest*: rejected — functionally equivalent but heavier configuration for a TypeScript project; Vitest is the lighter, faster choice with native ESM/TS support.
  - *Playwright/obsidian-test end-to-end in a real Obsidian instance*: rejected for MVP — high setup cost, flaky, and the constitution's dependency-minimization rule favors keeping the automated suite small; manual quickstart scenarios (Q1–Q10) already cover the real-environment behavior, and an automated E2E harness can be added in a later iteration if needed.
  - *No test framework (manual only)*: rejected — the spec explicitly requires automated tests as the baseline for the success criteria (SC-009, SC-010).

## R-14: View picker presentation (FR-027)

- **Decision**: The plugin registers exactly one custom view (type `usm-board-view`) via `plugin.registerView`. The three view options — "USM board" (the custom view), "Edit MD" (native `MarkdownView` in source mode), and "View MD" (native `MarkdownView` in preview mode) — are presented through a **dedicated pane-header view-switch button** (a distinct icon, `columns-2`, not the "…" context-menu button) that is available in **all three view states**. The button opens a menu listing the three options with the current one checked; selecting an option switches the leaf via `leaf.setViewState` and persists the choice (FR-026). The button is added via `ItemView.addAction`:
  - **Map state** (`BoardView`): added in `onload` (the plugin fully controls this view).
  - **Edit/Preview states** (native `MarkdownView`): added by the `file-open` routing handler, which grabs the `MarkdownView` instance (`leaf.view`) and calls `addAction` on it. A `WeakSet<MarkdownView>` tracks which instances already have the action so repeated `file-open` events do not duplicate it. The action's callback reads the view's current file at click time and only offers the switch when that file is a board note, so the action is inert if the view later shows a non-board file.

  The "…" button remains the native context menu (the previous design placed the three options in the "…" menu via `onPaneMenu`, which conflicted with the context-menu convention and was not reachable in the Markdown view). The tab and breadcrumbs show the note's file name: `getDisplayText()` returns `file.basename` when a file is loaded (falling back to the "USM board" label only when no file is loaded). "Visible at a glance" (FR-027) is satisfied because all three options appear as plain list items in the button's menu with no additional navigation.
- **Rationale**: Constitution Principle I mandates reusing Obsidian's built-in solutions. `ItemView.addAction` is the sanctioned API for adding a pane-header action; it is not a command-palette command, so the amended FR-002 is preserved. The native "change view" picker is not reliably present for this view in the target Obsidian build (1.14.5, manual validation 2026-10-23), so the plugin must provide its own switching surface. A dedicated button (rather than extending the "…" menu) is reachable in all three view states and keeps "…" reserved for the context menu, per the reporter's request.
- **Alternatives considered**:
  - *Relying on the native "change view" picker only*: rejected — the picker is not reliably present for this view in the target build (manual validation, 2026-10-23), leaving the user without a discoverable switching surface.
  - *Extending the "…" pane menu via `onPaneMenu` (previous design)*: rejected — only reachable in the map view (the native `MarkdownView` menu cannot be extended), and it conflicted with the convention that "…" is the context menu (manual validation, 2026-10-23).
  - *Monkey-patching the native `MarkdownView.onPaneMenu` to add a "USM board" item*: rejected — fragile (depends on Obsidian's internal menu structure) and modifies a view the plugin does not own.
  - *Command-palette command*: rejected — the reporter wants a button, not a command; FR-002 (amended) still forbids a command-palette command.
  - *Registering two custom views (one for edit, one for preview)*: rejected — would produce four or more picker entries and duplicate Obsidian's native Markdown rendering, violating FR-025.
  - *Constant "USM board" tab label (previous design)*: rejected — overrode the file name in the tab and breadcrumbs, creating a name mismatch with the file list (manual validation, 2026-10-23).

## R-15: `usm-view` persistence (FR-026)

- **Decision**: The plugin reads `usm-view` from the board file frontmatter when a board note is opened (default `map` when missing or unrecognized). When the user switches views via the native picker, the plugin writes the new value (`map` / `edit` / `preview`) back to the frontmatter using `vault.process()` (atomic read-modify-write, safe against concurrent edits). The write is the only frontmatter mutation the plugin performs (contract: board-file-format.md). Multi-pane: the last switch wins; other open panes are not retroactively switched.
- **Rationale**: FR-026 requires the last-selected view to be restored on reopen, and FR-028 / Principle VI require board-level state to live in the board file (portable, AI-readable, survives plugin reinstall). `vault.process()` is the Obsidian-sanctioned atomic file mutation API.
- **Alternatives considered**:
  - *Plugin settings storage (`saveData` / `data.json`)*: rejected — not portable, not AI-readable, violates Principle VI and FR-028 (only plugin-internal settings belong in `data.json`).
  - *In-memory only (no persistence)*: rejected — violates FR-026 (last-selected view must be restored on reopen).

## R-16: View-switch detection

- **Decision**: The plugin detects view switches by listening to `workspace.on('file-open')` and inspecting the active leaf's view: if the view is the plugin's `usm-board-view`, the selected view is `map`; if it is a `MarkdownView`, `view.getMode()` returns `'source'` (→ `edit`) or `'preview'` (→ `preview`). The plugin writes `usm-view` only when the detected value differs from the current frontmatter value (no-op writes are skipped to avoid spurious file modifications). Listeners are registered via `this.registerEvent` for clean unload.

  **Leaf-readiness retry (defect 1)**: on every fresh open of a board note (first open after restart, and close-tab → reopen within the same session), Obsidian fires `file-open` while the new leaf's view is still initializing, so a single `setViewState` can be dropped or `findLeafWithFile` can return `null`. The routing is therefore tolerant of the leaf not being ready: after computing the desired view, if the leaf is not found or the current view is not yet the expected Markdown view, the routing **retries a bounded number of times** (≤5 attempts, ~50 ms apart) until the view settles. The retry stops early when the view matches the desired view or the file is no longer a board note, so a mere tab re-activation (view already correct) never triggers a switch or a spurious write (expected behavior #1). The retry is bounded so it cannot fight the user or cause an unbounded loop.
- **Rationale**: `file-open` fires for every leaf/file activation, covering both picker-driven switches and direct file opens. `MarkdownView.getMode()` is the only API that distinguishes "Edit MD" from "View MD" (both are the same `MarkdownView` class). Skipping no-op writes keeps the board file's modification history clean. The bounded retry makes first-open routing robust against the leaf-readiness race without adding a second event source.
- **Alternatives considered**:
  - *Defer the whole handler by one tick (`setTimeout(0)` / `requestAnimationFrame`)*: rejected — simpler but less robust if the leaf needs more than one tick to settle; the bounded retry is strictly more robust.
  - *Hook `active-leaf-change` in addition to `file-open`*: rejected — adds a second event source to keep in sync; more moving parts than a bounded retry.
  - *`workspace.on('active-leaf-change')` only*: rejected — does not fire when the same leaf's file changes, missing picker switches within an existing leaf.
  - *Polling the active leaf*: rejected — wasteful and non-idiomatic; event-driven detection is the Obsidian-sanctioned pattern.
