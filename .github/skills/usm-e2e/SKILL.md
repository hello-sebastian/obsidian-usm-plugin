---
name: "usm-e2e"
description: "Manual/E2E verification of the USM plugin in a real Obsidian instance on the committed test vault — environment preparation, standard checks, ad-hoc inspection, the manual-assist protocol, mobile emulation, and on-demand preview."
---

# USM Manual/E2E Verification

This skill is the single, self-contained workflow for manually testing and
previewing the User Story Map plugin in a real Obsidian instance. It drives the
committed `test-vault/` fixture vault over the Chrome DevTools Protocol (CDP)
using the repository's own `e2e/` tooling (Node 22+ built-ins only).

Follow this skill whenever you are asked to verify, preview, or manually test
the plugin in Obsidian. It requires no knowledge outside this repository and
never touches the user's private vault.

## Prerequisites

- **macOS** with the **Obsidian desktop** app installed (launch uses `open -a`).
- **Node.js 22+** (global `fetch` + global `WebSocket` are required by the
  `e2e/` tooling).
- A clean checkout of the repository.
- **No private vault is touched.** Every command targets the committed
  `test-vault/` fixture vault explicitly. Never attach to, inspect, or modify
  a private Obsidian instance or vault.

## Environment preparation

```bash
npm install
npm run e2e:setup     # build the plugin + install into test-vault (SHA-256 verified)
npm run e2e:launch    # open a debuggable Obsidian instance on the test vault
```

- `e2e:setup` builds the plugin and installs `main.js`, `manifest.json`, and
  `styles.css` into `test-vault/.obsidian/plugins/obsidian-usm-plugin/`,
  verifying each file's SHA-256. Run it once, and again after any plugin code
  change.
- `e2e:launch` opens Obsidian on the test vault with a CDP remote-debugging
  port (default `9222`) and waits (up to 30 s) for the CDP endpoint to be
  ready. It is **idempotent**: re-running while an instance is already up
  exits `0` without spawning a duplicate.
- The launch **MUST** target the test vault explicitly (it passes the absolute
  `test-vault/` path to Obsidian). It never attaches to, inspects, or modifies
  a private instance.
- Alternate port: every command accepts `--port <number>` (integer 1–65535),
  e.g. `npm run e2e:launch -- --port 9333`.

## Standard checks

```bash
npm run e2e:verify
```

- Connects over CDP, opens `Board.md` in the map view, runs the standard
  checks, and writes a machine-readable JSON report to
  `e2e/output/report.json` (plus a screenshot at `e2e/output/board.png`).
- **Baseline for `Board.md`**: `taskColumns: 4` (the `002` contract — this
  feature does not change it). A `status: "pass"` with `taskColumns: 4` and
  exit `0` is the green state.
- Exit codes: `0` = pass, `1` = one or more checks failed, `2` = environment
  error before checks ran (CDP unreachable, build missing/outdated).

## Test vault fixtures

The committed `test-vault/` holds two boards that coexist and each render its
own structure independently (FR-009):

- **`Board.md`** (root) — the `002` standard-verify target: `taskColumns: 4`,
  8 cards. Unchanged by this feature.
- **`boards/Test Board 2.md`** — the extended board fixture, with its story
  notes `boards/T1.md`–`T8.md` (names distinct from the root `S1`–`S6` so the
  two boards never share notes). It renders 4 release sections (Unassigned
  first, then `1.0 MVP`, `2.0`, `3.0`), 9 cards (8 notes + 1 duplicate `T1`),
  6 task columns, 4 activity columns, and a long epic title that clamps within
  the fixed column width. See
  `specs/003-manual-test-workflow/contracts/extended-board-baseline.md` for the
  full baseline and the per-leaf measurement method.

**Multi-board coexistence.** With both boards present, opening each in turn
(and switching back and forth) reproduces its own baseline with no cross-board
interference. Because both boards can be open at once, measure each board
within its own leaf (e.g. `app.workspace.getLeavesOfType('usm-board-view')`),
not with a global `document.querySelectorAll` count, which sums every open
board.

**Same-folder arrangement (ad-hoc).** The committed vault uses the
separate-folder arrangement. To verify the same-folder arrangement ad-hoc:
create a variant board file in the vault root (distinct name, e.g.
`Board variant.md`, referencing the `T` notes or a small new set), verify it
renders independently alongside `Board.md`, delete it, and restore a clean
tree. This step is not a committed fixture.

## Ad-hoc inspection

`e2e/inspect.mjs` is a deterministic, committed CLI for inspecting and driving
the running instance (Node 22+ built-ins only, reuses `e2e/cdp.mjs`). It is the
canonical way to perform ad-hoc checks and interactions.

```bash
node e2e/inspect.mjs <operation> [args] [--port <number>]
# or: npm run e2e:inspect -- <operation> [args] [--port <number>]
```

| Operation | What it does | Output |
|-----------|--------------|--------|
| `eval <expression>` | Evaluates JS in the page context | the value as one-line JSON on stdout |
| `wait <css-selector> [--timeout <ms>]` | Polls until the selector matches (default `15000` ms, `200` ms poll) | `ok: <selector> found` |
| `screenshot <path>` | Captures a PNG (parent directories created) | the written path |

`--port` is accepted by every operation (default `9222`, integer 1–65535).
Exit codes: `0` = success, `1` = operation failed (wait timeout, page
evaluation exception), `2` = environment error before the operation ran (no
CDP instance on the port, invalid arguments). Every environment error includes
the hint `(run npm run e2e:launch)`.

### Documented interaction expressions

`eval` is also the **interaction channel** — navigation, view switching,
clicks, typing, and mobile emulation are performed by evaluating these
documented expressions:

| Purpose | Expression |
|---------|------------|
| Open a note (vault-relative path) | `location.href = 'obsidian://open?path=<path>'` |
| Reload the page | `location.reload()` |
| Switch to the map view (fallback when the view is edit/preview) | click `button[aria-label="Change view"]`, then the `.menu-item` labeled "USM board" (the same two-step sequence `e2e/verify.mjs` uses) |
| Enable mobile emulation | `this.app.emulateMobile(true)` |
| Disable mobile emulation (restore) | `this.app.emulateMobile(false)` |
| Toggle mobile emulation | `this.app.emulateMobile(!this.app.isMobile)` |
| Check the mobile flag | `this.app.isMobile` |
| Click an element by selector | `document.querySelector('<selector>').click()` |
| Type into an element by selector | `document.querySelector('<selector>').value = '<text>'` (followed by a dispatched `input` event where needed) |

### Mobile scenarios (emulation sequence)

Mobile scenarios run on the same desktop instance via Obsidian's built-in
mobile emulation — no physical device is needed. The documented sequence is
mandatory (the docs do not guarantee an immediate re-render, so a reload is
required after toggling):

```bash
node e2e/inspect.mjs eval "this.app.emulateMobile(true)"
node e2e/inspect.mjs eval "location.reload()"
node e2e/inspect.mjs wait ".usm-board"
node e2e/inspect.mjs screenshot e2e/output/mobile-emulated.png
# inspect the screenshot: compact release header, full-width columns, both-axis scroll
node e2e/inspect.mjs eval "this.app.emulateMobile(false)"
node e2e/inspect.mjs eval "location.reload()"
node e2e/inspect.mjs wait ".usm-board"
node e2e/inspect.mjs eval "this.app.isMobile"   # → false
```

The **restore step (disable + reload) is mandatory** after any mobile
scenario — otherwise the emulated state leaks into later checks. Relaunching
the instance also resets it.

## The manual-assist protocol

Some verification scenarios cannot be judged by the agent alone. Classify each
scenario into exactly one mode and behave accordingly:

| Mode | Who judges | Agent behavior |
|------|-----------|----------------|
| **automatable** | the agent | Run it end-to-end via the `e2e/` tooling (standard checks, ad-hoc inspection, mobile emulation). The agent MAY set `pass`/`fail` on its own. |
| **subjective** | the user | Prepare the environment, deliver a screenshot to the user, and record the user's judgment. The agent MUST NOT set `pass`/`fail` without the user's recorded judgment. |
| **live interaction** | the user | Prepare the environment, ask the user to perform the interaction in the live instance, and record the outcome. The agent MUST NOT set `pass`/`fail` without the user's recorded judgment. |

**Recording outcomes.** Outcomes are recorded in the feature's manual
validation checklist at `specs/<feature>/checklists/manual-validation.md`,
following
`specs/003-manual-test-workflow/contracts/manual-checklist-format.md`:

- Each scenario entry has an id (`M1`, `M2`, …), a title, a mode, a status
  marker, evidence, and a one-line observation.
- Status markers: `[ ]` pending · `[x]` pass · `[!]` fail · `[~]` pending user
  review.
- **User unavailable** → record `[~]` pending user review. Never guess a
  subjective or live-interaction outcome.
- **Screenshot persistence (hybrid rule)**: manual-assist evidence (subjective
  / live interaction, and any screenshot delivered to the user as judgment
  evidence) is committed under
  `specs/<feature>/checklists/<scenario-id>-<slug>.png`; automated-check
  evidence stays in the gitignored `e2e/output/`.
- Update the checklist **during** the session (immediately after each
  scenario), not reconstructed afterwards.

## On-demand interactive sessions

At any time on the developer's request — including mid-development — the agent
serves preview and interaction requests without the developer explaining any
infrastructure:

1. **Ensure the instance is running** — `npm run e2e:launch` is idempotent;
   re-running while an instance is up exits `0`.
2. **Perform the operation** via `e2e/inspect.mjs` — navigation (open a note),
   view switching, clicks, typing, mobile emulation (see the documented
   interaction expressions above).
3. **Deliver the result** — a screenshot (`screenshot`) and/or an evaluated
   state (`eval`).
4. **Iterate the development cycle** — change code → `npm run e2e:setup` →
   `location.reload()` → inspect → screenshot — repeated without developer
   intervention.

**Non-automatable operations.** For an operation the agent cannot perform
programmatically (e.g. a true touch gesture, or a drag & drop that cannot be
simulated), fall back to the manual-assist protocol: ask the user to perform
the operation in the live instance, then record the outcome in the feature's
`checklists/manual-validation.md`.

## Known runtime side effects on the test vault

Running Obsidian on the test vault can rewrite committed config files
(formatting only — e.g. `test-vault/.obsidian/community-plugins.json` may be
re-indented and lose its trailing newline). Before ending a session, restore
any such side effects so the working tree is clean:

```bash
git status --porcelain
git checkout -- test-vault/.obsidian/community-plugins.json   # if it shows as modified
```

Only committed test-vault files are ever restored this way; runtime-generated
files (workspace, cache) are gitignored and left alone.

## Ending a session cleanly

- Restore any Obsidian runtime side effects on committed test-vault files
  (see above) so `git status --porcelain` shows only intended changes.
- The debuggable instance is left running **only with the user's explicit
  consent**; otherwise close it (quit the Obsidian window that was opened on
  the test vault).
