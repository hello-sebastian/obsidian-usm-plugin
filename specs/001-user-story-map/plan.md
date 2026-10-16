# Implementation Plan: User Story Map Board View

**Branch**: `001-user-story-map` | **Date**: 2026-10-15 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-user-story-map/spec.md`

## Summary

The plugin renders a board note (flagged with `usm-board: true`) as a 2D visual user story map: columns grouped by Activity → Task → Epic (order of first appearance in the board file), rows by Release. Each story appears as a card with a cascading title and a Release badge. The map is read-only, auto-updates on file changes via `metadataCache` events, and supports seamless toggle between the visual map and raw Markdown. Board-level configuration (e.g., row sort order) lives in the board file frontmatter for portability. A debug/dev mode exposes rendering metrics (fps, story count).

## Technical Context

**Language/Version**: TypeScript 5.8+ (strict mode, no `any`)

**Primary Dependencies**: Obsidian API (`obsidian` package, latest), esbuild (bundler only — no runtime deps). Dev-only (test) dependencies: Vitest (test runner) and jsdom (DOM environment for the performance tests) — zero impact on the bundled `main.js` (constitution dependency-minimization applies to runtime dependencies)

**Storage**: N/A — all data lives in Markdown files within the vault; read exclusively via `app.metadataCache` (no disk I/O, no plugin-owned storage)

**Testing**: Automated unit + integration tests (Vitest) for the core logic (parser, attributes, grid model, sanitization); versioned test fixtures for reproducible runs; automated performance tests measuring render smoothness on a defined board size; manual acceptance testing in Obsidian (Desktop + Mobile) against a test vault for user-facing behavior (view toggle, 2D navigation, live updates, mobile). Debug/dev mode provides the metrics source for performance tests (FR-022, FR-023, FR-024, SC-009, SC-010).

**Target Platform**: Obsidian Desktop (macOS, Windows, Linux) + Mobile (iOS, Android). No Node.js/Electron APIs.

**Project Type**: Obsidian Community Plugin (browser-based, single bundled `main.js`)

**Performance Goals**: Smooth rendering on weak mobile devices (tablet/phone); no hard scale limit; debug/dev mode exposes fps and story count; target: map updates within 2s of source edit (SC-005)

**Constraints**: 100% local (no network calls); no `eval`/`Function`; XSS sanitization on all note-derived content; no Node/Electron APIs; all DOM/event/interval registrations via `register*` helpers; CSS Grid/Flexbox for layout (no manual geometry)

**Scale/Scope**: No hard limit on story count; must remain usable on mobile; single vault (no cross-vault references); read-only map (no drag-and-drop, no inline editing)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Obsidian ecosystem & view architecture | ✅ PASS | `TextFileView` subclass for dual-mode; Obsidian API components; CSS variables; no Node/Electron APIs |
| II. Security, privacy & data protection | ✅ PASS | 100% local; no eval/Function; XSS sanitization on all rendered content; no file writes (read-only map) |
| III. Lifecycle, cleanup & code quality | ✅ PASS | TypeScript strict; `register*` helpers for all listeners; esbuild bundle; English comments; semantic naming; logical module division |
| IV. UX/UI, ergonomics & incomplete data | ✅ PASS | Obsidian CSS variables; defensive "Unassigned" bucketing; 2D scroll with sticky headers; keyboard-accessible cards; non-intrusive error handling |
| V. Performance, reactivity & large vaults | ✅ PASS | `metadataCache` only (no sync disk reads); event-driven with debounce; CSS Grid/Flexbox layout |
| VI. Data portability & self-describing config | ✅ PASS | Board config in board file frontmatter; self-describing; survives sync/copy/reinstall; readable without plugin |

**Gate result: PASS — no violations. No Complexity Tracking entries required.**

**Post-design re-check (after Phase 1): PASS.** The design artifacts confirm compliance: `metadataCache`-only data access (R-02), event-driven debounced updates (R-03), CSS Grid + sticky headers with no manual geometry (R-04), text-node DOM insertion for XSS safety with zero added runtime dependencies (R-05), board config in board file frontmatter (R-08, contracts), English `en` label dictionary as i18n foundation (R-09), debug metrics gated behind a setting with proper cleanup (R-07), and a Vitest-based automated test suite with versioned fixtures covering the core logic, integration pipeline, and performance (R-13). No new violations introduced.

## Project Structure

### Documentation (this feature)

```text
specs/001-user-story-map/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── board-file-format.md
│   └── story-file-format.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── main.ts                  # Plugin entry point: lifecycle, command registration, view registration
├── settings.ts              # Plugin settings interface and defaults (existing, extended)
├── types.ts                 # Shared TypeScript interfaces (BoardConfig, StoryAttributes, GridModel, etc.)
├── board/
│   ├── board-view.ts        # TextFileView subclass: dual-mode (raw Markdown ↔ visual map), pane header icon
│   ├── board-parser.ts      # Parses board file: extracts wikilinks, reads frontmatter config attributes
│   ├── board-model.ts       # Builds in-memory grid model (columns: Activity→Task→Epic, rows: Release)
│   └── board-renderer.ts    # Renders grid DOM: CSS Grid layout, sticky headers, story cards
├── story/
│   ├── story-attributes.ts  # Reads/normalizes story frontmatter (case-insensitive, PL/EN synonyms)
│   └── story-card.ts        # Individual story card: title cascade, Release badge, click handler
├── i18n/
│   └── en.ts                # English label dictionary (single locale for MVP; foundation for future i18n)
├── debug/
│   └── debug-panel.ts       # Debug/dev mode: fps counter, story count, render time metrics
└── utils/
    ├── debounce.ts          # Debounce/throttle utility for event-driven updates
    └── sanitize.ts          # XSS sanitization: strips HTML/script from note-derived strings

# Tests (automated — FR-022, FR-023, FR-024)
tests/
├── unit/                    # Pure-logic unit tests (no Obsidian runtime needed)
│   ├── board-parser.test.ts     # Flag detection, config, link extraction, duplicates, broken links
│   ├── story-attributes.test.ts # PL/EN synonyms, case-insensitivity, title cascade, missing frontmatter
│   ├── board-model.test.ts      # Column hierarchy, row order, Unassigned grouping, value normalization
│   └── sanitize.test.ts         # XSS neutralization of note-derived strings
├── integration/             # End-to-end pipeline tests (board + story files → GridModel)
│   └── pipeline.test.ts         # Full data pipeline with fixture notes (SC-002, SC-003)
├── performance/             # Automated performance tests (FR-024, SC-001)
│   └── render-perf.test.ts      # Render time, fps proxy, story count on a defined board size
└── fixtures/                # Versioned test fixture notes (FR-023)
    ├── board.md                 # Board note with flag, config, links (incl. duplicates, broken)
    ├── S1.md … S6.md            # Story notes covering all attribute combinations
    └── README.md                # Fixture description and coverage matrix
```

**Structure Decision**: Single-project Obsidian plugin layout. Code is split into focused modules by responsibility: `board/` (view, parser, model, renderer), `story/` (attributes, card), `i18n/` (label dictionary), `debug/` (metrics panel), `utils/` (shared helpers). `main.ts` remains minimal (lifecycle + registration only). A `tests/` directory contains automated unit, integration, and performance tests (Vitest) with versioned fixtures — tests are a first-class part of the MVP (FR-022–FR-024). The core logic modules (`board-parser`, `story-attributes`, `board-model`, `sanitize`) are designed as pure functions (no Obsidian API dependency) so they are directly unit-testable in Node.js; the integration tests exercise the full pipeline with fixture data; performance tests measure render smoothness on a defined board size.

## Complexity Tracking

> No Constitution Check violations — this section is not applicable.
