# Contract: Ad-Hoc Inspection CLI (`e2e/inspect.mjs`)

**Feature**: `003-manual-test-workflow` | **Date**: 2026-10-28

Defines the command-line interface of the ad-hoc inspection helper (FR-005,
FR-006, FR-007, US-02). The helper is a thin CLI over the existing CDP client
(`e2e/cdp.mjs`); it introduces no new external dependencies (Node 22+
built-ins only).

## Invocation

```bash
node e2e/inspect.mjs <operation> [operation args] [--port <number>]
# or, via the package script:
npm run e2e:inspect -- <operation> [operation args] [--port <number>]
```

`--port` is accepted by every operation (default `9222`, integer 1–65535).
An invalid `--port` value exits `2` with a clear message.

## Operations

### `eval <expression>`

Evaluates a JavaScript expression in the page context of the first CDP page
target and prints the result to stdout as JSON (one line).

```bash
node e2e/inspect.mjs eval "document.querySelectorAll('.usm-story-card').length"
# → 8
```

- The expression is passed to CDP `Runtime.evaluate` with
  `returnByValue: true`, `awaitPromise: true` (the same semantics as
  `cdp.mjs`'s `evaluate`).
- A page-side exception exits `1` and prints the exception text to stderr.
- `eval` is also the **interaction channel**: navigation, view switching,
  clicks, typing, and mobile emulation are performed by evaluating documented
  expressions (see "Documented interaction expressions" below).

### `wait <css-selector> [--timeout <ms>]`

Polls `document.querySelector(<selector>)` in the page until it is non-null
or the timeout elapses.

```bash
node e2e/inspect.mjs wait ".usm-board"
node e2e/inspect.mjs wait ".usm-release" --timeout 30000
```

- Default timeout: `15000` ms. Poll interval: `200` ms (consistent with
  `e2e/verify.mjs`).
- Success: prints `ok: <selector> found` and exits `0`.
- Timeout: prints `timeout: <selector> not found within <ms> ms` to stderr
  and exits `1`.

### `screenshot <path>`

Captures a PNG screenshot of the page and writes it to `<path>` (parent
directories are created as needed).

```bash
node e2e/inspect.mjs screenshot e2e/output/board.png
node e2e/inspect.mjs screenshot specs/003-manual-test-workflow/checklists/M3-mobile-layout.png
```

- Prints the written path and exits `0`.
- The path is relative to the repository root (or absolute).

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Operation succeeded. |
| `1` | Operation failed: wait timeout, page evaluation exception, or a CDP command error. |
| `2` | Environment error before the operation ran: no CDP instance on the port, invalid arguments. |

Every environment error message MUST include the hint
`(run npm run e2e:launch)` (FR-006).

## Documented interaction expressions

The skill documents these expressions for the `eval` operation (they are the
canonical, tested way to drive the instance):

| Purpose | Expression |
|---------|------------|
| Open a note (vault-relative path) | `app.workspace.getLeaf(true).openFile(app.vault.getAbstractFileByPath('<path>'))` |
| Reload the page | `location.reload()` |
| Switch to the map view (fallback when the view is edit/preview) | click `button[aria-label="Change view"]`, then the `.menu-item` labeled "USM board" (the same two-step sequence `e2e/verify.mjs` uses) |
| Enable mobile emulation | `this.app.emulateMobile(true)` |
| Disable mobile emulation (restore) | `this.app.emulateMobile(false)` |
| Toggle mobile emulation | `this.app.emulateMobile(!this.app.isMobile)` |
| Check the mobile flag | `this.app.isMobile` |
| Click an element by selector | `document.querySelector('<selector>').click()` |
| Type into an element by selector | `document.querySelector('<selector>').value = '<text>'` (followed by a dispatched `input` event where needed) |

The URI form `location.href = 'obsidian://open?path=<path>'` is intermittently
rejected by Obsidian's vault resolver ("Vault not found"); the API method
above is the reliable open-note expression.

Mobile emulation MUST be followed by a page reload for the mobile layout to
apply, and the restore step (disable + reload) is mandatory after any mobile
scenario (research R4; spec edge case: mobile emulation state leak).

## Invariants

- **No new dependencies (FR-007)**: the file imports only `node:` built-ins
  and `./cdp.mjs`.
- **Fail-fast (FR-006)**: no operation may hang; every bounded wait has a
  timeout, and every connection failure produces an actionable error.
- **Read-only by default**: the helper performs whatever the expression does;
  the *skill* is responsible for prescribing safe expressions and the
  clean-tree restore steps (FR-011).
