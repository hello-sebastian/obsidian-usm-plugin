# Bug Verification: Duplicate view-switch buttons in native Markdown view for board notes (Defect 4, iteration 4)

- **Slug**: board-view-routing
- **Tested**: 2026-10-25
- **Assessment**: ./assessment.md
- **Fix**: ./fix.md
- **Result**: partial

## Summary

The **live-vault manual check** (run by the user after `npm run deploy`) confirms **Defect 4 is fixed**: in the native Markdown view of a board note, only the plugin's `columns-2` button shows and the native source/preview toggle is hidden (Ad. 1–3 pass). All automated checks remain green (12/12 view-routing, 146/146 suite, tsc, lint 0 errors, build; the deployed `main.js` contains the fix). **However**, the live check surfaced a **new, related defect** (Ad. 4B/5): when a board note is in native mode (plugin button added) and the user navigates to a non-board note in the same tab, the **inert plugin button persists** alongside the (correctly restored) native toggle — two buttons, one of which does nothing. The native-toggle restore works (the native button is present and functional), but the plugin button is never removed when the view leaves a board file. This is a pre-existing gap (the button is added once and guarded by the `markdownViewsWithSwitchAction` WeakSet, but never removed), now surfaced by the live test. Per the skill's guardrail, the result is `partial`: the original symptom is gone, but a related defect remains.

## Checks Performed

| Check | Command / Action | Result | Notes |
|-------|------------------|--------|-------|
| Reproduction (post-fix) — Defect 4 | Manual (live vault): board note → "Edit MD" / "View MD" → count buttons in pane header | pass | Ad. 1–3 pass: only the plugin's `columns-2` button shows; the native toggle is hidden. **Defect 4 is fixed.** |
| Reproduction (post-fix) — non-board restore | Manual (live vault): board note (native mode) → navigate to non-board note in same tab → count buttons | **fail** | Ad. 4B/5: **two** buttons — the inert plugin button (click shows no menu) **and** the native toggle (functional). Expected: only the native toggle. **New defect.** (Ad. 4A — board in board mode → non-board — passes: only the native button.) |
| New / updated tests | `npx vitest run tests/integration/view-routing.test.ts` | pass | 12/12 (was 9; +3 Defect-4 tests: hide on board, restore on non-board via `active-leaf-change`, safe no-op when `modeButtonEl` absent) |
| Regression suite | `npm test` | pass | 146/146 across 11 files (was 143 before this iteration) |
| Lint / type-check | `npx tsc --noEmit -skipLibCheck`; `npm run lint` | pass | tsc clean (0 errors); lint 0 errors (44 warnings = pre-existing baseline) |
| Build + bundle | `npm run build`; `grep -c "modeButtonEl" main.js` | pass | Build success (16.6 KB); local `main.js` contains the fix (1 match) |
| Deploy to live vault | `npm run deploy` (run by user); `grep -c "modeButtonEl" <vault>/main.js` | pass | Deployed bundle contains the fix (1 match) — the live vault is running the iteration-4 code |
| Mechanism (static bundle analysis) | `grep` scan of `/Applications/Obsidian.app/Contents/Resources/obsidian.asar` | pass | Confirmed: `HTMLElement.prototype.hide`/`show` exist; `modeButtonEl=n.addAction("lucide-book-open","",n.onSwitchView.bind(n))` (so `modeButtonEl` is an `HTMLElement` with `hide`/`show`); `hide` saves prior display in `data-display`, `show` restores it (symmetric round-trip) |

## Output Excerpts

**Manual check (live vault, user-reported):**
```
Ad. 1 ok
Ad. 2 ok
Ad. 3 ok
Ad. 4 i 5
A. Notatka tablicy w trybie tablicy i wychodzę do notatki nie-tablicy jest tylko natywny przycisk
   zmiany trybu widoku – poprawnie.
B. Notatka tablicy w trybie natywnym edycja/podgląd i wychodzę do notatki nie-tablicy są dwa
   przyciski: pierwszy to przycisk pluginu (kiedy klikam nie pojawia się menu), drugi natywny
   (działa) – niepoprawnie, powinien być tylko przycisk natywny.
```

**New / updated tests:**
```
✓ tests/integration/view-routing.test.ts (12 tests) 9ms
Test Files  1 passed (1)
     Tests  12 passed (12)
```

**Regression suite:**
```
Test Files  11 passed (11)
     Tests  146 passed (146)
```

**Lint:**
```
✖ 44 problems (0 errors, 44 warnings)
```

**Bundle (local + deployed):**
```
===BUNDLE_LOCAL===
1
===DEPLOYED_VAULT===
1
```

**Mechanism (Obsidian 1.14.5 bundle):**
```
HTMLElement.prototype.hide||(HTMLElement.prototype.hide=function(){var t=this.style.display;
"none"!==t&&(this.style.display="none",t?this.setAttribute("data-display",t):this.removeAttribu...
HTMLElement.prototype.show||(HTMLElement.prototype.show=function(){"none"===this.style.display&&(this
.style.display=this.getAttribute("data-display")||"",this.removeAttribute("data-displa...
modeButtonEl=n.addAction("lucide-book-open","",n.onSwitchView.bind(n
```
This proves the fix's three runtime assumptions: (1) `hide`/`show` exist on `HTMLElement.prototype` — the helper's `el.hide()`/`el.show()` calls cannot throw; (2) `modeButtonEl` is the return value of `addAction`, i.e. an `HTMLElement` — so it carries `hide`/`show`; (3) the round-trip is symmetric — `hide` remembers the previous display value in `data-display` and `show` restores exactly that, so repeated board ↔ non-board navigation never leaves the toggle stuck hidden or visible.

## New Defect (surfaced by the live check)

**Symptom**: A board note shown in the native Markdown view (plugin button added, native toggle hidden) → user navigates to a non-board note in the same tab → the pane header shows **two** buttons: (1) the plugin's `columns-2` button, which is **inert** (clicking it shows no menu because the click handler re-checks `isBoardFileContent` and bails), and (2) the native source/preview toggle, which is **functional** (correctly restored by `syncNativeModeToggle`). Expected: only the native toggle.

**Root cause (high confidence)**: `ensureViewSwitchActionForLeaf` (src/obsidian/board-view.ts) adds the plugin button **once** per `MarkdownView` (guarded by the `markdownViewsWithSwitchAction` WeakSet) and **never removes it**. When the view later shows a non-board file, the `active-leaf-change` handler calls `syncNativeModeToggle` (which correctly restores the native toggle) but nothing removes or hides the plugin button. The code comment in `ensureViewSwitchActionForLeaf` even acknowledges this: *"the action is inert (does nothing) if the view later shows a non-board file."* The button was designed to be inert, not to be removed — but an inert, visible button is confusing (the user's exact complaint). This is a pre-existing gap from the iteration-2 button-once design, now surfaced because the iteration-3 `active-leaf-change` listener makes the button get added in the board → native-view flow, and the iteration-4 fix makes the native-toggle restore work, so the two-button state is visible.

**Proposed remediation (for the next assessment)**: In the `active-leaf-change` re-evaluation path, when the view's current file is **not** a board note, **remove** the plugin button (and drop the view from `markdownViewsWithSwitchAction`) so only the native toggle remains. Obsidian has no public `removeAction`, so the button element must be tracked (e.g. store the `HTMLElement` returned by `addAction` in a `WeakMap<MarkdownView, HTMLElement>`) and removed via `el.remove()`. Alternatively, hide the button (symmetric with the native-toggle hide) — but removal is cleaner since the button is genuinely not needed for non-board notes.

## Residual Risks

- **A new, related defect is unassessed.** The live check (Ad. 4B/5) shows the inert plugin button persists when navigating from a board note (native mode) to a non-board note. It needs its own `/speckit-bug-assess` (iteration 5) before a fix. Root cause is high-confidence (the button is added once and never removed), but the remediation (button removal vs. hiding, and how to track the button element without a public `removeAction`) needs scoping.
- **No public `removeAction`.** Obsidian's `ItemView.addAction` has no corresponding `removeAction`; the fix will need to track the button element and call `el.remove()` (or hide it).
- **Internal API access.** `modeButtonEl` is not in `obsidian.d.ts`; a future Obsidian rename would make the helper a silent no-op (the native toggle would remain visible — the original cosmetic issue returns, no crash). Watch for this on Obsidian upgrades.
- **`active-leaf-change` is not typed in `obsidian.d.ts`** (pre-existing pattern from iteration 3, not a regression).
- **The `tests/` lint override** (`obsidianmd/no-static-styles-assignment` off for `tests/**/*.ts` in `eslint.config.mts`) is a new, documented exception to the Constitution Principle VII guard. It is scoped to test doubles only (production `src/` remains fully guarded by both the lint rule and `inline-styling-guard.test.ts`), but it should be reviewed when the constitution is next amended.

## Recommendation

**Hold — Defect 4 is verified fixed on the live vault (Ad. 1–3 pass), but the live check surfaced a new, related defect (Ad. 4B/5): the inert plugin button persists when navigating from a board note (native mode) to a non-board note.** Re-run `/speckit-bug-assess slug=board-view-routing` with the new evidence captured above (the inert-button-persists symptom, the root cause in `ensureViewSwitchActionForLeaf`'s button-once design, and the proposed button-removal remediation). After that assessment and fix, re-run this verification. Do not close the bug as `verified` until the new defect is also resolved.
