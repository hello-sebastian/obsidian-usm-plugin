# CLOSED — board-view-routing

- **Closed**: 2026-10-25
- **Final result**: verified (see `test.md`)
- **Iterations**: 5 (assessment → fix → test per iteration)
- **Defects resolved**: 5

## Summary

The `board-view-routing` bug is **closed as verified**. The final live-vault manual check (user-confirmed: "Testy manualne 1, 2, 3 działają poprawnie") confirmed the last defect (Defect 5 — inert plugin view-switch button persisting after navigating from a board note in native mode to a non-board note) no longer reproduces. All automated checks are green (13/13 view-routing, 147/147 full suite, tsc clean, lint 0 errors, build OK) and the fix is deployed to the live vault.

## Defects (chronological)

| Iter | Defect | Fix |
|------|--------|-----|
| 1 | First-open routing race — a single `setViewState` dropped while the fresh leaf is still initializing | Bounded retry (`ROUTE_MAX_ATTEMPTS`/`ROUTE_RETRY_DELAY_MS`) until the view settles |
| 2 | (a) Board view claimed `.md` files for leaf reuse → empty panel; (b) view-switch menu not loaded before shown; (c) duplicate button on repeated `file-open` | `canAcceptExtension('md')` → `false`; `menu.load()` before `showAtMouseEvent`; button added once per view (WeakSet guard) + deferred behind async board check |
| 3 | Plugin button missing after a view-type switch (board → native Markdown) because `file-open` does not fire on a view-type switch | Added an `active-leaf-change` listener that ensures the button is present (routing stays on `file-open` only) |
| 4 | Both the plugin button and the native source/preview toggle visible in the native Markdown view of a board note | Hide the native `modeButtonEl` via `hide()`/`show()` when the plugin button is present; restore it for non-board notes |
| 5 | Inert plugin button persists when navigating from a board note (native mode) to a non-board note in the same tab | Track the `addAction` element in a `WeakMap<MarkdownView, HTMLElement>`; `removeViewSwitchAction(view)` removes it (and clears the tracking structures) when the current file is non-board; re-add works after removal |

## Report trail

- `assessment.md` / `fix.md` / `test.md` — iteration 5 (final; `test.md` = verified).
- `assessment-iter1..4.md`, `fix-iter1..4.md`, `test-iter1..4.md` — preserved history.
- `test-iter5.md` — the iteration-5 `partial` checkpoint (before the live manual check).

## Residual watch-items (non-blocking)

- `modeButtonEl` is an internal Obsidian property (not in `obsidian.d.ts`); a future rename would make the native-toggle helper a silent no-op (cosmetic regression, no crash). Watch on Obsidian upgrades.
- `el.remove()` on an `addAction` element is confirmed safe on live 1.14.5 (header renders correctly after remove + re-add). Fallback if a future Obsidian wraps action elements: `hide()`/`show()`.
