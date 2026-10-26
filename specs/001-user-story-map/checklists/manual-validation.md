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

## Result

- [x] All Q1–Q10 scenarios pass → mark **T025** `[X]` in `tasks.md`.
- [x] All Q11–Q14 scenarios pass → mark **T007** and **T008** `[X]` in
      `tasks.md`.
- [ ] Any failure → record it here, fix, and re-run the affected scenario.
