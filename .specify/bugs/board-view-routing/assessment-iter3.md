# Bug Assessment: View-switch button missing in native Markdown view after switching from board view

- **Slug**: board-view-routing
- **Created**: 2026-10-24
- **Source**: pasted text
- **Verdict**: valid
- **Severity**: high
- **Iteration**: 3 (supersedes `assessment-iter2.md`; the iteration-2 fix resolved the empty panel, dead menu, and button-on-non-board defects, but exposed this new defect)

## Report (verbatim)

> W notatce tablicy (z `usm-board: true`) kiedy przełączę tryb widoku na natywny edytor/podgląd md, nie mam możliwości powrotu do wizualnego trybu tablicy. Przycisk zmiany trybu w trybie tablicy wywołuje custom menu z 3 opcjami do wyboru, natomiast w trybie natywnego edytora pomimo, że notatka ma atrybut `usm-board: true`, przycisk zmiany trybu jest natywnym przyciskiem uwzględniającym tylko dwa natywne tryby.
>
> Spodziewane działanie: Kiedy notatka ma atrybut `usm-board: true` na wszystkich trybach widoku notatki, przycisk reaguje tak samo, czyli wyświetla menu z listą trzech opcji tak jak to teraz ma miejsce w trybie wizualnego widoku usm-board.

## Symptom

When a board note (`usm-board: true`) is in the native Markdown view (source or preview mode), the view-switch button in the pane header is the **native** Obsidian source/preview toggle (2 options), not the plugin's custom 3-option menu. The user cannot switch back to the board view from the native Markdown view. The plugin's button only appears in the board view itself.

## Reproduction

1. Build and install the plugin; enable it.
2. Open a board note (`usm-board: true`) — it renders in the map view (works).
3. Click the plugin's view-switch button (icon `columns-2`, tooltip "Change view") in the pane header.
4. Select "Edit MD" (or "View MD") from the 3-option menu.
5. The leaf switches to the native Markdown view (source or preview mode).
6. **Observed**: the view-switch button in the pane header is now the **native** Obsidian source/preview toggle (2 options: source/preview), not the plugin's 3-option menu.
7. **Expected**: the plugin's 3-option menu should still be present, allowing the user to switch back to the board view.

## Suspected Code Paths

- `src/obsidian/board-view.ts:521` — `registerBoardViewRouting(plugin)` — registers the `file-open` handler that calls `ensureViewSwitchActionForLeaf`. This is the **only** place where the button is added to the native `MarkdownView`.
- `src/obsidian/board-view.ts:789` — `ensureViewSwitchActionForLeaf(app, file)` — adds the button to the `MarkdownView` if the file is a board note. Called **only** from the `file-open` handler.
- `src/obsidian/board-view.ts:695` — `restoreView(leaf, file, view)` — switches the leaf's view state via `setViewState`. When switching from board view to Markdown view, this is called with `view = 'edit'` or `'preview'`.
- `src/obsidian/board-view.ts:165` — `BoardView.ensureViewSwitchAction()` — adds the button to the board view in `onload`. This works correctly (the button is present in the board view).

## Root Cause Hypothesis

**High confidence.** The `file-open` event in Obsidian fires **only when the active file changes** (confirmed by bundle analysis of `obsidian.asar` at offset 3699715: `t!=n && ... trigger("file-open",n)` where `t` is the previous active file and `n` is the new active file). When the user switches the view type (board → Markdown) via `setViewState`, the **file does not change** — only the view type changes. Therefore, `file-open` **does not fire**, and `ensureViewSwitchActionForLeaf` is **never called** for the new `MarkdownView`. The button is never added.

The `active-leaf-change` event, on the other hand, fires on **every change of the active leaf**, including view-type switches (confirmed by bundle analysis at offset 3699551: `activeLeafEvents()` → `trigger("active-leaf-change",e)`, and at offset 2303060: `setViewState` calls `requestActiveLeafEvents()` after loading the new view). This event is the correct trigger for ensuring the button is present after a view-type switch.

## Proposed Remediation

**Preferred**: Add an `active-leaf-change` listener in `registerBoardViewRouting` that calls `ensureViewSwitchActionForLeaf` with the active file. This ensures the button is added to the `MarkdownView` whenever the active leaf changes, including view-type switches. The `file-open` listener should remain (it handles the initial open case and is needed for the routing logic in `handleBoardFileOpen`).

The `active-leaf-change` handler should:
1. Get the active file from `app.workspace.getActiveFile()`.
2. If the file is not null, call `ensureViewSwitchActionForLeaf(app, file)`.
3. **Not** call `handleBoardFileOpen` (the routing logic is already handled by the `file-open` listener; calling it from `active-leaf-change` would cause unwanted view switches on tab re-activation).

The `ensureViewSwitchActionForLeaf` function is already idempotent (guarded by `markdownViewsWithSwitchAction` WeakSet), so calling it multiple times is safe.

**Alternatives**:
- *Call `ensureViewSwitchActionForLeaf` from `BoardView.switchView` after `restoreView`.* Rejected: this only handles the case where the user switches from the board view; it does not handle the case where the user switches from the Markdown view back to the board view (the button would still be missing in the Markdown view if the user navigates away and back).
- *Use a `layout-change` listener instead of `active-leaf-change`.* Rejected: `layout-change` fires on layout changes (splitting, closing, etc.), not on view-type switches. `active-leaf-change` is the correct event.

**Files likely to change**:
- `src/obsidian/board-view.ts` (`registerBoardViewRouting` — add `active-leaf-change` listener)
- `tests/integration/view-routing.test.ts` (add a test for the button being added after a view-type switch)

**Tests to add or update**:
- A test asserting that `ensureViewSwitchActionForLeaf` is called when `active-leaf-change` fires (pins the fix).
- A test asserting that the button is added to the `MarkdownView` after a view-type switch from the board view (pins the user-visible behavior).
- Keep the existing tests green (retry, tab-activation no-op, button-once, Defect 1/2a/2b).

## Risks & Considerations

- **Event timing.** The `active-leaf-change` event fires after the new view is loaded (confirmed by bundle analysis: `setViewState` calls `requestActiveLeafEvents()` after loading the view). The `MarkdownView` should be ready to accept `addAction` at this point. However, if the view is not yet ready, the `addAction` call may fail silently. The existing `ensureViewSwitchActionForLeaf` function already handles this by checking `findLeafWithFile` (which returns null if the leaf is not registered yet).
- **Duplicate button.** The `ensureViewSwitchActionForLeaf` function is idempotent (guarded by `markdownViewsWithSwitchAction` WeakSet), so calling it from both `file-open` and `active-leaf-change` will not duplicate the button.
- **Performance.** The `active-leaf-change` event fires on every tab switch and view-type switch. The `ensureViewSwitchActionForLeaf` function is lightweight (it checks the WeakSet and returns early if the button is already present), so the performance impact is negligible.
- **Scope discipline.** The fix only adds the button to board notes (the `isBoardFileContent` check in `ensureViewSwitchActionForLeaf` ensures this). Non-board notes are unaffected.
- **No content mutation.** The fix does not introduce any board-file writes; it only adds a UI element.

## Open Questions

- [NEEDS CLARIFICATION: Should the `active-leaf-change` handler also call `handleBoardFileOpen` to handle the case where the user switches to a board note from a non-board note via a view-type switch? The current `file-open` handler already handles the initial open case, but a view-type switch from a non-board note to a board note (if possible) would not be caught. However, this scenario is unlikely in practice, as the user would need to manually switch the view type of a non-board note to the board view, which is not possible via the UI.]
