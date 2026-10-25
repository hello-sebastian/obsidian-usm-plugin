# Bug Fix: Board note opens in Markdown view, not the map view

- **Slug**: board-view-routing
- **Fixed**: 2026-10-23
- **Assessment**: ./assessment.md
- **Status**: applied

## Summary

Fixed both defects from the assessment. Defect 1 (systematic leaf-readiness race on every fresh open) is now handled by a bounded retry in the `file-open` routing: the switch to the map view is re-attempted (≤5 attempts, ~50 ms apart) until the leaf is ready, with early-stop guards so a mere tab re-activation never triggers a switch or a spurious `usm-view` write. Defect 2 (no switcher in the Markdown view + "…" icon conflict) is fixed by a dedicated pane-header view-switch button (`ItemView.addAction`, icon `columns-2`, tooltip "Change view") available in all three view states; the old `onPaneMenu` approach was removed and "…" remains the native context menu. The spec amendment (FR-002/FR-027) required for defect 2 was approved by the reporter (`napraw oba`) and applied.

## Changes

| File | Change | Notes |
|------|--------|-------|
| `src/obsidian/board-view.ts` | modified | Defect 1: `handleBoardFileOpen` → `routeBoardFileOpen` + `scheduleRouteRetry` (bounded retry, early-stop guards, `isBoardFileContent` re-check). Defect 2: removed `onPaneMenu`; added `ensureViewSwitchAction` (BoardView), `ensureViewSwitchActionForLeaf` (native MarkdownView, `WeakSet` dedupe), `showViewSwitchMenu` (`new Menu().showAtMouseEvent`), `currentView`; new constants `VIEW_SWITCH_ICON`/`ROUTE_MAX_ATTEMPTS`/`ROUTE_RETRY_DELAY_MS`; `findLeafWithFile` now exported. |
| `src/obsidian/main.ts` | modified | Updated the routing comment to reference the dedicated view-switch button (FR-027 amended) instead of the native picker. |
| `src/ui/en.ts` | modified | Added `view.switch` key ("Change view") for the button tooltip. |
| `specs/001-user-story-map/spec.md` | modified | FR-002 + FR-027 amended to permit a dedicated pane-header view-switch button (distinct icon, not "…"); no command-palette command. |
| `specs/001-user-story-map/research.md` | modified | R-14 (dedicated button via `addAction` in all 3 states; rejected alternatives) and R-16 (bounded retry for the leaf-readiness race) updated. |
| `specs/001-user-story-map/quickstart.md` | modified | Q1 added a close/reopen regression step; Q1b renumbered to use the dedicated view-switch button. |
| `tests/integration/view-routing.test.ts` | added | 5 tests locking in both defects (retry, tab-activation no-op, `findLeafWithFile` null, button-once for MarkdownView, button-once for BoardView). |

## Diff Highlights

Defect 1 — bounded retry with early-stop guards (no spurious switch/write on tab re-activation):

```ts
async function routeBoardFileOpen(app, file, attempt): Promise<boolean> {
  // read config (cache + vault.read fallback); if !isBoard → return true
  const desiredView = config.usmView;
  const leaf = findLeafWithFile(app, file);
  if (leaf === null) return scheduleRouteRetry(app, file, desiredView, attempt);
  const currentView = detectCurrentView(leaf.view);
  if (currentView === desiredView) return true;          // already correct → stop
  if (currentView === 'edit' || currentView === null) {
    restoreView(leaf, file, desiredView);                 // switch to map
    return scheduleRouteRetry(app, file, desiredView, attempt);
  }
  void writeUsmView(app, file, currentView);              // persist non-default
  return true;
}
```

Defect 2 — dedicated button on the native `MarkdownView`, deduped via `WeakSet`:

```ts
export function ensureViewSwitchActionForLeaf(app: App, file: TFile): void {
  const leaf = findLeafWithFile(app, file);
  if (leaf === null) return;
  const view = leaf.view;
  if (!(view instanceof MarkdownView) || markdownViewsWithSwitchAction.has(view)) return;
  markdownViewsWithSwitchAction.add(view);
  view.addAction(VIEW_SWITCH_ICON, t('view.switch'), async (evt) => {
    const currentFile = view.file;
    if (currentFile === null) return;
    if (!(await isBoardFileContent(app, currentFile))) return;
    const current = detectCurrentView(view) ?? 'edit';
    showViewSwitchMenu(evt, current, (chosen) => {
      restoreView(leaf, currentFile, chosen);
      void writeUsmView(app, currentFile, chosen);
    });
  });
}
```

## Tests Added or Updated

- `tests/integration/view-routing.test.ts` › "retries until the leaf is ready, then switches to the map view" — pins the defect-1 fix: with no leaf registered at first `file-open`, the routing retries and, once the leaf is ready, switches to `usm-board-view` via `setViewState` (and performs no spurious `usm-view` write).
- `tests/integration/view-routing.test.ts` › "does not switch or write on a mere tab re-activation (view already correct)" — pins expected behavior #1: a re-activation of a tab already in the correct view triggers no `setViewState` and no `vault.process` write.
- `tests/integration/view-routing.test.ts` › "findLeafWithFile returns null when no leaf is registered" — pins the "leaf not yet registered" case.
- `tests/integration/view-routing.test.ts` › "adds the button to the native Markdown view once (no duplicate)" — pins defect 2: `addAction` is called exactly once per `MarkdownView` instance across repeated `file-open` events.
- `tests/integration/view-routing.test.ts` › "adds the button to the board view once (no duplicate)" — pins defect 2: the `BoardView` adds the button exactly once across repeated `onload` calls.

## Local Verification

- Commands run:
  - `npx tsc --noEmit -skipLibCheck` → clean (no type errors).
  - `npm run lint` → 0 errors (34 pre-existing warnings, none introduced by this change).
  - `npx vitest run tests/integration/view-routing.test.ts` → 5/5 passed.
  - `npm test` → 139/139 passed (11 files). Note: `tests/performance/render-perf.test.ts` is timing-sensitive and failed once on a full-suite run (model build 16.38 ms vs 13.59 ms baseline, >20%); it passes on re-run and is unrelated to this change (the render/model path was not touched).
  - `npm run build` → succeeded (`tsc -noEmit -skipLibCheck && node esbuild.config.mjs production`).
- Manual checks: none performed in this session (requires a live Obsidian 1.14.5 vault). The fix should be verified on 1.14.5 per the assessment's version-drift note — see Follow-ups.

## Deviations from Assessment

- **Menu positioning API**: the assessment did not specify how to position the view-switch menu. `Menu.forEvent(evt)` (the natural choice) requires Obsidian 1.6.0, but the project's `minAppVersion` is 1.1.0, so `eslint-plugin-obsidianmd` (`no-unsupported-api`) rejects it. Used `new Menu().showAtMouseEvent(evt)` instead, which is available since 0.12.6 (below `minAppVersion`) and is functionally equivalent for a mouse-driven button.
- **Icon choice**: the assessment left the exact icon to implementation. Chose `columns-2` (a "change view / layout" icon, distinct from "…") with the tooltip "Change view". The reporter had suggested an icon tied to the current mode; a single consistent icon is simpler and still clear.
- **Spec amendment approval**: the assessment marked the FR-002/FR-027 amendment as `[NEEDS APPROVAL]`. The reporter's instruction `napraw oba` ("fix both") is treated as explicit approval for the amendment; it was applied to `spec.md`, `research.md`, and `quickstart.md`.

## Follow-ups

- **Manual validation on Obsidian 1.14.5** (T025 / quickstart Q1 + Q1b): confirm (a) a fresh open of a `usm-board: true` note lands in the map view without the "switch away and back" workaround; (b) close-tab → reopen also lands in the map view; (c) the dedicated view-switch button is present in all three states and "…" remains the native context menu; (d) tab re-activation does not change views.
- **Re-run the performance baseline** if the `render-perf` flake recurs on CI (unrelated to this fix, but worth a clean-baseline re-capture).
- **Consider a regression note** in `CHANGELOG.md` for the 0.1.x release describing the first-open routing fix and the new view-switch button.
