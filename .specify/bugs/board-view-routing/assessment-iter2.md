# Bug Assessment: Board view leaks into non-board notes + view-switch button non-functional

- **Slug**: board-view-routing
- **Created**: 2026-10-24
- **Source**: pasted text
- **Verdict**: valid
- **Severity**: high
- **Iteration**: 2 (supersedes `assessment-iter1.md`; the iteration-1 fix resolved the first-open routing race but introduced/exposed the two defects below)

## Report (verbatim or summarized)

> 1. Wizualny podgląd tablicy włącza się poprawnie, lepiej niż wcześniej, przełączanie zakładek nie powoduje przełączania trybów — to dobrze. Jednak po przejściu z notatki z graficznym widokiem tablicy usm, kiedy wchodzę w inne zwykłe notatki md, zamiast edytora lub podglądu widzę tylko pusty panel. Żadnych przycisków, tekstów. Muszę wtedy wejść w notatkę typu np. Canvas lub inny niestandardowy, kiedy przechodzę do notatki md, natywne widoki podglądu i edycji zaczynają działać poprawnie. Wizualny tryb USM board pluginu nie może blokować natywnych trybów edycji i podglądu, ani innych trybów dostarczanych przez inne pluginy. Plugin operuje tylko w obrębie notatek z atrybutem `usm-board: true`.
>
> 2. Na graficznym podglądzie USM jest teraz przycisk zmiany widoku, ale po kliknięciu nic się nie dzieje. Jest również osobny przycisk … menu kontekstowego, który wyświetla podstawowe funkcje podziału w pionie i w poziomie. Na widokach innych notatek md bez atrybutu `usm-board` pojawił się dodatkowy przycisk zmiany widoku, ale nic się nie dzieje po jego naciśnięciu.
>
> Spodziewane zachowanie: po naciśnięciu przycisku zmiany widoku na notatce z atrybutem `usm-board: true`, zobaczę możliwość wyboru widoku z trzema opcjami (na tym etapie etykiety poglądowo): Wizualna tablica USM, Tryb edycji źródła i Tryb podglądu markdown. Można do tego wykorzystać tego typu rozwijne menu używane w Obsidian w natywnym podglądzie kanban. Na notatkach bez atrybutu `usm-board` nie chcę widzieć możliwości zmiany widoku do usm-board — powinna być natywna kontrolka Obsidian przełączająca pomiędzy dwoma natywnymi trybami.

## Symptom

Two distinct defects, both regressions/exposures from the iteration-1 fix:

1. **Board view leaks into non-board notes (empty panel).** Navigating from a board note (rendered in the plugin's `usm-board-view`) to a regular `.md` note shows an **empty panel** (no editor, no preview, no controls). Opening an unrelated view type (e.g. Canvas) and then returning to the `.md` note restores the native editor/preview. The plugin's board view must not block native edit/preview or other plugins' views; it must operate only on `usm-board: true` notes.

2. **View-switch button is non-functional and appears on non-board notes.** The dedicated view-switch button (added by iteration 1) does **nothing** when clicked — on board notes *and* on non-board notes. It also **appears on non-board notes**, where it should not exist (non-board notes should keep only Obsidian's native source/preview toggle).

## Reproduction

**Defect 1 (empty panel):**
1. Build and install the plugin; enable it.
2. Open a board note (`usm-board: true`) — it renders in the map view (works).
3. With the board note active, click a **regular** `.md` note (no `usm-board` attribute) in the file explorer.
4. **Observed**: an empty panel — no editor, no preview, no text, no controls.
5. Open a Canvas (or any non-Markdown, non-board view), then click back to the regular `.md` note.
6. **Observed**: the native editor/preview now renders correctly.

**Defect 2 (button non-functional / on non-board notes):**
1. Open a board note (`usm-board: true`) in the map view.
2. Click the dedicated view-switch button (icon `columns-2`, tooltip "Change view") in the pane header.
3. **Observed**: nothing happens (no menu appears).
4. Open a regular `.md` note (no `usm-board`).
5. **Observed**: the view-switch button is present in the pane header (it should not be).
6. Click it.
7. **Observed**: nothing happens.

## Suspected Code Paths

- `src/obsidian/board-view.ts` — `BoardView.canAcceptExtension(ext)` (returns `ext === 'md'`) — **Defect 1**. The board view claims it can accept *every* `.md` file, so Obsidian reuses the `usm-board-view` leaf when opening a regular `.md` note; `BoardView.render()` then finds the file is not a board and calls `cleanupRender()`, leaving an empty panel.
- `src/obsidian/board-view.ts` — `BoardView.render()` / `cleanupRender()` — **Defect 1** (symptom site). Renders nothing for non-board files, which is correct *only if* the board view is never shown a non-board file.
- `src/obsidian/board-view.ts` — `showViewSwitchMenu(evt, current, onSelect)` (uses `new Menu().showAtMouseEvent(evt)` without `load()`) — **Defect 2a**. The menu is positioned but never loaded/shown, so clicking the button does nothing.
- `src/obsidian/board-view.ts` — `ensureViewSwitchActionForLeaf(app, file)` (adds the button to any `MarkdownView` without checking `isBoard`) — **Defect 2b**. Called on every `file-open`, so non-board notes get the button.
- `src/obsidian/board-view.ts` — `registerBoardViewRouting(plugin)` (calls `ensureViewSwitchActionForLeaf` + `handleBoardFileOpen` on every `file-open`) — **Defect 2b** (call site that makes the button leak to all notes).
- `src/obsidian/board-view.ts` — `BoardView.ensureViewSwitchAction()` (the board view's own button) — **Defect 2a** (shares the broken `showViewSwitchMenu`).

## Root Cause Hypothesis

**Defect 1 — the board view claims all `.md` files (high confidence).** `BoardView.canAcceptExtension` returns `true` for `ext === 'md'`. Obsidian's leaf-selection logic uses `canAcceptExtension` to decide whether an *existing* leaf can be reused to open a file. Because the board view accepts every `.md` file, when the user navigates from a board note to a regular `.md` note, Obsidian reuses the `usm-board-view` leaf and calls `BoardView.onLoadFile(regularFile)`. `render()` then sees the file is not a board and empties the content — producing the empty panel. Opening a Canvas (a view type the board view cannot be) forces Obsidian to use a different leaf, which is why returning to the `.md` note then works. The board view should only ever be the target for board notes; since `canAcceptExtension` receives only the extension (not the file), it cannot distinguish board from non-board `.md` files, so it must not claim `.md` files at all — board notes are routed into the board view by the existing `file-open` handler (`handleBoardFileOpen` → `restoreView` → `setViewState`), which already works.

**Defect 2a — the view-switch menu is never loaded (high confidence).** `showViewSwitchMenu` builds the menu with `new Menu().showAtMouseEvent(evt)`. In Obsidian, `Menu` extends `Component`; `showAtMouseEvent` only positions the menu, it does **not** call `load()`. Without `load()`, the menu is never displayed, so clicking the button does nothing. The iteration-1 fix replaced `Menu.forEvent(evt)` (which loads and shows the menu, but requires Obsidian 1.6.0) with `new Menu().showAtMouseEvent(evt)` to satisfy the `minAppVersion` 1.1.0 lint rule — but dropped the `load()` step in the process. `Component.load()` is available since 0.9.7 (below `minAppVersion`), so the fix is to call `load()` before `showAtMouseEvent`.

**Defect 2b — the button is added to every Markdown view (high confidence).** `registerBoardViewRouting` calls `ensureViewSwitchActionForLeaf(app, file)` on **every** `file-open`, and `ensureViewSwitchActionForLeaf` adds the button to any `MarkdownView` it finds, without checking whether the file is a board note. So non-board notes get the button. The button's click callback does check `isBoardFileContent` and returns early for non-board files (which is why clicking it on a non-board note does nothing even if the menu worked), but the button should not be *added* in the first place.

## Proposed Remediation

**Preferred:**

- **Defect 1 — stop the board view from claiming non-board `.md` files.** Change `BoardView.canAcceptExtension` to return `false` (the board view should never be the leaf-reuse target for a file open). Board notes still open in the board view because the existing `file-open` routing (`handleBoardFileOpen` → `restoreView` → `leaf.setViewState({ type: BOARD_VIEW_TYPE, … })`) switches the leaf after the note opens in the default Markdown view. This keeps the plugin scoped to `usm-board: true` notes and stops it from hijacking regular `.md` files (and, by extension, from interfering with other plugins' views).
  - *Verification needed*: confirm that `leaf.setViewState({ type: BOARD_VIEW_TYPE, … })` is not gated by `canAcceptExtension` (it is a direct state change and is expected to bypass it; the iteration-1 routing already relies on it and the user confirms the board view opens correctly).

- **Defect 2a — actually show the view-switch menu.** In `showViewSwitchMenu`, create the menu, call `menu.load()`, then `menu.showAtMouseEvent(evt)` (i.e. replicate what `Menu.forEvent` does, using only APIs available since ≤ 1.1.0). This makes the button open the three-option menu on board notes.

- **Defect 2b — only add the button to board notes.** In `ensureViewSwitchActionForLeaf`, guard the `addAction` call so the button is added only when the file is a board note. Because the metadata cache may not have indexed the frontmatter on the first open, use the existing async `isBoardFileContent(app, file)` check (cache + `vault.read` fallback) rather than the sync cache-only check; make the guard async (fire-and-forget from the `file-open` handler) and keep the `WeakSet<MarkdownView>` dedupe so the button is added at most once per view instance. Non-board notes then keep only Obsidian's native source/preview toggle, as the reporter requires.

**Alternatives:**
- *Defect 1 — keep `canAcceptExtension('md') === true` and instead make `BoardView.render()` fall back to a native Markdown view for non-board files.* Rejected: a `FileView` cannot "become" the native Markdown view from within `render()`; the clean fix is to not claim the file in the first place.
- *Defect 2a — use a custom dropdown (like the Kanban plugin's) instead of `Menu`.* The reporter referenced the Kanban dropdown as a UI hint, but a working `Menu` satisfies the stated requirement (three options, current checked). A custom dropdown is a larger change and can be a follow-up if the `Menu` UX is deemed insufficient.
- *Defect 2b — add the button to all Markdown views but hide it for non-board files via DOM.* Rejected: the action element is owned by Obsidian's header and is not cleanly hideable; not adding it is simpler and matches the requirement.

**Files likely to change:**
- `src/obsidian/board-view.ts` (`canAcceptExtension`, `showViewSwitchMenu`, `ensureViewSwitchActionForLeaf`, and the `registerBoardViewRouting` call site if the guard becomes async)
- `tests/integration/view-routing.test.ts` (extend with the new behaviors)
- Possibly `specs/001-user-story-map/spec.md` / `research.md` / `quickstart.md` if the "button only on board notes" scoping needs to be made explicit (FR-027 already implies it; likely a doc clarification only).

**Tests to add or update:**
- A test asserting `BoardView.canAcceptExtension('md')` returns `false` (pins the Defect 1 fix — the board view must not claim `.md` files for leaf reuse).
- A test asserting `ensureViewSwitchActionForLeaf` does **not** add the button to a `MarkdownView` showing a non-board file (pins Defect 2b).
- A test asserting `ensureViewSwitchActionForLeaf` **does** add the button to a `MarkdownView` showing a board file (pins the positive case for Defect 2b).
- A test asserting `showViewSwitchMenu` calls `Menu.load()` before `showAtMouseEvent` (pins Defect 2a) — e.g. by spying on the `Menu` prototype or asserting the menu is loaded.
- Keep the existing iteration-1 tests (retry, tab-activation no-op, button-once) green.

## Risks & Considerations

- **`setViewState` independence from `canAcceptExtension` (Defect 1).** The fix relies on `leaf.setViewState({ type: BOARD_VIEW_TYPE, … })` working even when `canAcceptExtension` returns `false`. This is expected (a direct state change bypasses the file-open leaf-selection gate) and the iteration-1 routing already depends on it, but it must be verified on a live Obsidian 1.14.5 vault — if it is gated, board notes would no longer open in the board view and the fix would need rework.
- **First-open cache race (Defect 2b).** The "is this a board note" guard must tolerate the metadata cache not having indexed the frontmatter yet; using the async `isBoardFileContent` (cache + `vault.read` fallback) avoids missing the button on the first open. The async guard must not add the button twice (keep the `WeakSet` dedupe) and must not add it after the view has moved to a non-board file.
- **Menu lifecycle (Defect 2a).** `Menu` is a `Component`; calling `load()` without a matching `unload()` could leak. `Menu` self-unloads when closed (it is a `CloseableComponent`), so a single `load()` per click is safe, but the fix should not retain references to the menu.
- **Scope discipline.** The plugin must operate only on `usm-board: true` notes. Both fixes reinforce this: the board view no longer claims non-board files, and the button no longer appears on non-board notes.
- **No content mutation.** Neither fix introduces a board-file write; the only sanctioned write remains the `usm-view` attribute (FR-026/FR-028).
- **Version drift.** Runtime is Obsidian 1.14.5, type definitions are 1.12.3. `canAcceptExtension`, `setViewState`, `Menu.load()`, and `showAtMouseEvent` are all stable and available since ≤ 1.1.0, but the fix should be verified on 1.14.5 specifically.

## Open Questions

- [NEEDS CLARIFICATION: Is a working `Menu` (three options, current checked) sufficient for the view-switch UI, or does the reporter require the Kanban-style dropdown control specifically? The stated requirement is met by a working `Menu`; the Kanban reference is treated as a UI hint.]
- [NEEDS CLARIFICATION: For non-board notes, the reporter wants "the native Obsidian control switching between the two native modes" — confirm this means the existing native source/preview toggle (no plugin involvement), which is the default once the plugin stops adding its button.]
