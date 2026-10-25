# Bug Verification: Inert plugin view-switch button persists when navigating from a board note (native mode) to a non-board note (Defect 5, iteration 5)

- **Slug**: board-view-routing
- **Tested**: 2026-10-25
- **Assessment**: ./assessment.md
- **Fix**: ./fix.md
- **Result**: partial

## Summary

All automated checks pass (13/13 view-routing including the new round-trip test, 147/147 full suite, tsc clean, lint 0 errors, build OK) and the fix is **deployed to the live vault** (the deployed `main.js` contains the removal logic: `remove()`×2, `WeakMap`×1). The new round-trip test pins the exact Defect-5 behavior (board → non-board removes the plugin button and shows the native toggle; non-board → board re-adds the button and hides the toggle). **However**, the assessment's reproduction is a **manual live-vault check that was not performed** in this run (it requires the user's Obsidian instance). Per the skill's guardrail, the result is `partial`: the automated evidence is fully green and the fix is deployed, but the original symptom has not been re-observed on the live vault.

## Checks Performed

| Check | Command / Action | Result | Notes |
|-------|------------------|--------|-------|
| Reproduction (post-fix) — Defect 5 | Manual (live vault): board note → "Edit MD" → navigate to non-board note in same tab → count buttons; then navigate back to the board note | **not-run** | Requires the user's live Obsidian. The fix is deployed and ready for this check (see "Manual check to run" below). |
| New / updated tests | `npx vitest run tests/integration/view-routing.test.ts` | pass | 13/13 (was 12; +1 round-trip test). The updated Defect-4 restore test now also asserts the plugin button element is removed from the view header after board → non-board navigation. |
| Regression suite | `npm test` | pass | 147/147 across 11 files (was 146; +1). No regressions. |
| Lint / type-check | `npx tsc --noEmit`; `npm run lint` | pass | tsc clean (0 errors); lint 0 errors (46 warnings — baseline 44 + 2 `obsidianmd/prefer-create-el` in the new test code, consistent with existing test style; the gate is 0 errors). |
| Build + bundle | `npm run build`; `grep -c "remove()" main.js`; `grep -c "WeakMap" main.js` | pass | Build success (16.7 KB); local `main.js` contains the removal logic (`remove()`×2, `WeakMap`×1). |
| Deploy to live vault | `npm run deploy`; `grep -c "remove()" <vault>/main.js`; `grep -c "WeakMap" <vault>/main.js` | pass | Deployed to `/Users/sebastian/OneDrive/Aplikacje/Hermes/Hermes-sebastian/.obsidian/plugins/obsidian-usm-plugin/` (3 files, 26.6 KB). Deployed `main.js` contains the fix (`remove()`×2, `WeakMap`×1, `modeButtonEl`×1) — the live vault is running the iteration-5 code. |

## Output Excerpts

**New / updated tests:**
```
✓ tests/integration/view-routing.test.ts (13 tests) 11ms
Test Files  1 passed (1)
     Tests  13 passed (13)
```

**Regression suite:**
```
Test Files  11 passed (11)
     Tests  147 passed (147)
```

**Lint:**
```
✖ 46 problems (0 errors, 46 warnings)
```

**Build + deployed bundle:**
```
✔ Build zakończony w 676 ms (tsc 647 ms · esbuild 8 ms)
  main.js   16.7 KB
→ Deploy do /Users/sebastian/OneDrive/Aplikacje/Hermes/Hermes-sebastian/.obsidian/plugins/obsidian-usm-plugin
✔ Deploy zakończony w 3 ms (3 pliki, 26.6 KB łącznie)
  main.js         16.6 KB → 16.7 KB (+133 B)
=== DEPLOYED BUNDLE CHECK ===
remove() count: 2
WeakMap count: 1
modeButtonEl count: 1
```

## Manual check to run (live vault, to close as `verified`)

The fix is deployed. In Obsidian (reload the plugin first, e.g. **Settings → Community plugins → toggle off/on** or restart Obsidian):

1. Open a board note (`usm-board: true`) — it renders in the map view.
2. Click the plugin's view-switch button → select **Edit MD** (or **View MD**). The leaf switches to the native Markdown view; the plugin's `columns-2` button is present and the native source/preview toggle is hidden (iteration-4 behavior).
3. **In the same tab**, open a **non-board** note (click a link or select another note that replaces the content of the active leaf).
   - **Expected (Defect 5 fixed)**: the pane header shows **only** the native source/preview toggle. The plugin's `columns-2` button is **gone** (removed, not just hidden).
4. **Navigate back** to the board note in the same tab.
   - **Expected (round-trip)**: the plugin's `columns-2` button is **back** and the native toggle is hidden again.
5. (Regression) Re-confirm the iteration-4 case: board note in native mode shows only the plugin button (native toggle hidden).

## Residual Risks

- **Live-vault reproduction not performed.** The automated round-trip test exercises the same code path (`active-leaf-change` → `syncNativeModeToggle` → `removeViewSwitchAction`), but it runs against the test stub, not the real Obsidian `MarkdownView`. The real-world behavior (button removal in the actual pane header) is unconfirmed until the manual check above is run.
- **`el.remove()` on an `addAction` element.** Obsidian has no public `removeAction`; the fix removes the element directly from the DOM. This is a standard DOM operation and the element is a plain child of the view header, but if Obsidian ever wraps action elements in a container it manages, a direct `remove()` could desync its internal bookkeeping (low risk). The manual check should confirm the header renders correctly after removal and re-addition. Fallback if it desyncs: switch `removeViewSwitchAction` to `el.hide()`/`el.show()` (the assessment's alternative).
- **Internal API access.** `modeButtonEl` is not in `obsidian.d.ts`; a future Obsidian rename would make the native-toggle helper a silent no-op (the native toggle would remain visible — the original cosmetic issue returns, no crash). Watch for this on Obsidian upgrades.
- **`active-leaf-change` is not typed in `obsidian.d.ts`** (pre-existing pattern from iteration 3, not a regression).
- **The `tests/` lint override** (`obsidianmd/no-static-styles-assignment` off for `tests/**/*.ts` in `eslint.config.mts`) remains a documented exception to the Constitution Principle VII guard (scoped to test doubles only; production `src/` stays fully guarded).

## Recommendation

**Hold — the fix is applied, deployed, and fully green on all automated checks (including the new round-trip test), but the assessment's manual live-vault reproduction was not performed in this run.** Run the "Manual check to run" steps above on the live vault. If step 3 shows only the native toggle and step 4 restores the plugin button, re-run `/speckit-bug-test slug=board-view-routing` with the manual results and the bug can be closed as `verified`. If the plugin button still appears in step 3, reopen with `/speckit-bug-assess slug=board-view-routing` and capture the observed header state.
