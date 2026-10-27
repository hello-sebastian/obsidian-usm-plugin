# Phase 0 Research: Isolated E2E Test Environment & GUI Automation

**Feature**: `002-e2e-test-env` | **Date**: 2026-10-27

All technical unknowns from the Technical Context are resolved below. No NEEDS CLARIFICATION items remain.

## R1. How to launch Obsidian with a CDP remote-debugging port on macOS

**Decision**: Launch with `open -a Obsidian --args --remote-debugging-port=<port> <vault-path>`. The vault path is passed as a positional argument so Obsidian opens the test vault explicitly.

**Rationale**:
- Obsidian is an Electron app; Electron exposes the standard Chromium `--remote-debugging-port` flag, which enables the Chrome DevTools Protocol (CDP) over `http://127.0.0.1:<port>`.
- `open -a` is the canonical macOS way to launch an application by name; `--args` forwards arguments to the app.
- Passing the vault path explicitly guarantees the instance targets the test vault, never a private vault (spec edge case: "Obsidian already open on a different (private) vault").

**Alternatives considered**:
- Launching the app binary directly (`/Applications/Obsidian.app/Contents/MacOS/Obsidian --remote-debugging-port=...`) — rejected: bypasses LaunchServices, can produce duplicate-instance warnings, and is less portable across macOS versions.
- Using Obsidian's URI scheme (`obsidian://open?path=...`) — rejected: the URI scheme does not forward `--remote-debugging-port`, so it cannot establish the CDP endpoint.

## R2. How to make the launch command idempotent (FR-007, SC-007)

**Decision**: Before launching, probe `http://127.0.0.1:<port>/json/version` with a short-timeout `fetch`. If it responds, an instance is already listening — report "instance already available" and exit 0 without spawning a duplicate. If it does not respond, launch.

**Rationale**:
- The CDP `/json/version` endpoint is the standard, lightweight readiness probe for any Chromium/Electron debug port. A successful response proves a debuggable instance is up on that port.
- This makes repeated execution safe (SC-007) and distinguishes "already running" from "port occupied by an unrelated process" (see R3).

**Alternatives considered**:
- Checking the process list (`pgrep -f Obsidian`) — rejected: a running Obsidian may not be debuggable (no port) or may be on a different vault; the port probe is the precise signal.
- Always launching and letting the OS deduplicate — rejected: `open` on an already-running app may just focus the existing (possibly private-vault) window, which violates the isolation requirement.

## R3. How to detect a port occupied by an unrelated process (spec edge case)

**Decision**: After a launch attempt, re-probe `/json/version`. If the port is now reachable but the response does not identify an Obsidian/Chromium debug target (or the probe fails while the port is bound), report a clear, actionable error suggesting `--port <alternate>`. The launch script accepts `--port` (default 9222) so the user can move to a free port (FR-008).

**Rationale**:
- A bound-but-non-CDP port means another process owns it; silently failing or attaching would be unsafe. An explicit error with the `--port` hint is the actionable outcome required by the spec.

**Alternatives considered**:
- Auto-picking the next free port — rejected: it would break the "known port" assumption the verification step relies on and surprise the user; explicit configuration is simpler and more predictable (Constitution: simplicity over magic).

## R4. How the verification script connects to the running instance without new NPM dependencies

**Decision**: `e2e/verify.mjs` uses only Node built-ins: `fetch` to query `http://127.0.0.1:<port>/json` (list of CDP targets) and the global `WebSocket` (Node 22+) to attach to the page target's `webSocketDebuggerUrl`. It drives the page with raw CDP commands (`Runtime.evaluate`, `Page.captureScreenshot`).

**Rationale**:
- The Constitution mandates dependency minimization; a full Playwright/Puppeteer install is unnecessary for the small, fixed set of operations needed (evaluate JS in the page, capture a screenshot).
- Node 22+ provides a stable global `WebSocket`, so no `ws` package is required.
- The agent's built-in CDP browser capability remains available for ad-hoc inspection (FR-017); the committed script (FR-016) is the repeatable, versioned standard-check path.

**Alternatives considered**:
- Adding Playwright as a devDependency — rejected: heavy, duplicates native capability, and conflicts with the dependency-minimization principle for a use case that needs only a handful of CDP calls.
- Relying solely on the agent's browser tool with no committed script — rejected by clarification Q1: the standard checks must be a committed, versioned script for reproducibility.

## R5. How to detect a missing or outdated plugin build (FR-015, SC-008)

**Decision**: `e2e/setup.mjs` builds the plugin (`npm run build`) and copies `main.js`, `manifest.json`, `styles.css` into `test-vault/.obsidian/plugins/obsidian-usm-plugin/`. `e2e/verify.mjs` (and `launch.mjs`) pre-flight checks that `main.js` exists in the test vault and that its `manifest.json` version matches the repository `manifest.json` version; on mismatch or absence it reports a clear "build missing/outdated — run `npm run e2e:setup`" error and exits non-zero before any verification.

**Rationale**:
- The spec requires detecting and reporting a broken build rather than testing it (SC-008). Comparing the installed `manifest.json` version against the repo source is a cheap, reliable freshness signal.
- Keeping the build step in a dedicated `setup` script (not inside verification) matches the "plugin build prerequisite" assumption: the environment detects and reports, and the developer runs setup explicitly.

**Alternatives considered**:
- Hash-comparing `main.js` against a fresh build on every verify — rejected: slower and requires a build on the verify path; the version check plus an explicit setup step is simpler and sufficient.
- Building automatically inside verify — rejected: it couples verification to the build toolchain and hides setup failures.

## R6. Where screenshots and verification output are stored

**Decision**: Screenshots and the JSON report are written to `e2e/output/` (gitignored). The JSON report references the screenshot by relative path.

**Rationale**:
- Keeps generated artifacts out of version control (project rule: no committed build artifacts) while giving the agent and developer a stable, documented location to inspect results.
- A gitignored output directory avoids polluting the repository with binary screenshots.

**Alternatives considered**:
- Writing screenshots into `test-vault/` — rejected: it would make the vault non-reproducible (FR-004) and mix generated output with fixture data.
- Printing base64 screenshots to stdout — rejected: unwieldy for large images and not persistable for later review.

## R7. What the known verification baseline is (SC-004)

**Decision**: The test vault's board has a fixed, documented structure used as the expected baseline: **4 task columns**, **3 activity columns**, **3 release rows**, and **8 story cards** (7 story notes + 1 broken-link placeholder). The exact expected counts are defined in `contracts/test-vault-structure.md` and derived from the committed `Board.md` + story notes.

**Rationale**:
- SC-004 requires 100% accuracy of the reported task-column count against a known fixture; a fixed, committed baseline makes the check deterministic.
- Deriving the baseline from the same fixture files the plugin parses keeps the contract self-consistent and reviewable.

**Alternatives considered**:
- Computing the expected count dynamically from the notes at verify time — rejected: it would make the test tautological (comparing the plugin's output to a re-implementation of the plugin's logic) instead of checking against an independently fixed expectation.

## R8. How the reactivity check works within the 5-second bound (SC-006)

**Decision**: The verify script (a) reads a structural signature (e.g., task-column count or card count) via CDP `Runtime.evaluate`, (b) triggers a source change by appending/modifying a story note in the test vault through the filesystem, (c) polls the signature via CDP until it changes or a 5-second deadline elapses, and (d) reports pass/fail with the measured delay.

**Rationale**:
- The plugin debounces map refreshes at 250 ms (`src/obsidian/board-view.ts`), so a 5-second detection bound gives a large safety margin while still catching a broken reactivity path.
- Polling a structural signature (not a pixel diff) matches the "reactivity scope" assumption: verify structure/count/content update, not pixel-perfect equality.

**Alternatives considered**:
- Waiting for a CDP `Runtime` console event from the plugin — rejected: it requires instrumenting the plugin and couples the test to internal logging.
- Pixel-diffing screenshots before/after — rejected: brittle to theme/scroll differences and outside the stated reactivity scope.
