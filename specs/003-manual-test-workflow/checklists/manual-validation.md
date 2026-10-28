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

## Result

- [ ] All scenarios pass → mark the driving tasks `[X]` in `tasks.md`.
- [ ] Any failure → record it here, fix, and re-run the affected scenario.
