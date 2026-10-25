# Bug Assessment: Inert plugin view-switch button persists when navigating from a board note (native mode) to a non-board note

- **Slug**: board-view-routing
- **Created**: 2026-10-25
- **Source**: pasted text (live-vault manual check, iteration-4 verification)
- **Verdict**: valid
- **Severity**: medium
- **Iteration**: 5 (supersedes `assessment-iter4.md`; the iteration-4 fix resolved the duplicate-buttons defect — confirmed fixed on the live vault — but the live check surfaced this new one)

## Report (verbatim)

Live-vault manual check (run by the user after `npm run deploy`, iteration-4 verification):

> Ad. 1 ok
> Ad. 2 ok
> Ad. 3 ok
> Ad. 4 i 5
> A. Notatka tablicy w trybie tablicy i wychodzę do notatki nie-tablicy jest tylko natywny przycisk zmiany trybu widoku – poprawnie.
> B. Notatka tablicy w trybie natywnym edycja/podgląd i wychodzę do notatki nie-tablicy jest są dwa przyciski pierwszy przycisk to przycisk pluginu (kiedy klikam nie pojawia się menu), drugi natywny (działa) – niepoprawnie, powinien być tylko przycisk natywny.

Translation of the failing case (Ad. 4B/5): a board note in native edit/preview mode (plugin button present) → navigate to a non-board note in the same tab → **two** buttons appear: (1) the plugin's button, which is **inert** (clicking it shows no menu), and (2) the native toggle, which **works**. Expected: only the native toggle.

## Symptom

When a `MarkdownView` that is showing a board note (and therefore has the plugin's view-switch button, with the native toggle hidden per the iteration-4 fix) is navigated to a **non-board** note in the same tab, the pane header shows **two** view-switch buttons: the plugin's `columns-2` button (inert — its click handler re-checks `isBoardFileContent` and bails, so no menu appears) and the native source/preview toggle (correctly restored by `syncNativeModeToggle`). Expected: only the native toggle — the plugin's button should be removed (or at least hidden) when the view no longer shows a board note.

## Reproduction

1. Build, deploy, and enable the plugin (iteration-4 code).
2. Open a board note (`usm-board: true`) — it renders in the map view.
3. Click the plugin's view-switch button → select "Edit MD" (or "View MD"). The leaf switches to the native Markdown view; the plugin's button is present and the native toggle is hidden (iteration-4 behavior — confirmed working, Ad. 1–3).
4. In the **same tab**, open a **non-board** note (e.g. click a link or select another note that replaces the content of the active leaf).
5. **Observed**: the pane header shows **two** buttons — the inert plugin `columns-2` button (click → no menu) **and** the native source/preview toggle (functional).
6. **Expected**: only the native toggle; the plugin's button should be gone.

Note: the variant where the board note is in the **board (map) view** when navigating away (Ad. 4A) is correct — the `BoardView` manages its own button and closes it on `onClose`, so only the native toggle remains. The defect is specific to the **native Markdown view** path, where the button is added to a long-lived `MarkdownView` instance.

## Suspected Code Paths

- `src/obsidian/board-view.ts:~74` — `markdownViewsWithSwitchAction` (`WeakSet<MarkdownView>`) — tracks which `MarkdownView` instances have the plugin's button. It is **add-only**: views are added in `ensureViewSwitchActionForLeaf` but **never removed**, and the set stores no reference to the button element, so the button cannot be removed later.
- `src/obsidian/board-view.ts:~868` — `ensureViewSwitchActionForLeaf(app, file)` — adds the plugin button **once** per `MarkdownView` (guarded by the WeakSet) via `view.addAction(VIEW_SWITCH_ICON, t('view.switch'), handler)`. The returned `HTMLElement` is **discarded** (not stored). The doc comment explicitly states the button is *"inert (does nothing) if the view later shows a non-board file"* — i.e. the design intent was inertness, not removal, but a visible inert button is the user's complaint.
- `src/obsidian/board-view.ts:~550` — the `active-leaf-change` handler (iteration-3 fix) — on every active-leaf change it calls `ensureViewSwitchActionForLeaf(app, file)` and, for a `MarkdownView`, `syncNativeModeToggle(app, view, file)`. `syncNativeModeToggle` correctly **restores** the native toggle for a non-board file, but **nothing removes or hides the plugin's button** — this is the gap.
- `src/obsidian/board-view.ts:~117,169,217` — `BoardView.viewSwitchActionEl` — the existing pattern to mirror: `BoardView` stores the element returned by `addAction` in a field and nulls it on `onClose`. The `MarkdownView` path has no equivalent stored reference.

## Root Cause Hypothesis

**High confidence.** The plugin's view-switch button is added to a `MarkdownView` exactly once (guarded by the `markdownViewsWithSwitchAction` WeakSet) and is **never removed**. Obsidian's `ItemView.addAction` has **no public `removeAction`**, and the code does not retain the `HTMLElement` that `addAction` returns, so there is no handle to remove the button later. When the same `MarkdownView` instance is reused to display a non-board file (the user navigates within the tab), the iteration-4 `syncNativeModeToggle` correctly restores the native toggle, but the plugin's button remains in the pane header. Its click handler re-checks `isBoardFileContent` against the *current* file and bails, so the button is inert — but it is still visible, producing the two-button state the user reports. This is a pre-existing gap in the iteration-2 "button-once" design (the button was meant to be inert, not removed); it became user-visible because the iteration-3 `active-leaf-change` listener makes the button get added in the board → native-view flow, and the iteration-4 fix makes the native-toggle restore work, so both buttons are now simultaneously present.

## Proposed Remediation

**Preferred**: Track the plugin button element per `MarkdownView` and **remove** it when the view's current file is not a board note.

1. Replace the add-only `WeakSet<MarkdownView>` with a `WeakMap<MarkdownView, HTMLElement>` (e.g. `markdownViewSwitchActionEls`) that maps each `MarkdownView` to the `HTMLElement` returned by `view.addAction(...)`. The map's presence still serves as the "button already added" guard (replacing the WeakSet's role), and it now also provides the handle needed to remove the button.
2. In `ensureViewSwitchActionForLeaf`, store the element: `const el = view.addAction(...); markdownViewSwitchActionEls.set(view, el);`.
3. In the `active-leaf-change` re-evaluation path (where `syncNativeModeToggle` already runs), when the view's current file is **not** a board note **and** the view has a plugin button, remove it: `el.remove(); markdownViewSwitchActionEls.delete(view);`. This leaves only the native toggle (which `syncNativeModeToggle` has just restored). When the file **is** a board note, keep the button and keep the native toggle hidden (existing iteration-4 behavior).
4. Keep the button's click-handler re-check of `isBoardFileContent` as a defensive no-op (it now rarely fires, since the button is removed for non-board files, but it guards against a race where the file changes between the event and the click).

This makes the button's lifecycle symmetric with the native toggle's: both are hidden/removed for non-board notes and present for board notes, and both track the active file via the same `active-leaf-change` hook.

**Alternatives**:
- *Hide the button instead of removing it* (store the element, call `el.hide()`/`el.show()` symmetric with the native toggle). Trade-off: simpler (no `remove()`), and symmetric with the iteration-4 native-toggle approach, but leaves a hidden DOM node in the pane header for as long as the `MarkdownView` lives, and a hidden-but-present button is slightly less clean than a removed one. Removal is preferred because the button is genuinely not needed for non-board notes and `addAction`'s element is a plain child of the view's header that is safe to remove.
- *Re-create the button on every board-file open* (remove-then-add). Trade-off: more churn and a visible flicker; rejected.

**Files likely to change**:
- `src/obsidian/board-view.ts` (replace the WeakSet with a `WeakMap<MarkdownView, HTMLElement>`; store the `addAction` return value; add a `removeViewSwitchAction(view)` helper; call it from the `active-leaf-change` path when the current file is non-board)
- `tests/integration/view-routing.test.ts` (add a test: board → non-board navigation removes the plugin button and leaves only the native toggle; update existing button-once tests that reference the WeakSet)
- `tests/helpers/obsidian-stub.ts` (the `FileView`/`MarkdownView` stub's `addAction` already returns an element; ensure the stub supports `el.remove()` — jsdom's `HTMLElement.remove()` exists natively, so likely no change)

**Tests to add or update**:
- A test asserting that after `ensureViewSwitchActionForLeaf` adds the button to a board `MarkdownView`, navigating the same view to a non-board file (via the `active-leaf-change` handler) **removes** the plugin button (the header no longer contains the `columns-2` action) and the native toggle is shown.
- A test asserting that navigating back to a board file re-adds the button and hides the native toggle again (full round-trip).
- Update the existing "button-once" tests (Defect 2b, button-once MarkdownView) that assert against the `markdownViewsWithSwitchAction` WeakSet to use the new `WeakMap` (or assert on the DOM presence of the action element instead).

## Risks & Considerations

- **No public `removeAction`.** The fix relies on `HTMLElement.remove()` on the element returned by `addAction`. This is a standard DOM operation and is safe (the element is a plain child of the view's header), but it is an internal-DOM manipulation — if Obsidian ever wraps the action element in a container it manages, a direct `remove()` could desync Obsidian's internal bookkeeping. Low risk (the element is a leaf action button), but worth a live check.
- **Re-adding after removal.** Once the button is removed and the view is dropped from the `WeakMap`, a later navigation back to a board file must re-add it. The `ensureViewSwitchActionForLeaf` guard (map presence) naturally allows this: after `delete(view)`, the next board-file `active-leaf-change` re-enters the add path. This must be tested (round-trip).
- **Timing / races.** The removal happens in the `active-leaf-change` handler, which fires after the view's file has changed. The button's click handler already re-checks `isBoardFileContent` at click time, so a brief window where the button is still present but the file is non-board is harmless (the click is a no-op). No new race is introduced.
- **Scope discipline.** The change only affects `MarkdownView` instances; `BoardView` already manages its own button (stored in `viewSwitchActionEl`, nulled on `onClose`) and is untouched. Non-board notes that never had the plugin button are unaffected.
- **No content mutation.** The change only adds/removes a header button; it does not write to the board file.

## Open Questions

- [NEEDS CLARIFICATION: Should the button be **removed** or **hidden** for non-board notes?] Removal is preferred (cleaner, no lingering hidden node) and is the proposed default; hiding is the fallback if `remove()` proves to desync Obsidian's header bookkeeping in a live check.
- [NEEDS CLARIFICATION: Does the same inert-button issue affect the **board (map) view** path?] No — `BoardView` stores its button in `viewSwitchActionEl` and nulls it on `onClose`, and Ad. 4A (board in map mode → non-board) was confirmed correct in the live check. The defect is specific to the native `MarkdownView` path.
