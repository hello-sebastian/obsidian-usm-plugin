# Bug Fix: View-switch button missing in native Markdown view after switching from board view (iteration 3)

- **Slug**: board-view-routing
- **Fixed**: 2026-10-24
- **Assessment**: ./assessment.md
- **Status**: applied

## Summary

The view-switch button was only added to the native `MarkdownView` from the `file-open` handler, but Obsidian fires `file-open` only when the active *file* changes — a view-type switch (board → Markdown) for the same file does not fire it, so the button was never added after switching to "Edit MD" / "View MD". The fix adds an `active-leaf-change` listener in `registerBoardViewRouting` that calls the existing (idempotent) `ensureViewSwitchActionForLeaf` for the active leaf's file, so the button is present in all three view states of a board note.

## Changes

| File | Change | Notes |
|------|--------|-------|
| `src/obsidian/board-view.ts` | modified | `registerBoardViewRouting` now also registers an `active-leaf-change` listener that calls `ensureViewSwitchActionForLeaf(app, file)` for the active leaf's file (no `handleBoardFileOpen` — routing stays on `file-open` only, so tab re-activation never triggers a view switch or a spurious write) |
| `tests/integration/view-routing.test.ts` | modified | `createMockApp` now captures workspace event handlers (`workspace.on` records callbacks in a `Map`); added a test that registers the routing via a mock `Plugin`, fires the captured `active-leaf-change` handler after a simulated board → Markdown view swap, and asserts the button is added to the new `MarkdownView` |

## Diff Highlights

**The new listener (Defect 3):**

```ts
plugin.registerEvent(
    app.workspace.on('active-leaf-change', (leaf) => {
        if (leaf === null) {
            return;
        }
        const view = leaf.view;
        if (view instanceof FileView) {
            const file = view.file;
            if (file !== null) {
                ensureViewSwitchActionForLeaf(app, file);
            }
        }
    }),
);
```

`active-leaf-change` fires on every active-leaf change, including view-type switches (confirmed by bundle analysis of Obsidian 1.14.5: `setViewState` → `requestActiveLeafEvents()` → `trigger("active-leaf-change", leaf)`). The handler is deliberately minimal: it only ensures the button; it does not route or write.

## Tests Added or Updated

- `tests/integration/view-routing.test.ts` — `defect 3 — button present after view-type switch › adds the button to the Markdown view when active-leaf-change fires after a view-type switch` — pins the fix end-to-end at the handler level: `registerBoardViewRouting` registers an `active-leaf-change` handler, and firing it after a board → Markdown view swap adds the button to the new `MarkdownView` (icon `columns-2`, title "Change view").
- `tests/integration/view-routing.test.ts` — `createMockApp` now exposes `workspaceHandlers` (a `Map` of captured `workspace.on` callbacks) so tests can fire the registered handlers.

## Local Verification

- Commands run:
  - `npx tsc --noEmit -skipLibCheck` → clean (0 errors).
  - `npx vitest run tests/integration/view-routing.test.ts` → 9/9 passed (was 8; +1 new test).
  - `npm test` → 143/143 passed (11 files; was 142 before this iteration).
  - `npm run lint` → 0 errors (39 warnings; the one new warning is `prefer-create-el` in the new test, the same pre-existing pattern already used in the file).
  - `npm run build` → success; `main.js` regenerated (16.8 KB) and contains the listener (`active-leaf-change",t=>{if(t===null)return;let n=t.view;if(n instanceof y.FileView){let r=n.file;r!==null&&te(e,r)}}`).
- Manual checks: none performed in this environment (no live Obsidian instance). The event-firing behavior (`active-leaf-change` on view-type switch, `file-open` only on file change) was verified by static analysis of the Obsidian 1.14.5 bundle during the assessment.

## Deviations from Assessment

None. The remediation was applied exactly as proposed in `assessment.md` (iteration 3): an `active-leaf-change` listener in `registerBoardViewRouting` calling `ensureViewSwitchActionForLeaf` (without `handleBoardFileOpen`). The test goes slightly beyond the assessment's "call `ensureViewSwitchActionForLeaf` when `active-leaf-change` fires" by exercising the actual registered handler through `registerBoardViewRouting` with a mock `Plugin`, which pins the wiring itself rather than just the helper.

## Follow-ups

- Run `/speckit-bug-test slug=board-view-routing` to verify on live Obsidian 1.14.5: (a) board note → "Edit MD" → the 3-option menu button is present in the native Markdown view; (b) "View MD" → same; (c) switching back to "USM board" works from both native modes; (d) tab re-activation still does not change views or write `usm-view`.
- The assessment's open question (whether `active-leaf-change` should also route non-board → board view-type switches) was left out of scope: that scenario is not reachable via the UI (the plugin never offers a board view for non-board notes), and routing remains the `file-open` handler's responsibility.
