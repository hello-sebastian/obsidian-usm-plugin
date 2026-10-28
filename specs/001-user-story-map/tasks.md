---

description: "Task list for User Story Map Board View — Iteration 2 (Visual Layer Refactor)"
---

# Tasks: User Story Map Board View — Iteration 2 (Visual Layer Refactor)

**Input**: Design documents from `/specs/001-user-story-map/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Scope**: Iteration 2 only (US7–US10). The MVP (US1–US6) is implemented; its tasks are archived as `tasks-mvp.md`. The domain layer (`src/domain/`), the Obsidian adapters (`src/obsidian/`), and the file format contracts are **unchanged** — no tasks touch them.

**Tests**: Included — the spec's Testing Strategy (FR-022, FR-023, FR-024, SC-009, SC-010, SC-014, SC-015) and Constitution Principle III (TDD for new logic) require them. New renderer logic follows TDD: structural DOM tests are written FIRST and MUST fail before implementation.

**Organization**: Tasks are grouped by user story (US7–US10) to enable independent implementation and testing. The core section-based DOM/CSS refactor is a shared prerequisite (Phase 2) because US7 and US8 are two sides of the same structural change.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US7–US10)
- Include exact file paths in descriptions

## Path Conventions

- Single project: `src/`, `tests/` at repository root
- Authoritative decision source: `specs/001-user-story-map/refactor-concept.md` (section 9: resolved decisions)
- Visual-layer structure contract: `specs/001-user-story-map/data-model.md` (section V-01)
- Research decisions: `specs/001-user-story-map/research.md` (R-17–R-24)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish a verified green baseline before the refactor (SC-015 reference point)

- [X] T001 Verify the pre-refactor baseline: run `npm install`, `npm test` (expect the full MVP suite green), `npm run build`, and `npm run lint` from the repository root; record the results (test count, performance baseline in `tests/performance/baseline.json`) as the SC-015/SC-014 reference point

  **Baseline (2026-10-26)**: `npm test` → 147/147 passed (11 files, ~4.2s); `npm run build` → OK (main.js 16.7 KB); `npm run lint` → 0 errors, 46 pre-existing warnings; performance baseline `tests/performance/baseline.json` → `modelBuildMs: 13.59`, `renderMs: 517.07` (SC-014/SC-015 reference point).

---

## Phase 2: Foundational (Core Section-Based Refactor — Blocking Prerequisite)

**Purpose**: The shared structural change that US7–US10 all build on: the new section-based DOM (sticky column-header block + one grid per release section) and the fixed-width shared grid template (research R-17, R-18, R-19; data-model.md V-01)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 Write the structural DOM tests FIRST (TDD — they MUST fail against the current renderer) in `tests/integration/section-layout.test.ts`: assert the renderer emits `.usm-board-map > .usm-board` (width:max-content wrapper); `.usm-board-header` with exactly three rows (`.usm-header-row--activity`, `.usm-header-row--task`, `.usm-header-row--epic`); `.usm-board-releases` containing one `section.usm-release` per release row; each section has `.usm-release-header` (horizontal row) + `.usm-release-body > .usm-release-grid`; every grid (the header block and all section grids) carries the identical inline `--usm-grid-cols` custom property value (`repeat(N, var(--usm-col-w))`, N = number of Epic leaf columns) — read via `el.style.getPropertyValue('--usm-grid-cols')` (reliable in jsdom; computed `grid-template-columns` is not observable); the UNASSIGNED release row renders as the FIRST `section.usm-release`; a release row with no stories renders an empty grid without an error (defensive case — tested with a synthetic GridModel, since the current domain model derives release rows from stories)

  **TDD red (2026-10-26)**: `tests/integration/section-layout.test.ts` created with 7 structural tests; all 7 FAIL against the current single-grid renderer (verified: `npx vitest run tests/integration/section-layout.test.ts` → 7 failed); `npx tsc --noEmit` clean.
- [X] T003 Refactor `src/ui/board-renderer.ts` to emit the new section-based DOM per data-model.md V-01: sticky column-header block (three rows; Activity cells span their Task children's columns, Task cells span their Epic children's columns, Epic cells are leaf columns); a vertical stack of release sections (`.usm-release-header` horizontal row + `.usm-release-body > .usm-release-grid` of `.usm-epic-column > .usm-epic-column-cards`); the Unassigned release section rendered first; remove the sticky left column (`.usm-rowheader`) and the single-grid layout; preserve text-node insertion for all note-derived strings (FR-016), wikilink header clickability (FR-007), broken-link placeholder cards (R-11), and story-card click-to-open (FR-019)

  **Verified (2026-10-26)**: `npx tsc --noEmit` clean; `tests/integration/section-layout.test.ts` → 7/7 PASS (TDD green); full suite → 154/154 passed (12 files, ~4.9s), performance within 20% tolerance.
- [X] T004 [P] Rewrite the layout core in `styles.css`: `.usm-board-map` as the single scroll container (`overflow: auto`, both axes); `.usm-board` with `width: max-content`; `.usm-board-header` with `position: sticky; top: 0` (z-index above section content, fixed row heights); the shared grid template `grid-template-columns: repeat(N, var(--usm-col-w))` applied to `.usm-board-header` and every `.usm-release-grid`; `--usm-col-w` set once on the board root (~240 px desktop); remove the old `.usm-board-grid` single-grid and `.usm-rowheader` sticky-left-column styles (R-17, R-18, R-19)

  **Verified (2026-10-26)**: `npm run build` OK; `npm run lint` 0 errors; full suite → 154/154 passed (12 files, ~5.4s).
  **Baseline decision (2026-10-26, user-approved)**: the section-based architecture (mandated by T003 / data-model.md V-01) renders ~2400 additional structural DOM elements (per-cell `.usm-epic-column` + `.usm-epic-column-cards` pairs, 15 separate section grids), which is a deliberate, known cost (refactor-concept.md: "potencjalnie więcej elementów DOM; do zmierzenia"). Measured on the same machine: old single-grid renderer 480.8 ms vs new section-based renderer ~624–647 ms (median 623.74 ms) — a ~31% render-time increase, beyond the 20% SC-014 budget against the MVP baseline. The user accepted the reduced performance at this stage (optimizations and renderer refactoring are planned for later iterations), so `tests/performance/baseline.json` was re-recorded for the new architecture: `renderMs: 623.74` (re-recorded, median of 5 runs after 2 warmup — same methodology). `modelBuildMs: 13.59` was kept at the committed MVP value because the domain model is unchanged in this iteration (a freshly recorded 11.15 ms sample was a low outlier that flaked the guard). The regression guard now protects the new baseline against future regressions.
- [X] T005 Run the full automated suite (`npm test`) and confirm: the new structural tests in `tests/integration/section-layout.test.ts` pass, and ALL existing MVP unit/integration tests still pass unchanged (SC-015)

  **Verified (2026-10-26)**: `npm test` → 154/154 passed (12 files, ~5.2s) — the 7 new structural tests in `tests/integration/section-layout.test.ts` pass and all 147 pre-existing MVP unit/integration/performance tests pass unchanged (SC-015).

**Checkpoint**: Foundation ready — the board renders in the new section-based layout; user story work can now begin

---

## Phase 3: User Story 7 - Mobile-friendly board layout (Priority: P1) 🎯 MVP

**Goal**: On mobile (~375 px), the release header is a thin horizontal row (≤ 32 px) instead of the old 96 px sticky left column, freeing the full screen width for story columns; the column-header block stays sticky at the top (FR-029, FR-030, SC-011)

**Independent Test**: Open the board on a mobile device (or a ~375 px window) — the release header is a horizontal row, the full width is available for story columns, and the column-header block stays pinned while scrolling (quickstart Q14)

### Implementation for User Story 7

- [X] T006 [US7] Add the mobile media query (~375 px) in `styles.css`: `--usm-col-w` reduced to ~160 px, the release header compacted to ≤ 32 px of vertical space (SC-011), and compact header-row heights for the sticky column-header block
  - **Verified (2026-10-26)**: The mobile media query (`@media (max-width: 768px)`) already existed from T004 with `--usm-col-w: 160px` and compact `--usm-header-h: 24px` header rows. T006 added the missing SC-011 guarantee: `.usm-release-header { max-height: 32px; box-sizing: border-box; }` so the release header occupies ≤ 32px of vertical space on mobile (the `box-sizing` keeps the `border-top` inside the cap). The 768px breakpoint covers the ~375px mobile portrait target (mobile styles apply at 375px). Full suite 154/154, lint 0 errors.
- [X] T007 [US7] Manual verification: run quickstart Q11 (sticky column-header block, non-sticky release headers, horizontal scrolling keeps the header block visible) and Q14 (mobile ~375 px: release header ≤ 32 px, full width for columns, both-axis scrolling, no sticky left column) on Desktop and at least one mobile device
  - **Verified (2026-10-27)**: User ran the manual pass on the deployed build (post-T006 `styles.css`) against the `Test Board 2` fixture — Q11 (sticky column-header block, non-sticky release headers, horizontal scroll keeps the block visible) and Q14 (mobile ~375 px: release header ≤ 32 px, full column width, both-axis scrolling, no sticky left column) both pass. Recorded in `checklists/manual-validation.md` (Q11–Q14 section, all checked).

**Checkpoint**: US7 complete — the mobile layout works independently of US9/US10 polish

---

## Phase 4: User Story 8 - Release sections with aligned columns (Priority: P1) 🎯 MVP

**Goal**: Each release is a self-contained section (header + grid of Epic columns); columns in the header block and in all release sections are perfectly aligned via the shared fixed-width template; the Unassigned release section renders first (FR-031, FR-032, SC-012)

**Independent Test**: Open a board with multiple releases and multiple Epic columns — each release is a self-contained section, columns align across the header and all sections, and the Unassigned section is first (quickstart Q12, Q13)

### Verification for User Story 8

> The US8 implementation (section DOM, shared template, Unassigned-first) was delivered in Phase 2; this phase verifies the US8 acceptance scenarios end-to-end.

- [X] T008 [US8] Verify all US8 acceptance scenarios: automated — the structural tests in `tests/integration/section-layout.test.ts` (one section per release, identical grid template across all grids ⇒ aligned columns, Unassigned section first, empty release renders an empty grid) pass; manual — quickstart Q12 (Unassigned section first, top of board) and Q13 (columns perfectly aligned across the header block and every section; long titles clamp within the fixed column width)
  - **Verified (2026-10-27)**: Automated — `tests/integration/section-layout.test.ts` 7/7 (one section per release, identical `--usm-grid-cols` template across all grids ⇒ aligned columns, Unassigned section first, empty release renders an empty grid); full suite 154/154. Manual — user pass on the deployed build against the `Test Board 2` fixture: Q12 (Unassigned section first, top of board) and Q13 (columns perfectly aligned across the header block and every section; the long S6 epic title clamps within the fixed column width) both pass. Recorded in `checklists/manual-validation.md` (Q11–Q14 section, all checked).

**Checkpoint**: US7 AND US8 complete — the core Iteration 2 layout (MVP scope) is functional and independently testable

---

## Phase 5: User Story 9 - Visual design matching the Figma reference (Priority: P2)

**Goal**: The board's visual appearance matches the Figma design (node 76:421) — header cells as cards with name + badge, release top dividers, story card styling — and renders correctly in both light and dark themes via Obsidian CSS variables with no hard-coded colors (FR-033, SC-013)

**Independent Test**: Open the board in both light and dark themes and compare with the Figma design (node 76:421) — colors, spacing, and typography match; all text is readable (quickstart Q15 part 1)

### Tests for User Story 9 ⚠️

- [X] T009 [P] [US9] Add the static token guard test in `tests/unit/token-guard.test.ts` (regression guard for FR-033, research R-24): read `styles.css` as text and assert no hard-coded hex/rgb color literals appear and every color declaration uses `var(--...)`, `color-mix(... var(--interactive-accent) ...)`, or a CSS color keyword (`transparent`, `currentColor`, `inherit`); the test must pass against the final stylesheet
  - **Verified (2026-10-27)**: `tests/unit/token-guard.test.ts` created — 4 tests (non-empty stylesheet, no hex literals, no rgb/rgba/hsl/hsla literals, every color declaration uses `var(--...)` / `color-mix(... var(...) ...)` / an allowed keyword). Passes against the current token-only stylesheet (4/4); `npx tsc --noEmit` clean. Will re-run after T010 to confirm the Figma design stays token-only.

### Implementation for User Story 9

- [X] T010 [US9] Apply the Figma visual design (node 76:421) in `styles.css` per the token table in `refactor-concept.md` section 7.1: header cells as cards (name + badge) with accent shades derived via `color-mix(in oklch, var(--interactive-accent) X%, var(--background-primary))` (no hex); release top divider via `var(--background-modifier-border)`; story card surface/border/badge via `var(--background-secondary)` / `var(--background-modifier-border)` / `var(--background-primary-alt)`; title clamped to a small number of lines within the fixed column width (FR-033, SC-013)
  - **Verified (2026-10-27)**: Figma design (node 76:421) read via MCP (screenshot + reference code). Applied in `styles.css`: header cells as accent-tinted cards (bg `color-mix(in oklch, var(--interactive-accent) 8%, var(--background-primary))`, border 30%, text `var(--interactive-accent)`, left-aligned, `--font-semibold`, radius-m); Epic columns as light rounded containers (`var(--background-primary-alt)`, padding 8px, radius-m); release header as a thin row (no background, 2px top divider `var(--background-modifier-border)`, bold title); story card badge bg → `var(--background-primary-alt)`. Token guard 4/4 (no hard-coded colors), full suite 158/158, tsc clean. Accent tint percentages recorded in repo memory `iteration2-us9-tokens.md` (approximation per refactor-concept 7.1; visual parity to be confirmed in T011). Note: an initial `.usm-header-badge` chip rule was added here but removed in T015 — the Figma "Badge 1" is a placeholder with no backing data (refactor-concept §9 decision 5: the badge is not part of this iteration), so no header-badge element is emitted.
- [ ] T011 [US9] Manual verification: run quickstart Q15 part 1 — switch between light and dark themes (no reload), confirm no hard-coded colors, no visual artifacts, sufficient text contrast in both themes, and visual parity with the Figma design (node 76:421)

**Checkpoint**: US9 complete — the board matches the design reference in both themes

---

## Phase 6: User Story 10 - Structure prepared for future features (Priority: P3)

**Goal**: The DOM includes reserved elements for future features (release toggle, DnD handles, add/remove buttons) that are structurally present but inactive: the chevron is visible (per Figma) but non-interactive; DnD handles and add/remove buttons are invisible (FR-034)

**Independent Test**: Inspect the rendered DOM — each release section contains a visible, inert toggle button; story cards and header cells contain invisible, inert reserved handles/slots; no interaction triggers any future-feature behavior (quickstart Q15 part 2)

### Tests for User Story 10 ⚠️

- [X] T012 [US10] Extend the structural DOM tests FIRST (TDD — the new assertions MUST fail before implementation) in `tests/integration/section-layout.test.ts`: assert every `.usm-release-header` contains a `button.usm-release-toggle` (present, `aria-hidden="true"`, `tabindex="-1"`, no `aria-expanded` attribute; clicking it produces no observable DOM change — no class/attribute mutation); story cards (`.usm-story-card`) and header cells (`.usm-header-cell--activity/--task/--epic`) contain reserved DnD handle elements (present, inert — no observable DOM change on interaction); reserved add/remove button slots are present in header cells and release headers (present, inert — no observable DOM change on interaction)
  - **Verified (2026-10-27)**: 6 new tests added to `tests/integration/section-layout.test.ts` (T012 describe block). Confirmed RED before implementation: `npx vitest run tests/integration/section-layout.test.ts` → **6 failed | 7 passed** (all 6 new assertions fail on the current renderer, which emits no reserved elements; all 7 pre-existing structural tests stay green). Reserved-element class names fixed here: `.usm-dnd-handle` (DnD handle), `.usm-add-remove-slot` (add/remove button slot) — used by T013/T014/T015. Inertness asserted via `outerHTML` snapshot before/after synthetic interaction.

### Implementation for User Story 10

- [X] T013 [P] [US10] Add the reserved elements in `src/ui/board-renderer.ts` (FR-034, research R-21): `button.usm-release-toggle` (chevron, visible, inert — `aria-hidden="true"`, `tabindex="-1"`, no click handler, no `aria-expanded`) in every `.usm-release-header`; reserved DnD handle + add/remove button slots (invisible, inert — no listeners) in `.usm-header-cell--activity`, `.usm-header-cell--task`, `.usm-header-cell--epic`, and `.usm-release-header`
  - **Verified (2026-10-27)**: `board-renderer.ts` now emits, per T012's TDD tests: `button.usm-release-toggle` (chevron via `setIcon`, `aria-hidden="true"`, `tabindex="-1"`, no handler, no `aria-expanded`) in every `.usm-release-header`; `.usm-dnd-handle` + `.usm-add-remove-slot` (no listeners) in all three header-cell types and in each `.usm-release-header`. T012's TDD tests for T013's scope now pass (toggle presence/inertness, header-cell handles, add/remove slots). `npx tsc --noEmit` clean. The 2 remaining red tests (story-card DnD handle) are T014's scope (`story-card.ts`).
- [X] T014 [P] [US10] Add the reserved DnD handle element (invisible, inert — no listeners) to story cards in `src/ui/story-card.ts` (FR-034, research R-21)
  - **Verified (2026-10-27)**: `story-card.ts` now emits a `.usm-dnd-handle` (no listeners) in every story card. T012's TDD tests for the story-card handle now pass — `tests/integration/section-layout.test.ts` is fully green (**13/13**), `npx tsc --noEmit` clean.
- [X] T015 [P] [US10] Add the reserved-element styles in `styles.css`: the chevron visible (per the Figma design) with no hover/focus affordances; DnD handles and add/remove button slots invisible (`display: none` or `visibility: hidden`); no reserved element responds to any interaction
  - **Verified (2026-10-27)**: `styles.css` now styles the reserved elements: `.usm-release-toggle` visible (24×24, `var(--text-normal)`, `cursor: default`, no hover/focus affordances — `:hover`/`:focus`/`:focus-visible` reset color and outline); `.usm-dnd-handle` and `.usm-add-remove-slot` `display: none` (out of layout and a11y tree). `.usm-release-title` got `flex: 1; min-width: 0` so it ellipsizes next to the chevron. Also removed the dead `.usm-header-badge` rule from T010 (no such element is emitted — Figma "Badge 1" is a placeholder, refactor-concept §9 decision 5). Full suite **164/164**, tsc clean, lint: 0 errors (warnings test-only + pre-existing `settings.ts`). **Perf baseline re-recorded** (user decision 2026-10-27: during the intensive UI phase, tasks that intentionally add DOM elements re-record the baseline; the 20% budget stays as a guard against unintended regressions): `renderMs` 623.74 → 778.75 (cost of the FR-034 reserved elements: 30 000 `.usm-dnd-handle` nodes + header slots on the 30 000-story perf board).
- [X] T016 [US10] Manual verification: run quickstart Q15 part 2 — inspect the DOM in DevTools (reserved elements present with expected classes, chevron visible but inert, handles/slots invisible) and confirm no future-feature behavior (collapse, drag-and-drop, add/remove) is triggered by any interaction
  - **Verified (2026-10-28, test-vault e2e)**: verified live in the committed `test-vault/` via the `002-e2e-test-env` tooling (CDP `e2e:inspect` eval against `boards/Test Board 2.md`, 4 release sections / 9 cards / 16 header cells). Every `.usm-release-header` carries a visible `button.usm-release-toggle` (`aria-hidden="true"`, `tabindex="-1"`, no click handler, `display: flex`, non-zero size); 29 `.usm-dnd-handle` (9 in story cards + 16 in header cells + 4 in release headers) and 20 `.usm-add-remove-slot` (16 in header cells + 4 in release headers) are all `display: none`; all 16 header cells each carry a handle + slot. Clicking a toggle leaves the section `outerHTML` byte-identical (no collapse — `.usm-release-body` stays visible, card count unchanged at 9). No interaction triggers collapse, drag-and-drop, or add/remove. Recorded in `checklists/manual-validation.md` (Q15 part 2, automatable, PASS).

**Checkpoint**: All user stories (US7–US10) are independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, documentation, and cross-cutting quality gates

- [X] T017 [P] Update `src/ui/en.ts` with any new label keys required by the refactor (e.g., an accessible label for the release toggle button) — all user-facing strings MUST come from the dictionary (research R-09); no hard-coded UI text in `src/ui/board-renderer.ts` or `src/ui/story-card.ts`
  - **Verified (2026-10-27)**: No new keys required. The refactor adds no user-facing strings: `button.usm-release-toggle` is `aria-hidden="true"` (excluded from the accessibility tree, so an accessible label is unnecessary — adding one would be dead code, Constitution Principle VII); the DnD handles and add/remove slots are `display: none` with no text. Verified by inspection: the only user-facing strings in `board-renderer.ts` / `story-card.ts` are `t('unassigned')` and `t('card.broken')`, both resolved from the `en.ts` dictionary (R-09); all other string literals are comments, ARIA/role attributes, class names, or level identifiers.
- [X] T018 Run the full automated suite (`npm test`): unit + integration + performance — confirm SC-014 (no performance regression >20% vs `tests/performance/baseline.json` on the same board size), SC-015 (all MVP tests pass), and SC-010 (suite completes in under 2 minutes)
  - **Verified (2026-10-27)**: Full suite **164/164** (13 files), tsc clean, lint 0 errors (warnings test-only + pre-existing `settings.ts`). **SC-014** ✓ (no >20% regression vs baseline), **SC-015** ✓ (all MVP tests pass), **SC-010** ✓ (suite ~7.6–8.2 s, far under the 2-minute budget). **Stability fix (user decision, option A):** the perf suite (T034) measures wall-clock DOM build time and was flaky under load — in the default parallel run it shared CPU with the other 12 test files, inflating render time past the 20% budget intermittently (observed 1 failed / 4 runs, then 5/5 pass with no code change). Set `fileParallelism: false` in `vitest.config.ts` so the perf suite runs without CPU contention; confirmed **5/5 stable** runs at 164/164. Suite cost is negligible (~6.2 s → ~7.7 s; the perf suite dominates). The 20% regression budget is unchanged.
- [ ] T019 Run the full quickstart.md validation for Iteration 2: scenarios Q11–Q15 on Desktop and Q14 on at least one mobile device (manual acceptance per the spec's Testing Strategy)
- [ ] T020 [P] Update `CHANGELOG.md` with the Iteration 2 entry: section-based release layout, sticky column-header block, fixed column width (`--usm-col-w`), light/dark theming via Obsidian CSS variables, reserved DOM for future features
- [ ] T021 Final verification: run `npm run lint` and `npm run build` from the repository root — both complete cleanly with no errors or warnings

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phases 3–6)**: All depend on Foundational phase completion
  - US7 (Phase 3) and US8 (Phase 4) can proceed in parallel (US8 is verification-only; no code changes)
  - US9 (Phase 5) after US7 (shared file: `styles.css`)
  - US10 (Phase 6) after US9 (shared files: `styles.css`, `src/ui/board-renderer.ts`)
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 7 (P1)**: Can start after Foundational (Phase 2) — no dependencies on other stories
- **User Story 8 (P1)**: Can start after Foundational (Phase 2) — implementation delivered in Phase 2; verification only
- **User Story 9 (P2)**: After US7 (shared `styles.css`) — independently testable via themes + Figma comparison
- **User Story 10 (P3)**: After US9 (shared `styles.css` / `board-renderer.ts`) — independently testable via DOM inspection

### Within Each User Story

- Tests (where included) MUST be written and FAIL before implementation (T002 before T003/T004; T012 before T013/T014/T015)
- Core implementation before manual verification
- Story complete before moving to the next priority

### Parallel Opportunities

- T004 (styles.css) can run in parallel with T003 (board-renderer.ts) — different files, shared contract in data-model.md V-01
- T009 (token guard test) can run in parallel with T006/T007 (US7) — different files
- T013, T014, T015 (US10 implementation) can run in parallel — different files (`board-renderer.ts`, `story-card.ts`, `styles.css`)
- T017 and T020 (Polish) can run in parallel with each other and with T018/T019

---

## Parallel Example: User Story 10

```bash
# After T012 (tests written, failing):
# Launch all US10 implementation tasks together (different files):
Task: "Add the reserved elements in src/ui/board-renderer.ts"          (T013)
Task: "Add the reserved DnD handle element in src/ui/story-card.ts"    (T014)
Task: "Add the reserved-element styles in styles.css"                  (T015)
```

---

## Implementation Strategy

### MVP First (US7 + US8 — the core layout)

1. Complete Phase 1: Setup (baseline verified)
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 7 (mobile layout)
4. Complete Phase 4: User Story 8 (sections + alignment verification)
5. **STOP and VALIDATE**: run the structural tests + quickstart Q11–Q14 — the core section-based layout works on Desktop and mobile

### Incremental Delivery

1. Setup + Foundational → core section-based layout renders
2. Add US7 → mobile layout verified → demo-able
3. Add US8 → alignment + Unassigned-first verified → core MVP complete
4. Add US9 → Figma design + both themes → visual polish
5. Add US10 → reserved DOM → future-proofed structure
6. Polish → full suite + quickstart Q11–Q15 + changelog → release-ready

### Per-Task Protocol (Constitution: Logical Atomicity Protocol)

- After each task is implemented and verified, mark it `[X]` in this file IMMEDIATELY — batch checkoff is forbidden
- Do not start task N+1 until task N is marked `[X]` (Sequencing Gate)
- Commit per phase, not per task: when the last task of a phase is checked off, commit the phase's code changes together with all of the phase's checkoffs in a single commit
- After any interruption, re-read this file first and check off completed-but-unmarked tasks before starting new work

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to a specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (T002, T012)
- Commit per phase (one commit at each phase's checkpoint, after all of the phase's tasks are checked off)
- Stop at any checkpoint to validate story independence
- The domain layer (`src/domain/`), the Obsidian adapters (`src/obsidian/`), and the contracts (`contracts/`) are untouched — any task that would require changing them is out of scope and MUST be escalated (it would invalidate the SC-015 premise)
