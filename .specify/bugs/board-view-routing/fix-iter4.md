# Bug Fix: Native source/preview toggle visible alongside plugin view-switch button (Defect 4)

- **Slug**: board-view-routing
- **Fixed**: 2026-10-25
- **Assessment**: ./assessment.md
- **Status**: applied

## Summary

When a board note is shown in the native Markdown view, the plugin's
view-switch button (added by the iteration-3 fix) and Obsidian's native
source/preview toggle (`MarkdownView.modeButtonEl`) were both visible,
confusing the user. The fix hides the native toggle whenever the plugin
button is present on a board note, and restores it when the same
`MarkdownView` later shows a non-board note (dynamic re-evaluation on
`active-leaf-change`).

## Changes

| File | Change | Notes |
|------|--------|-------|
| `src/obsidian/board-view.ts` | modified | Added `setNativeModeToggleVisible` (defensive structural cast to the internal `modeButtonEl`; silent no-op when absent) and `syncNativeModeToggle` (re-evaluates board status + plugin-button presence). Called after `addAction` in `ensureViewSwitchActionForLeaf` (hide) and from the `active-leaf-change` handler (sync). |
| `tests/helpers/obsidian-stub.ts` | modified | `MarkdownView` stub now exposes `modeButtonEl: HTMLElement` (mirrors Obsidian's internal property so the helper can be exercised in tests). |
| `tests/helpers/dom-patch.ts` | modified | Patched `HTMLElement.prototype.hide`/`show` (jsdom lacks Obsidian's augmentation); mirrors Obsidian's real implementation via `style.display`. |
| `tests/integration/view-routing.test.ts` | modified | `MarkdownViewStub` type gained `modeButtonEl`; added 3 Defect-4 tests (hide on board, restore on non-board, safe no-op when property absent). |
| `eslint.config.mts` | modified | Scoped override: `obsidianmd/no-static-styles-assignment` off for `tests/**/*.ts` only (test helpers legitimately mirror Obsidian's real DOM API; the rule is a production-code concern per Constitution Principle VII). |

## Diff Highlights

`src/obsidian/board-view.ts` — new helper (defensive, no-op safe):

```ts
function setNativeModeToggleVisible(
	view: MarkdownView,
	visible: boolean,
): void {
	const el = (view as unknown as { modeButtonEl?: HTMLElement }).modeButtonEl;
	if (el === undefined || el === null) {
		return;
	}
	if (visible) {
		el.show();
	} else {
		el.hide();
	}
}
```

`src/obsidian/board-view.ts` — dynamic sync from the `active-leaf-change`
handler (restores the native toggle for non-board notes):

```ts
if (view instanceof MarkdownView) {
	void syncNativeModeToggle(app, view, file);
}
```

## Tests Added or Updated

- `tests/integration/view-routing.test.ts` — *hides the native toggle when the plugin button is added to a board Markdown view*: pins `modeButtonEl` hidden after `ensureViewSwitchActionForLeaf` on a board file.
- `tests/integration/view-routing.test.ts` — *restores the native toggle when the active file is a non-board note*: pins the dynamic re-evaluation (hidden for board → shown for plain note) via the `active-leaf-change` handler.
- `tests/integration/view-routing.test.ts` — *no-ops safely when modeButtonEl is absent (future Obsidian rename)*: pins the defensive no-op path.

## Local Verification

- Commands run:
  - `npx tsc --noEmit -skipLibCheck` → clean (no errors)
  - `npx vitest run tests/integration/view-routing.test.ts` → 12/12 passed (was 9; +3 Defect-4 tests)
  - `npm test` → 146/146 passed (11 files; was 143)
  - `npm run lint` → 0 errors (44 warnings = pre-existing baseline)
  - `npm run build` → success; `main.js` bundle contains `modeButtonEl` (1 match)
- Manual checks: none (live-vault repro deferred to `/speckit-bug-test`).

## Deviations from Assessment

- The assessment proposed `hide()`/`show()` with a `style.display` fallback.
  The implementation uses `hide()`/`show()` only (no fallback) — the
  `modeButtonEl` is an `HTMLElement` in Obsidian's runtime, which always has
  these methods; the fallback was unnecessary.
- The assessment did not anticipate the **inline-styling guard**
  (Constitution Principle VII, `tests/unit/inline-styling-guard.test.ts`)
  forbidding any `.style.<property>` access under `src/`. The initial
  `style.display` implementation failed that guard; the fix was switched to
  Obsidian's `hide()`/`show()` API, which satisfies both the guard and the
  `obsidianmd/no-static-styles-assignment` lint rule.
- The assessment did not list `tests/helpers/dom-patch.ts` or
  `eslint.config.mts` as files to change. Both were required: jsdom lacks
  Obsidian's `hide()`/`show()` augmentation (patched in the test helper), and
  the test helper's legitimate `style.display` assignment tripped the
  `obsidianmd/no-static-styles-assignment` rule (scoped override for
  `tests/` only). Scope expansion is limited to test infrastructure and lint
  config — no production code beyond `board-view.ts` was touched.
- `MarkdownViewStub` type in the test file needed `modeButtonEl` because the
  stub is runtime-only (aliased in `vitest.config.ts`) while types come from
  the real `obsidian` package, which does not declare `modeButtonEl`.

## Follow-ups

- Manual live-vault verification (5-point check) via `/speckit-bug-test`.
- Monitor for Obsidian renaming `modeButtonEl` in a future release — the
  defensive no-op keeps the plugin safe, but the native toggle would then
  remain visible (feature regression, not a crash). A periodic bundle check
  could detect the rename.
- Consider documenting the `tests/` lint override in `AGENTS.md` or the
  constitution so future contributors understand why it exists.
