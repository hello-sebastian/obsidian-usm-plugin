# Bug Fix: Board view routing — empty panel on non-board notes, dead view-switch button, button on non-board notes (iteration 2)

- **Slug**: board-view-routing
- **Fixed**: 2026-10-24
- **Assessment**: ./assessment.md
- **Status**: applied

## Summary

The iteration-1 fix (leaf-readiness retry + dedicated view-switch button) left three defects: (1) `BoardView.canAcceptExtension('md')` returned `true`, so Obsidian reused the board leaf for regular `.md` notes and `render()` emptied the content → empty panel; (2) `showViewSwitchMenu` called `new Menu().showAtMouseEvent(evt)` without `menu.load()`, so the menu never built its DOM and clicking the button did nothing; (3) the view-switch button was added to every `MarkdownView` regardless of whether the note is a USM board. All three are now fixed: the board view no longer claims `.md` files for leaf reuse, the menu is loaded before being shown, and the button is only added to Markdown views whose file is a board (checked asynchronously).

## Changes

| File | Change | Notes |
|------|--------|-------|
| `src/obsidian/board-view.ts` | modified | `canAcceptExtension` now returns `false` (Defect 1); `showViewSwitchMenu` builds items, then calls `menu.load()` before `menu.showAtMouseEvent(evt)` (Defect 2a); `ensureViewSwitchActionForLeaf` defers `addAction` behind an async `isBoardFileContent` check so non-board notes keep only the native toggle (Defect 2b) |
| `tests/helpers/obsidian-stub.ts` | modified | Added a `Menu` stub class (`addItem`, `addSeparator`, `load`, `showAtMouseEvent`, `showAtPosition`, `hide`, `close`, `onHide`) so the menu path is testable |
| `tests/integration/view-routing.test.ts` | modified | `readSpy` is now path-aware (board content only for `board.md`); added `flushMicrotasks` helper; existing MarkdownView button test is now async (addAction is deferred); added 3 new tests pinning Defects 1, 2a, 2b |

## Diff Highlights

**Defect 1 — board view must not claim `.md` files for leaf reuse:**

```ts
canAcceptExtension(_ext: string): boolean {
    return false;
}
```

Board notes are still routed to the board view via `handleBoardFileOpen` → `restoreView` → `leaf.setViewState({ type: BOARD_VIEW_TYPE, … })`, which is a direct state change and does not depend on `canAcceptExtension`.

**Defect 2a — menu must be loaded before shown:**

```ts
for (const option of options) {
    menu.addItem((item) => {
        item.setTitle(option.label).setIcon(option.icon)
            .setChecked(option.view === current)
            .onClick(() => onSelect(option.view));
    });
}
menu.load();
menu.showAtMouseEvent(evt);
```

`Component.load()` is required to build the menu's DOM; without it `showAtMouseEvent` positions an empty menu.

**Defect 2b — button only on board notes:**

```ts
if (view instanceof MarkdownView && !markdownViewsWithSwitchAction.has(view)) {
    markdownViewsWithSwitchAction.add(view);
    void (async (): Promise<void> => {
        if (!(await isBoardFileContent(app, file))) return;
        view.addAction(VIEW_SWITCH_ICON, t('view.switch'), async (evt) => {
            // …re-check board status, then showViewSwitchMenu
        });
    })();
}
```

The `WeakSet` still guarantees at most one `addAction` per view; the async guard means the action is only attached when the file is actually a board.

## Tests Added or Updated

- `tests/integration/view-routing.test.ts` — `defect 1 — board view must not claim non-board files › does not claim .md files for leaf reuse` — pins `canAcceptExtension('md') === false`.
- `tests/integration/view-routing.test.ts` — `defect 2b — view-switch button only on board notes › does not add the button to a non-board Markdown view` — pins that `addAction` is never called for a non-board file (cache miss + plain `vault.read` content).
- `tests/integration/view-routing.test.ts` — `defect 2a — view-switch menu is loaded before shown › loads the menu before showing it` — pins that `Menu.load()` is called exactly once, before `Menu.showAtMouseEvent`, when the button callback fires.
- `tests/integration/view-routing.test.ts` — `defect 2 — dedicated view-switch button › adds the button to the native Markdown view once (no duplicate)` — updated to async: awaits a microtask flush after each `ensureViewSwitchActionForLeaf` call because `addAction` is now deferred behind the async board check.
- `tests/integration/view-routing.test.ts` — `createMockApp` `readSpy` is now path-aware (`board.md` → board content, anything else → plain content) so the non-board test is not mis-detected as a board via the `vault.read` fallback.

## Local Verification

- Commands run:
  - `npx tsc --noEmit -skipLibCheck` → clean (0 errors).
  - `npx vitest run tests/integration/view-routing.test.ts` → 8/8 passed.
  - `npm test` → 142/142 passed (11 files; was 139 before this iteration — 3 new tests).
  - `npm run lint` → 0 errors (38 warnings, all pre-existing patterns: `as TFile` casts and `document.createElement` in test helpers, consistent with the file's existing style).
  - `npm run build` → success; `main.js` regenerated (16.6 KB) and contains the fix (`canAcceptExtension(t){return!1}` in the bundle).
- Manual checks: none performed in this environment (no live Obsidian instance). The Defect-1 fix relies on `leaf.setViewState` working independently of `canAcceptExtension` — this must be confirmed on live Obsidian 1.14.5 via `/speckit-bug-test`.

## Deviations from Assessment

None. The remediation was applied exactly as proposed in `assessment.md` (iteration 2): `canAcceptExtension` → `false`, `menu.load()` before `showAtMouseEvent`, and the async board guard in `ensureViewSwitchActionForLeaf`. The only addition beyond the assessment's file list was the `Menu` stub in `tests/helpers/obsidian-stub.ts`, which the assessment's "Tests to add or update" section implicitly required (the menu path could not be exercised without a `Menu` in the stub).

## Follow-ups

- Run `/speckit-bug-test slug=board-view-routing` to verify on live Obsidian 1.14.5: (a) opening a regular `.md` note after a board note shows the native editor/preview (no empty panel); (b) the view-switch button on a board note opens a 3-option menu (USM board / Edit MD / View MD); (c) non-board notes show only the native source/preview toggle.
- Confirm on live Obsidian that `leaf.setViewState({ type: BOARD_VIEW_TYPE, … })` still routes board notes to the board view now that `canAcceptExtension` returns `false` (the assessment's primary risk).
- Consider whether the menu should be a Kanban-style dropdown (open question from the assessment) — the current `Menu` implementation satisfies the reported requirement (3 options, checkmark on the current view).
