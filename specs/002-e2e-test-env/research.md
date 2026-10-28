# Research: E2E Test Infrastructure — Isolated Test Environment & Manual Test/Preview Workflow

**Feature**: `002-e2e-test-env` (consolidated with `003-manual-test-workflow`) | **Date**: 2026-10-27 (Part 1) · 2026-10-28 (Part 2)

All technical unknowns from the Technical Context are resolved below. No NEEDS CLARIFICATION items remain.

> **Merge note**: This research document consolidates the research of two previously separate features that together form the plugin's E2E test infrastructure: **Part 1** — the isolated E2E test environment & GUI automation (originally `002-e2e-test-env`), and **Part 2** — the manual test & preview workflow (originally `003-manual-test-workflow`). Part 2 builds on Part 1. All research, requirement, success-criterion, and user-story IDs are namespaced (`-002-` / `-003-`). No research item from either original document has been omitted or altered in meaning; only IDs and cross-references were updated for the consolidation.

---

## Part 1: E2E Test Environment (002)

## R-002-1. How to launch Obsidian with a CDP remote-debugging port on macOS

**Decision**: Launch with `open -a Obsidian --args --remote-debugging-port=<port> <vault-path>`. The vault path is passed as a positional argument so Obsidian opens the test vault explicitly.

**Rationale**:
- Obsidian is an Electron app; Electron exposes the standard Chromium `--remote-debugging-port` flag, which enables the Chrome DevTools Protocol (CDP) over `http://127.0.0.1:<port>`.
- `open -a` is the canonical macOS way to launch an application by name; `--args` forwards arguments to the app.
- Passing the vault path explicitly guarantees the instance targets the test vault, never a private vault (spec edge case: "Obsidian already open on a different (private) vault").

**Alternatives considered**:
- Launching the app binary directly (`/Applications/Obsidian.app/Contents/MacOS/Obsidian --remote-debugging-port=...`) — rejected: bypasses LaunchServices, can produce duplicate-instance warnings, and is less portable across macOS versions.
- Using Obsidian's URI scheme (`obsidian://open?path=...`) — rejected: the URI scheme does not forward `--remote-debugging-port`, so it cannot establish the CDP endpoint.

## R-002-2. How to make the launch command idempotent (FR-002-007, SC-002-007)

**Decision**: Before launching, probe `http://127.0.0.1:<port>/json/version` with a short-timeout `fetch`. If it responds, an instance is already listening — report "instance already available" and exit 0 without spawning a duplicate. If it does not respond, launch.

**Rationale**:
- The CDP `/json/version` endpoint is the standard, lightweight readiness probe for any Chromium/Electron debug port. A successful response proves a debuggable instance is up on that port.
- This makes repeated execution safe (SC-002-007) and distinguishes "already running" from "port occupied by an unrelated process" (see R-002-3).

**Alternatives considered**:
- Checking the process list (`pgrep -f Obsidian`) — rejected: a running Obsidian may not be debuggable (no port) or may be on a different vault; the port probe is the precise signal.
- Always launching and letting the OS deduplicate — rejected: `open` on an already-running app may just focus the existing (possibly private-vault) window, which violates the isolation requirement.

## R-002-3. How to detect a port occupied by an unrelated process (spec edge case)

**Decision**: After a launch attempt, re-probe `/json/version`. If the port is now reachable but the response does not identify an Obsidian/Chromium debug target (or the probe fails while the port is bound), report a clear, actionable error suggesting `--port <alternate>`. The launch script accepts `--port` (default 9222) so the user can move to a free port (FR-002-008).

**Rationale**:
- A bound-but-non-CDP port means another process owns it; silently failing or attaching would be unsafe. An explicit error with the `--port` hint is the actionable outcome required by the spec.

**Alternatives considered**:
- Auto-picking the next free port — rejected: it would break the "known port" assumption the verification step relies on and surprise the user; explicit configuration is simpler and more predictable (Constitution: simplicity over magic).

## R-002-4. How the verification script connects to the running instance without new NPM dependencies

**Decision**: `e2e/verify.mjs` uses only Node built-ins: `fetch` to query `http://127.0.0.1:<port>/json` (list of CDP targets) and the global `WebSocket` (Node 22+) to attach to the page target's `webSocketDebuggerUrl`. It drives the page with raw CDP commands (`Runtime.evaluate`, `Page.captureScreenshot`).

**Rationale**:
- The Constitution mandates dependency minimization; a full Playwright/Puppeteer install is unnecessary for the small, fixed set of operations needed (evaluate JS in the page, capture a screenshot).
- Node 22+ provides a stable global `WebSocket`, so no `ws` package is required.
- The agent's built-in CDP browser capability remains available for ad-hoc inspection (FR-002-017); the committed script (FR-002-016) is the repeatable, versioned standard-check path.

**Alternatives considered**:
- Adding Playwright as a devDependency — rejected: heavy, duplicates native capability, and conflicts with the dependency-minimization principle for a use case that needs only a handful of CDP calls.
- Relying solely on the agent's browser tool with no committed script — rejected by clarification Q1: the standard checks must be a committed, versioned script for reproducibility.

## R-002-5. How to detect a missing or outdated plugin build (FR-002-015, SC-002-008)

**Decision**: `e2e/setup.mjs` builds the plugin (`npm run build`) and copies `main.js`, `manifest.json`, `styles.css` into `test-vault/.obsidian/plugins/obsidian-usm-plugin/`. `e2e/verify.mjs` (and `launch.mjs`) pre-flight checks that `main.js` exists in the test vault and that its `manifest.json` version matches the repository `manifest.json` version; on mismatch or absence it reports a clear "build missing/outdated — run `npm run e2e:setup`" error and exits non-zero before any verification.

**Rationale**:
- The spec requires detecting and reporting a broken build rather than testing it (SC-002-008). Comparing the installed `manifest.json` version against the repo source is a cheap, reliable freshness signal.
- Keeping the build step in a dedicated `setup` script (not inside verification) matches the "plugin build prerequisite" assumption: the environment detects and reports, and the developer runs setup explicitly.

**Alternatives considered**:
- Hash-comparing `main.js` against a fresh build on every verify — rejected: slower and requires a build on the verify path; the version check plus an explicit setup step is simpler and sufficient.
- Building automatically inside verify — rejected: it couples verification to the build toolchain and hides setup failures.

## R-002-6. Where screenshots and verification output are stored

**Decision**: Screenshots and the JSON report are written to `e2e/output/` (gitignored). The JSON report references the screenshot by relative path.

**Rationale**:
- Keeps generated artifacts out of version control (project rule: no committed build artifacts) while giving the agent and developer a stable, documented location to inspect results.
- A gitignored output directory avoids polluting the repository with binary screenshots.

**Alternatives considered**:
- Writing screenshots into `test-vault/` — rejected: it would make the vault non-reproducible (FR-002-004) and mix generated output with fixture data.
- Printing base64 screenshots to stdout — rejected: unwieldy for large images and not persistable for later review.

## R-002-7. What the known verification baseline is (SC-002-004)

**Decision**: The test vault's board has a fixed, documented structure used as the expected baseline: **4 task columns**, **3 activity columns**, **3 release rows**, and **8 story cards** (7 story notes + 1 broken-link placeholder). The exact expected counts are defined in `contracts/test-vault-structure.md` and derived from the committed `Board.md` + story notes.

**Rationale**:
- SC-002-004 requires 100% accuracy of the reported task-column count against a known fixture; a fixed, committed baseline makes the check deterministic.
- Deriving the baseline from the same fixture files the plugin parses keeps the contract self-consistent and reviewable.

**Alternatives considered**:
- Computing the expected count dynamically from the notes at verify time — rejected: it would make the test tautological (comparing the plugin's output to a re-implementation of the plugin's logic) instead of checking against an independently fixed expectation.

## R-002-8. How the reactivity check works within the 5-second bound (SC-002-006)

**Decision**: The verify script (a) reads a structural signature (e.g., task-column count or card count) via CDP `Runtime.evaluate`, (b) triggers a source change by appending/modifying a story note in the test vault through the filesystem, (c) polls the signature via CDP until it changes or a 5-second deadline elapses, and (d) reports pass/fail with the measured delay.

**Rationale**:
- The plugin debounces map refreshes at 250 ms (`src/obsidian/board-view.ts`), so a 5-second detection bound gives a large safety margin while still catching a broken reactivity path.
- Polling a structural signature (not a pixel diff) matches the "reactivity scope" assumption: verify structure/count/content update, not pixel-perfect equality.

**Alternatives considered**:
- Waiting for a CDP `Runtime` console event from the plugin — rejected: it requires instrumenting the plugin and couples the test to internal logging.
- Pixel-diffing screenshots before/after — rejected: brittle to theme/scroll differences and outside the stated reactivity scope.

---

## Part 2: Manual Test & Preview Workflow (003)

Resolves the unknowns from the plan's Technical Context and records the design decisions for Phase 1. All decisions favor the constitution's dependency minimization and "simplicity over magic" rules.

## R-003-1 — Skill placement and discoverability

- **Decision**: A single project-local skill at `.github/skills/usm-e2e/SKILL.md` (YAML frontmatter: `name: usm-e2e`, a discoverable `description`), following the existing `usm-task-protocol` precedent. No reference files in the first iteration — one self-contained SKILL.md (FR-003-002).
- **Rationale**: Project-local skills under `.github/skills/` are listed in the agent's skill index (name + description preloaded, body on demand) and are NOT listed in `.specify/integrations/*.manifest.json`, so `speckit update` cannot overwrite or remove them. This is the exact pattern already proven by `usm-task-protocol`.
- **Alternatives considered**: (a) a top-level `E2E.md` doc — rejected: not discoverable from the skill index, agents would have to be told to read it; (b) a skill listed in an integration manifest — rejected: `speckit update` would overwrite it (FR-003-002 requires surviving tooling updates).

## R-003-2 — Inspection CLI shape

- **Decision**: One file, `e2e/inspect.mjs`, with three subcommands — `eval <expression>`, `wait <css-selector> [--timeout <ms>]`, `screenshot <path>` — all accepting `--port <number>` (default 9222). It imports `connect()` from the existing `e2e/cdp.mjs` and uses only Node built-ins. A thin `package.json` script `e2e:inspect` wraps it.
- **Rationale**: `cdp.mjs` already exposes exactly the primitives needed (`evaluate`, `screenshot`, `probe`) with fail-fast hints; the CLI is a thin argument-parsing layer over them (FR-003-005, FR-003-007). One file keeps the skill lean (SC-003-004: a single documented command).
- **Alternatives considered**: (a) one file per operation — rejected: three near-identical files, over-engineering; (b) adding the operations to `verify.mjs` — rejected: `verify.mjs` is the standard-checks runner with its own report contract; mixing ad-hoc operations into it would blur the two purposes; (c) Playwright/Puppeteer — rejected: new NPM dependency, forbidden by FR-003-007 and the constitution.

## R-003-3 — CLI exit codes and output

- **Decision**: Exit codes consistent with the Part 1 tooling: `0` = success; `1` = operation failed (wait timeout, page evaluation exception); `2` = environment error before the operation ran (no CDP instance on the port). `eval` prints the evaluated value (JSON) to stdout; `wait` prints a one-line result; `screenshot` prints the written path. Every environment error includes the hint `(run npm run e2e:launch)`.
- **Rationale**: Consistency with `e2e:verify` (0/1/2) means the skill can document one exit-code table for the whole `e2e/` toolset (FR-003-006).
- **Alternatives considered**: distinct exit codes per operation — rejected: no added value, harder to document.

## R-003-4 — Mobile emulation application

- **Decision**: The skill documents a deterministic mobile-scenario sequence: (1) `eval` `this.app.emulateMobile(true)` in the page context, (2) reload the page (`location.reload()`) so the mobile UI mode is applied, (3) wait for the board selector, (4) capture evidence / assert the layout **under the viewport override applied within the same connection as the action** (`screenshot <path> --viewport 375x667 --mobile` / `eval <expr> --viewport 375x667 --mobile`, CDP `Emulation.setDeviceMetricsOverride`) so the plugin's viewport-based mobile layout (`@media (max-width: 768px)`) matches, (5) restore: `eval` `this.app.emulateMobile(false)` + reload. The restore step is documented as mandatory (spec edge case: mobile emulation state leak — the emulation flag persists until cleared; the `--viewport` override is cleared automatically at the end of the call).
- **Rationale**: The official docs confirm `emulateMobile(true/false)` works in the page context (Developer Tools Console), which is exactly what the `eval` operation drives. The docs do not guarantee an immediate re-render, so the explicit reload makes the sequence deterministic and idempotent; a relaunch also resets the state (documented fallback). Live verification (2026-10-28, bug `emulate-mobile-viewport-gap`) showed two things: (a) `emulateMobile(true)` alone does **not** resize the viewport — it only flips the flag and body classes — so the viewport override is a separate, required step for the layout to apply; (b) the CDP device-metrics override is **session-scoped** — visible target-wide only while the connection that set it is open, and cleared when that connection closes (it survives page reloads while the setting connection stays open). A standalone `viewport` call (connect → set → close) therefore cannot hold the override for a later, separate `screenshot`/`eval` call; the `--viewport` flag on `eval`/`screenshot` (set before the action, cleared after, same connection) is the reliable mechanism. The standalone `viewport` operation remains for diagnostics.
- **Alternatives considered**: (a) assume the layout switches without reload — rejected: non-deterministic, would make mobile scenarios flaky; (b) physical device only — rejected: the user explicitly wants the agent to run mobile scenarios (clarification, Session 2026-10-27); (c) key the plugin CSS off `body.is-mobile` instead of the media query — rejected: product behavior change to work around a tooling gap, couples the layout to Obsidian's internal class names (bug assessment, 2026-10-28).

## R-003-5 — Extended board fixture: source and naming

- **Decision**: The extended "Test Board 2" fixture is **recreated from its documented baseline** (the Iteration 2 layout checks Q11–Q14 in `specs/001-user-story-map/checklists/manual-validation.md`: 8 stories, multiple releases, long epic titles, unassigned sections) and committed to `test-vault/boards/` as `Test Board 2.md` + story notes **`T1.md`–`T8.md`**. The exact expected rendered structure is fixed in `contracts/extended-board-baseline.md`.
- **Rationale**: The original fixture lives in the user's private vault (`projects/Story Map Builder/Test Board 2/`), which the workflow must never read (FR-003-010) — so it cannot be copied; it is recreated from the documented baseline. Distinct note names (`T1`–`T8`) are **required**: Obsidian wikilinks resolve vault-wide, so reusing `S1`–`S6` names would make the two boards share story notes and cross-board interference would be impossible to test (FR-003-009, US-003-03 scenario 5).
- **Alternatives considered**: (a) copy from the private vault — rejected: FR-003-010; (b) replace `Board.md` — rejected: the user chose coexistence (clarification), and the Part 1 contract (`taskColumns: 4`) must stay untouched; (c) reuse `S1`–`S8` names — rejected: vault-wide wikilink resolution would couple the boards.

## R-003-6 — Same-folder board arrangement

- **Decision**: The committed vault uses the **separate-folder** arrangement (`test-vault/boards/`). The **same-folder** arrangement is a documented ad-hoc verification step in the skill and quickstart: create a variant board file in the vault root (distinct name, e.g. `Board variant.md`), verify it renders independently, delete it, and restore a clean tree.
- **Rationale**: FR-003-009 requires both arrangements to work and be testable, but committing a third board in the root would permanently change the standard-verify environment; an ad-hoc step keeps the committed vault stable while still making the arrangement testable on demand.
- **Alternatives considered**: committing both arrangements — rejected: fixture drift risk and a dirtier standard-verify baseline.

## R-003-7 — Screenshot persistence

- **Decision**: Manual-assist screenshots are committed under the feature's `checklists/` directory with the naming `<scenario-id>-<slug>.png` (e.g. `M3-mobile-layout.png`); automated-check screenshots stay in the gitignored `e2e/output/`. The skill prescribes which kind a given scenario produces.
- **Rationale**: Direct implementation of the user's hybrid decision (clarification): human-judgment evidence is not easily reproducible and must survive; automated evidence is reproducible on demand and must not bloat the repo (FR-003-003).
- **Alternatives considered**: all screenshots committed — rejected: reproducible artifacts would bloat the repo; all local — rejected: subjective judgments would lose their evidence.

## R-003-8 — Task-writing convention

- **Decision**: The convention is documented in `contracts/task-convention.md` and pointed to from `AGENTS.md`. A manual-verification task in `tasks.md` MUST: (1) reference the skill by name (`usm-e2e`), (2) name the checklist file and section to update, (3) mark the scenario mode (automatable / subjective / live interaction), (4) target the test vault (never the private vault).
- **Rationale**: FR-003-008 requires the convention to be documented and discoverable; `AGENTS.md` is loaded into every agent session, so a one-line pointer there makes the convention effective without relying on the agent finding the contract file.
- **Alternatives considered**: encoding the convention only in the skill — rejected: task authors (agents writing `tasks.md`) may not load the skill before writing tasks; the `AGENTS.md` pointer guarantees visibility.

## R-003-9 — On-demand interactive sessions

- **Decision**: No new tooling. The skill documents the on-demand loop: probe the port (`e2e:launch` is idempotent — it exits 0 when an instance is already up) → perform operations via `e2e/inspect.mjs` (navigation, view switching, clicks, typing, mobile emulation — all `eval` expressions) → deliver the result (screenshot / evaluated state) → iterate (change → `e2e:setup` if the build changed → reload → inspect).
- **Rationale**: US-003-04/FR-003-013 are a *mode* of using the existing tools, not new capability; the Part 1 launch idempotency (SC-002-007 there) already makes "ensure the instance is running" a single command.
- **Alternatives considered**: a dedicated "session" subcommand in `inspect.mjs` — rejected: a persistent interactive session would require a REPL/daemon, adding complexity with no value over the probe-then-operate loop.

## R-003-10 — Multi-board coexistence verification

- **Decision**: Coexistence is verified by opening each board in turn and checking its own baseline: `Board.md` → the Part 1 baseline (`taskColumns: 4`, 8 cards); `Test Board 2.md` → the extended baseline (4 release sections, 8 cards, long epic titles). Switching back and forth must reproduce both baselines; the `usm-view` frontmatter attribute is per-file, so view state cannot leak between boards.
- **Rationale**: FR-003-009/US-003-03 scenario 5 define the test target as "each board renders its own structure independently with no cross-board interference" — the two-baseline check is the direct, deterministic expression of that.
- **Alternatives considered**: a dedicated multi-board check in `verify.mjs` — rejected: `verify.mjs`'s report contract is fixed by Part 1 and must stay untouched; coexistence is a manual/inspection scenario, not a standard check.
