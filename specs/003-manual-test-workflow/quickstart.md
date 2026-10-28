# Quickstart: Manual Test & Preview Workflow (E2E Infrastructure Integration)

**Feature**: `003-manual-test-workflow` | **Date**: 2026-10-28

Runnable validation scenarios that prove the feature works end-to-end. This is
a validation/run guide — implementation details belong in `tasks.md` and the
implementation phase. The skill itself (`.github/skills/usm-e2e/SKILL.md`) is
the day-to-day reference; this guide validates that the skill, the CLI, the
fixtures, and the convention all work together.

## Prerequisites

- macOS with the Obsidian desktop app installed.
- Node.js 22+ (global `WebSocket` is required by the `002` tooling and by
  `e2e/inspect.mjs`).
- A clean checkout of the repository.
- No private vault is touched at any step (SC-003, FR-010).

## Setup (one-time, < 5 minutes — SC-001)

```bash
npm install
npm run e2e:setup
npm run e2e:launch
```

**Expected**: `e2e:setup` exits 0 (plugin built and installed into the test
vault); `e2e:launch` opens a debuggable Obsidian instance on the test vault
and exits 0 (CDP ready on port 9222).

## Scenario 1 — Fresh-session skill discovery (US-01, SC-001, SC-002)

In a fresh agent session with only the repository:

1. Ask the agent to "verify the plugin in Obsidian" (or any manual-verification
   task).
2. **Expected**: the agent finds the `usm-e2e` skill via the skill index,
   follows it to prepare the environment (setup + launch), and runs the
   standard checks — without the user explaining any infrastructure.
3. **Expected**: the agent uses `test-vault/` exclusively; no read or write
   touches the private vault.

## Scenario 2 — Standard automated verification (regression, `002`)

```bash
npm run e2e:verify
```

**Expected**: `status: "pass"`, `taskColumns: 4` (the `002` baseline is
untouched by this feature), screenshot at `e2e/output/board.png`, exit 0.

## Scenario 3 — Ad-hoc inspection CLI (US-02, SC-004)

With a debuggable instance running:

```bash
node e2e/inspect.mjs eval "document.querySelectorAll('.usm-story-card').length"
# → 8

node e2e/inspect.mjs wait ".usm-board"
# → ok: .usm-board found   (exit 0)

node e2e/inspect.mjs screenshot e2e/output/inspect-check.png
# → e2e/output/inspect-check.png   (exit 0)
```

**Expected**: each operation prints the documented output and exits 0
(contract: [inspect-cli.md](./contracts/inspect-cli.md)).

**Fail-fast check (FR-006)**: stop the instance (or use a free port), then:

```bash
node e2e/inspect.mjs eval "1+1" --port 9999
```

**Expected**: a clear, actionable error including the hint
`(run npm run e2e:launch)` and exit code 2 — no hang.

## Scenario 4 — Extended board fixture (US-03, FR-009)

```bash
node e2e/inspect.mjs eval "location.href = 'obsidian://open?path=boards/Test Board 2.md'"
node e2e/inspect.mjs wait ".usm-board"
node e2e/inspect.mjs eval "document.querySelectorAll('section.usm-release').length"
# → 4
node e2e/inspect.mjs eval "document.querySelectorAll('.usm-story-card').length"
# → 9
node e2e/inspect.mjs screenshot e2e/output/extended-board.png
```

**Expected**: the extended board renders its own baseline — 4 release sections
(Unassigned first), 9 cards, the long epic title clamped — per
[extended-board-baseline.md](./contracts/extended-board-baseline.md).

**Multi-board coexistence (US-03 scenario 5)**: open `Board.md` again and
re-check the `002` baseline (`taskColumns: 4`, 8 cards). **Expected**: each
board renders its own structure independently, in either order, with no
cross-board interference.

**Same-folder arrangement (ad-hoc, R6)**: create a variant board file in the
vault root (distinct name, e.g. `Board variant.md`), verify it renders
independently alongside `Board.md`, delete it, and confirm
`git status` is clean. **Expected**: the same-folder arrangement works and
leaves no trace.

## Scenario 5 — Mobile scenario via emulation (US-02/FR-004, SC-007)

```bash
node e2e/inspect.mjs eval "this.app.emulateMobile(true)"
node e2e/inspect.mjs eval "location.reload()"
node e2e/inspect.mjs wait ".usm-board"
node e2e/inspect.mjs screenshot e2e/output/mobile-emulated.png
# inspect the screenshot: compact release header, full-width columns, both-axis scroll
node e2e/inspect.mjs eval "this.app.emulateMobile(false)"
node e2e/inspect.mjs eval "location.reload()"
node e2e/inspect.mjs wait ".usm-board"
node e2e/inspect.mjs eval "this.app.isMobile"
# → false
```

**Expected**: the mobile layout is captured while emulated; the desktop state
is restored afterwards (`isMobile` is `false`) — no physical device needed
(SC-007). The restore step is mandatory (spec edge case: mobile emulation
state leak).

## Scenario 6 — Manual-assist protocol (US-01, FR-003, FR-004)

1. Pick a subjective scenario (e.g. "the header block reads cleanly at 1440 px").
2. **Expected**: the agent prepares the environment, delivers a screenshot to
   the user, records the user's judgment in the feature's
   `checklists/manual-validation.md` (status + committed screenshot +
   one-line observation), per
   [manual-checklist-format.md](./contracts/manual-checklist-format.md).
3. **Expected**: the committed screenshot lives in the feature's `checklists/`
   directory; no automated screenshot is committed.
4. **User-unavailable check**: if the user is unavailable, the scenario is
   recorded as `[~]` pending user review — never guessed.

## Scenario 7 — On-demand interactive session (US-04, FR-013, SC-006)

Mid-development, ask the agent: "show me the board" / "open that note and
switch to the map view".

**Expected**: the agent ensures the instance is running (`e2e:launch` is
idempotent), performs the operation via `e2e/inspect.mjs`, and delivers the
result (screenshot / evaluated state) — without the developer explaining any
infrastructure. Then: change code → `npm run e2e:setup` → reload → inspect →
screenshot, repeated without developer intervention.

**Non-automatable operation check**: ask for an operation the agent cannot
perform programmatically (e.g. a true touch gesture). **Expected**: the agent
falls back to the manual-assist protocol and asks the user to perform it in
the live instance.

## Scenario 8 — Task-writing convention (US-03, FR-008)

1. Write a new manual-verification task in a draft `tasks.md` following
   [task-convention.md](./contracts/task-convention.md).
2. **Expected**: the task references `usm-e2e`, names the checklist file and
   scenario, marks the mode, and targets the test vault.
3. **Expected**: `AGENTS.md` contains the pointer to the convention/skill, so
   a fresh agent session sees it.

## Scenario 9 — Clean session end (FR-011, FR-012, SC-005)

After any of the scenarios above:

```bash
git status --porcelain
```

**Expected**: only intended changes remain. Obsidian runtime side effects on
committed test-vault files (e.g. `community-plugins.json` reformatting) are
restored per the skill's documented steps (e.g.
`git checkout -- test-vault/.obsidian/community-plugins.json`). The instance
is left running only with the user's explicit consent, otherwise it is
closed.

## Failure diagnostics

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| `inspect.mjs` exits 2 with a connection error | No instance running, or wrong port | Run `npm run e2e:launch`; confirm the port matches. |
| Extended board counts differ from the baseline | Fixture changed without updating the baseline | Update [extended-board-baseline.md](./contracts/extended-board-baseline.md) in the same change. |
| `Board.md` baseline changed | The `002` fixture was modified | Restore it — this feature MUST NOT change the `002` contract. |
| Mobile layout not applied after `emulateMobile(true)` | Missing reload | Reload the page after toggling emulation (documented sequence). |
| `isMobile` still `true` after a scenario | Restore step skipped | Run the restore sequence (disable + reload); relaunching also resets it. |
| `git status` dirty after a run | Obsidian rewrote committed test-vault config | Follow the skill's clean-tree restore steps. |
