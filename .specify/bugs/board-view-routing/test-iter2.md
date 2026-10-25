# Bug Verification: Board view routing — empty panel, dead view-switch button, button on non-board notes (iteration 2)

- **Slug**: board-view-routing
- **Tested**: 2026-10-24
- **Assessment**: ./assessment.md
- **Fix**: ./fix.md
- **Result**: partial

## Summary

All automated checks pass — the fix's new integration tests (8/8, including 3 that pin Defects 1, 2a, 2b), the full regression suite (142/142), type-check, lint (0 errors), and the production build are all green, and the built `main.js` provably contains all three fixes. In addition, static analysis of the **actual Obsidian 1.14.5 bundle** (`obsidian.asar`) confirms both halves of the assessment's key risk: the leaf-selection path is gated by `canAcceptExtension` (so `return false` forces the native Markdown view for regular notes), and `setViewState` creates the view directly from the view registry **without** consulting `canAcceptExtension` (so board-note routing still works). However, the assessment's **manual reproduction** (clicking through a live Obsidian 1.14.5 vault) was **not exercised** in this session, so the end-to-end symptom cannot be confirmed as gone. Per the skill's guardrail, the result is downgraded to `partial` rather than `verified`.

## Checks Performed

| Check | Command / Action | Result | Notes |
|-------|------------------|--------|-------|
| Reproduction (post-fix) | Manual: install into vault, open board note → regular `.md` note, click view-switch button | not-run | Requires driving a live Obsidian 1.14.5 GUI; not available in this session, and the skill forbids modifying files outside the workspace (so no deploy to the vault). The automated equivalents + bundle static analysis below cover the core logic. |
| New / updated tests | `npx vitest run tests/integration/view-routing.test.ts` | pass | 8/8 — retry-until-ready, tab-activation no-op, `findLeafWithFile` null, button-once (MarkdownView, now async), button-once (BoardView), **Defect 1** `canAcceptExtension('md')===false`, **Defect 2b** no button on non-board, **Defect 2a** `Menu.load()` before `showAtMouseEvent`. |
| Regression suite | `npm test` | pass | 142/142 across 11 files (incl. `live-update`, `render-perf`, unit guards). Was 139 before this iteration (+3 new tests). |
| Lint / type-check | `npx tsc --noEmit -skipLibCheck` ; `npm run lint` | pass | tsc exit 0; lint 0 errors (38 warnings, all pre-existing patterns in test helpers — `as TFile` casts, `document.createElement`). |
| Build + bundle verification | `npm run build` ; `grep` on `main.js` | pass | Build succeeded; `main.js` (16.6 KB) contains all three fixes: `canAcceptExtension(t){return!1}` (Defect 1), `n.load(),n.showAtMouseEvent(i)` (Defect 2a), and the `usm-board` board guard (Defect 2b). |
| Static analysis of Obsidian 1.14.5 bundle | `grep`/`python` on `/Applications/Obsidian.app/Contents/Resources/obsidian.asar` | pass | Confirms (a) leaf-selection is gated by `canAcceptExtension`, and (b) `setViewState` does **not** reference `canAcceptExtension`. See Output Excerpts. |

## Output Excerpts

New / updated tests:
```
Test Files  1 passed (1)
     Tests  8 passed (8)
```

Full regression suite:
```
Test Files  11 passed (11)
     Tests  142 passed (142)
```

Lint:
```
✖ 38 problems (0 errors, 38 warnings)
```

Built bundle (`main.js`) — all three fixes present:
```
canAcceptExtension(t){return!1}
...setChecked(s.view===e).onClick(()=>t(s.view))});n.load(),n.showAtMouseEvent(i)}
```

Obsidian 1.14.5 bundle (`obsidian.asar`) — leaf-selection is gated by `canAcceptExtension` (confirms Defect 1 mechanism; `return false` forces the native Markdown view for regular notes):
```
n=this.view, i=this.app.viewRegistry.getTypeByExtension(e.extension),
n && n instanceof BO && n.canAcceptExtension(e.extension) && (i=n.getViewType()),
i ? (r=t.state||{}, ...)
```

Obsidian 1.14.5 bundle (`obsidian.asar`) — `WorkspaceLeaf.setViewState` creates the view directly from the registry and does **not** reference `canAcceptExtension` (confirms board-note routing still works after the Defect 1 fix):
```
setViewState=function(e,t){ ... n=this.view, i=n?n.getViewType():"", ...
  if(l=this.app.viewRegistry.getViewCreatorByType(e.type)) ... n=l(this) ...
```

## Residual Risks

- **End-to-end not confirmed on a live vault.** The fix's logic is covered by unit/integration tests, the built bundle, and static analysis of the real Obsidian 1.14.5 code paths — but the actual user-visible behavior (opening a regular `.md` note after a board note shows the native editor/preview; the view-switch button on a board note opens the 3-option menu; non-board notes show only the native source/preview toggle) was not observed in a running vault.
- **Version drift.** Runtime is Obsidian 1.14.5; type definitions are 1.12.3. The bundle analysis was done against the 1.14.5 binary, which mitigates this for the two load-bearing APIs (`canAcceptExtension`, `setViewState`), but a live run is still the definitive check.
- **`addAction` on the native `MarkdownView`.** Adding a header action to a view the plugin does not own is a public-API use but somewhat unusual; it should be confirmed to behave correctly (no duplicates, cleaned up on view destroy) in a real vault.
- **Performance baseline flake.** `tests/performance/render-perf.test.ts` is timing-sensitive; it passed in this verification run. Worth a clean-baseline re-capture if it recurs on CI.

## Recommendation

**Hold — automated verification and bundle static analysis are green, but the manual reproduction was not exercised.** The fix's logic is well-covered by the new integration tests, the full suite passes with no regressions, and the built bundle provably contains all three fixes. Crucially, static analysis of the actual Obsidian 1.14.5 bundle confirms the assessment's key risk is resolved: `canAcceptExtension` gates leaf reuse (so regular notes fall back to the native Markdown view) while `setViewState` is independent of it (so board notes still route to the board view). To close the bug as `verified`, run the manual validation on a live Obsidian 1.14.5 vault: confirm (a) opening a regular `.md` note after a board note shows the native editor/preview (no empty panel), (b) the view-switch button on a board note opens the 3-option menu (USM board / Edit MD / View MD) with the current view checked, (c) non-board notes show only the native source/preview toggle (no plugin button), and (d) tab re-activation does not change views. If any of those fail, reopen with `/speckit-bug-assess` using the captured evidence.
