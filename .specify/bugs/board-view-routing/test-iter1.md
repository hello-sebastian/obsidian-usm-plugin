# Bug Verification: Board note opens in Markdown view, not the map view

- **Slug**: board-view-routing
- **Tested**: 2026-10-23
- **Assessment**: ./assessment.md
- **Fix**: ./fix.md
- **Result**: partial

## Summary

All automated checks pass: the fix's new integration tests (5/5), the full regression suite (139/139), type-check, and lint (0 errors) are all green, and the build succeeds. However, the assessment's **manual reproduction** (installing the plugin into a live Obsidian 1.14.5 vault and clicking `board.md`) was **not exercised** in this session, so the end-to-end symptom cannot be confirmed as gone. Per the skill's guardrail, the result is downgraded to `partial` rather than `verified`.

## Checks Performed

| Check | Command / Action | Result | Notes |
|-------|------------------|--------|-------|
| Reproduction (post-fix) | Manual: install into vault, open `board.md`, verify map view + view-switch button | not-run | Requires a live Obsidian 1.14.5 vault; not available in this session. The automated equivalents below cover the core routing/button logic. |
| New / updated tests | `npx vitest run tests/integration/view-routing.test.ts` | pass | 5/5 — retry-until-ready, tab-activation no-op, `findLeafWithFile` null, button-once (MarkdownView), button-once (BoardView). |
| Regression suite | `npm test` | pass | 139/139 across 11 files (incl. `live-update`, `render-perf`, unit guards). |
| Lint / type-check | `npx tsc --noEmit -skipLibCheck` ; `npm run lint` | pass | tsc exit 0; lint 0 errors (34 pre-existing warnings, none from this change). |
| Build | `npm run build` | pass | `tsc -noEmit -skipLibCheck && node esbuild.config.mjs production` succeeded (run during the fix session). |

## Output Excerpts

New tests:
```
Test Files  1 passed (1)
     Tests  5 passed (5)
```

Full suite:
```
Test Files  11 passed (11)
     Tests  139 passed (139)
```

Lint:
```
✖ 34 problems (0 errors, 34 warnings)
```

## Residual Risks

- **End-to-end not confirmed on Obsidian 1.14.5.** The fix's logic is covered by unit/integration tests, but the real-world behavior — a fresh open landing in the map view without the "switch away and back" workaround, close-tab → reopen also landing in the map view, the dedicated button appearing in the pane header in all three states, and "…" remaining the native context menu — was not observed in a live vault.
- **Version drift.** The runtime is Obsidian 1.14.5 but the type definitions are 1.12.3. `addAction` and `setViewState` are stable across these versions, but the fix should be confirmed on 1.14.5 specifically.
- **`addAction` on the native `MarkdownView`.** Adding a header action to a view the plugin does not own is a public-API use but somewhat unusual; it should be confirmed to behave correctly (no duplicates, removed on view destroy) in a real vault.
- **Performance baseline flake.** `tests/performance/render-perf.test.ts` is timing-sensitive and failed once on an earlier full-suite run (unrelated to this change); it passed in this verification run. Worth a clean-baseline re-capture if it recurs on CI.

## Recommendation

**Hold — automated verification is green, but the manual reproduction was not exercised.** The fix's logic is well-covered by the new integration tests and the full suite passes with no regressions. To close the bug as `verified`, run the manual validation on a live Obsidian 1.14.5 vault (quickstart Q1 + Q1b / T025): confirm (a) a fresh open of a `usm-board: true` note lands in the map view without the workaround, (b) close-tab → reopen also lands in the map view, (c) the dedicated view-switch button is present in all three states and "…" remains the native context menu, and (d) tab re-activation does not change views. If any of those fail, reopen with `/speckit-bug-assess` using the captured evidence.
