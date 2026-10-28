# Manual Validation Checklist — Manual Test & Preview Workflow (E2E Infrastructure Integration)

**Feature**: `003-manual-test-workflow` | **Tasks**: T004, T007, T009, T011, T014

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

## Result

- [ ] All scenarios pass → mark the driving tasks `[X]` in `tasks.md`.
- [ ] Any failure → record it here, fix, and re-run the affected scenario.
