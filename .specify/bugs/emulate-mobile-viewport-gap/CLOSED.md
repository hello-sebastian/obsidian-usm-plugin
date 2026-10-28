# CLOSED — emulate-mobile-viewport-gap

- **Closed**: 2026-10-28
- **Final result**: verified (see `test.md`)
- **Iterations**: 1 (assessment → fix → test)
- **Defects resolved**: 1

## Summary

The `emulate-mobile-viewport-gap` bug is **closed as verified**. The documented mobile-emulation sequence in the `usm-e2e` skill never applied the mobile layout because `app.emulateMobile(true)` only flips a flag/classes and does not resize the viewport, while the plugin's mobile CSS is viewport-based (`@media (max-width: 768px)`). The fix adds a `--viewport <WxH> [--mobile] [--scale N]` flag to `eval` and `screenshot` (the CDP device-metrics override is applied within the same connection as the action and cleared after) and corrects the documented sequence. Live verification confirmed the mobile layout now applies (`--usm-col-w: 160px`, release header 32 px, `innerWidth: 375`) and the desktop state restores cleanly. All automated checks are green (16/16 viewport tests, 180/180 full suite, lint 0 errors).

## Defect

| # | Defect | Fix |
|---|--------|-----|
| 1 | Documented mobile sequence left the desktop layout in effect — `emulateMobile(true)` does not resize the viewport, and the CDP device-metrics override is **session-scoped** (cleared when the setting connection closes), so a standalone connect→set→close `viewport` operation could not hold the override for a separate capture call | `--viewport` flag on `eval`/`screenshot` applies the override in the same connection as the action (set before, cleared after); corrected sequence = `emulateMobile(true)` → `location.reload()` → `wait ".usm-board"` → capture/assert under `--viewport 375x667 --mobile` → restore `emulateMobile(false)` + reload. Standalone `viewport`/`viewport reset` retained for diagnostics |

## Report trail

- `assessment.md` — original symptom, reproduction, and (invalidated) proposed standalone `viewport` mechanism.
- `fix.md` — Status `applied`; 10 files changed; documents the session-scoping finding and the deviations from the assessment.
- `test.md` — Result `verified`; post-fix reproduction exercised live, restore clean, 16/16 viewport tests, 180/180 full suite, lint 0 errors.

## Residual watch-items (non-blocking)

- The session-scoping behavior of `Emulation.setDeviceMetricsOverride` was verified on a single environment (Obsidian 1.14.5 / Chrome 150, macOS). It is a CDP/Chromium behavior and expected to be stable, but it has not been exercised on other Chromium versions or a real mobile device.
- The standalone `viewport` operation is now primarily diagnostic; its session-scoped limitation is documented. The `--viewport` flag is the supported path for capture/assert.
