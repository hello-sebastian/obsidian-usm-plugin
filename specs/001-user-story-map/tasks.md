---

description: "Task list for User Story Map Board View"
---

# Tasks: User Story Map Board View

**Input**: Design documents from `/specs/001-user-story-map/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included — the feature specification requires automated tests as a first-class part of the MVP (FR-022, FR-023, FR-024, SC-009, SC-010). Automated unit + integration tests (Vitest) cover the core logic; versioned fixtures ensure reproducibility; automated performance tests establish render thresholds. Manual acceptance testing via `quickstart.md` scenarios covers user-facing behavior (plan.md: Testing, research R-13).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project (Obsidian plugin)**: `src/` at repository root; release artifacts (`main.js`, `manifest.json`, `styles.css`) at plugin root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create source directory structure per plan.md in `src/`: `src/domain/`, `src/obsidian/`, `src/ui/` (strict 3-layer layout per Constitution Principle VII; originally created as `src/board/`, `src/story/`, `src/i18n/`, `src/debug/`, `src/utils/` and restructured in Phase 11)
- [X] T002 Update plugin identity in `manifest.json` (set `id` to `obsidian-usm-plugin` — matching the plugin folder name and permanent once released per the Constitution "ID persistence" rule; set `name` to "User Story Map" and a concise `description`, keep `isDesktopOnly: false`) and align `name`/`description` in `package.json`
- [X] T003 [P] Create the English label dictionary in `src/ui/en.ts` — flat `Record<string, string>` keyed by semantic string IDs covering: "Unassigned" section label, command names ("Open as User Story Map", "Open as Markdown"), pane header icon tooltip, debug panel labels (fps, story count, render time); all user-facing strings MUST come from this dictionary (research R-09)
- [X] T004 [P] Implement the debounce utility in `src/domain/debounce.ts` — generic debounce function with cancel support, used to coalesce bursts of file-change events into a single re-render (research R-03)
- [X] T005 [P] Implement the sanitization utility in `src/domain/sanitize.ts` — HTML-escape function for note-derived strings; document that the primary XSS defense is text-node insertion (`setText`/`createEl`), with this escape as the fallback for any markup construction (research R-05, FR-016)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core data pipeline that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 Create shared TypeScript interfaces in `src/domain/types.ts` per `data-model.md`: `BoardConfig` (`isBoard: boolean`, `releaseRowOrder: 'appearance' | 'alphabetical'`), `StoryAttributes` (activity/task/epic/release as `{ text: string; linkPath?: string } | null`), `StoryEntry` (`id`, `targetPath: string | null`, `linkText`, `attributes`, `title`, `isBroken`), `GridModel` (`activities: ColumnGroup[]`, `releases: string[]`, `cells: Map<string, StoryEntry[]>` with key format `${activityKey}::${taskKey}::${epicKey}::${releaseKey}`, `unassigned: { activity: boolean; task: boolean; epic: boolean; release: boolean }` — a per-level flag indicating whether an "Unassigned" section exists at that level), `ColumnGroup`, `TaskGroup`; strict mode, no `any`
- [X] T007 [P] Implement story attribute reading in `src/obsidian/story-attributes.ts` — read frontmatter via `app.metadataCache.getFileCache()` only (no disk reads); case-insensitive PL/EN synonym matching per `contracts/story-file-format.md` (activity/aktywność, task/zadanie, epic/epik, release/wydanie/row, story, title); distinguish plain-text values from wikilink values (`{ text, linkPath? }`); resolve the title cascade: `Story` → `title` → first alias → file name without extension (FR-004, FR-009, FR-012); missing frontmatter → all attributes `null`
- [X] T008 [P] Implement board file parsing in `src/obsidian/board-parser.ts` per `contracts/board-file-format.md` — detect `usm-board: true` flag (case-insensitive); read `usm-release-order` (`appearance` default, `alphabetical` optional, unknown values fall back to `appearance`); extract the ordered list of wikilinks from the body ignoring ALL non-wikilink lines (headers, text, comments, empty lines); resolve each wikilink to its target note path; preserve duplicates as separate `StoryEntry` occurrences in order of appearance; mark entries whose target does not exist as `isBroken: true` (FR-001, FR-003, FR-006, FR-018)
- [X] T009 Implement grid model building in `src/domain/board-model.ts` — build `GridModel` from `BoardConfig` + `StoryEntry[]`: column hierarchy Activity → Task → Epic in order of first appearance across the board's story entries (FR-005); rows from Release values ordered per `releaseRowOrder` (FR-006); missing attribute at any level → reserved `UNASSIGNED` key at that level (FR-011); populate `cells` map; set the `unassigned` per-level flags to `true` whenever the `UNASSIGNED` key is used at that level (so the renderer knows which "Unassigned" sections to draw); case-insensitive value comparison so `Login` and `login` group together (spec edge case)
- [X] T027 [P] Configure Vitest test infrastructure — add `vitest` as a devDependency in `package.json`, create `vitest.config.ts` at repository root (test include: `tests/**/*.test.ts`, environment: `node`), add npm scripts: `"test": "vitest run"`, `"test:unit": "vitest run tests/unit"`, `"test:integration": "vitest run tests/integration"`, `"test:perf": "vitest run tests/performance"` (FR-022, R-13)
- [X] T028 [P] Create versioned test fixtures in `tests/fixtures/` — a board note (`board.md`) with `usm-board: true`, `usm-release-order: appearance`, and wikilinks covering: complete stories, missing attributes (each level), duplicates, broken links, Polish field names, and a story with no frontmatter; story notes `S1.md`–`S6.md` with varied attribute combinations per `contracts/story-file-format.md`; a `README.md` describing the fixture coverage matrix (FR-023)

**Checkpoint**: Foundation ready — data pipeline (types → attributes → parser → model) complete; test infrastructure configured; user story implementation can now begin

---

## Phase 3: User Story 1 - Opening a board note as a visual map (Priority: P1) 🎯 MVP

**Goal**: A board note (`usm-board: true`) opens as a visual map; seamless toggle to raw Markdown and back without any content change.

**Independent Test**: Create `board.md` with the flag and three links to stories, open the note, and verify the map renders with the stories placed in a grid; toggle to Markdown and back — content unchanged (quickstart Q1).

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T029 [P] [US1] Write unit tests for board file parsing in `tests/unit/board-parser.test.ts` — flag detection (`usm-board: true`, case-insensitive), config attribute reading (`usm-release-order`), wikilink extraction (ordered list, ignoring non-link lines), duplicate links preserved as separate entries, broken links marked `isBroken: true`, unknown config values fall back to defaults (FR-001, FR-003, FR-006, FR-018, FR-021; uses fixtures from T028)

### Implementation for User Story 1

- [X] T010 [P] [US1] Implement the board view in `src/obsidian/board-view.ts` — subclass `TextFileView` with a custom view type; when the opened file has `usm-board: true`, render the visual map container instead of raw Markdown; add a pane header icon and command-palette commands ("Open as User Story Map" / "Open as Markdown", labels from `src/ui/en.ts`) that toggle the mode within the same leaf without modifying the file (FR-001, FR-002, SC-004; research R-01)
- [X] T011 [P] [US1] Implement the base map renderer in `src/ui/board-renderer.ts` — render a `GridModel` into the view's content container: single scroll container with `overflow: auto` on both axes, CSS Grid layout, one card element per `StoryEntry` (basic card: title text + empty footer), all note-derived strings inserted as text nodes (FR-008, FR-016, FR-018; research R-04)
- [X] T012 [US1] Wire the view into the plugin lifecycle in `src/obsidian/main.ts` — register the board view type, register the toggle commands, remove the sample-plugin boilerplate (ribbon icon, status bar, sample commands); keep `main.ts` minimal (lifecycle + registration only) (depends on T010, T011)

**Checkpoint**: User Story 1 fully functional — a board note opens as a map with story cards, toggle works, content never changes (MVP demo-able)

---

## Phase 4: User Story 2 - Preview of stories arranged in a 2D grid (Priority: P1)

**Goal**: Stories are grouped into a 2D grid — columns Activity → Task → Epic (first-appearance order), rows per Release.

**Independent Test**: Create stories with varied Activity/Task/Epic/Release values, open the board, and verify the grid groups them correctly with the right column and row order (quickstart Q2).

### Tests for User Story 2 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T030 [P] [US2] Write unit tests for grid model building in `tests/unit/board-model.test.ts` — column hierarchy (Activity → Task → Epic) in order of first appearance, row order (appearance and alphabetical), `UNASSIGNED` key placement for missing attributes, case-insensitive value grouping (`Login` and `login` → same column), `cells` map key format and population, `unassigned` per-level flags (FR-005, FR-006, FR-011; SC-002; uses fixtures from T028)

### Implementation for User Story 2

- [X] T013 [US2] Extend the grid rendering in `src/ui/board-renderer.ts` — nested column group headers (Activity header spanning its Task sub-columns, Task header spanning its Epic columns), row headers per Release, and place each card in the cell at the intersection of its Epic column and Release row using the `GridModel.cells` keys (FR-005, FR-006, FR-008; SC-002)
- [X] T014 [US2] Render attribute headers with wikilink support in `src/ui/board-renderer.ts` — when an Activity/Task/Epic/Release value is a wikilink, render the header as a clickable element that opens the linked note; plain-text values render as inert visual labels (FR-007)

**Checkpoint**: User Stories 1 AND 2 both work independently — the map shows the full 2D hierarchy with correct placement

---

## Phase 5: User Story 3 - Story cards with readable titles (Priority: P2)

**Goal**: Each story renders as a card with a cascading title (clamped to a few lines), a Release badge in the footer, and click-to-open behavior.

**Independent Test**: Create stories with and without the `Story` attribute, open the board, and verify each card shows the correct title per the cascade plus the Release badge; clicking a card opens the note (quickstart Q3).

### Tests for User Story 3 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T031 [P] [US3] Write unit tests for story attribute reading in `tests/unit/story-attributes.test.ts` — PL/EN synonym matching (activity/aktywność, task/zadanie, epic/epik, release/wydanie/row), case-insensitive field name matching, plain-text vs. wikilink value distinction (`{ text, linkPath? }`), title cascade (`Story` → `title` → first alias → file name), missing frontmatter → all attributes `null` (FR-004, FR-009, FR-012; uses fixtures from T028)

### Implementation for User Story 3

- [X] T015 [P] [US3] Implement the story card component in `src/ui/story-card.ts` — card DOM with header (title resolved via the cascade from `StoryEntry.title`, clamped to 2–3 lines using CSS `-webkit-line-clamp`) and footer (badge showing the Release value only — no status attribute in MVP, FR-010); click opens the linked note in the standard view (FR-019); keyboard accessible: `tabindex="0"`, `role="button"`, Enter/Space activation (Constitution Principle IV)
- [X] T016 [US3] Integrate the story card into the renderer in `src/ui/board-renderer.ts` — replace the basic card from T011 with the `story-card.ts` component for every `StoryEntry` (depends on T015, and on T013 so the card is placed within the full 2D grid)

**Checkpoint**: User Stories 1–3 all work independently — cards show correct titles, badges, and open notes on click

---

## Phase 6: User Story 4 - Navigating the map in 2D (Priority: P2)

**Goal**: Large maps scroll horizontally and vertically with column and row headers remaining visible.

**Independent Test**: Create a board with many activities and releases, open it, scroll in both directions, and verify headers stay visible (quickstart Q4).

### Implementation for User Story 4

- [X] T017 [US4] Implement sticky headers and 2D scrolling in `src/ui/board-renderer.ts` and `styles.css` — single scroll container (`overflow: auto`), column headers with `position: sticky; top: 0`, row headers with `position: sticky; left: 0`, corner cell pinned on both axes; verify with ≥ 10 columns and ≥ 5 rows (FR-014, SC-006; research R-04)

**Checkpoint**: User Stories 1–4 all work independently — navigation is usable on large maps

---

## Phase 7: User Story 5 - Handling incomplete story data (Priority: P2)

**Goal**: Stories with missing attributes never break the map — they are grouped into "Unassigned" sections; broken links show placeholders.

**Independent Test**: Create stories missing Activity, Task, Epic, or Release (and one with no frontmatter at all), open the board, and verify they appear in "Unassigned" sections without errors (quickstart Q5).

### Tests for User Story 5 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T032 [P] [US5] Write integration tests for the full data pipeline in `tests/integration/pipeline.test.ts` — load fixture board + story notes (from `tests/fixtures/`), run the complete pipeline (parse → attributes → model), verify: stories with missing attributes land in `UNASSIGNED` cells at the correct level, broken links produce `isBroken` entries with correct grid position, stories with no frontmatter are fully unassigned, the resulting `GridModel` matches the expected structure (cell keys, order, unassigned flags) (FR-011, SC-002, SC-003; depends on T028)

### Implementation for User Story 5

- [X] T018 [US5] Render "Unassigned" sections and broken-link placeholders in `src/ui/board-renderer.ts` — dedicated "Unassigned" column group / sub-column / row using the label from `src/ui/en.ts` whenever the `GridModel` contains the `UNASSIGNED` key at that level; render `isBroken` entries as dimmed placeholder cards showing the link text; no errors, no intrusive notifications (FR-011, SC-003; research R-11)

**Checkpoint**: User Stories 1–5 all work independently — incomplete data is fully resilient

---

## Phase 8: User Story 6 - Editing exclusively in Markdown (map is read-only) (Priority: P3)

**Goal**: The map is read-only and automatically mirrors edits made in the Markdown source.

**Independent Test**: With the map open, edit a story's frontmatter or add a link to the board, and verify the map updates within 2 seconds without touching the map (quickstart Q6).

### Implementation for User Story 6

- [X] T019 [US6] Implement event-driven live updates in `src/obsidian/board-view.ts` — register `metadataCache.on('changed')` and `vault.on('modify')` via `this.registerEvent`; filter events to the board file and its linked story files; debounce with `src/domain/debounce.ts` so a burst of changes triggers a single model rebuild + re-render; update must complete within 2 seconds of the edit (FR-013, SC-005; research R-03)
- [X] T020 [US6] Enforce read-only behavior in `src/obsidian/board-view.ts` and `src/ui/board-renderer.ts` — no editing affordances on the map (no drag, no inline edit, no context-menu mutations); verify the board file and story files are never written by the plugin, so that after the plugin is disabled the board note remains a readable, bulleted list of links in standard Markdown (FR-015, FR-017, SC-004)

**Checkpoint**: All user stories independently functional — the map is a live, read-only projection of the Markdown source

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T021 [P] Add the `debugMode` plugin setting (boolean, default `false`) in `src/obsidian/settings.ts` and expose it in the settings tab via `SettingTab`
- [X] T022 Implement the debug/dev panel in `src/ui/debug-panel.ts` — when `debugMode` is enabled and the map view is visible, show an overlay with: fps (measured via `requestAnimationFrame` deltas), number of rendered story cards, last render duration in ms; start/stop the measurement loop only while active and clean it up on view close or toggle-off (FR-020, SC-001; research R-07) (depends on T021)
- [X] T023 [P] XSS hardening audit across `src/ui/board-renderer.ts`, `src/ui/story-card.ts`, and `src/obsidian/board-view.ts` — verify every note-derived string (titles, attribute values, badges, link text) is inserted as a text node or escaped via `src/domain/sanitize.ts`; no `innerHTML` with note data anywhere (FR-016; quickstart Q8)
- [X] T033 [P] Write unit tests for XSS sanitization in `tests/unit/sanitize.test.ts` — verify that note-derived strings containing HTML markup (`<img src=x onerror=alert(1)>`), script tags, and event handler attributes are neutralized (rendered as inert text, never executed); test the escape function output for special characters (`<`, `>`, `&`, `"`, `'`); verify the text-node insertion path (no `innerHTML` with note data) (FR-016; quickstart Q8)
- [X] T034 Write automated performance tests in `tests/performance/render-perf.test.ts` — build a `GridModel` from a defined board size (≥ 10 columns × ≥ 5 rows × ≥ 50 stories), measure: model build time (ms), DOM render time (ms, using jsdom — dev-only dependency, see plan.md Technical Context), and story card count; record baseline thresholds on first passing run and enforce them on subsequent runs (fail if regression exceeds 20%); the suite must complete in under 2 minutes total (FR-020, FR-024, SC-001, SC-010; depends on T027, T028)
- [X] T024 [P] Complete the map styling in `styles.css` — use Obsidian CSS variables (`var(--text-normal)`, `var(--background-primary)`, etc.) for full light/dark theme adaptation, card styling, sticky-header offsets, and mobile-friendly sizing (Constitution Principles I, IV)
- [ ] T025 Run the full validation suite from `specs/001-user-story-map/quickstart.md` — scenarios Q1–Q10 on Desktop and Q10 on at least one mobile device; fix any failures
- [X] T026 [P] Update `README.md` (usage instructions, board/story file format examples, and real screenshots of the map view — the Constitution requires a README with screenshots, so capture actual screenshots before release; do not ship a placeholder) and create `CHANGELOG.md` with the initial release entry (Constitution: documentation quality)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phases 3–8)**: All depend on Foundational phase completion
  - US1 (Phase 3) is the MVP and should be completed first
  - US2 (Phase 4) builds directly on US1's view + renderer
  - US3–US6 (Phases 5–8) each extend the renderer/view and can proceed in priority order
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — no dependencies on other stories
- **User Story 2 (P1)**: Depends on US1 (extends its renderer) — independently testable once done
- **User Story 3 (P2)**: Depends on US1/US2 (replaces the basic card in the grid) — independently testable once done
- **User Story 4 (P2)**: Depends on US2 (sticky headers on the full grid) — independently testable once done
- **User Story 5 (P2)**: Depends on US2 (Unassigned sections in the grid) — independently testable once done
- **User Story 6 (P3)**: Depends on US1 (view lifecycle for event registration) — independently testable once done

### Within Each User Story

- Foundational data pipeline (types → attributes → parser → model) before any UI
- View/renderer skeleton (US1) before grid extensions (US2+)
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- Setup: T003, T004, T005 can run in parallel (different files)
- Foundational: T007 and T008 can run in parallel (different files, both depend only on T006)
- US1: T010 and T011 can run in parallel (different files); T012 after both
- US3: T015 can start in parallel with US2 work (different file); T016 after T015
- Polish: T021, T023, T024, T026 can run in parallel; T022 after T021; T025 last

---

## Parallel Example: User Story 1

```text
# Launch together (different files, no dependencies):
Task: "T010 Implement the board view in src/obsidian/board-view.ts"
Task: "T011 Implement the base map renderer in src/ui/board-renderer.ts"

# Then, after both complete:
Task: "T012 Wire the view into the plugin lifecycle in src/obsidian/main.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Run quickstart Q1 — board opens as a map, toggle works, content unchanged
5. Demo-able MVP: a board note renders as a visual map with story cards

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Validate (Q1) → **MVP**
3. Add User Story 2 → Validate (Q2) → full 2D grid
4. Add User Story 3 → Validate (Q3) → proper cards
5. Add User Story 4 → Validate (Q4) → sticky navigation
6. Add User Story 5 → Validate (Q5) → incomplete-data resilience
7. Add User Story 6 → Validate (Q6) → live read-only updates
8. Polish (Phase 9) → Validate (Q7–Q10) → release candidate

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 → US2 (view/renderer owner)
   - Developer B: US3 (story-card owner, can start T015 early)
   - Developer C: US6 (event-driven updates, different files)
3. US4/US5 (renderer extensions) follow US2 to avoid merge conflicts in `board-renderer.ts`

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Task IDs are not strictly sequential with execution order (test tasks T027–T034 were appended after the original numbering); **phase grouping is authoritative** for execution order
- **Tests are a first-class part of the MVP** (FR-022, FR-023, FR-024, SC-009, SC-010): automated unit + integration tests (Vitest) for core logic, versioned fixtures for reproducibility, automated performance tests for render thresholds; manual acceptance via `quickstart.md` for user-facing behavior
- Test tasks are marked ⚠️ and should be written FIRST (TDD): ensure they FAIL before the corresponding implementation is complete
- All code in TypeScript strict mode, no `any`; comments in English (Constitution Principle III)
- All user-facing strings from `src/ui/en.ts` — never hardcoded
- Commit after each task or logical group
- Stop at any checkpoint to validate story independence before proceeding
- The automated test suite must pass (under 2 minutes) before any release (SC-010)

---

## Phase 10: Convergence

- [X] T035 Capture and commit real map-view and debug-panel screenshots to `docs/screenshots/` (`map-view.png`, `debug-panel.png`) so the README's screenshot references resolve, per Constitution (Documentation quality) + T026 (partial)

---

## Phase 11: Constitution v1.6.0 Alignment

**Purpose**: Bring the implementation and documentation into compliance with the amended constitution (v1.6.0 → v1.6.1), which added Principle VII (Pragmatic Architecture & Anti-Over-Engineering) and clarified the "No Inline JS Styling" rule.

- [X] T036 Amend the constitution (PATCH, v1.6.1): clarify "No Inline JS Styling" — setting `--usm-*` CSS custom properties to encode structural grid geometry is permitted; all visual styling remains exclusively in `styles.css` with Obsidian CSS variables; record the amendment in `CHANGELOG.md`
- [X] T037 Add the inline-styling regression guard `tests/unit/inline-styling-guard.test.ts` — statically scans all `src/**/*.ts` files and fails on any `.style.<prop>` access, `setAttribute('style', …)`, or `setCssProps` call setting a non-`--usm-*` key (Constitution Principle VII)
- [X] T038 Restructure `src/` into the strict 3-layer layout `src/domain/` (pure functions, zero Obsidian imports) / `src/obsidian/` (API adapters) / `src/ui/` (DOM rendering) via `git mv` (history preserved); rewire all relative imports in `src/` and `tests/`; update the esbuild entry point to `src/obsidian/main.ts`; verify build + full test suite + lint
- [X] T039 Update feature documentation for the restructure: `plan.md` (3-layer Project Structure, Principle VII row in the Constitution Check table, post-amendment re-check note), `tasks.md` (path references + this phase), `research.md` (stale path references)
