# Manual Validation Checklist — Manual Test & Preview Workflow (E2E Infrastructure Integration)

**Feature**: `002-e2e-test-env` (consolidated with `003-manual-test-workflow`) | **Tasks**: T003-004, T003-007, T003-009, T003-011, T003-014

## Setup (once)

- [x] `npm install`
- [x] `npm run e2e:setup` (plugin built + installed into the test vault, SHA-256 verified)
- [x] `npm run e2e:launch` (debuggable instance on the test vault, CDP ready on port 9222)

## Scenarios

- [x] **M1** — The board header block reads cleanly at 1440 px _(mode: subjective)_
      Evidence: `M1-header-aesthetics.png` (committed)
      Observation: user judgment — pass (header block reads cleanly).
- [x] **M2** — A non-automatable operation (true touch gesture) falls back to the user _(mode: live interaction)_
      Evidence: `e2e/output/m2-live-interaction.png` (automated, gitignored)
      Observation: pass — the agent could not simulate a true touch gesture via the CDP `eval` channel, so it fell back to the manual-assist protocol and asked the user to perform it in the live instance; the user performed a pinch-zoom and reported the result. Finding: Obsidian does not respond to pinch-zoom (two-finger scroll works), so pinch-zoom is not a usable preview gesture here — recorded as an Obsidian limitation, not a scenario failure.
- [x] **M3** — The extended board renders its documented baseline and coexists with `Board.md` _(mode: automatable)_
      Evidence: `e2e/output/t011-test-board-2.png` (automated, gitignored)
      Observation: pass — `boards/Test Board 2.md` renders 4 release sections / 9 cards / 6 task columns / 4 activity columns with the long epic title clamped within the fixed column width; `Board.md` renders its `002` baseline (3 sections / 8 cards / 4 task columns) independently in a separate leaf, with no cross-board interference. Note: the `obsidian://open?path=…` URI is intermittently rejected by Obsidian's vault resolver ("Vault not found"); the reliable open-note path is the API call `app.workspace.getLeaf(true).openFile(app.vault.getAbstractFileByPath('<path>'))`.

## Result

- [x] All scenarios pass → mark the driving tasks `[X]` in `tasks.md`.
- [ ] Any failure → record it here, fix, and re-run the affected scenario.
