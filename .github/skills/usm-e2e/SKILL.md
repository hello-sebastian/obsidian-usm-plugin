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
