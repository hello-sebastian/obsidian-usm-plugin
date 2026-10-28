# Manual Validation Checklist — Quickstart Q1–Q14

**Feature**: `001-user-story-map` | **Tasks**: T025 (Q1–Q10), T007/T008 (Q11–Q14)

This checklist drives T025 (MVP) and T007/T008 (Iteration 2). The automated
suite (unit + integration + performance) already passes in Node.js; the
scenarios below require a **real Obsidian instance** (Desktop, and Q10/Q14 on
at least one mobile device) because they exercise the live view, the toggle,
sticky scrolling, and mobile behavior that the Node harness cannot cover.

## Setup (once)

- [X] `npm install && npm run build`
- [X] Copy `main.js`, `manifest.json`, `styles.css` into
      `<Vault>/.obsidian/plugins/obsidian-usm-plugin/`
- [X] Obsidian: **Settings → Community plugins** → enable **User Story Map**
- [X] Create the test fixture from `quickstart.md` (board.md + S1–S3, plus the
      extended fixture for Q4)

## Automated (already verified — re-run to confirm)

- [X] `npm test` → all unit + integration + performance tests pass, under 2 min

## Desktop scenarios

- [X] **Q1** — Board renders as a map; toggle to Markdown and back leaves the
      file byte-identical; a non-board note opens as plain Markdown.
- [X] **Q2** — 2D grid grouping/ordering is correct (duplicate `S1` appears
      twice, `S2` in Unassigned, `S3` absent, `S4` broken link dimmed); changing
      `usm-release-order` to `alphabetical` re-sorts rows within ~2 s.
- [X] **Q3** — Card titles follow the cascade (story → title → file name);
      Release badge shows; clicking a card opens the note.
- [X] **Q4** — With ≥ 10 columns and ≥ 5 releases, both axes scroll and the
      column/row headers stay sticky.
- [X] **Q5** — A story with no frontmatter lands in Unassigned at every level;
      no error, no crash, no intrusive notification.
- [X] **Q6** — Editing a story's `release` moves its card within 2 s; adding a
      wikilink to the board adds a card; the map offers no editing
      affordances (read-only).
- [x] **Q7** — Debug mode shows the metrics panel (fps / stories / render ms);
      disabling it removes the panel with no residual overhead.
- [x] **Q8** — A story whose `story` attribute contains
      `<img src=x onerror=alert(1)>` renders as inert text; nothing executes.
- [x] **Q9** — Disabling the plugin leaves `board.md` as a readable bulleted
      list; copying the vault to a fresh install reproduces the identical map.

## Mobile (Q10)

- [x] **Q10** — On a phone/tablet the map renders, scrolls both axes with
      sticky headers, cards are tappable, and debug metrics are available. No
      desktop-only behavior.

## Iteration 2 — section-based layout (Q11–Q14)

Fixture: `projects/Story Map Builder/Test Board 2/` (Board.md + S1–S8, incl.
the long epic title in S6 for the Q13 clamp check). Deploy with
`npm run deploy` before running these scenarios.

- [x] **Q11** — The sticky column-header block (Activity / Task / Epic rows)
      stays pinned at the top while scrolling; release headers are NOT sticky
      (they scroll away); horizontal scrolling keeps the header block visible
      and aligned with the columns. (T007, FR-029/FR-030)
- [x] **Q12** — The Unassigned section renders first, at the top of the board,
      before any release section. (T008, FR-031)
- [x] **Q13** — Columns are perfectly aligned across the header block and
      every release section (identical fixed column width); long titles (e.g.
      the S6 epic) clamp within the fixed column width. (T008, FR-032, SC-012)
- [x] **Q14** — On a mobile device (~375 px portrait): the release header
      occupies ≤ 32 px of vertical space, columns get the full width, the map
      scrolls both axes, and there is no sticky left column. (T007, SC-011)

## Iteration 2 — test-vault e2e verification (Q11–Q15, 2026-10-28)

Re-verified in the committed `test-vault/` via the `002-e2e-test-env` tooling
(`npm run e2e:setup` / `e2e:launch` / `e2e:inspect`), per the 002 mandate that
manual/E2E verification runs against `test-vault/` (never the private vault).
Fixture: `test-vault/boards/Test Board 2.md` (4 release sections — Unassigned
first, then 1.0 MVP / 2.0 / 3.0 — 9 cards, 6 task columns, 4 activity columns,
long epic title). Standard `e2e:verify` sanity pass on `Board.md`:
`taskColumns: 4`, reactivity 307 ms, screenshot PASS.

- [x] **Q11** — Sticky column-header block (Activity/Task/Epic rows) pinned at
      the top; release headers are NOT sticky; horizontal scroll keeps the
      header block aligned with the columns. _(mode: automatable)_
      Evidence: `e2e/output/q11-q13-desktop.png` (automated, gitignored)
      Observation: `.usm-board-header` `position: sticky` (3 rows,
      `display: contents`, 4/6/6 cells); all 4 `.usm-release-header` are
      `position: static`.
- [x] **Q12** — The Unassigned section renders first, directly below the sticky
      header block, before any release section. _(mode: automatable)_
      Evidence: `e2e/output/q11-q13-desktop.png`
      Observation: `section.usm-release[0]` title = "Unassigned".
- [x] **Q13** — Columns are perfectly aligned across the header block and every
      release section (identical fixed width); the long epic title clamps within
      the fixed column width. _(mode: automatable)_
      Evidence: `e2e/output/q11-q13-desktop.png`
      Observation: all 4 grids `grid-template-columns: 240px × 6`; long epic
      cell 240 px with `overflow: hidden` + `text-overflow: ellipsis` + `nowrap`.
- [x] **Q14** — Mobile (~375 px portrait): release header ≤ 32 px, columns
      ~160 px, sticky header, both-axis scroll, no sticky left column.
      _(mode: automatable, mobile emulation)_
      Evidence: `e2e/output/q14-mobile.png`
      Observation: at a 375 px viewport — release header 32 px, `--usm-col-w`
      160 px, header block sticky, scroll container `overflow: auto` on both
      axes. Note: `emulateMobile(true)` alone sets Obsidian's mobile flag but
      does not resize the viewport, so the `@media (max-width: 768px)` CSS is
      exercised by the committed viewport override applied within the same
      connection as the capture/assertion
      (`e2e/inspect.mjs screenshot … --viewport 375x667 --mobile`, CDP
      `Emulation.setDeviceMetricsOverride`) — see the `usm-e2e` skill's mobile
      sequence (bug `emulate-mobile-viewport-gap`, fixed 2026-10-28).
- [x] **Q15 part 2** — Reserved DOM present and inert: every release header has
      a visible but inert chevron toggle; drag handles and add/remove slots are
      present but invisible; no interaction triggers collapse, drag-and-drop, or
      add/remove. _(mode: automatable)_
      Evidence: `e2e/output/` (ad-hoc inspection)
      Observation: 4 toggles (`aria-hidden="true"`, `tabindex="-1"`, no click
      handler, visible); 29 `.usm-dnd-handle` + 20 `.usm-add-remove-slot` all
      `display: none`; all 16 header cells each carry a handle + slot; clicking
      a toggle leaves the section `outerHTML` unchanged (no collapse, body
      stays visible, card count unchanged).
- [~] **Q15 part 1** — Light/dark theme switch (no reload): no hard-coded
      colors, no visual artifacts, sufficient text contrast in both themes, and
      visual parity with the Figma design (node 76:421). _(mode: subjective)_
      Evidence: `Q15-dark.png`, `Q15-light.png` (committed)
      Observation: pending user review — screenshots delivered; agent confirms
      no hard-coded colors (all `var(--…)`), text readable in both themes, and
      the accent adapts without a reload.

## Result (test-vault e2e)

- [x] Q11–Q14 + Q15 part 2 pass (automatable) → mark **T016** `[X]` in
      `tasks.md`.
- [ ] Q15 part 1 pending user review → **T011** and **T019** stay open until
      the user confirms the theme judgment.
- [ ] Any failure → record it here, fix, and re-run the affected scenario.

## Result

- [x] All Q1–Q10 scenarios pass → mark **T025** `[X]` in `tasks.md`.
- [x] All Q11–Q14 scenarios pass → mark **T007** and **T008** `[X]` in
      `tasks.md`.
- [ ] Any failure → record it here, fix, and re-run the affected scenario.
