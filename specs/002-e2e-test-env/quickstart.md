# Quickstart: Isolated E2E Test Environment & GUI Automation

**Feature**: `002-e2e-test-env` | **Date**: 2026-10-27

Runnable validation scenarios that prove the feature works end-to-end. This is a validation/run guide — implementation details belong in `tasks.md` and the implementation phase.

## Prerequisites

- macOS with the Obsidian desktop app installed.
- Node.js 22+ (global `WebSocket` is required by the verification script).
- A clean checkout of the repository.
- No private vault is touched at any step (SC-002).

## Setup (one-time, < 5 minutes — SC-001)

```bash
npm install
npm run e2e:setup
```

`e2e:setup` builds the plugin and installs `main.js`, `manifest.json`, and `styles.css` into `test-vault/.obsidian/plugins/obsidian-usm-plugin/`. See [test-vault structure](./contracts/test-vault-structure.md) for the exact layout and the committed-vs-generated split.

**Expected**: the command exits 0 and `test-vault/.obsidian/plugins/obsidian-usm-plugin/main.js` exists.

## Scenario 1 — Launch a debuggable instance (US-02)

```bash
npm run e2e:launch
```

**Expected**:
- Obsidian opens on the test vault.
- `http://127.0.0.1:9222/json/version` responds (CDP ready).
- Exit code 0.

**Idempotency check (SC-007)**: run the command again while the instance is up.

**Expected**: it prints that an instance is already available on port 9222, spawns no duplicate, and exits 0.

**Alternate port (FR-008)**: `npm run e2e:launch -- --port 9333` starts a second, independently connectable instance.

## Scenario 2 — Standard automated verification (US-03)

With a debuggable instance running:

```bash
npm run e2e:verify
```

**Expected** (see [verification report contract](./contracts/verification-report.md)):
- A JSON report is written to `e2e/output/report.json` and printed to stdout.
- `status: "pass"`.
- `taskColumns: 4` — matching the [known baseline](./contracts/test-vault-structure.md) with 100% accuracy (SC-004).
- A screenshot is captured at `e2e/output/board.png` showing the 2D layout: header rows, release sections, epic columns, story cards (SC-005).
- `reactivity.detected: true` with `delayMs <= 5000` (SC-006).
- Exit code 0.

## Scenario 3 — Agent ad-hoc inspection (FR-017)

The agent may connect to the running instance with its built-in CDP browser capability (e.g., open `http://127.0.0.1:9222` as a CDP target) and inspect the DOM beyond the standard checks — for example, reading card titles, checking the "Unassigned" sections, or diagnosing a rendering problem.

**Expected**: the agent can evaluate JavaScript in the page and capture additional screenshots without any project-level browser dependency.

## Scenario 4 — Broken build is detected (SC-008)

```bash
rm test-vault/.obsidian/plugins/obsidian-usm-plugin/main.js
npm run e2e:verify
```

**Expected**: the run fails before any check with a clear "plugin build missing/outdated — run `npm run e2e:setup`" message and a non-zero exit code. No verification of a broken build is attempted.

## Scenario 5 — Port conflict (spec edge case)

Occupy port 9222 with an unrelated process, then:

```bash
npm run e2e:launch
```

**Expected**: a clear, actionable error (not a silent failure) suggesting `--port <alternate>`. Then `npm run e2e:launch -- --port 9333` succeeds on the free port.

## Scenario 6 — Reproducibility (FR-004)

```bash
# in a fresh clone
npm install
npm run e2e:setup
npm run e2e:launch
npm run e2e:verify
```

**Expected**: identical environment and an identical `pass` report as Scenario 2 — same board, same notes, same baseline counts.

## Failure diagnostics

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| `e2e:verify` exits 2 with a connection error | No instance running, or wrong port | Run `e2e:launch`; confirm the port matches. |
| `taskColumns` mismatch | Fixture changed without updating the baseline | Update [test-vault-structure.md](./contracts/test-vault-structure.md) in the same change. |
| Reactivity not detected within 5 s | Plugin refresh path broken | Inspect the running instance ad-hoc (Scenario 3). |
| Launch reports port conflict | Another process owns the port | Use `--port <alternate>`. |
