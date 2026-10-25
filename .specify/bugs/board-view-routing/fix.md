# Bug Fix: Inert plugin view-switch button persists when navigating from a board note (native mode) to a non-board note

- **Slug**: board-view-routing
- **Fixed**: 2026-10-25
- **Assessment**: ./assessment.md
- **Status**: applied

## Summary

The plugin's view-switch button was added to a `MarkdownView` once and never removed, so navigating from a board note (native mode) to a non-board note in the same tab left an inert plugin button alongside the (correctly restored) native toggle. The fix tracks the `HTMLElement` returned by `addAction` in a `WeakMap` and removes the button (plus clears the tracking structures) when the view's current file is not a board note, making the button's lifecycle symmetric with the native toggle's.

## Changes

| File | Change | Notes |
|------|--------|-------|
| `src/obsidian/board-view.ts` | modified | Added `markdownViewSwitchActionEls` `WeakMap<MarkdownView, HTMLElement>` (element handle); added `removeViewSwitchAction(view)` helper (`el.remove()` + delete from map and set); `syncNativeModeToggle` now removes the plugin button when the current file is non-board; `ensureViewSwitchActionForLeaf` stores the `addAction` return value in the map; updated doc comments. |
| `tests/integration/view-routing.test.ts` | modified + added test | Updated the Defect-4 "restores the native toggle" test to also assert the plugin button is removed from the header (Defect 5); added a round-trip test (board → non-board removes the button, non-board → board re-adds it and hides the native toggle again). |

## Diff Highlights

New element-handle map (alongside the existing synchronous guard set):

```ts
const markdownViewSwitchActionEls = new WeakMap<MarkdownView, HTMLElement>();
```

New removal helper:

```ts
function removeViewSwitchAction(view: MarkdownView): void {
	const el = markdownViewSwitchActionEls.get(view);
	if (el !== undefined) {
		el.remove();
	}
	markdownViewSwitchActionEls.delete(view);
	markdownViewsWithSwitchAction.delete(view);
}
```

Removal wired into the existing `active-leaf-change` sync path:

```ts
const isBoard = await isBoardFileContent(app, file);
const hasPluginButton = markdownViewsWithSwitchAction.has(view);
// Defect 5: when the view no longer shows a board note, remove the
// plugin's view-switch button (it would be inert) so only the native
// toggle remains.
if (!isBoard && hasPluginButton) {
	removeViewSwitchAction(view);
}
setNativeModeToggleVisible(view, !(hasPluginButton && isBoard));
```

The `addAction` return value is now stored:

```ts
const actionEl = view.addAction(VIEW_SWITCH_ICON, t('view.switch'), async (evt) => { /* … */ });
markdownViewSwitchActionEls.set(view, actionEl);
```

## Tests Added or Updated

- `tests/integration/view-routing.test.ts` — "restores the native toggle and removes the plugin button when the active file is a non-board note" (updated): pins that after board → non-board navigation the native toggle is shown **and** the plugin button element is removed from the view header.
- `tests/integration/view-routing.test.ts` — "re-adds the plugin button and hides the native toggle when navigating back to a board note (round-trip)" (added): pins the full round-trip — board (button added, toggle hidden) → non-board (button removed, toggle shown, `addAction` NOT re-called) → board (button re-added via a second `addAction` call, toggle hidden again).

## Local Verification

- Commands run:
  - `npx tsc --noEmit` → clean (no type errors).
  - `npx vitest run tests/integration/view-routing.test.ts` → 13/13 passed (was 12; +1 round-trip test).
  - `npm test` → 147/147 passed (11 files; was 146; +1).
  - `npm run lint` → 0 errors, 46 warnings (baseline 44; +2 `obsidianmd/prefe r-create-el` warnings in the new test code, consistent with the existing test style — the gate is 0 errors).
  - `npm run build` → success (`main.js` 16.7 KB, +133 B).
  - `grep -c "remove()" main.js` → 2; `grep -c "WeakMap" main.js` → 1 (the removal logic and the new map are present in the production bundle).
- Manual checks: none (live-vault repro not run in this step — deferred to `/speckit-bug-test`).

## Deviations from Assessment

- **Kept the `WeakSet` in addition to the new `WeakMap`** (the assessment proposed *replacing* the set with the map). Reason: the set is marked **synchronously** in `ensureViewSwitchActionForLeaf` (before the deferred `addAction`), which is what prevents duplicate adds from concurrent `file-open`/`active-leaf-change` events. The map can only be populated **after** the async board check resolves (the element does not exist yet), so it cannot serve as the synchronous guard on its own. Keeping both preserves the Defect 2b duplicate-guard while adding the removal handle the assessment requires. The map's presence is the source of truth for "the button element exists and can be removed"; the set's presence is the source of truth for "an add is in flight or complete". Both are cleared together in `removeViewSwitchAction`, so re-adding after removal works (verified by the round-trip test).
- **Removal is driven from `syncNativeModeToggle`** (the existing `active-leaf-change` sync path) rather than a separate call in the handler — this is exactly the path the assessment pointed to ("where `syncNativeModeToggle` already runs"), so no new event wiring was needed.

## Follow-ups

- Live-vault verification of the round-trip (board native → non-board → board) via `/speckit-bug-test slug=board-view-routing`.
- Confirm on a live 1.14.5 vault that `el.remove()` on the `addAction` element does not desync Obsidian's pane-header bookkeeping (the assessment's low-risk concern). If it does, fall back to `el.hide()`/`el.show()` (the alternative in the assessment).
