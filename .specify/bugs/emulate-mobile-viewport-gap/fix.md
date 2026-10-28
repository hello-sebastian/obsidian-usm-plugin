# Bug Fix: Mobile emulation sequence does not apply the mobile viewport

- **Slug**: emulate-mobile-viewport-gap
- **Fixed**: 2026-10-28
- **Assessment**: ./assessment.md
- **Status**: applied

## Summary

Extended the e2e tooling with a viewport-override capability and corrected the documented mobile-emulation sequence. Live verification revealed that the CDP device-metrics override is **session-scoped** (cleared when the setting connection closes), which invalidated the assessment's proposed standalone `viewport` operation as the primary mechanism. The fix adds a `--viewport` flag to `eval` and `screenshot` (override applied within the same connection as the action, cleared after) as the reliable mechanism, and retains the standalone `viewport` operation for diagnostics.

## Changes

| File | Change | Notes |
|------|--------|-------|
| `e2e/cdp.mjs` | modified | Added `setViewport(w, h, scale, mobile)` and `clearViewport()` to the session object; corrected the doc comment to reflect session-scoped semantics |
| `e2e/inspect.mjs` | modified | Added `viewport <WxH> [--scale N] [--mobile]` / `viewport reset` operations; added `--viewport <WxH> [--mobile] [--scale N]` flag to `eval` and `screenshot` (override applied for the call, cleared after); updated header doc |
| `e2e/README.md` | modified | Updated operations table with `--viewport` flag on `eval`/`screenshot` and session-scoping note on `viewport` |
| `.github/skills/usm-e2e/SKILL.md` | modified | Rewrote "Mobile scenarios (emulation sequence)" with the corrected sequence (reload before override; `--viewport` flag on capture/assert); added session-scoping explanation; updated operations table |
| `specs/002-e2e-test-env/contracts/inspect-cli.md` | modified | Updated `eval`/`screenshot` sections with `--viewport` flag; rewrote `viewport` section with session-scoping rationale; corrected the mobile-emulation paragraph |
| `specs/002-e2e-test-env/research.md` | modified | R-003-4 decision + rationale updated to the corrected sequence and session-scoping finding |
| `specs/002-e2e-test-env/quickstart.md` | modified | Scenario 5 sequence corrected; Expected text updated; failure-diagnostics table updated |
| `specs/002-e2e-test-env/spec.md` | modified | FR-003-004 and SC-003-007 made mechanism-agnostic (consistent with session-scoped override) |
| `specs/001-user-story-map/checklists/manual-validation.md` | modified | Q14 observation note updated to reference the `--viewport` flag mechanism |
| `tests/unit/inspect-viewport.test.ts` | added | 16 tests: 9 for the standalone `viewport` operation (pre-existing) + 7 for the `--viewport` flag on `eval`/`screenshot` (new) |

## Diff Highlights

**`e2e/inspect.mjs` — `--viewport` flag on `eval` (parsing):**
```js
if (rest[i] === '--viewport') {
    const raw = rest[i + 1];
    const m = /^(\d+)x(\d+)$/.exec(raw ?? '');
    if (!m) {
        fail(`Invalid --viewport value: '${raw ?? '(missing)'}'. …`, 2);
    }
    viewportWidth = Number(m[1]);
    viewportHeight = Number(m[2]);
    i++;
}
```

**`e2e/inspect.mjs` — override applied within the same connection:**
```js
try {
    if (viewportWidth > 0) {
        await session.setViewport(viewportWidth, viewportHeight, viewportScale, viewportMobile);
    }
    // … run eval / screenshot …
} finally {
    if (viewportWidth > 0) {
        try { await session.clearViewport(); } catch { /* best-effort */ }
    }
    session.close();
}
```

**Corrected mobile sequence (SKILL.md / quickstart.md):**
```bash
node e2e/inspect.mjs eval "this.app.emulateMobile(true)"
node e2e/inspect.mjs eval "location.reload()"
node e2e/inspect.mjs wait ".usm-board"
node e2e/inspect.mjs screenshot e2e/output/mobile-emulated.png --viewport 375x667 --mobile
node e2e/inspect.mjs eval "JSON.stringify({…})" --viewport 375x667 --mobile
# restore:
node e2e/inspect.mjs eval "this.app.emulateMobile(false)"
node e2e/inspect.mjs eval "location.reload()"
node e2e/inspect.mjs wait ".usm-board"
node e2e/inspect.mjs eval "this.app.isMobile"   # → false
```

## Tests Added or Updated

- `tests/unit/inspect-viewport.test.ts` — 16 tests total:
  - 9 tests for the standalone `viewport` operation (argument parsing, invalid input → exit 2, valid input → connection step only).
  - 7 new tests for the `--viewport` flag on `eval`/`screenshot` (valid `WxH` + `--mobile` → connection step only; malformed `--viewport` → exit 2 "Invalid --viewport value"; missing `--viewport` value → exit 2; non-positive `--scale` → exit 2; unknown flag on `screenshot` → exit 2 "Unknown screenshot argument").

## Local Verification

- `npx vitest run` → **180/180 passed** (14 test files).
- `npm run lint` → **0 errors**, 53 warnings (all pre-existing convention warnings for `node:` imports in tests and `innerHTML`/`createElement` in `src/`).
- **Live verification** (Obsidian 1.14.5, Chrome 150, CDP port 9222, test vault `Test Board 2.md`):
  - Sequence: `emulateMobile(true)` → `location.reload()` → `wait ".usm-board"` → `screenshot --viewport 375x667 --mobile` → `eval --viewport 375x667 --mobile`.
  - Result: `{isMobile: true, innerWidth: 375, colW: "160px", releaseHeaderH: 32}` — **mobile layout applied** (SC-003-007 criteria met).
  - Screenshot: `e2e/output/mobile-emulated.png` (gitignored).
  - Restore: `emulateMobile(false)` → `location.reload()` → `wait` → `{isMobile: false, innerWidth: 1635, colW: "240px"}` — **desktop state restored**.

## Deviations from Assessment

1. **Session-scoped override (critical finding).** The assessment proposed a standalone `viewport` operation (connect → set → close) followed by a separate `screenshot`/`eval` call, with the override persisting for the target. Live verification (2026-10-28, Obsidian 1.14.5 / Chrome 150) proved the CDP `Emulation.setDeviceMetricsOverride` is **session-scoped**: it is visible target-wide only while the connection that set it is open, and is **cleared when that connection closes** (it survives page reloads while the setting connection stays open). A standalone `viewport` call therefore cannot hold the override for a later, separate call. The fix adds a `--viewport` flag to `eval` and `screenshot` (override applied within the same connection as the action, cleared after) as the primary mechanism. The standalone `viewport` operation is retained for diagnostics.

2. **Sequence order corrected.** The assessment proposed `emulateMobile(true)` → `viewport 375x667 --mobile` → `location.reload()` → `wait` → `screenshot`. Because the override is session-scoped and a standalone `viewport` call closes its connection (clearing the override), the reload in between would have no override to preserve. The corrected sequence is `emulateMobile(true)` → `location.reload()` → `wait` → `screenshot --viewport 375x667 --mobile` (override applied within the screenshot call itself).

3. **Restore step simplified.** The assessment's restore step included `viewport reset` (because the override was assumed to persist). With the `--viewport` flag, the override is cleared automatically at the end of the call, so the restore step is simply `emulateMobile(false)` + `location.reload()` + `wait`. `viewport reset` is only needed if a standalone `viewport` call was used.

4. **SC-003-007 / FR-003-004 wording.** The assessment proposed tightening SC-003-007 to assert the applied layout. This was done (user-approved in scope), but the wording was made mechanism-agnostic ("apply the viewport override so the mobile layout is in effect during the scenario's capture/assertion") rather than prescribing a specific CLI invocation, to keep the spec stable across tooling changes.

## Follow-ups

- The standalone `viewport` operation is now primarily a diagnostic tool. Consider whether it should be documented as such more prominently, or whether a `--hold` mode (long-lived connection) would be useful for interactive debugging sessions.
- The throwaway diagnostic scripts in `e2e/output/` (`vp-scope-check.mjs`, `vp-reload-check.mjs`, `vp-seq-check.mjs`, `vp-timing-check.mjs`, `vp-xy-check.mjs`, `vp-session-check.mjs`) are gitignored and can be deleted.
- Run `/speckit-bug-test slug=emulate-mobile-viewport-gap` to validate the fix against the assessment's reproduction steps.
