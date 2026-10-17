# Manual Validation Checklist — Quickstart Q1–Q10

**Feature**: `001-user-story-map` | **Task**: T025

This checklist drives T025. The automated suite (unit + integration +
performance) already passes in Node.js; the scenarios below require a **real
Obsidian instance** (Desktop, and Q10 on at least one mobile device) because
they exercise the live view, the toggle, sticky scrolling, and mobile
behavior that the Node harness cannot cover.

## Setup (once)

- [ ] `npm install && npm run build`
- [ ] Copy `main.js`, `manifest.json`, `styles.css` into
      `<Vault>/.obsidian/plugins/obsidian-usm-plugin/`
- [ ] Obsidian: **Settings → Community plugins** → enable **User Story Map**
- [ ] Create the test fixture from `quickstart.md` (board.md + S1–S3, plus the
      extended fixture for Q4)

## Automated (already verified — re-run to confirm)

- [ ] `npm test` → all unit + integration + performance tests pass, under 2 min

## Desktop scenarios

- [ ] **Q1** — Board renders as a map; toggle to Markdown and back leaves the
      file byte-identical; a non-board note opens as plain Markdown.
- [ ] **Q2** — 2D grid grouping/ordering is correct (duplicate `S1` appears
      twice, `S2` in Unassigned, `S3` absent, broken link dimmed); changing
      `usm-release-order` to `alphabetical` re-sorts rows within ~2 s.
- [ ] **Q3** — Card titles follow the cascade (story → title → file name);
      Release badge shows; clicking a card opens the note.
- [ ] **Q4** — With ≥ 10 columns and ≥ 5 releases, both axes scroll and the
      column/row headers stay sticky.
- [ ] **Q5** — A story with no frontmatter lands in Unassigned at every level;
      no error, no crash, no intrusive notification.
- [ ] **Q6** — Editing a story's `release` moves its card within 2 s; adding a
      wikilink to the board adds a card; the map offers no editing
      affordances (read-only).
- [ ] **Q7** — Debug mode shows the metrics panel (fps / stories / render ms);
      disabling it removes the panel with no residual overhead.
- [ ] **Q8** — A story whose `story` attribute contains
      `<img src=x onerror=alert(1)>` renders as inert text; nothing executes.
- [ ] **Q9** — Disabling the plugin leaves `board.md` as a readable bulleted
      list; copying the vault to a fresh install reproduces the identical map.

## Mobile (Q10)

- [ ] **Q10** — On a phone/tablet the map renders, scrolls both axes with
      sticky headers, cards are tappable, and debug metrics are available. No
      desktop-only behavior.

## Result

- [ ] All scenarios pass → mark **T025** `[X]` in `tasks.md`.
- [ ] Any failure → record it here, fix, and re-run the affected scenario.
