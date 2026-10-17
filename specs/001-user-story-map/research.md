# Research: User Story Map Board View

**Feature**: `001-user-story-map` | **Date**: 2026-10-15

All NEEDS CLARIFICATION items from the Technical Context were resolved during the two `/speckit-clarify` sessions (7 questions total). This document records the remaining technical decisions, their rationale, and alternatives considered.

## R-01: View architecture for dual-mode (raw Markdown ↔ visual map)

- **Decision**: Subclass `TextFileView` and register it with a custom view type (e.g., `usm-board-view`). The view renders the raw Markdown source in its leaf; when the active file is a board note (`usm-board: true`), the view swaps its content container to the visual map. A pane header icon and a command palette command toggle between the two modes for the same leaf/file.
- **Rationale**: `TextFileView` is the Obsidian-native base for file-backed views. It gives us the file lifecycle (open/close/switch), the pane header (for the toggle icon), and the standard Markdown rendering for the "raw" mode for free. Toggling within the same leaf guarantees SC-004 (no content change) because the underlying file is never touched — only the rendered representation changes.
- **Alternatives considered**:
  - *Separate `ItemView` for the map + `MarkdownView` for raw mode*: rejected — switching between two different leaves is less seamless, complicates "same note, two modes", and loses the file context in the map view.
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

- **Decision**: Board-level configuration is read from the board file frontmatter as plain attributes alongside the `usm-board: true` flag. MVP attribute: row ordering for Release (default: order of first appearance; optional: alphabetical sort). Unknown attributes are ignored (edge case in spec). Exact attribute key names are defined in `contracts/board-file-format.md`.
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
- **Rationale**: The spec (Testing Strategy, FR-022–FR-024, SC-009–SC-010) makes tests a first-class part of the MVP — the baseline that defines whether the goals are achieved. Vitest is chosen because it is a zero-config, fast, TypeScript-native runner that works in Node.js without a browser, which fits the pure-function design of the core logic and the constitution's dependency-minimization rule (one dev-only dependency, no runtime impact on `main.js`). Pure-function design keeps the tested logic free of Obsidian runtime dependencies, so the suite runs in CI and locally without an Obsidian instance; user-facing behavior (view toggle, 2D navigation, live updates, mobile) remains covered by the manual quickstart scenarios, which require the real application environment.
- **Alternatives considered**:
  - *Jest*: rejected — functionally equivalent but heavier configuration for a TypeScript project; Vitest is the lighter, faster choice with native ESM/TS support.
  - *Playwright/obsidian-test end-to-end in a real Obsidian instance*: rejected for MVP — high setup cost, flaky, and the constitution's dependency-minimization rule favors keeping the automated suite small; manual quickstart scenarios (Q1–Q10) already cover the real-environment behavior, and an automated E2E harness can be added in a later iteration if needed.
  - *No test framework (manual only)*: rejected — the spec explicitly requires automated tests as the baseline for the success criteria (SC-009, SC-010).
