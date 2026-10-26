# Feature Specification: User Story Map Board View

**Feature Branch**: `001-user-story-map`

**Created**: 2026-10-15

**Status**: Iteration 1 (MVP) — implemented (2026-10-16). Iteration 2 (visual layer refactor) — **current planning target**.

**Input**: User description: Summary of the architectural and business decisions for the **Obsidian User Story Map** plugin (MVP) — a visual board view, a 2D grid (Activity → Task → Epic × Release), story cards with cascading titles, "Unassigned" grouping, editing exclusively in Markdown, and 100% data locality. Iteration 2: refactor of the visual layer — release header as a horizontal row (section header), release sections stacked vertically, fixed column width, DOM structure prepared for future features.

> **Planning scope**: `/speckit-plan` and `/speckit-tasks` apply to **Iteration 2 only**. Iteration 1 (MVP) is fully implemented; its plan and tasks are archived as `plan-mvp.md` and `tasks-mvp.md`.

## Clarifications

> **Note**: The entries below are the recorded clarification decisions (a point-in-time Q&A log). Their distilled normative form is captured in the **Edge Cases**, **Assumptions**, and **Functional Requirements** sections; where a clarification and a requirement restate the same fact, the requirement section is authoritative.

### Session 2026-10-15

- Q: How should the board parser treat lines in the `board.md` file that are not wiki links to stories (e.g., `#` headers, plain text, comments)? → A: Ignore all lines that are not wiki links — the map is built exclusively from links to stories.
- Q: What should the map do when the same story is linked multiple times (a duplicated wiki link) in `board.md`? → A: Render a card for each occurrence of the link — duplicates appear on the map as separate cards.
- Q: What should happen when the user clicks a story card on the map? → A: In the MVP, clicking a card opens the linked story note; in later iterations, clicking in graphical mode will open a card/dialog/popup with a graphical representation of the note's information, without leaving board mode.
- Q: What is the target scale limit (number of stories) for the MVP, above which the plugin does not guarantee smooth operation? → A: No hard scale limit in the MVP; the plugin must also work on weaker mobile devices (tablet/phone); a debug/dev mode displaying smoothness metrics (e.g., fps, number of displayed stories) was added; optimization is a priority, but so are code cleanliness, universality, and the generality of the architecture; performance tests will be added later.
- Q: How does the user enable the optional alphabetical sorting of Release rows (FR-006)? → A: Board configuration (including sorting) is stored as attributes in the header of the board file (board-xyz.md), so that it survives synchronization and copying and remains readable even for AI agents without the plugin.
- Q: Exactly what should be displayed in the badge in the footer of a story card (FR-010)? → A: In the MVP the badge shows only the Release value; a separate "status" attribute is out of scope for the MVP.
- Q: What language should the map interface labels use (section headers, the "Unassigned" label, command and icon texts)? → A: In the MVP the interface is based exclusively on English naming — terminology, labels, and messages are stored in a single "en" dictionary; the dictionary mechanism is the foundation for future multilingual support (additional dictionary versions will be developed in later iterations).
- Q: The original specification deferred automated tests to later iterations ("performance tests will be added later"). Is that acceptable? → A: No — tests are a fundamental part of the feature and the baseline that defines whether the goals are achieved. Automated tests (unit + integration) for the core logic, reproducible test fixtures, and automated performance tests are part of the MVP scope; manual acceptance testing via the quickstart scenarios remains for user-facing behavior.

### Session 2026-10-22

- Q: The implemented "text preview" mode of the board view renders the board note's source as inert text inside the plugin's own view — a custom, read-only text display written from scratch by the plugin. Should the plugin keep providing its own text display of the board note? → A: No. The text display and editing of the board note MUST be provided by Obsidian's standard Markdown view (the same view any other note gets), not by a plugin-implemented text view. The plugin's custom view is exclusively the visual map; switching from the map to "Markdown" opens the note in Obsidian's standard Markdown view. This follows the constitution's requirement to reuse Obsidian's built-in solutions rather than reimplementing them, and removes the feeling that the board view is not a native part of Obsidian.
- Q: When a board note is opened, which view should it display in, and how should the user switch between the visual map view and the standard Markdown view? → A: The board note opens in the last-selected view type, which is stored as an attribute in the board file's header (defaulting to the visual map view on first open, when the attribute is absent). The view type can be changed only via Obsidian's native view picker (the pane header "change view" button at the top right of the pane); the plugin does not provide its own pane header icon or command palette command for switching between the two views. This makes the view type a portable, self-describing board configuration and keeps the switching mechanism native to Obsidian.

### Session 2026-10-23

- Q: For a board note (`usm-board: true`), what views should the view picker offer, and how should they be presented? → A: The view picker MUST offer exactly three views — the visual map ("USM board"), the standard Markdown editor ("Edit MD"), and the standard Markdown preview ("View MD") — presented as a dropdown list or a three-position toggle so that all three options are visible at a glance. This lets the user see the available views immediately, without trial and error, and makes the visual map feel like a native part of Obsidian's view system.
- Q: Should the plugin be allowed to write the view-type attribute into the board file's frontmatter, which would require amending the board file format contract's rule that "the frontmatter must not be modified by the plugin"? (FR-026) → A: Yes. The plugin MAY write board-level state into the board file — its frontmatter attributes now, and its body content in later iterations. The board file (frontmatter + body) is the single source of truth for all board-level state: configuration (e.g., the last-selected view type, row order) and, in later iterations, the visual-layer effects of user actions (e.g., sorting, moving stories between tasks, changing stickiness). Only the plugin's own internal settings — not board or story data — are stored in the plugin's configuration files (e.g., `data.json`), such as keyboard shortcuts and the debug-mode toggle. This keeps the entire board and its stories reproducible and understandable by a user or an AI agent from the Markdown files alone, even without the plugin installed. (In a later iteration, a "Create USM board" action could create a note and set `usm-board: true`.)
- Q: What attribute name and values should the board file use to record the last-selected view type? (FR-026) → A: The attribute is `usm-view` in the board file's frontmatter, with values `map` (visual map), `edit` (standard Markdown editor), and `preview` (standard Markdown preview). The name follows the existing `usm-` prefix convention (`usm-board`, `usm-release-order`), and the three values map one-to-one to the three view picker options. An absent or unrecognized value is treated as absent and defaults to the visual map view.
- Q: If the same board note is open in multiple panes at once (for example, the map in one pane and the Markdown editor in another), what should happen when the user switches the view in one of those panes? (FR-026) → A: A switch in any pane writes the `usm-view` attribute (last switch wins), but it only affects future opens; the other already-open panes keep showing their current view until reopened.

### Session 2026-10-26

- Q: Should the chevron in the release section header be visible (per Figma) but inactive, or completely hidden in this iteration? (FR-029, FR-034) → A: The chevron is a visible design element (per the Figma reference, satisfying FR-029 and US9) but non-interactive (no collapse/expand functionality). The "invisible" scope in FR-034 applies only to drag-and-drop handles and add/remove buttons, not to the chevron.
- Q: In the new section-based structure, how should stories without a Release attribute (the "Unassigned" group at the release level) be rendered? (FR-011, FR-031) → A: Stories without a Release attribute are rendered in a dedicated "Unassigned" release section (a self-contained section like any other release section, with a header and a grid of Epic columns). The "Unassigned" release section is rendered as the first section (at the top of the board). The "Unassigned" groups at the Activity/Task/Epic levels remain "Unassigned" column groups in the header block.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Opening a board note in its last-selected view (Priority: P1)

The user has a `board.md` note with the `usm-board: true` flag in its header and a list of wiki links to story notes. They open the note and want to see it in the view they last selected — the visual 2D map by default on first open. The view picker offers three views (the visual map, the Markdown editor, and the Markdown preview), all visible at a glance.

**Why this priority**: This is the main value of the plugin — the visual map. Without it, the plugin delivers no value.

**Independent Test**: Create a `board.md` with the flag and three links to stories, open the note, and verify that the map renders with the stories laid out in a grid; open the view picker and verify it shows the three options ("USM board", "Edit MD", "View MD") at a glance.

**Acceptance Scenarios**:

1. **Given** a note with the `usm-board: true` flag in its header and no stored view-type attribute, **When** the user opens the note, **Then** the note is displayed in the visual map view (the default on first open).
2. **Given** a note without the flag, **When** the user opens it, **Then** it is displayed as plain Markdown (the plugin does not interfere).
3. **Given** a board note, **When** the user opens the view picker (the pane header "change view" button), **Then** the picker shows exactly three options — "USM board", "Edit MD", and "View MD" — all visible at a glance, so the user can see the available views without trial and error.
4. **Given** a board note opened in the map view, **When** the user selects "Edit MD" via the view picker, **Then** the note switches to Obsidian's standard Markdown editor (the same editor used for any other note) with no change to its content, and the board file's view-type attribute is updated to record the Markdown editor view.
5. **Given** a board note opened in the map view, **When** the user selects "View MD" via the view picker, **Then** the note switches to Obsidian's standard Markdown preview (the same preview used for any other note) with no change to its content, and the board file's view-type attribute is updated to record the Markdown preview view.
6. **Given** a board note opened in a Markdown view, **When** the user selects "USM board" via the view picker, **Then** it switches to the visual map view, and the board file's view-type attribute is updated to record the map view.
7. **Given** a board note whose view-type attribute records a previously selected view, **When** the user opens the note, **Then** the note is displayed in that last-selected view (the last-selected view is restored).

---

### User Story 2 - Preview of stories arranged in a 2D grid (Priority: P1)

The user wants to see their user journey laid out: columns grouped by Activity → Task → Epic (horizontal axis), rows by Release (vertical axis).

**Why this priority**: The 2D layout is the essence of a "story map" — it is what distinguishes a map from a plain list.

**Independent Test**: Create stories with Activity/Task/Epic/Release attributes covering many values, open the board, and verify that the grid groups them correctly with the right column and row order.

**Acceptance Scenarios**:

1. **Given** stories with different Activity values, **When** the map renders, **Then** columns are grouped by Activity in order of first appearance in `board.md`.
2. **Given** stories in the same Activity with different Task values, **When** the map renders, **Then** sub-columns are grouped by Task (nested under Activity).
3. **Given** stories with different Release values, **When** the map renders, **Then** rows are created per Release.
4. **Given** a story with Activity, Task, Epic, and Release set, **When** the map renders, **Then** the story card appears in the cell at the intersection of the Epic column and the Release row.

---

### User Story 3 - Story cards with readable titles (Priority: P2)

Each story appears as a card with a title (with a line-count limit) and a footer (release/status badge).

**Why this priority**: Cards make the map scannable; titles are the main content the user reads.

**Independent Test**: Create stories with and without the `Story` attribute, open the board, and verify that each card shows the correct title (per the cascade) and a badge in the footer.

**Acceptance Scenarios**:

1. **Given** a story with the `Story` attribute in its header, **When** the card renders, **Then** the card title is the `Story` value.
2. **Given** a story without `Story` but with a `title` attribute or a first alias, **When** the card renders, **Then** the title is taken from that value.
3. **Given** a story with none of the above values, **When** the card renders, **Then** the title is the note's file name.
4. **Given** a story with a long title, **When** the card renders, **Then** the title is limited to a small number of lines.
5. **Given** a story with a Release value, **When** the card renders, **Then** the badge in the footer shows the Release value.
6. **Given** a story card on the map, **When** the user clicks the card, **Then** the linked story note opens in the standard view.

---

### User Story 4 - Navigating the map in 2D (Priority: P2)

The user can scroll a large map horizontally and vertically, with headers that remain visible while scrolling.

**Why this priority**: Real maps are large; navigation is required for usability.

**Independent Test**: Create a board with many activities and releases, open it, scroll in both directions, and verify that the headers remain visible.

**Acceptance Scenarios**:

1. **Given** a map wider than the viewport, **When** the user scrolls horizontally, **Then** all columns are reachable and the column headers remain visible.
2. **Given** a map taller than the viewport, **When** the user scrolls vertically, **Then** all rows are reachable and the row headers remain visible.

---

### User Story 5 - Handling incomplete story data (Priority: P2)

Stories missing one or more attributes do not break the map; they are grouped in "Unassigned" sections.

**Why this priority**: Real data is incomplete; resilience is a constitution requirement (defensive grouping).

**Independent Test**: Create stories missing Activity, Task, Epic, or Release, open the board, and verify that they appear in "Unassigned" sections without errors.

**Acceptance Scenarios**:

1. **Given** a story without Release, **When** the map renders, **Then** the story appears in the "Unassigned" release section (rendered as the first section at the top of the board) and no error is displayed.
2. **Given** a story without Activity, **When** the map renders, **Then** the story appears in the "Unassigned" column group.
3. **Given** a story with several missing attributes, **When** the map renders, **Then** the story is placed in the appropriate "Unassigned" sections for each missing level.

---

### User Story 6 - Editing exclusively in Markdown (map is read-only) (Priority: P3)

The map is read-only; all editing happens in Obsidian's standard Markdown view (the same editor the user uses for any other note). The map automatically mirrors changes.

**Why this priority**: It guarantees data integrity (constitution: non-destructive operations, no risk of corrupting the source). Editing in the visual view is out of scope for the MVP.

**Independent Test**: Edit a story note's header (frontmatter) or the list of links in the board, and verify that the map updates automatically, without touching the map.

**Acceptance Scenarios**:

1. **Given** a board opened in the map view, **When** the user edits a story note's attributes in Obsidian's standard Markdown view, **Then** the map updates, mirroring the change (after a short delay).
2. **Given** a board opened in the map view, **When** the user adds a new link to a story in `board.md`, **Then** the new story appears on the map.
3. **Given** a board opened in the map view, **When** the user tries to edit a card directly on the map, **Then** editing is not available (the map is read-only).

---

### Iteration 2: Visual Layer Refactor (to be implemented)

> **Scope**: This iteration refactors the visual layer of the board (renderer + styles) without changing the domain model, file format, or story ordering. The authoritative source of decisions is `refactor-concept.md` (section 9: resolved decisions). The domain model (`GridModel`, `buildGridModel`) and the cell key format (`activity::task::epic::release`) are unchanged. The existing FR-011 (Unassigned), FR-014 (sticky 2D navigation), FR-016 (security), and FR-019 (card click opens note) MUST continue to pass.

#### User Story 7 - Mobile-friendly board layout (Priority: P1)

The user opens the board on a phone (portrait orientation, ~375 px wide). The release header is a thin horizontal row (~24 px) instead of a wide sticky column (96 px), freeing the full screen width for story columns. The column header block (Activity/Task/Epic) remains sticky at the top.

**Why this priority**: This is the main motivation for the refactor — on mobile devices, the previous sticky release column consumed a large portion of the screen, leaving little space for the actual story columns.

**Independent Test**: Open the board on a mobile device (or a narrow browser window, ~375 px), verify that the release header is a horizontal row and that the full width is available for story columns.

**Acceptance Scenarios**:

1. **Given** a board with multiple releases, **When** the user opens it on a mobile device (portrait, ~375 px), **Then** the release header is rendered as a horizontal row (section header) and the full screen width is available for story columns.
2. **Given** a board with multiple releases, **When** the user scrolls vertically, **Then** the column header block (Activity/Task/Epic) remains sticky at the top, and the release section headers scroll with their content.
3. **Given** a board with multiple releases, **When** the user scrolls horizontally, **Then** all columns are reachable and the column header block remains visible.

---

#### User Story 8 - Release sections with aligned columns (Priority: P1)

The user sees the board as vertically stacked release sections. Each section has a header (chevron + release name + top divider) and a grid of Epic columns with story cards. Columns in the header block and in all release sections are perfectly aligned (same fixed width), so the user can trace a column from the header to the cards.

**Why this priority**: The section-based layout is the core visual change; column alignment is essential for readability.

**Independent Test**: Open a board with multiple releases and multiple Epic columns, verify that each release is a self-contained section and that columns are aligned across the header and all sections.

**Acceptance Scenarios**:

1. **Given** a board with multiple releases, **When** the map renders, **Then** each release is rendered as a self-contained section with a header (chevron + release name + top divider) and a body containing a grid of Epic columns.
2. **Given** a board with multiple Epic columns, **When** the map renders, **Then** columns in the header block and in all release sections are perfectly aligned (same x-position and same width).
3. **Given** a release row with no stories (defensive case — with the current domain model, release rows are derived from story attributes, so this is reachable only via a synthetic model), **When** the map renders, **Then** the release section renders with an empty grid (no story cards) without an error.
4. **Given** a board with stories that have no Release attribute, **When** the map renders, **Then** the "Unassigned" release section is rendered as the first section (at the top of the board) with a header and a grid of Epic columns.

---

#### User Story 9 - Visual design matching the Figma reference (Priority: P2)

The board's visual appearance matches the Figma design: header cells are cards with name + badge, release sections have a top divider, story cards have the correct styling. The board works in both light and dark themes.

**Why this priority**: Visual consistency with the design reference is important for user trust, but it does not block the core layout.

**Independent Test**: Open the board in both light and dark themes, compare the visual appearance with the Figma design (node 76:421), and verify that colors, spacing, and typography match.

**Acceptance Scenarios**:

1. **Given** the board in light theme, **When** the map renders, **Then** the visual appearance matches the Figma design (header cells, release sections, story cards, dividers).
2. **Given** the board in dark theme, **When** the map renders, **Then** the visual appearance matches the Figma design and all text is readable (sufficient contrast).
3. **Given** a story card with a long title, **When** the card renders, **Then** the title is clamped to a small number of lines within the fixed column width.

---

#### User Story 10 - Structure prepared for future features (Priority: P3)

The DOM structure includes reserved elements for future features (collapse/expand, drag-and-drop handles, add/remove buttons, keyboard navigation) that are structurally present but inactive. The release toggle button (chevron) is visible (per the Figma design) but non-interactive; drag-and-drop handles and add/remove buttons are invisible. This iteration does not implement any of these features.

**Why this priority**: The structural preparation is important for future iterations but does not deliver direct user value in this iteration.

**Independent Test**: Inspect the DOM structure of the rendered board and verify that the reserved elements (release toggle button, DnD handles, add/remove buttons) are present but inactive/invisible.

**Acceptance Scenarios**:

1. **Given** a rendered board, **When** the DOM is inspected, **Then** each release section contains a toggle button (chevron) that is structurally present but does not trigger any action.
2. **Given** a rendered board, **When** the DOM is inspected, **Then** story cards and header cells contain reserved DnD handle elements that are invisible and non-interactive.
3. **Given** a rendered board, **When** the user interacts with the board, **Then** no future-feature behavior (collapse, drag-and-drop, add/remove) is triggered.

---

### Testing Strategy

Tests are a first-class part of this feature: they are the baseline that defines whether the goals in the Success Criteria are achieved. Every user story above is independently testable, and its acceptance scenarios are the source of the test cases.

**Test levels** (from most to least automated):

1. **Automated unit tests** — the pure logic of the feature, without the user interface:
   - Board file parsing: flag detection, configuration reading (including the view-type attribute), link extraction, ignoring non-link lines, duplicate links, broken links (FR-001, FR-003, FR-006, FR-018, FR-021, FR-026).
   - Story attribute reading: field-name synonyms (Polish/English, case-insensitive), plain-text vs. link values, the title cascade, missing header (FR-004, FR-009, FR-012).
   - Grid model building: column hierarchy in order of first appearance, row order (default and alphabetical), "Unassigned" grouping, case-insensitive value grouping (FR-005, FR-006, FR-011).
   - Content safety: note-derived strings containing markup or script fragments are neutralized and never executed (FR-016).
2. **Automated integration tests** — the data pipeline end to end (board file + story files → grid model), verifying that the model matches the expected structure for a given set of notes (SC-002, SC-003).
3. **Manual acceptance tests** — the user-facing behavior that requires the real application environment, executed against the scenarios in `quickstart.md`: opening the map, switching views via the native view picker (verifying the three options are shown at a glance), 2D navigation, live updates, mobile behavior (FR-001, FR-002, FR-013, FR-014, FR-019, FR-026, FR-027; SC-004, SC-005, SC-006).
4. **Performance tests** — automated measurement of rendering smoothness (model build time, DOM render time in jsdom, number of rendered stories) on a board of a defined size; the debug/dev mode fps metrics are verified manually on a real device (quickstart Q7); the results establish the performance thresholds referenced in SC-001 (FR-020, FR-024).

**Test data**: a dedicated set of fixture notes (a board note and story notes) covering all attribute combinations, missing attributes, duplicates, broken links, and mixed Polish/English field names. The fixtures are versioned with the project so that every test run is reproducible.

**Definition of done for a user story**: a story is complete only when its acceptance scenarios pass — the automated tests for its logic and the relevant manual scenarios for its user-facing behavior.

---

### Edge Cases

- What happens when a board note contains a wiki link to a non-existent note (a broken link)? → The link is shown as unrecognized (a placeholder); the map does not hang.
- How does the system handle a story whose header field is a wiki link (e.g., `Epic: "[[Logowanie]]"`)? → The header is clickable and opens the linked note; if it is plain text, it acts only as a visual label.
- What happens when the same Activity/Task/Epic/Release value appears with different letter casing or with a Polish/English field name? → Case-insensitive matching normalizes them so they are grouped together.
- What happens when a board note has the flag but an empty list of links? → The map renders an empty grid (no stories) without an error.
- What happens when the board file contains headers, plain text, or comments between links? → Those lines are ignored; the map is built exclusively from wiki links to stories.
- What happens when the same story is linked multiple times (a duplicated link) in the board file? → Each occurrence of the link renders a separate story card in order of appearance.
- What happens when a story note has no header (frontmatter) at all? → All attributes are treated as missing; the story is grouped in the "Unassigned" sections.
- How does the system handle a very large number of stories? → There is no hard scale limit; the map must remain usable even on weaker mobile devices (tablet/phone). Smoothness can be measured using the debug/dev mode metrics (e.g., fps, number of displayed stories).
- What happens when the board file contains an unknown configuration attribute? → Unknown attributes are ignored; the map renders with default values.
- What happens when a board note is opened in Obsidian's standard Markdown view (e.g., via the file explorer, a link, or after switching from the map)? → The note is displayed and edited like any other note; the user can switch to the visual map view via Obsidian's native view picker, and the map reflects the note's current content.
- What happens when the board file's `usm-view` attribute is missing or has an unrecognized value (i.e., a value that is not one of `map`, `edit`, or `preview`)? → The system treats it as absent and opens the board note in the visual map view (the default).
- What happens when the same board note is open in multiple panes and the user switches the view in one of them? → The switch writes the `usm-view` attribute (last switch wins) and affects only future opens; the other already-open panes keep showing their current view until reopened.

**Iteration 2 edge cases:**

- What happens when a release has no stories? → The release section renders with an empty grid (no story cards) without an error. Note: with the current domain model, release rows are derived from story attributes, so a release row always has at least one story; this is a defensive guarantee of the renderer (testable with a synthetic GridModel). Release mechanics (releases as note files, declared/empty releases) are deferred to a later iteration.
- What happens when there is only one release? → The board renders a single section with the release header and its grid.
- What happens when the board is very wide (many Epic columns)? → Horizontal scrolling works; the column header block remains sticky at the top.
- What happens when the board is very tall (many releases)? → Vertical scrolling works; the column header block remains sticky at the top.
- What happens when a story card title is longer than the fixed column width? → The title is clamped to a small number of lines within the column width.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST detect the `usm-board: true` flag in a note's header and, when the note is opened, display it in the view type recorded in the board file's `usm-view` attribute (defaulting to the visual map view when the attribute is absent).
- **FR-002**: The system MUST allow the user to switch between the visual map view, the standard Markdown editor, and the standard Markdown preview for a flagged note without modifying the note's content. The plugin MAY provide a dedicated pane-header view-switch button (a distinct icon, not the "…" context-menu button) for this switching; the plugin MUST NOT provide a command-palette command for this switching. (Amended 2026-10-23: the original "exclusively via the native view picker" wording is superseded because the native picker is not reliably present for this view in the target Obsidian build; a dedicated button is now permitted.)
- **FR-003**: The system MUST read the list of story links from the board note and resolve each link to its target note; all lines that are not wiki links (headers, plain text, comments) are ignored.
- **FR-004**: The system MUST read each story note's attributes (Activity, Task, Epic, Release) from its header (frontmatter).
- **FR-005**: The system MUST dynamically build the horizontal column hierarchy (Activity → Task → Epic) in memory based on the story attributes, in order of first appearance in the board note.
- **FR-006**: The system MUST build the vertical rows based on the Release attribute; the row order is determined by a configuration attribute in the board file's header (default: order of first appearance, optionally: alphabetical sorting).
- **FR-007**: The system MUST accept both plain text and wiki links as header field values; a wiki-link value makes the header clickable (opens the linked note), while plain text is rendered as a visual label.
- **FR-008**: The system MUST render each story as a card with a header section (title) and a footer section (space for the badge).
- **FR-009**: The system MUST determine the card title via the cascade: `Story` attribute → `title` attribute / first alias → note file name, and limit the title to a small number of lines.
- **FR-010**: The system MUST display the Release value in the badge in the card footer (in the MVP the badge shows only the Release value; a separate "status" attribute is out of scope for the MVP).
- **FR-011**: The system MUST group stories missing any attribute into dedicated "Unassigned" sections, without reporting an error or interrupting rendering.
- **FR-012**: The system MUST use case-insensitive field matching that recognizes Polish and English field names (e.g., activity/aktywność, task/zadanie, epic/epik, release/wydanie/row).
- **FR-013**: The system MUST automatically update the map in response to changes in the board note or linked story notes, without requiring a manual reload; a burst of changes MUST trigger at most one re-render (debounced), and the update MUST complete within 2 seconds of the last edit (SC-005).
- **FR-014**: The system MUST enable 2D navigation (horizontal and vertical scrolling) with column and row headers remaining visible while scrolling.
- **FR-015**: The system MUST keep the visual map read-only; all content editing happens in Obsidian's standard Markdown view.
- **FR-016**: The system MUST render all note-derived content safely, so that no markup or script embedded in a note can be executed in the interface.
- **FR-017**: The system MUST ensure that after the plugin is disabled, the board note remains a readable, bulleted list of links in standard Markdown.
- **FR-018**: The system MUST display a story card for each occurrence of a link to it in the board note; repeated (duplicated) links are rendered as separate cards in order of appearance.
- **FR-019**: The system MUST open the linked story note in the standard view after a story card on the map is clicked (MVP behavior).
- **FR-020**: The system MUST provide a debug/dev mode that displays map rendering smoothness metrics (e.g., fps, number of displayed stories), to enable performance measurement and optimization.
- **FR-021**: The system MUST store board configuration (e.g., row order, the last-selected view type) as attributes in the board file's header, so that the board file is self-describing and portable — the configuration survives synchronization and copying and remains readable even without the plugin installed (e.g., for AI agents reading the notes).
- **FR-022**: The system MUST provide automated tests for the feature's core logic (board file parsing, story attribute reading, grid model building, and content safety), so that regressions in the data pipeline are detected without manual verification.
- **FR-023**: The system MUST provide a set of test fixtures (a board note and story notes covering complete, incomplete, duplicated, and broken data, as well as Polish and English field names) that is versioned with the project, so that every test run is reproducible.
- **FR-024**: The system MUST provide automated performance tests that measure rendering smoothness (e.g., frame rate, render time, number of rendered stories) on a board of a defined size, so that the performance thresholds in SC-001 can be established and verified.
- **FR-025**: The system MUST NOT provide its own text display of the board note; the text display and editing of the board note MUST be provided by Obsidian's standard Markdown view. The plugin's custom view is exclusively the visual map, so the plugin does not duplicate Obsidian's native note-viewing functionality.
- **FR-026**: The system MUST store the last-selected view type as the `usm-view` attribute in the board file's frontmatter, with values `map` (visual map), `edit` (standard Markdown editor), or `preview` (standard Markdown preview), writing it when the user switches views, so that the board note reopens in the same view type on subsequent opens; when the attribute is absent or has an unrecognized value, the system MUST default to the visual map view.
- **FR-027**: For a flagged note, the system MUST present exactly three view options — the visual map ("USM board"), the standard Markdown editor ("Edit MD"), and the standard Markdown preview ("View MD") — in a form that shows all three options at a glance (a dropdown list or a three-position toggle), so the user can see the available views without trial and error. The options are offered through a dedicated pane-header view-switch button (a distinct icon, not the "…" context-menu button) that is available in all three view states (the map view and the standard Markdown editor/preview); the "…" button remains the native context menu. The tab and breadcrumbs show the note's file name (not a constant view label) so the tab stays consistent with the file list. (Amended 2026-10-23: the options moved from the "…" pane menu to a dedicated view-switch button so the button is reachable in all three view states and "…" is reserved for the context menu.)
- **FR-028**: The system MUST store all board-level state — board configuration (e.g., row order, the last-selected view type) and, in later iterations, the visual-layer effects of user actions — in the board file (its frontmatter and body), and MUST store only the plugin's own internal settings (e.g., keyboard shortcuts, debug-mode toggle) in the plugin's configuration files; board and story data MUST NOT be stored in the plugin's configuration files, so that the board and its stories remain fully reproducible and understandable from the Markdown files alone, even without the plugin installed.

#### Iteration 2: Visual Layer Refactor

- **FR-029**: The system MUST render the release header as a horizontal row (section header) with a chevron and the release name, instead of a sticky left column, so that the full screen width is available for story columns.
- **FR-030**: The system MUST render the column header block (Activity/Task/Epic) as a sticky top block with three horizontal rows, where each header cell spans the columns of its children (Activity spans its Tasks, Task spans its Epics).
- **FR-031**: The system MUST render each release as a self-contained section with a header (chevron + release name + top divider) and a body containing a grid of Epic columns with story cards. The "Unassigned" release section (stories without a Release attribute) is rendered as the first section (at the top of the board).
- **FR-032**: The system MUST use a fixed column width for all grids (the column header block and all release section grids) so that columns are perfectly aligned across all grids.
- **FR-033**: The system MUST render the board in both light and dark themes using Obsidian CSS variables, without hard-coded color values.
- **FR-034**: The system MUST include reserved DOM elements for future features (release toggle button, drag-and-drop handles, add/remove buttons) that are structurally present but inactive in this iteration. The release toggle button (chevron) is visible (per the Figma design) but non-interactive; drag-and-drop handles and add/remove buttons are invisible.

### Key Entities

- **Board Note**: A Markdown note with the `usm-board: true` flag, containing an ordered list of wiki links to story notes and board configuration attributes (e.g., `usm-release-order` for row order, `usm-view` for the last-selected view type). It defines which stories are on the map, in what order, how to interpret them, and which view to open in; the file is self-describing and portable.
- **Story Note**: A Markdown note representing a single user story, with attributes in its header (Activity, Task, Epic, Release, optionally Story/title) and body content (description/acceptance criteria).
- **Story Card**: The visual representation of a story note on the map, with a header (title) and a footer (badge).
- **Column Hierarchy (Activity → Task → Epic)**: The horizontal grouping structure built dynamically from the story attributes.
- **Release Row**: A horizontal row of the map corresponding to a Release value.
- **"Unassigned" Section**: A placeholder column/row group collecting stories missing a given attribute.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The user can open a flagged board note and see the visual map; rendering smoothness is measurable (automated: model build time, DOM render time, story count on a defined board size; manual: fps via the debug/dev mode on a real device). The MVP establishes a recorded performance baseline with a regression guard (fail on >20% regression); absolute performance targets are set post-MVP from that baseline and real-device measurements.
- **SC-002**: 100% of stories with complete attributes appear in the correct grid cell (the correct Activity/Task/Epic column and Release row) on the first render.
- **SC-003**: 100% of stories with one or more missing attributes are placed in the appropriate "Unassigned" section without an error or hang.
- **SC-004**: The user can switch between the visual map view, the standard Markdown editor, and the standard Markdown preview (via the native view picker, which shows all three options at a glance) and back without any change to the note's content (verified by content comparison), and the board note reopens in the last-selected view type.
- **SC-005**: After editing a story note or the board note, the map mirrors the change within 2 seconds (after a delay) without a manual reload.
- **SC-006**: The user can scroll the map by at least 10 columns and 5 rows in both directions, with the headers remaining visible.
- **SC-007**: Note content never leaves the local machine (100% local operation, no data sent externally).
- **SC-008**: 90% of users correctly identify the Activity and Release of a given story by reading the map, without opening the underlying note.
- **SC-009**: 100% of the functional requirements (FR-001–FR-028) are covered by at least one test (automated or manual), and every user story's acceptance scenarios pass before the story is considered complete.
- **SC-010**: The automated test suite for the core logic (parsing, attribute reading, grid model, content safety) runs to completion in under 2 minutes and passes on a clean environment without manual intervention.

#### Iteration 2: Visual Layer Refactor

- **SC-011**: On a mobile device (portrait, ~375 px), the release header occupies ≤ 32 px of vertical space, freeing at least 96 px of horizontal space for story columns compared to the previous sticky column layout.
- **SC-012**: Columns in the header block and in all release sections are perfectly aligned (same x-position) across the entire board, verified by automated structural tests (identical `--usm-grid-cols` template across all grids) and manual visual inspection (pixel-level alignment in a real browser).
- **SC-013**: The board renders correctly in both light and dark themes without visual artifacts, with sufficient text contrast in both themes.
- **SC-014**: No performance regression >20% compared to the MVP baseline (SC-001) — measured by the automated performance tests on the same board size.
- **SC-015**: All existing functional requirements (FR-011, FR-014, FR-016, FR-019) continue to pass after the refactor, verified by the existing test suite.

## Assumptions

- The target users are Obsidian users who already organize their work in Markdown notes and wiki links; no new data-entry interface is required in the MVP.
- The board note and the story notes are in the same vault; cross-vault references are out of scope.
- The visual map in the MVP is read-only; drag-and-drop, inline editing, and creating notes from the map are out of scope for this milestone.
- In later iterations, clicking a card in graphical mode will open a dialog/popup with a graphical representation of the note's content without leaving board mode; in the MVP, clicking a card opens the note in the standard view.
- Performance is a priority, but in the MVP code cleanliness, universality, and the generality of the architecture that ensure healthy development are equally important; hard performance thresholds will be established later based on the debug/dev mode metrics and the automated performance tests (FR-024).
- A reasonable default value for the title line-count limit is a small, fixed number (e.g., 2–3 lines); the exact value is an interface detail.
- Board configuration (e.g., Release row order) is stored as attributes in the board file's header; the default order is the order of first appearance, optionally alphabetical sorting. This way the configuration survives synchronization and copying and remains readable even without the plugin installed (e.g., for AI agents reading the notes).
- The plugin supports both Desktop and Mobile; no Node.js/Electron APIs are used.
- Field name matching is based by default on a built-in Polish/English synonym dictionary; the user does not need to configure it in the MVP.
- The map interface labels (section headers, the "Unassigned" label, command and icon texts) are in the MVP exclusively in English and stored in a single "en" dictionary; the dictionary mechanism is the foundation for future multilingual support — additional dictionary versions will be developed in later iterations.
- Tests are part of the MVP scope, not a later iteration: automated unit and integration tests cover the core logic, reproducible fixtures make every run deterministic, and automated performance tests establish the performance thresholds; manual acceptance testing via the quickstart scenarios covers the user-facing behavior that requires the real application environment.
- SC-008 (90% of users correctly identify the Activity and Release of a given story by reading the map) is a post-launch usability metric: it will be validated via user testing after release and does not gate the MVP build.
- The plugin does not provide its own text display of the board note: text display and editing use Obsidian's standard Markdown view (the same view any other note gets). The plugin's custom view is exclusively the visual map. This follows the constitution's requirement to reuse Obsidian's built-in solutions rather than reimplementing them; the previously implemented plugin-side "text preview" mode (the note's source rendered as inert text inside the plugin's view) is superseded by this decision.
- The board note opens in the last-selected view type, stored as an attribute in the board file's header (defaulting to the visual map view on first open). The view type is changed only via Obsidian's native view picker (the pane header "change view" button); the plugin does not provide its own pane header icon or command palette command for switching. This makes the view type a portable, self-describing board configuration and keeps the switching mechanism native to Obsidian.
- For a board note, the view picker offers exactly three views — the visual map ("USM board"), the standard Markdown editor ("Edit MD"), and the standard Markdown preview ("View MD") — presented so that all three are visible at a glance (a dropdown list or a three-position toggle). This lets the user see the available views immediately, without trial and error, and reinforces that the visual map is a native part of Obsidian's view system.
- The board file is writable by the plugin for board-level state: the plugin MAY write board configuration attributes (e.g., the last-selected view type) to the board file's frontmatter, and in later iterations the visual-layer effects of user actions to the board file's body. Only the plugin's own internal settings (not board or story data) are stored in the plugin's configuration files. This makes the board and its stories a self-contained, AI-agent-readable record of the project that can be understood from the Markdown files alone.

**Iteration 2 assumptions:**

- The domain model (`GridModel`, `buildGridModel`) and the cell key format (`activity::task::epic::release`) are unchanged; the refactor affects only the visual layer (renderer + styles).
- The column width is fixed (~240 px desktop, ~160 px mobile) — a design decision, not a user-configurable setting.
- The release header is not sticky (it scrolls with the section content); only the column header block is sticky at the top.
- The chevron in the release header is a visual element only (no collapse/expand functionality in this iteration).
- The reserved DOM elements for future features are structurally present but do not affect the behavior in this iteration. The release toggle button (chevron) is visible (per the Figma design) but non-interactive; drag-and-drop handles and add/remove buttons are invisible.
- The story ordering within a release remains the order of appearance in the board file (no change).
- The badge in the card footer remains the Release value (no change in this iteration).
- The "Unassigned" release section (stories without a Release attribute) is rendered as the first section (at the top of the board); the "Unassigned" groups at the Activity/Task/Epic levels remain "Unassigned" column groups in the header block.
- Release mechanics are deferred: a release is conceptually a note file (linked or named), and declared/empty releases are a later iteration. In this iteration, releases are derived from story attributes (unchanged domain model); the renderer is defensive against empty release rows (renders an empty grid without error).
