# Bug Assessment: Duplicate view-switch buttons in native Markdown view for board notes

- **Slug**: board-view-routing
- **Created**: 2026-10-24
- **Source**: pasted text
- **Verdict**: valid
- **Severity**: medium
- **Iteration**: 4 (supersedes `assessment-iter3.md`; the iteration-3 fix resolved the missing-button defect but exposed this new one)

## Report (verbatim)

> Po teście manualnym zauważyłem jeszcze jeden problem – w notatce z atrybutem `usm-board: true`, kiedy przełączę się na natywny tryb edycji/podglądu, widzę teraz dwa przyciski przełączania trybu widoku: 1. przycisk dostarczany przez plugin, 2. przycisk natywny. Jeśli jest wyświetlany przycisk pluginu, przycisk natywny powinien być niewidoczny, aby nie dezorientować użytkownika.

## Symptom

After the iteration-3 fix, a board note (`usm-board: true`) in the native Markdown view (source or preview mode) shows **two** view-switch buttons in the pane header: (1) the plugin's 3-option menu button (icon `columns-2`, tooltip "Change view") and (2) Obsidian's **native** source/preview toggle (icon `lucide-book-open` / `lucide-edit-3`). The two buttons overlap in purpose (both switch the view), which is confusing. Expected: when the plugin's button is present, the native toggle should be hidden.

## Reproduction

1. Build and install the plugin (with the iteration-3 fix); enable it.
2. Open a board note (`usm-board: true`) — it renders in the map view.
3. Click the plugin's view-switch button → select "Edit MD" (or "View MD").
4. The leaf switches to the native Markdown view.
5. **Observed**: the pane header now shows **two** buttons — the plugin's `columns-2` menu button **and** the native source/preview toggle.
6. **Expected**: only the plugin's button should be visible; the native toggle should be hidden.

## Suspected Code Paths

- `src/obsidian/board-view.ts:814` — `ensureViewSwitchActionForLeaf(app, file)` — adds the plugin's button to the native `MarkdownView` via `view.addAction(...)` (line 842). This is where the native toggle should also be hidden, because this is the only place the plugin knows it has added its own button to a given `MarkdownView`.
- `src/obsidian/board-view.ts:74` — `markdownViewsWithSwitchAction` (`WeakSet<MarkdownView>`) — tracks which `MarkdownView` instances already have the plugin's button. The hide/show logic should be keyed off the same set.
- `src/obsidian/board-view.ts:556` — the `active-leaf-change` listener (iteration-3 fix) — calls `ensureViewSwitchActionForLeaf` on every active-leaf change. This is the natural hook to **re-evaluate** the native toggle's visibility when the active file changes (a `MarkdownView` may later show a non-board file, in which case the native toggle must be restored).
- Obsidian bundle (1.14.5, `obsidian.asar`): the native toggle is `MarkdownView.modeButtonEl`, created in the `MarkdownView` constructor (offset 3856502): `n.modeButtonEl=n.addAction("lucide-book-open","",n.onSwitchView.bind(n))`. It is a **stable** property (created once per view instance, never re-created), and `updateButtons()` (offset 3861117) only updates its icon/tooltip. **`modeButtonEl` is NOT in `obsidian.d.ts`** — it is an internal property.

## Root Cause Hypothesis

**High confidence.** The iteration-3 fix added the plugin's button to the native `MarkdownView` (via `addAction`) but did not hide Obsidian's own source/preview toggle (`modeButtonEl`). Both buttons now coexist in the pane header. The native toggle is a stable `HTMLElement` on the `MarkdownView` instance, so it can be hidden with `modeButtonEl.hide()` (or `style.display = 'none'`) and restored with `modeButtonEl.show()`. Because `modeButtonEl` is not in the public type definitions, the access must be done through a typed, defensive helper (a cast to a minimal structural type, guarded by an `instanceof`/`in` check) so the code stays strict-mode clean and does not crash if Obsidian renames the property in a future version.

The hide/show must be **dynamic**, not one-shot: a `MarkdownView` instance can later display a non-board file (the user navigates away and back), in which case the plugin's button is inert (the click handler re-checks `isBoardFileContent`) and the native toggle must be **restored** so the user still has a way to switch source/preview. Conversely, when the view shows a board file, the native toggle must be hidden. The `active-leaf-change` listener (which already fires on every active-leaf change and calls `ensureViewSwitchActionForLeaf`) is the right place to re-evaluate visibility.

## Proposed Remediation

**Preferred**: Introduce a small, typed helper in `board-view.ts` that hides or shows the native `MarkdownView` mode toggle, and call it from `ensureViewSwitchActionForLeaf` (after the board check) and from the `active-leaf-change` path so the visibility tracks the active file.

Concretely:

1. Add a helper `setNativeModeToggleVisible(view: MarkdownView, visible: boolean): void` that:
   - Reads the native toggle element via a defensive, typed access: `(view as unknown as { modeButtonEl?: HTMLElement }).modeButtonEl`.
   - If the element is missing (future Obsidian rename), no-ops silently (no crash).
   - Calls `element.hide()` / `element.show()` (Obsidian's `HTMLElement` extension) or falls back to `style.display = 'none'` / `''` if `hide`/`show` are unavailable.
2. In `ensureViewSwitchActionForLeaf`, after the async `isBoardFileContent` check confirms the file is a board note and the plugin's button is added, call `setNativeModeToggleVisible(view, false)`.
3. In the `active-leaf-change` listener (or a shared re-evaluation function it calls), for the active `MarkdownView`, re-check `isBoardFileContent` for the view's **current** file and call `setNativeModeToggleVisible(view, !isBoard)` — so the native toggle is restored when the view shows a non-board file and hidden when it shows a board file. This keeps the visibility correct across navigation without depending on the one-shot `ensureViewSwitchActionForLeaf` path.
4. Keep the `markdownViewsWithSwitchAction` `WeakSet` as the source of truth for "the plugin's button is present on this view"; the native-toggle visibility is derived from it plus the current file's board status.

**Alternatives**:
- *Hide the native toggle via CSS in `styles.css`* (e.g. a class on the view's container that targets the mode button). Rejected: the plugin does not control a stable class on the `MarkdownView` container, and a global CSS selector targeting Obsidian's internal button is brittle and could leak to non-board notes.
- *Remove the native toggle entirely* (`modeButtonEl.remove()`). Rejected: it is not restorable (Obsidian does not re-create it), so a `MarkdownView` that later shows a non-board file would lose its source/preview toggle permanently. Hiding/showing is the safe, reversible approach.

**Files likely to change**:
- `src/obsidian/board-view.ts` (add `setNativeModeToggleVisible` helper; call it from `ensureViewSwitchActionForLeaf` and the `active-leaf-change` re-evaluation path)
- `tests/integration/view-routing.test.ts` (add tests for the hide/show behavior)
- `tests/helpers/obsidian-stub.ts` (the `MarkdownView` stub needs a `modeButtonEl` property so the helper can be exercised in tests)

**Tests to add or update**:
- A test asserting that when `ensureViewSwitchActionForLeaf` adds the plugin's button to a `MarkdownView` showing a board file, the native `modeButtonEl` is hidden.
- A test asserting that when the active file changes to a non-board file (via the `active-leaf-change` path), the native `modeButtonEl` is restored (shown).
- A test asserting that the helper no-ops safely when `modeButtonEl` is absent (future-obsidian rename resilience).
- Keep the existing tests green (retry, tab-activation no-op, button-once, Defect 1/2a/2b/3).

## Risks & Considerations

- **Internal API access.** `modeButtonEl` is not in `obsidian.d.ts`; accessing it requires a cast. The defensive helper (structural type + `in`/optional check + silent no-op) mitigates the risk that a future Obsidian version renames or removes the property — the worst case is the native toggle stays visible (the original cosmetic issue), not a crash.
- **Reversibility.** Hiding (not removing) is essential so the native toggle can be restored when the view later shows a non-board file. The `active-leaf-change` re-evaluation guarantees this.
- **Timing.** The native toggle is created in the `MarkdownView` constructor, so it exists before `ensureViewSwitchActionForLeaf` runs (which happens on `file-open` / `active-leaf-change`, after the view is loaded). No race is expected, but the helper's silent no-op covers the edge case where the element is not yet present.
- **Scope discipline.** The change only affects `MarkdownView` instances showing board notes; non-board notes keep the native toggle and never get the plugin's button (Defect 2b behavior is preserved).
- **No content mutation.** The change only toggles the visibility of a header button; it does not write to the board file.

## Open Questions

- [NEEDS CLARIFICATION: Should the native toggle be hidden in the **board view** as well? No — the board view is a custom `FileView` that does not have a `modeButtonEl` (it is a `MarkdownView`-specific property), so there is nothing to hide there. The defect is specific to the native `MarkdownView`.]
- [NEEDS CLARIFICATION: Is there a public Obsidian API to hide the mode toggle? No — `modeButtonEl` is internal. The defensive-cast approach is the only viable option without a public API.]
