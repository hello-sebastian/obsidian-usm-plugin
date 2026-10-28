# Bug Verification: Mobile emulation sequence does not apply the mobile viewport

- **Slug**: emulate-mobile-viewport-gap
- **Tested**: 2026-10-28
- **Assessment**: ./assessment.md
- **Fix**: ./fix.md
- **Result**: verified

## Summary

The original symptom no longer reproduces: running the corrected documented sequence (with the `--viewport` flag) applies the mobile layout (`--usm-col-w: 160px`, release header 32 px, `innerWidth: 375`) instead of the desktop layout. The fix held, the new tests pass, and the full regression suite + lint are clean.

## Checks Performed

| Check | Command / Action | Result | Notes |
|-------|------------------|--------|-------|
| Reproduction (post-fix) | `emulateMobile(true)` → `location.reload()` → `wait ".usm-board"` → `screenshot … --viewport 375x667 --mobile` → `eval … --viewport 375x667 --mobile` (live, CDP 9222, `Test Board 2.md`) | pass | `{isMobile: true, innerWidth: 375, colW: "160px", releaseHeaderH: 32}` — mobile layout applied; symptom gone |
| Restore (post-fix) | `emulateMobile(false)` → `location.reload()` → `wait` → `eval` | pass | `{isMobile: false, innerWidth: 1635, colW: "240px"}` — desktop state restored, no leak |
| New / updated tests | `npx vitest run tests/unit/inspect-viewport.test.ts` | pass | 16/16 (9 standalone `viewport` + 7 `--viewport` flag on `eval`/`screenshot`) |
| Regression suite | `npx vitest run` | pass | 180/180 across 14 files |
| Lint / type-check | `npm run lint` | pass | 0 errors, 53 warnings (all pre-existing convention warnings) |

## Output Excerpts

Post-fix reproduction (live CDP eval under `--viewport 375x667 --mobile`):
```
{"isMobile":true,"innerWidth":375,"colW":"160px","releaseHeaderH":32}
```
Restore (live CDP eval, no override):
```
{"isMobile":false,"innerWidth":1635,"colW":"240px"}
```
Test suite:
```
Test Files  14 passed (14)
     Tests  180 passed (180)
```
Lint:
```
✖ 53 problems (0 errors, 53 warnings)
```

## Residual Risks

- The session-scoping behavior of `Emulation.setDeviceMetricsOverride` was verified on a single environment (Obsidian 1.14.5 / Chrome 150, macOS). It is a CDP/Chromium behavior and is expected to be stable, but it has not been exercised on other Chromium versions or on a real mobile device.
- The standalone `viewport` operation is now primarily diagnostic; its session-scoped limitation is documented, but a user who relies on it for a separate capture call will still see the desktop layout (by design — the `--viewport` flag is the supported path).
- The `--viewport` override is applied and cleared within a single connection; if the action throws, the `finally` block clears it best-effort, but a hard process crash between set and clear could in theory leave the override on the (now-closed) connection — which, per the session-scoping finding, is cleared on connection close anyway.

## Recommendation

Close the bug — verified end-to-end. The post-fix reproduction was actually exercised against a live Obsidian instance (not just tests), the original symptom (desktop layout after the documented sequence) no longer reproduces, the desktop state restores cleanly, and the full regression suite and lint are green.
