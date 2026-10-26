# Implementation Plan: User Story Map Board View — Iteration 2 (Visual Layer Refactor)

**Branch**: `001-user-story-map` | **Date**: 2026-10-26 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-user-story-map/spec.md` (Iteration 2 section). The MVP (Iteration 1) plan and tasks are archived as [plan-mvp.md](plan-mvp.md) and [tasks-mvp.md](tasks-mvp.md).

## Summary

Iteration 2 refactors the **visual layer only** of the board: the release header stops being a sticky left column and becomes a horizontal row (section header); releases render as vertically stacked, self-contained sections; the column header block (Activity/Task/Epic, three rows) stays sticky at the top; all grids (header block + one grid per release section) share a fixed column width (`--usm-col-w`) so columns are perfectly aligned; the board renders in both light and dark themes via Obsidian CSS variables; and the DOM is prepared for future features (release toggle, DnD handles, add/remove buttons) without implementing them. The domain model (`GridModel`, `buildGridModel`), the file formats, and the story ordering are **unchanged** — FR-011/FR-014/FR-016/FR-019 MUST continue to pass (SC-015). The authoritative source of decisions is [refactor-concept.md](refactor-concept.md) (section 9: resolved decisions).

## Technical Context

**Language/Version**: TypeScript 5.8+ (strict mode, no `any`)

**Primary Dependencies**: Obsidian API (`obsidian` package, latest), esbuild (bundler only — no runtime deps). Dev-only (test) dependencies: Vitest (test runner) and jsdom (DOM environment) — zero impact on the bundled `main.js`

**Storage**: All data lives in Markdown files within the vault; read exclusively via `app.metadataCache` (no synchronous disk I/O). No new persisted state in this iteration — the only board-file write remains the `usm-view` frontmatter attribute (FR-026, unchanged)

**Testing**: Automated unit + integration tests (Vitest) for the core logic (unchanged, MUST keep passing — SC-015); new structural DOM tests (jsdom) verifying the section-based layout guarantees (same grid template across all grids, reserved elements present/inactive, Unassigned section first); automated performance tests against the existing baseline (no >20% regression — SC-014); manual acceptance testing in Obsidian (Desktop + Mobile) for pixel-level behavior jsdom cannot verify (mobile header height, column alignment, themes — SC-011, SC-012, SC-013)

**Target Platform**: Obsidian Desktop (macOS, Windows, Linux) + Mobile (iOS, Android). No Node.js/Electron APIs.

**Project Type**: Obsidian Community Plugin (browser-based, single bundled `main.js`)

**Performance Goals**: No performance regression >20% vs the MVP baseline (SC-014, measured by the existing automated performance tests on the same board size); on mobile (~375 px) the release header occupies ≤ 32 px of vertical space (SC-011)

**Constraints**: 100% local (no network calls); no `eval`/`Function`; XSS sanitization on all note-derived content (text-node insertion, unchanged); no Node/Electron APIs; no inline JS visual styling — all styling in `styles.css` with Obsidian CSS variables (structural geometry via `--usm-*` custom properties only, per constitution v1.6.1 clarification); CSS Grid/Flexbox for layout (no manual geometry in JS); fixed column width is a design decision, not a user setting

**Scale/Scope**: No hard limit on story count; must remain usable on mobile; single vault; read-only map (no DnD, no CRUD, no keyboard-grid navigation in this iteration — reserved DOM only); the refactor touches the visual layer (`src/ui/board-renderer.ts`, `src/ui/story-card.ts`, `styles.css`) and the test suite — the domain layer is untouched

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Obsidian ecosystem & view architecture | ✅ PASS | View architecture unchanged (single map-only `FileView`, three-view switching); the refactor is confined to the map's internal DOM/CSS; Obsidian CSS variables for theming; no Node/Electron APIs |
| II. Security, privacy & data protection | ✅ PASS | 100% local; no eval/Function; all note-derived strings still inserted as text nodes (FR-016 unchanged); no new file writes (the only sanctioned write remains `usm-view`, FR-026); reserved DOM elements are static and inert |
| III. Lifecycle, cleanup & code quality | ✅ PASS | TypeScript strict; no new listeners/intervals introduced by the refactor (event wiring unchanged); renderer stays a pure DOM module (no `obsidian` imports); new renderer logic follows TDD (structural DOM tests written first) |
| IV. UX/UI, ergonomics & incomplete data | ✅ PASS | Obsidian CSS variables only (no hard-coded colors — FR-033); mobile: release header ≤ 32 px (SC-011); defensive "Unassigned" grouping preserved (FR-011) — the Unassigned release section renders first (top of board); reserved elements are inert and do not interfere with existing keyboard access |
| V. Performance, reactivity & large vaults | ✅ PASS | `metadataCache` only; event-driven debounced updates unchanged; CSS Grid + `overflow: auto` layout with no manual geometry (R-17, R-18); multiple grids are more scalable than a single grid (per-section lazy rendering becomes possible later); performance regression guard (SC-014) |
| VI. Data portability & self-describing config | ✅ PASS | Board file format and frontmatter unchanged (contracts untouched); no new board-level state; the refactor is purely visual |
| VII. Pragmatic architecture & anti-over-engineering | ✅ PASS | Strict 3-layer structure preserved — all changes in `src/ui/` + `styles.css`; no inline JS visual styling (geometry via `--usm-*` custom properties only, per v1.6.1 clarification); no new dependencies; popout-window compatibility preserved (container's `ownerDocument`) |

**Gate result: PASS — no violations. No Complexity Tracking entries required.**

**Post-design re-check (after Phase 1): PASS.** The design artifacts confirm compliance: the domain model and file formats are unchanged (data-model.md V-01, contracts untouched); the multiple-grids architecture uses one scroll container + CSS Grid with a shared fixed-width column template and no JS geometry (R-17, R-18); sticky behavior is pure CSS (R-19); theming uses L2 Obsidian variables + `color-mix()` with a static guard test (R-20, R-24); reserved DOM elements are structurally present but inert (R-21); the Unassigned release section renders first with zero domain changes (R-22); layout verification splits structural (automated) from pixel-level (manual) guarantees (R-23); the existing performance baseline and regression guard are reused (SC-014). No new violations introduced.

## Project Structure

### Documentation (this feature)

```text
specs/001-user-story-map/
├── plan.md              # This file (/speckit-plan command output — Iteration 2)
├── plan-mvp.md          # Archived MVP plan (Iteration 1)
├── tasks-mvp.md         # Archived MVP tasks (Iteration 1)
├── research.md          # Phase 0 output (MVP R-01–R-16 + Iteration 2 R-17–R-24)
├── data-model.md        # Phase 1 output (domain model unchanged + visual-layer structure)
├── quickstart.md        # Phase 1 output (MVP scenarios + Iteration 2 scenarios)
├── contracts/           # Phase 1 output (UNCHANGED in Iteration 2)
│   ├── board-file-format.md
│   └── story-file-format.md
├── refactor-concept.md  # Authoritative source of Iteration 2 decisions
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── domain/                  # UNCHANGED in Iteration 2 (pure logic, zero Obsidian imports)
│   ├── types.ts             # BoardConfig, StoryAttributes, GridModel, UNASSIGNED, cellKey
│   ├── board-model.ts       # buildGridModel — untouched
│   ├── sanitize.ts          # XSS sanitization — untouched
│   └── debounce.ts          # Debounce utility — untouched
├── obsidian/                # UNCHANGED in Iteration 2 (API adapters)
│   ├── main.ts              # Plugin lifecycle + view registration
│   ├── settings.ts          # Plugin settings (debugMode)
│   ├── board-view.ts        # FileView (usm-board-view) + view routing
│   ├── board-parser.ts      # Board file parsing
│   └── story-attributes.ts  # Story frontmatter reading
└── ui/                      # CHANGED in Iteration 2 (DOM rendering)
    ├── board-renderer.ts    # REFACTORED: section-based DOM (header block + release sections)
    ├── story-card.ts        # EXTENDED: reserved DnD handle element (invisible)
    ├── debug-panel.ts       # UNCHANGED
    └── en.ts                # EXTENDED: new label keys if needed (e.g., Unassigned section)

styles.css                   # REWRITTEN: new grid architecture, --usm-col-w, themes, reserved-element styles

tests/
├── unit/                    # UNCHANGED (MVP core-logic tests MUST keep passing — SC-015)
├── integration/             # UNCHANGED (pipeline tests MUST keep passing — SC-015)
│   └── section-layout.test.ts  # (new) structural DOM tests for the section-based layout (R-23)
├── performance/             # BASELINE REUSED (no >20% regression — SC-014)
│   ├── baseline.json
│   └── render-perf.test.ts
└── fixtures/                # UNCHANGED (versioned fixture notes)
```

**Structure Decision**: The strict 3-layer structure (Constitution Principle VII) is preserved; the refactor is confined to `src/ui/` (renderer + story card) and `styles.css`, plus new structural DOM tests. The domain layer (`src/domain/`) and the Obsidian adapters (`src/obsidian/`) are untouched — the cell key format (`activity::task::epic::release`) and `GridModel`/`buildGridModel` are unchanged, so the data pipeline and its tests are unaffected (SC-015). The renderer is refactored to emit the new section-based DOM (research R-17) and the stylesheet is rewritten around the fixed-width shared grid template (R-18) with Obsidian CSS variables (R-20).

## Complexity Tracking

> No Constitution Check violations — this section is not applicable.
