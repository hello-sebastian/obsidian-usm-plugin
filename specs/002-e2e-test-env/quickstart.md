# Quickstart: E2E Test Infrastructure — Isolated Test Environment & Manual Test/Preview Workflow

**Feature**: `002-e2e-test-env` (consolidated with `003-manual-test-workflow`) | **Date**: 2026-10-27 (Part 1) · 2026-10-28 (Part 2)

Runnable validation scenarios that prove the feature works end-to-end. This is a validation/run guide — implementation details belong in `tasks.md` and the implementation phase.

> **Merge note**: This quickstart consolidates the quickstarts of two previously separate features that together form the plugin's E2E test infrastructure: **Part 1** — the isolated E2E test environment & GUI automation (originally `002-e2e-test-env`), and **Part 2** — the manual test & preview workflow (originally `003-manual-test-workflow`). Part 2 builds on Part 1. All requirement, success-criterion, user-story, and research IDs are namespaced (`-002-` / `-003-`). No scenario from either original quickstart has been omitted or altered in meaning; only IDs and cross-references were updated for the consolidation.

---

## Part 1: E2E Test Environment (002)

### Prerequisites

- macOS with the Obsidian desktop app installed.
- Node.js 22+ (global `WebSocket` is required by the verification script).
- A clean checkout of the repository.
- No private vault is touched at any step (SC-002-002).

### Setup (one-time, < 5 minutes — SC-002-001)

```bash
npm install
npm run e2e:setup
```

`e2e:setup` builds the plugin and installs `main.js`, `manifest.json`, and `styles.css` into `test-vault/.obsidian/plugins/obsidian-usm-plugin/`. See [test-vault structure](./contracts/test-vault-structure.md) for the exact layout and the committed-vs-generated split.

**Expected**: the command exits 0 and `test-vault/.obsidian/plugins/obsidian-usm-plugin/main.js` exists.

### Scenario 1 — Launch a debuggable instance (US-002-02)

```bash
npm run e2e:launch
```

**Expected**:
- Obsidian opens on the test vault.
- `http://127.0.0.1:9222/json/version` responds (CDP ready).
- Exit code 0.

**Idempotency check (SC-002-007)**: run the command again while the instance is up.

**Expected**: it prints that an instance is already available on port 9222, spawns no duplicate, and exits 0.

**Alternate port (FR-002-008)**: `npm run e2e:launch -- --port 9333` starts a second, independently connectable instance.

### Scenario 2 — Standard automated verification (US-002-03)

With a debuggable instance running:

```bash
npm run e2e:verify
```

**Expected** (see [verification report contract](./contracts/verification-report.md)):
- A JSON report is written to `e2e/output/report.json` and printed to stdout.
- `status: "pass"`.
- `taskColumns: 4` — matching the [known baseline](./contracts/test-vault-structure.md) with 100% accuracy (SC-002-004).
- A screenshot is captured at `e2e/output/board.png` showing the 2D layout: header rows, release sections, epic columns, story cards (SC-002-005).
- `reactivity.detected: true` with `delayMs <= 5000` (SC-002-006).
- Exit code 0.

### Scenario 3 — Agent ad-hoc inspection (FR-002-017)

The agent may connect to the running instance with its built-in CDP browser capability (e.g., open `http://127.0.0.1:9222` as a CDP target) and inspect the DOM beyond the standard checks — for example, reading card titles, checking the "Unassigned" sections, or diagnosing a rendering problem.

**Expected**: the agent can evaluate JavaScript in the page and capture additional screenshots without any project-level browser dependency.

### Scenario 4 — Broken build is detected (SC-002-008)

```bash
rm test-vault/.obsidian/plugins/obsidian-usm-plugin/main.js
npm run e2e:verify
```

**Expected**: the run fails before any check with a clear "plugin build missing/outdated — run `npm run e2e:setup`" message and a non-zero exit code. No verification of a broken build is attempted.

### Scenario 5 — Port conflict (spec edge case)

Occupy port 9222 with an unrelated process, then:

```bash
npm run e2e:launch
```

**Expected**: a clear, actionable error (not a silent failure) suggesting `--port <alternate>`. Then `npm run e2e:launch -- --port 9333` succeeds on the free port.

### Scenario 6 — Reproducibility (FR-002-004)

```bash
# in a fresh clone
npm install
npm run e2e:setup
npm run e2e:launch
npm run e2e:verify
```

**Expected**: identical environment and an identical `pass` report as Scenario 2 — same board, same notes, same baseline counts.

### Failure diagnostics

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| `e2e:verify` exits 2 with a connection error | No instance running, or wrong port | Run `e2e:launch`; confirm the port matches. |
| `taskColumns` mismatch | Fixture changed without updating the baseline | Update [test-vault-structure.md](./contracts/test-vault-structure.md) in the same change. |
| Reactivity not detected within 5 s | Plugin refresh path broken | Inspect the running instance ad-hoc (Scenario 3). |
| Launch reports port conflict | Another process owns the port | Use `--port <alternate>`. |

---

## Part 2: Manual Test & Preview Workflow (003)

The skill itself (`.github/skills/usm-e2e/SKILL.md`) is the day-to-day reference; this guide validates that the skill, the CLI, the fixtures, and the convention all work together.

### Prerequisites

- macOS with the Obsidian desktop app installed.
- Node.js 22+ (global `WebSocket` is required by the Part 1 tooling and by `e2e/inspect.mjs`).
- A clean checkout of the repository.
- No private vault is touched at any step (SC-003-003, FR-003-010).

### Setup (one-time, < 5 minutes — SC-003-001)

```bash
npm install
npm run e2e:setup
npm run e2e:launch
```

**Expected**: `e2e:setup` exits 0 (plugin built and installed into the test vault); `e2e:launch` opens a debuggable Obsidian instance on the test vault and exits 0 (CDP ready on port 9222).

### Scenario 1 — Fresh-session skill discovery (US-003-01, SC-003-001, SC-003-002)

In a fresh agent session with only the repository:

1. Ask the agent to "verify the plugin in Obsidian" (or any manual-verification task).
2. **Expected**: the agent finds the `usm-e2e` skill via the skill index, follows it to prepare the environment (setup + launch), and runs the standard checks — without the user explaining any infrastructure.
3. **Expected**: the agent uses `test-vault/` exclusively; no read or write touches the private vault.

### Scenario 2 — Standard automated verification (regression, Part 1)

```bash
npm run e2e:verify
```

**Expected**: `status: "pass"`, `taskColumns: 4` (the Part 1 baseline is untouched by this feature), screenshot at `e2e/output/board.png`, exit 0.

### Scenario 3 — Ad-hoc inspection CLI (US-003-02, SC-003-004)

With a debuggable instance running:

```bash
node e2e/inspect.mjs eval "document.querySelectorAll('.usm-story-card').length"
# → 8

node e2e/inspect.mjs wait ".usm-board"
# → ok: .usm-board found   (exit 0)

node e2e/inspect.mjs screenshot e2e/output/inspect-check.png
# → e2e/output/inspect-check.png   (exit 0)
```

**Expected**: each operation prints the documented output and exits 0 (contract: [inspect-cli.md](./contracts/inspect-cli.md)).

**Fail-fast check (FR-003-006)**: stop the instance (or use a free port), then:

```bash
node e2e/inspect.mjs eval "1+1" --port 9999
```

**Expected**: a clear, actionable error including the hint `(run npm run e2e:launch)` and exit code 2 — no hang.

### Scenario 4 — Extended board fixture (US-003-03, FR-003-009)

```bash
node e2e/inspect.mjs eval "location.href = 'obsidian://open?path=boards/Test Board 2.md'"
node e2e/inspect.mjs wait ".usm-board"
node e2e/inspect.mjs eval "document.querySelectorAll('section.usm-release').length"
# → 4
node e2e/inspect.mjs eval "document.querySelectorAll('.usm-story-card').length"
# → 9
node e2e/inspect.mjs screenshot e2e/output/extended-board.png
```

**Expected**: the extended board renders its own baseline — 4 release sections (Unassigned first), 9 cards, the long epic title clamped — per [extended-board-baseline.md](./contracts/extended-board-baseline.md).

**Multi-board coexistence (US-003-03 scenario 5)**: open `Board.md` again and re-check the Part 1 baseline (`taskColumns: 4`, 8 cards). **Expected**: each board renders its own structure independently, in either order, with no cross-board interference.

**Same-folder arrangement (ad-hoc, R-003-6)**: create a variant board file in the vault root (distinct name, e.g. `Board variant.md`), verify it renders independently alongside `Board.md`, delete it, and confirm `git status` is clean. **Expected**: the same-folder arrangement works and leaves no trace.

### Scenario 5 — Mobile scenario via emulation (US-003-02/FR-003-004, SC-003-007)

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

**Expected**: the mobile layout is captured while emulated; the desktop state is restored afterwards (`isMobile` is `false`) — no physical device needed (SC-003-007). The restore step is mandatory (spec edge case: mobile emulation state leak).

### Scenario 6 — Manual-assist protocol (US-003-01, FR-003-003, FR-003-004)

1. Pick a subjective scenario (e.g. "the header block reads cleanly at 1440 px").
2. **Expected**: the agent prepares the environment, delivers a screenshot to the user, records the user's judgment in the feature's `checklists/manual-validation.md` (status + committed screenshot + one-line observation), per [manual-checklist-format.md](./contracts/manual-checklist-format.md).
3. **Expected**: the committed screenshot lives in the feature's `checklists/` directory; no automated screenshot is committed.
4. **User-unavailable check**: if the user is unavailable, the scenario is recorded as `[~]` pending user review — never guessed.

### Scenario 7 — On-demand interactive session (US-003-04, FR-003-013, SC-003-006)

Mid-development, ask the agent: "show me the board" / "open that note and switch to the map view".

**Expected**: the agent ensures the instance is running (`e2e:launch` is idempotent), performs the operation via `e2e/inspect.mjs`, and delivers the result (screenshot / evaluated state) — without the developer explaining any infrastructure. Then: change code → `npm run e2e:setup` → reload → inspect → screenshot, repeated without developer intervention.

**Non-automatable operation check**: ask for an operation the agent cannot perform programmatically (e.g. a true touch gesture). **Expected**: the agent falls back to the manual-assist protocol and asks the user to perform it in the live instance.

### Scenario 8 — Task-writing convention (US-003-03, FR-003-008)

1. Write a new manual-verification task in a draft `tasks.md` following [task-convention.md](./contracts/task-convention.md).
2. **Expected**: the task references `usm-e2e`, names the checklist file and scenario, marks the mode, and targets the test vault.
3. **Expected**: `AGENTS.md` contains the pointer to the convention/skill, so a fresh agent session sees it.

### Scenario 9 — Clean session end (FR-003-011, FR-003-012, SC-003-005)

After any of the scenarios above:

```bash
git status --porcelain
```

**Expected**: only intended changes remain. Obsidian runtime side effects on committed test-vault files (e.g. `community-plugins.json` reformatting) are restored per the skill's documented steps (e.g. `git checkout -- test-vault/.obsidian/community-plugins.json`). The instance is left running only with the user's explicit consent, otherwise it is closed.

### Failure diagnostics

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| `inspect.mjs` exits 2 with a connection error | No instance running, or wrong port | Run `npm run e2e:launch`; confirm the port matches. |
| Extended board counts differ from the baseline | Fixture changed without updating the baseline | Update [extended-board-baseline.md](./contracts/extended-board-baseline.md) in the same change. |
| `Board.md` baseline changed | The Part 1 fixture was modified | Restore it — this feature MUST NOT change the Part 1 contract. |
| Mobile layout not applied after `emulateMobile(true)` | Missing reload | Reload the page after toggling emulation (documented sequence). |
| `isMobile` still `true` after a scenario | Restore step skipped | Run the restore sequence (disable + reload); relaunching also resets it. |
| `git status` dirty after a run | Obsidian rewrote committed test-vault config | Follow the skill's clean-tree restore steps. |
