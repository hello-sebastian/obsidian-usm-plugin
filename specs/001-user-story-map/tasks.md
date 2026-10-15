---

description: "Task list for User Story Map Board View"
---

# Tasks: User Story Map Board View

**Input**: Design documents from `/specs/001-user-story-map/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not included — the feature specification defers automated/performance tests to later iterations ("testy wydajności zostaną dodane później"); validation is manual via `quickstart.md` scenarios (plan.md: Testing).

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

- [ ] T001 Create source directory structure per plan.md in `src/`: `src/board/`, `src/story/`, `src/i18n/`, `src/debug/`, `src/utils/`
- [ ] T002 Update plugin identity in `manifest.json` (set `id`, `name`, `description` for the User Story Map plugin, keep `isDesktopOnly: false`) and align `name`/`description` in `package.json`
- [ ] T003 [P] Create the English label dictionary in `src/i18n/en.ts` — flat `Record<string, string>` keyed by semantic string IDs covering: "Unassigned" section label, command names ("Open as User Story Map", "Open as Markdown"), pane header icon tooltip, debug panel labels (fps, story count, render time); all user-facing strings MUST come from this dictionary (research R-09)
- [ ] T004 [P] Implement the debounce utility in `src/utils/debounce.ts` — generic debounce function with cancel support, used to coalesce bursts of file-change events into a single re-render (research R-03)
- [ ] T005 [P] Implement the sanitization utility in `src/utils/sanitize.ts` — HTML-escape function for note-derived strings; document that the primary XSS defense is text-node insertion (`setText`/`createEl`), with this escape as the fallback for any markup construction (research R-05, FR-016)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core data pipeline that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 Create shared TypeScript interfaces in `src/types.ts` per `data-model.md`: `BoardConfig` (`isBoard: boolean`, `releaseRowOrder: 'appearance' | 'alphabetical'`), `StoryAttributes` (activity/task/epic/release as `{ text: string; linkPath?: string } | null`), `StoryEntry` (`id`, `targetPath: string | null`, `linkText`, `attributes`, `title`, `isBroken`), `GridModel` (`activities: ColumnGroup[]`, `releases: string[]`, `cells: Map<string, StoryEntry[]>` with key format `${activityKey}::${taskKey}::${epicKey}::${releaseKey}`), `ColumnGroup`, `TaskGroup`; strict mode, no `any`
- [ ] T007 [P] Implement story attribute reading in `src/story/story-attributes.ts` — read frontmatter via `app.metadataCache.getFileCache()` only (no disk reads); case-insensitive PL/EN synonym matching per `contracts/story-file-format.md` (activity/aktywność, task/zadanie, epic/epik, release/wydanie/row, story, title); distinguish plain-text values from wikilink values (`{ text, linkPath? }`); resolve the title cascade: `Story` → `title` → first alias → file name without extension (FR-004, FR-009, FR-012); missing frontmatter → all attributes `null`
- [ ] T008 [P] Implement board file parsing in `src/board/board-parser.ts` per `contracts/board-file-format.md` — detect `usm-board: true` flag (case-insensitive); read `usm-release-order` (`appearance` default, `alphabetical` optional, unknown values fall back to `appearance`); extract the ordered list of wikilinks from the body ignoring ALL non-wikilink lines (headers, text, comments, empty lines); resolve each wikilink to its target note path; preserve duplicates as separate `StoryEntry` occurrences in order of appearance; mark entries whose target does not exist as `isBroken: true` (FR-001, FR-003, FR-006, FR-018)
- [ ] T009 Implement grid model building in `src/board/board-model.ts` — build `GridModel` from `BoardConfig` + `StoryEntry[]`: column hierarchy Activity → Task → Epic in order of first appearance across the board's story entries (FR-005); rows from Release values ordered per `releaseRowOrder` (FR-006); missing attribute at any level → reserved `UNASSIGNED` key at that level (FR-011); populate `cells` map; case-insensitive value comparison so `Login` and `login` group together (spec edge case)

**Checkpoint**: Foundation ready — data pipeline (types → attributes → parser → model) complete; user story implementation can now begin

---

## Phase 3: User Story 1 - Otwarcie notatki tablicy jako wizualnej mapy (Priority: P1) 🎯 MVP

**Goal**: A board note (`usm-board: true`) opens as a visual map; seamless toggle to raw Markdown and back without any content change.

**Independent Test**: Create `board.md` with the flag and three links to stories, open the note, and verify the map renders with the stories placed in a grid; toggle to Markdown and back — content unchanged (quickstart Q1).

### Implementation for User Story 1

- [ ] T010 [P] [US1] Implement the board view in `src/board/board-view.ts` — subclass `TextFileView` with a custom view type; when the opened file has `usm-board: true`, render the visual map container instead of raw Markdown; add a pane header icon and command-palette commands ("Open as User Story Map" / "Open as Markdown", labels from `src/i18n/en.ts`) that toggle the mode within the same leaf without modifying the file (FR-001, FR-002, SC-004; research R-01)
- [ ] T011 [P] [US1] Implement the base map renderer in `src/board/board-renderer.ts` — render a `GridModel` into the view's content container: single scroll container with `overflow: auto` on both axes, CSS Grid layout, one card element per `StoryEntry` (basic card: title text + empty footer), all note-derived strings inserted as text nodes (FR-008, FR-016, FR-018; research R-04)
- [ ] T012 [US1] Wire the view into the plugin lifecycle in `src/main.ts` — register the board view type, register the toggle commands, remove the sample-plugin boilerplate (ribbon icon, status bar, sample commands); keep `main.ts` minimal (lifecycle + registration only) (depends on T010, T011)

**Checkpoint**: User Story 1 fully functional — a board note opens as a map with story cards, toggle works, content never changes (MVP demo-able)

---

## Phase 4: User Story 2 - Podgląd historii ułożonych w siatce 2D (Priority: P1)

**Goal**: Stories are grouped into a 2D grid — columns Activity → Task → Epic (first-appearance order), rows per Release.

**Independent Test**: Create stories with varied Activity/Task/Epic/Release values, open the board, and verify the grid groups them correctly with the right column and row order (quickstart Q2).

### Implementation for User Story 2

- [ ] T013 [US2] Extend the grid rendering in `src/board/board-renderer.ts` — nested column group headers (Activity header spanning its Task sub-columns, Task header spanning its Epic columns), row headers per Release, and place each card in the cell at the intersection of its Epic column and Release row using the `GridModel.cells` keys (FR-005, FR-006, FR-008; SC-002)
- [ ] T014 [US2] Render attribute headers with wikilink support in `src/board/board-renderer.ts` — when an Activity/Task/Epic/Release value is a wikilink, render the header as a clickable element that opens the linked note; plain-text values render as inert visual labels (FR-007)

**Checkpoint**: User Stories 1 AND 2 both work independently — the map shows the full 2D hierarchy with correct placement

---

## Phase 5: User Story 3 - Karty historii z czytelnymi tytułami (Priority: P2)

**Goal**: Each story renders as a card with a cascading title (clamped to a few lines), a Release badge in the footer, and click-to-open behavior.

**Independent Test**: Create stories with and without the `Story` attribute, open the board, and verify each card shows the correct title per the cascade plus the Release badge; clicking a card opens the note (quickstart Q3).

### Implementation for User Story 3

- [ ] T015 [P] [US3] Implement the story card component in `src/story/story-card.ts` — card DOM with header (title resolved via the cascade from `StoryEntry.title`, clamped to 2–3 lines using CSS `-webkit-line-clamp`) and footer (badge showing the Release value only — no status attribute in MVP, FR-010); click opens the linked note in the standard view (FR-019); keyboard accessible: `tabindex="0"`, `role="button"`, Enter/Space activation (Constitution Principle IV)
- [ ] T016 [US3] Integrate the story card into the renderer in `src/board/board-renderer.ts` — replace the basic card from T011 with the `story-card.ts` component for every `StoryEntry` (depends on T015)

**Checkpoint**: User Stories 1–3 all work independently — cards show correct titles, badges, and open notes on click

---

## Phase 6: User Story 4 - Nawigacja po mapie w 2D (Priority: P2)

**Goal**: Large maps scroll horizontally and vertically with column and row headers remaining visible.

**Independent Test**: Create a board with many activities and releases, open it, scroll in both directions, and verify headers stay visible (quickstart Q4).

### Implementation for User Story 4

- [ ] T017 [US4] Implement sticky headers and 2D scrolling in `src/board/board-renderer.ts` and `styles.css` — single scroll container (`overflow: auto`), column headers with `position: sticky; top: 0`, row headers with `position: sticky; left: 0`, corner cell pinned on both axes; verify with ≥ 10 columns and ≥ 5 rows (FR-014, SC-006; research R-04)

**Checkpoint**: User Stories 1–4 all work independently — navigation is usable on large maps

---

## Phase 7: User Story 5 - Obsługa niekompletnych danych historii (Priority: P2)

**Goal**: Stories with missing attributes never break the map — they are grouped into "Unassigned" sections; broken links show placeholders.

**Independent Test**: Create stories missing Activity, Task, Epic, or Release (and one with no frontmatter at all), open the board, and verify they appear in "Unassigned" sections without errors (quickstart Q5).

### Implementation for User Story 5

- [ ] T018 [US5] Render "Unassigned" sections and broken-link placeholders in `src/board/board-renderer.ts` — dedicated "Unassigned" column group / sub-column / row using the label from `src/i18n/en.ts` whenever the `GridModel` contains the `UNASSIGNED` key at that level; render `isBroken` entries as dimmed placeholder cards showing the link text; no errors, no intrusive notifications (FR-011, SC-003; research R-11)

**Checkpoint**: User Stories 1–5 all work independently — incomplete data is fully resilient

---

## Phase 8: User Story 6 - Edycja wyłącznie w Markdown (mapa tylko do odczytu) (Priority: P3)

**Goal**: The map is read-only and automatically mirrors edits made in the Markdown source.

**Independent Test**: With the map open, edit a story's frontmatter or add a link to the board, and verify the map updates within 2 seconds without touching the map (quickstart Q6).

### Implementation for User Story 6

- [ ] T019 [US6] Implement event-driven live updates in `src/board/board-view.ts` — register `metadataCache.on('changed')` and `vault.on('modify')` via `this.registerEvent`; filter events to the board file and its linked story files; debounce with `src/utils/debounce.ts` so a burst of changes triggers a single model rebuild + re-render; update must complete within 2 seconds of the edit (FR-013, SC-005; research R-03)
- [ ] T020 [US6] Enforce read-only behavior in `src/board/board-view.ts` and `src/board/board-renderer.ts` — no editing affordances on the map (no drag, no inline edit, no context-menu mutations); verify the board file and story files are never written by the plugin (FR-015, SC-004)

**Checkpoint**: All user stories independently functional — the map is a live, read-only projection of the Markdown source

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T021 [P] Add the `debugMode` plugin setting (boolean, default `false`) in `src/settings.ts` and expose it in the settings tab via `SettingTab`
- [ ] T022 Implement the debug/dev panel in `src/debug/debug-panel.ts` — when `debugMode` is enabled and the map view is visible, show an overlay with: fps (measured via `requestAnimationFrame` deltas), number of rendered story cards, last render duration in ms; start/stop the measurement loop only while active and clean it up on view close or toggle-off (FR-020, SC-001; research R-07) (depends on T021)
- [ ] T023 [P] XSS hardening audit across `src/board/board-renderer.ts`, `src/story/story-card.ts`, and `src/board/board-view.ts` — verify every note-derived string (titles, attribute values, badges, link text) is inserted as a text node or escaped via `src/utils/sanitize.ts`; no `innerHTML` with note data anywhere (FR-016; quickstart Q8)
- [ ] T024 [P] Complete the map styling in `styles.css` — use Obsidian CSS variables (`var(--text-normal)`, `var(--background-primary)`, etc.) for full light/dark theme adaptation, card styling, sticky-header offsets, and mobile-friendly sizing (Constitution Principles I, IV)
- [ ] T025 Run the full validation suite from `specs/001-user-story-map/quickstart.md` — scenarios Q1–Q10 on Desktop and Q10 on at least one mobile device; fix any failures
- [ ] T026 [P] Update `README.md` (usage instructions, board/story file format examples, screenshots placeholder) and create `CHANGELOG.md` with the initial release entry (Constitution: documentation quality)

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
Task: "T010 Implement the board view in src/board/board-view.ts"
Task: "T011 Implement the base map renderer in src/board/board-renderer.ts"

# Then, after both complete:
Task: "T012 Wire the view into the plugin lifecycle in src/main.ts"
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
- No automated test tasks — validation is manual via `quickstart.md` (spec defers performance tests to later iterations)
- All code in TypeScript strict mode, no `any`; comments in English (Constitution Principle III)
- All user-facing strings from `src/i18n/en.ts` — never hardcoded
- Commit after each task or logical group
- Stop at any checkpoint to validate story independence before proceeding
