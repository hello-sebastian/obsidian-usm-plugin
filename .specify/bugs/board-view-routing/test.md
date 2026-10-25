# Bug Verification: Inert plugin view-switch button persists when navigating from a board note (native mode) to a non-board note (Defect 5, iteration 5 — final)

- **Slug**: board-view-routing
- **Tested**: 2026-10-25
- **Assessment**: ./assessment.md
- **Fix**: ./fix.md
- **Result**: verified

## Summary

The **live-vault manual check** (run by the user after `npm run deploy`) confirms **Defect 5 is fixed**: manual checks 1–3 pass — a board note in native mode (plugin button present, native toggle hidden) navigated to a non-board note in the same tab now shows **only the native source/preview toggle**; the inert plugin button is removed. All automated checks are green (13/13 view-routing including the round-trip test, 147/147 full suite, tsc clean, lint 0 errors, build OK) and the deployed `main.js` contains the removal logic. The original symptom no longer reproduces; no regressions were found.

## Checks Performed

| Check | Command / Action | Result | Notes |
|-------|------------------|--------|-------|
| Reproduction (post-fix) — Defect 5 | Manual (live vault): (1) board note → "Edit MD" → plugin button present, native toggle hidden; (2) navigate to non-board note in same tab → count buttons; (3) navigate back to the board note | **pass** | User-confirmed: "Testy manualne 1, 2, 3 działają poprawnie". Step 2 shows **only the native toggle** — the plugin button is removed (Defect 5 fixed). Step 3 (round-trip) restores the plugin button and hides the native toggle. |
| New / updated tests | `npx vitest run tests/integration/view-routing.test.ts` | pass | 13/13 (was 12; +1 round-trip test). The updated Defect-4 restore test asserts the plugin button element is removed from the view header after board → non-board navigation; the round-trip test pins board → non-board (button removed, toggle shown) → board (button re-added, toggle hidden). |
| Regression suite | `npm test` | pass | 147/147 across 11 files. No regressions. |
| Lint / type-check | `npx tsc --noEmit`; `npm run lint` | pass | tsc clean (0 errors); lint 0 errors (46 warnings — baseline 44 + 2 `obsidianmd/prefer-create-el` in the new test code; the gate is 0 errors). |
| Build + bundle | `npm run build`; `grep -c "remove()" main.js`; `grep -c "WeakMap" main.js` | pass | Build success (16.7 KB); local `main.js` contains the removal logic (`remove()`×2, `WeakMap`×1). |
| Deploy to live vault | `npm run deploy`; `grep -c "remove()" <vault>/main.js`; `grep -c "WeakMap" <vault>/main.js` | pass | Deployed to `/Users/sebastian/OneDrive/Aplikacje/Hermes/Hermes-sebastian/.obsidian/plugins/obsidian-usm-plugin/`. Deployed `main.js` contains the fix (`remove()`×2, `WeakMap`×1, `modeButtonEl`×1) — the live vault was running the iteration-5 code during the manual check. |

## Output Excerpts

**Manual check (live vault, user-reported):**
```
Testy manualne 1, 2, 3 działają poprawnie
```
Mapping to the "Manual check to run" steps in `test-iter5.md`:
- Step 1 (board → Edit MD): plugin button present, native toggle hidden — **pass**.
- Step 2 (→ non-board note in same tab): **only the native toggle** shows; the plugin's `columns-2` button is gone — **pass** (Defect 5 fixed).
- Step 3 (→ back to the board note): plugin button re-added, native toggle hidden again — **pass** (round-trip).

**New / updated tests:**
```
✓ tests/integration/view-routing.test.ts (13 tests) 10ms
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
0 errors (46 warnings)
```

**Build + deployed bundle:**
```
✔ Build zakończony w 656 ms (tsc 629 ms · esbuild 9 ms)
  main.js   16.7 KB
=== DEPLOYED BUNDLE ===
remove(): 2
WeakMap: 1
modeButtonEl: 1
```

## Residual Risks

- **`el.remove()` on an `addAction` element.** Obsidian has no public `removeAction`; the fix removes the element directly from the DOM. The live check confirms the pane header renders correctly after removal and re-addition (steps 2–3 pass), so the low-risk desync concern from the assessment is resolved in practice. If a future Obsidian version wraps action elements in a managed container, revisit (fallback: `el.hide()`/`el.show()`).
- **Internal API access.** `modeButtonEl` is not in `obsidian.d.ts`; a future Obsidian rename would make the native-toggle helper a silent no-op (the native toggle would remain visible — the original cosmetic issue returns, no crash). Watch for this on Obsidian upgrades.
- **`active-leaf-change` is not typed in `obsidian.d.ts`** (pre-existing pattern from iteration 3, not a regression).
- **The `tests/` lint override** (`obsidianmd/no-static-styles-assignment` off for `tests/**/*.ts` in `eslint.config.mts`) remains a documented exception to the Constitution Principle VII guard (scoped to test doubles only; production `src/` stays fully guarded).

## Recommendation

**Close the bug — verified end-to-end.** The live-vault manual check (steps 1–3) confirms the original Defect 5 symptom no longer reproduces: navigating from a board note (native mode) to a non-board note in the same tab now shows only the native toggle, and navigating back restores the plugin button. All automated checks are green and the fix is deployed. The `board-view-routing` bug (5 iterations, 5 defects) is fully resolved.
