# Bug Assessment: Board note opens in Markdown view, not the map view

- **Slug**: board-view-routing
- **Created**: 2026-10-23
- **Source**: pasted text
- **Verdict**: valid
- **Severity**: high

## Report (verbatim or summarized)

> Aktualnie włączanie widoku graficznego tablicy ma problem. Kiedy klikam na liście notatek w Obsydian na notatkę tablicy `board.md` domyślnie wyświetla się ona jako zwykła notatka tekstowa w trybie edycji Obsydiana. Żeby wejść w tryb graficzny muszę kliknąć na inną kartę/zakładkę innej notatki u góry ekranu i z powrotem wrócić do notatki tablicy – wtedy wyświetla się jako tryb graficzny. W domyślnych trybach edycji i podglądu markdown obsidiana, nie widzę przycisku umożliwiającego uruchomienie trybu wizualnego tablicy, nawet wtedy kiedy notatka ma atrybut `usm-board: true`.
>
> Oczekiwane zachowanie:
> 1. Przełączanie się pomiędzy zakładkami różnych notatek nie może przełączać rodzajów widoków i trybów edycji.
> 2. Domyślnie, jeśli notatka ma atrybut `usm-board: true`, jest uruchamiana w trybie wizualnym tablicy dostarczanym przez plugin.
> 3. Jeśli notatka ma atrybut `usm-board: true`, to nawet w domyślnym trybie edycji markdown Obsidian widzę przycisk pozwalający na wybór trzech widoków (w tym wizualnego), tak jak to ma miejsce w trybie wizualnym tablicy.

## Clarifications (2026-10-23, from the reporter)

1. **Obsidian version**: 1.14.5 (Installer 1.14.5). Note: the project's `node_modules/obsidian` type definitions are 1.12.3 — the runtime API may differ.
2. **View-switch UX**:
   - The native Markdown editor's "…" menu shows the native tab/context menu (backlinks, read/source mode, split, rename, move, favorites, merge, add attribute, export PDF, find, replace, copy path, version history, linked view, open with default app, open in Finder, show in file browser, delete file). **This native menu should stay as-is.**
   - The reporter's fallback: in addition to the tab-management functions, the native menu has two items ("Tryb odczytu" / "Tryb źródłowy" = read/source mode) — a "Tryb tablicy USM" (USM board mode) item could be added there.
   - **Preferred**: a dedicated view-switch button that handles all three views (USM board / Edit MD / View MD), available in all three view states.
   - **Icon confusion**: in the map view, "…" currently shows the three view options (replacing the context menu); in the Markdown view, "…" shows the native context menu. The reporter wants "…" **reserved for the context menu**, and a **different icon** for view switching (e.g., an icon associated with the current preview/edit mode).
3. **Same-session reopen also fails**: closing the board note's tab and reopening it within the same session also opens it in the Markdown view, not the map view. This confirms the first-open failure is **systematic** (every fresh leaf creation), not a one-time metadata-cache race.

## Symptom

A board note (`usm-board: true`) opens in Obsidian's standard Markdown editor instead of the plugin's map view on **every fresh open** (first open after restart, and close-tab → reopen within the same session); it only renders as the map after the user activates another tab and returns. Additionally, while the note is in the standard Markdown editor/preview, there is no plugin-provided control to switch to the map view (the three-view switcher only exists in the map view's "…" menu, which conflicts with the context-menu convention).

## Reproduction

1. Build and install the plugin into a vault; enable it.
2. Create `board.md` with `usm-board: true` in the frontmatter (no `usm-view` attribute, so the default is `map`).
3. Click `board.md` in the file explorer (first open — the note is not already open in any tab).
4. **Observed**: the note opens in the standard Markdown editor (source mode), not the map view.
5. Click a different note's tab, then click back to `board.md`.
6. **Observed**: `board.md` now renders as the map view.
7. Close the `board.md` tab, then click `board.md` in the file explorer again (same session).
8. **Observed**: the note opens in the standard Markdown editor again, not the map view (same failure as step 4).
9. While `board.md` is in the Markdown editor (step 4/8 state), look for a control to switch to the map view.
10. **Observed**: no plugin-provided control is present in the Markdown editor/preview; the three-view switcher only appears in the map view's "…" menu.

[NEEDS CLARIFICATION: the exact Obsidian version/build of the reporter, and whether the pane-header "…" menu (as opposed to the right-click tab context menu) shows a native "Change view" entry that lists the board view.]

## Suspected Code Paths

- `src/obsidian/board-view.ts:registerBoardViewRouting()` — registers the `workspace.on('file-open')` handler that drives all view routing. The entire first-open behavior depends on this event firing at the right moment.
- `src/obsidian/board-view.ts:handleBoardFileOpen()` — the async routing body. Reads the config (with the direct-read fallback added for the metadata-cache race), then calls `findLeafWithFile` and `restoreView`. If `findLeafWithFile` returns `null` or `restoreView`'s `setViewState` is dropped, no switch happens.
- `src/obsidian/board-view.ts:findLeafWithFile()` — scans `getLeavesOfType('markdown')` + `getLeavesOfType(BOARD_VIEW_TYPE)` for a leaf whose `view.file === file`. On first open the newly created leaf may not yet satisfy this at the instant `file-open` fires.
- `src/obsidian/board-view.ts:restoreView()` — calls `leaf.setViewState({ type: BOARD_VIEW_TYPE, state: { file } })`. If the leaf's `MarkdownView` is still initializing when this runs, the state change can be ignored or overridden by Obsidian's own initialization.
- `src/obsidian/board-view.ts:onPaneMenu()` — the three-view switcher is implemented **only** on `BoardView`. The native `MarkdownView` (used for "Edit MD" / "View MD") is Obsidian's built-in view and cannot have its pane menu extended by the plugin, so no switcher exists while the note is in the Markdown view.
- `src/obsidian/main.ts:onload()` — `registerView(BOARD_VIEW_TYPE, …)` registers the map view; this is what makes the board view a candidate for the native "Change view" picker.

## Root Cause Hypothesis

Two distinct defects combine to produce the report.

**(1) Systematic leaf-readiness race on every fresh open (high confidence — confirmed by clarification #3).** The routing is driven by `workspace.on('file-open')`. On **every** fresh open of a board note (first open after restart, and close-tab → reopen within the same session), Obsidian creates a fresh leaf with a `MarkdownView` and fires `file-open` while that view is still initializing. At that instant, either `findLeafWithFile` does not yet match the new leaf (it is not yet registered / `view.file` not yet set) or `restoreView`'s `leaf.setViewState(...)` is issued before the leaf is ready to accept a view-type change and is dropped/overridden. Either way the switch to `usm-board-view` does not happen. When the user activates another tab and returns, `file-open` fires again against a fully-settled leaf, so the same code path now succeeds — which is exactly the "switch away and back" workaround the reporter describes. Note: the earlier fix (direct `vault.read` fallback in `handleBoardFileOpen`) addressed a *different* race (the metadata cache not having indexed the frontmatter) and does not address this leaf-readiness race, which is why the first-open failure persists.

**(2) No switcher in the Markdown view + icon convention conflict (high confidence).** The three-view switcher is implemented via `BoardView.onPaneMenu`, which places the options in the "…" menu. Two problems: (a) the "Edit MD" / "View MD" states are Obsidian's built-in `MarkdownView`, whose pane menu the plugin cannot extend, so no switcher exists while the note is in the Markdown view; (b) using "…" for view switching in the map view conflicts with the convention that "…" is the context menu (the reporter's "pomieszanie komunikatów"). The native "Change view" picker is not present/discoverable in Obsidian 1.14.5 for this use case (the reporter's "…" menu screenshot shows no "Change view" entry), so the plugin must provide its own switching surface.

## Proposed Remediation

**Preferred (for defect 1 — make first-open routing robust):** Stop relying on a single synchronous `file-open` → `setViewState` call. Make the routing tolerant of the leaf not being ready:
- In `handleBoardFileOpen`, after computing the desired view, if the leaf is not found or the current view is not yet the expected Markdown view, **defer and retry** the `setViewState` (e.g., a short bounded retry loop using `setTimeout`/`requestAnimationFrame`, or re-hooking the next `file-open`/`active-leaf-change` for that file) until the leaf is settled and the switch takes effect.
- Guard against the retry causing an unwanted switch on mere tab activation (expected behavior #1): only retry while the leaf's file is still the board file and the current view is still the default Markdown source view; stop as soon as the view matches `desiredView`.
- Keep the existing "persist on non-default switch" branch, but ensure it never fires as a side effect of the retry.

**Defect 2 — dedicated view-switch button available in all three view states (requires spec amendment):**
- **Spec amendment required**: FR-002 currently states "the plugin MUST NOT provide its own pane header icon or command palette command for this switching." The reporter is explicitly requesting a dedicated pane-header view-switch button. This requires amending FR-002 (and FR-027) to permit a dedicated view-switch button. **This is a requirements change and needs explicit approval before implementation.**
- **Remediation** (once approved):
  - Add a **dedicated view-switch button** to the pane header via `ItemView.addAction(icon, title, callback)`, using a dedicated icon (different from "…"), so "…" remains the context menu.
  - The button is available in **all three view states**:
    - **Map state** (`BoardView`): add the button in the view's constructor/`onload` (the plugin fully controls this view).
    - **Edit/Preview states** (native `MarkdownView`): the plugin grabs the `MarkdownView` instance (via `leaf.view`) and calls `addAction` on it to add the same button. Track added actions (e.g., a `WeakSet<MarkdownView>` or a marker property) to avoid duplicates when the routing runs multiple times for the same view instance.
  - The button's callback shows a menu with the three options (USM board / Edit MD / View MD), with the current one checked. Selecting an option switches the view (via `leaf.setViewState`) and persists `usm-view` (via `writeUsmView`).
  - Remove the current `onPaneMenu` approach (which put the three options in the "…" menu) and replace it with the dedicated button.
  - The button's icon: a dedicated "change view" icon (different from "…"). The reporter suggested an icon associated with the current mode (map/edit/preview); a consistent "change view" icon is simpler and still clear — the exact icon can be decided during implementation.

**Alternatives (defect 1):**
- *Defer the whole `handleBoardFileOpen` body by one tick* (`setTimeout(0)` / `requestAnimationFrame`) before reading the leaf and calling `setViewState`. Simpler than a retry loop, but less robust if the leaf needs more than one tick to settle.
- *Hook `active-leaf-change` in addition to `file-open`* to catch the settled state. Adds a second event source to keep in sync; more moving parts.

**Alternatives (defect 2):**
- *Monkey-patch the native `MarkdownView.onPaneMenu` to add a "Tryb tablicy USM" item to the native "…" menu* (the reporter's fallback): rejected — fragile (depends on Obsidian's internal menu structure), modifies a view the plugin doesn't own, and the reporter prefers the dedicated button.
- *Rely on the native "Change view" picker*: rejected — not present/discoverable in Obsidian 1.14.5 for this use case (confirmed by the reporter's screenshot).
- *Command-palette command*: rejected — the reporter wants a button, not a command; and FR-002's original intent was to avoid non-native switching affordances (now being amended).

**Files likely to change:**
- `src/obsidian/board-view.ts` (routing retry for defect 1; dedicated view-switch button + remove `onPaneMenu` for defect 2)
- `src/obsidian/main.ts` (possibly, if the `MarkdownView` action registration needs plugin-level coordination)
- `specs/001-user-story-map/spec.md` (FR-002, FR-027 amendment for defect 2)
- `specs/001-user-story-map/research.md` (R-14 view-picker presentation, R-16 view-switch detection — update)
- `specs/001-user-story-map/quickstart.md` (Q1 / Q1b — update the switcher location and first-open expectation)

**Tests to add or update:**
- A unit/integration test for `handleBoardFileOpen` that simulates a "leaf not ready on first `file-open`" condition and asserts the routing retries and eventually switches to `usm-board-view` (locking in the defect-1 fix).
- A test asserting that a mere tab re-activation (view already correct) does **not** trigger a view switch or a spurious `usm-view` write (locking in expected behavior #1).
- A test for `findLeafWithFile` covering the "leaf not yet registered" case.
- A test for the `MarkdownView` action: added once per view instance, not duplicated across multiple routing runs.

## Risks & Considerations

- **Retry loop correctness**: a naive retry could cause a visible flicker (Markdown → map) or fight the user if they quickly switch views. The retry must be bounded (e.g., ≤5 attempts, ~50 ms apart) and must stop the moment the view matches `desiredView` or the file changes.
- **Expected behavior #1 (no view switching on tab activation)**: any change to the `file-open` handler must be verified not to switch views when the user merely re-activates a tab whose view is already correct.
- **`addAction` on the native `MarkdownView`**: this is a use of the public API but is somewhat unusual (the plugin is adding a header action to a view it doesn't own). It must be robust to the view being recreated, to multiple board files, and to the action not being duplicated. The action is tied to the view's header DOM, so it is automatically removed when the view is destroyed.
- **Spec amendment (defect 2)**: amending FR-002/FR-027 is a requirements change that should be explicitly approved by the reporter before implementation. The amendment should preserve the original intent (no command-palette command, no content mutation) while permitting a dedicated pane-header view-switch button.
- **No content mutation**: any fix must preserve the invariant that the only board-file write is the `usm-view` attribute (FR-026/FR-028); the retry logic and the view-switch button must not introduce spurious writes.
- **Obsidian version drift**: the runtime is 1.14.5 but the type definitions are 1.12.3. The `addAction` and `setViewState` APIs are stable across these versions, but the fix should be verified on 1.14.5 specifically.

## Open Questions

- [RESOLVED: Obsidian version = 1.14.5]
- [RESOLVED: the "…" menu in the Markdown view is the native context menu and should stay as-is; the view switcher should be a dedicated button with a different icon]
- [RESOLVED: the first-open failure is systematic — it reproduces on close-tab → reopen within the same session, confirming a leaf-readiness race]
- [NEEDS APPROVAL: the spec amendment to FR-002/FR-027 (permitting a dedicated pane-header view-switch button) — requires the reporter's explicit sign-off before implementation]
