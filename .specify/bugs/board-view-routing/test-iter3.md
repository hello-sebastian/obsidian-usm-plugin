# Bug Verification: View-switch button missing in native Markdown view after switching from board view (iteration 3)

- **Slug**: board-view-routing
- **Tested**: 2026-10-24
- **Assessment**: ./assessment.md
- **Fix**: ./fix.md
- **Result**: partial

## Summary

All automated checks pass — the fix's new integration test (9/9 in `view-routing.test.ts`, including the new defect-3 test that pins the `active-leaf-change` handler end-to-end through `registerBoardViewRouting`), the full regression suite (143/143), type-check, lint (0 errors), and the production build are all green, and the built `main.js` provably contains the new listener. Static analysis of the **actual Obsidian 1.14.5 bundle** (`obsidian.asar`) re-confirms the mechanism the fix relies on: `activeLeafEvents()` triggers `active-leaf-change` on every active-leaf change, `file-open` is gated on the active *file* actually changing (`t!==n`), and `requestActiveLeafEvents()` is invoked from the view-load path after `setViewState` — so the button is now ensured after a board → Markdown view-type switch. However, the assessment's **manual reproduction** (clicking through a live Obsidian 1.14.5 vault: board → "Edit MD" → check the button) was **not exercised** in this session, so the end-to-end symptom cannot be confirmed as gone. Per the skill's guardrail, the result is downgraded to `partial` rather than `verified`.

## Checks Performed

| Check | Command / Action | Result | Notes |
|-------|------------------|--------|-------|
| Reproduction (post-fix) | Manual: open board note → "Edit MD" / "View MD" → verify the 3-option menu button is present in the native Markdown view; switch back to "USM board" | not-run | No live Obsidian instance in this environment; the assessment's reproduction requires clicking through a live 1.14.5 vault |
| New / updated tests | `npx vitest run tests/integration/view-routing.test.ts` | pass | 9/9 (was 8; +1 new defect-3 test that fires the captured `active-leaf-change` handler after a simulated board → Markdown swap and asserts the button is added to the new `MarkdownView`) |
| Regression suite | `npm test` | pass | 143/143 across 11 files (was 142 before this iteration) |
| Lint / type-check | `npx tsc --noEmit -skipLibCheck`; `npm run lint` | pass | tsc clean (0 errors); lint 0 errors (39 warnings — the one new warning is `prefer-create-el` in the new test, the same pre-existing pattern already used in the file) |
| Build + bundle | `npm run build`; `grep -c "active-leaf-change" main.js` | pass | Build success; `main.js` (16.8 KB) contains the listener: `active-leaf-change",t=>{if(t===null)return;let n=t.view;if(n instanceof y.FileView){let r=n.file;r!==null&&te(e,r)}}` |
| Mechanism (static bundle analysis) | `python3` regex scan of `/Applications/Obsidian.app/Contents/Resources/obsidian.asar` | pass | Re-confirmed: `activeLeafEvents()` → `trigger("active-leaf-change",e)` (offset 3699551); `file-open` gated by `t!==n` (offset 3699715); `requestActiveLeafEvents()` called from the view-load path (offset 2303060) and tab selection (offset 3698886) |

## Output Excerpts

**New / updated tests:**
```
✓ tests/integration/view-routing.test.ts (9 tests) 6ms
Test Files  1 passed (1)
     Tests  9 passed (9)
```

**Regression suite:**
```
Test Files  11 passed (11)
     Tests  143 passed (143)
```

**Lint:**
```
✖ 39 problems (0 errors, 39 warnings)
```

**Bundle (the fix is present in the shipped artifact):**
```
-rw-r--r--@ 1 sebastian  staff  16777 Oct 24 22:51 main.js
1
active-leaf-change",t=>{if(t===null)return;let n=t.view;if(n instanceof y.FileView){let r=n.file;r!==null&&te(e,r)}}
```

**Mechanism (Obsidian 1.14.5 bundle, `activeLeafEvents`):**
```
t.prototype.activeLeafEvents=function(){if(this.layoutReady){var e=this.activeLeaf;
this.trigger("active-leaf-change",e);var t=this.lastActiveFile,n=this.getActiveFile();
t!==n&&(this.recentFileTracker.onFileOpen(n,t),this.lastActiveFile=n,this.trigger("file-open",n))}}
```
This single function proves both halves of the root cause: `active-leaf-change` fires unconditionally on every active-leaf change, while `file-open` fires only when `t!==n` (the active file changed). A view-type switch changes the leaf's view but not the file, so only `active-leaf-change` fires — exactly the event the fix now listens to.

## Residual Risks

- **No live end-to-end confirmation.** The fix's correctness rests on (a) the new integration test, which exercises the registered handler with a mock `Plugin` and a simulated view swap, and (b) static analysis of the real 1.14.5 bundle confirming the event-firing semantics. Neither is a live click-through. If the real `MarkdownView` is not yet ready to accept `addAction` at the moment `active-leaf-change` fires (the assessment's "event timing" risk), the button could be missed on the first switch. The existing `ensureViewSwitchActionForLeaf` guards against this by checking `findLeafWithFile` (returns null if the leaf is not registered yet), but that guard's behavior under the real timing has not been observed live.
- **`active-leaf-change` is not typed in `obsidian.d.ts`.** The `.on('active-leaf-change', cb)` call is untyped (the handler param is `WorkspaceLeaf | null`). It works at runtime (confirmed by the bundle), but a future Obsidian version that renames or re-scopes the event would break the fix silently. This is a pre-existing pattern (the `file-open` handler is typed, but `active-leaf-change` is not), so it is not a regression — just a fragility to watch.
- **The assessment's open question** (whether `active-leaf-change` should also route non-board → board view-type switches) was deliberately left out of scope in the fix. That scenario is not reachable via the UI (the plugin never offers a board view for non-board notes), so it is not a risk in practice, but it is an untested edge.

## Recommendation

**Hold — automated verification is complete and the mechanism is statically confirmed, but the live end-to-end reproduction was not exercised.** To close the bug as `verified`, run the manual check on a live Obsidian 1.14.5 vault: (a) open a board note (`usm-board: true`) → it renders in the map view; (b) click the view-switch button → select "Edit MD" → confirm the 3-option menu button is present in the native Markdown view (not the native 2-option toggle); (c) select "View MD" → confirm the same; (d) from both native modes, select "USM board" → confirm the board view is restored; (e) re-activate the tab → confirm the view does not change and no `usm-view` write occurs. If all five pass, update this report's `Result` to `verified`. If the button is still missing after a switch, the "event timing" residual risk is real — reopen with `/speckit-bug-assess` and capture the live behavior.
