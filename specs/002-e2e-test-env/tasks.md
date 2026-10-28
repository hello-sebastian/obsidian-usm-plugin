# Tasks: E2E Test Infrastructure — Isolated Test Environment & Manual Test/Preview Workflow

**Input**: Design documents from `/specs/002-e2e-test-env/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: No TDD/test tasks — the feature specification does not request them and this feature adds no plugin domain logic (Constitution TDD rule applies to domain logic only). Validation is performed via the `quickstart.md` scenarios against a live test-vault instance; the `e2e/verify.mjs` and `e2e/inspect.mjs` scripts are the test mechanisms.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

> **Merge note**: This task list consolidates the task lists of two previously separate features that together form the plugin's E2E test infrastructure: **Part 1** — the isolated E2E test environment & GUI automation (originally `002-e2e-test-env`), and **Part 2** — the manual test & preview workflow (originally `003-manual-test-workflow`). Part 2 builds on Part 1. All task, requirement, success-criterion, user-story, and research IDs are namespaced (`-002-` / `-003-`) so the two parts stay unambiguous. No task from either original list has been omitted or altered in meaning; only IDs and cross-references were updated for the consolidation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

**Commit cadence (Constitution — Logical Atomicity Protocol)**: one commit per phase, bundling the phase's code changes and all of the phase's task checkoffs.

---

## Part 1: E2E Test Environment (002)

### Phase 1: Setup (Shared Infrastructure)

**Purpose**: Repository-level scaffolding shared by all user stories

- [X] T002-001 Create the `e2e/` directory at the repository root and add npm scripts to `package.json`: `"e2e:setup": "node e2e/setup.mjs"`, `"e2e:launch": "node e2e/launch.mjs"`, `"e2e:verify": "node e2e/verify.mjs"`
- [X] T002-002 [P] Add to `.gitignore`: `test-vault/.obsidian/plugins/obsidian-usm-plugin/main.js` (build artifact — never committed) and `e2e/output/` (generated screenshots and reports)

**Checkpoint**: `e2e/` exists, npm scripts are registered, gitignore rules in place

---

### Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The build/install pipeline that every user story depends on (US-002-01 needs the plugin installed; US-002-02/US-002-03 pre-flight check the build)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002-003 Implement `e2e/setup.mjs` (Node ESM, Node 22+, English comments): run `npm run build`, then copy `main.js`, `manifest.json`, and `styles.css` from the repository root into `test-vault/.obsidian/plugins/obsidian-usm-plugin/` (create directories as needed); verify each copied file's SHA-256 matches the source (abort non-zero on mismatch); print a summary (files copied, sizes, manifest version). Per contracts/test-vault-structure.md: `manifest.json` and `styles.css` are committed source files refreshed by setup; `main.js` is the gitignored build artifact

**Checkpoint**: `npm run e2e:setup` produces a complete, hash-verified plugin installation in the test vault

---

### Phase 3: User Story 1 (US-002-01) - Isolated Test Vault (Priority: P1) 🎯 MVP

**Goal**: A dedicated, self-contained, reproducible test vault in the repository so the plugin can be exercised without any risk to private notes (FR-002-001…FR-002-005)

**Independent Test**: Open `test-vault/` in Obsidian with the plugin enabled and confirm the board renders from the sample notes; no file outside `test-vault/` is read or modified

#### Implementation for User Story 1 (US-002-01)

- [X] T002-004 [P] [US1] Create `test-vault/Board.md` conforming to `specs/001-user-story-map/contracts/board-file-format.md`: frontmatter `usm-board: true`, `usm-release-order: appearance`; body = ordered wikilink list `- [[S1]]`, `- [[S2]]`, `- [[S3]]`, `- [[S4]]`, `- [[S5]]`, `- [[S6]]`, `- [[S1|Create first board (duplicate)]]`, `- [[Missing story]]` (broken link on purpose — must render a dimmed placeholder, never crash)
- [X] T002-005 [P] [US1] Create the six sample story notes in `test-vault/` per the fixture table in contracts/test-vault-structure.md: `S1.md` (activity: Onboarding, task: First run, epic: "[[Onboarding flow]]", release: "1.0 MVP", story: Create first board), `S2.md` (activity: Onboarding, task: First run, release: "1.0 MVP", title: First login — epic intentionally missing), `S3.md` (no frontmatter at all — Unassigned at every level, title falls through to file name), `S4.md` (Polish field names: aktywność: Logowanie, zadanie: Login, epik: "[[Auth]]", wydanie: "2.0", title: Historia po polsku), `S5.md` (task: first run, epic: "[[Onboarding flow]]", release: "2.0", story: Profile setup — activity missing, lower-cased task), `S6.md` (activity: onboarding, task: First run, epic: "[[Onboarding flow]]", title: Login flow — release missing, lower-cased activity)
- [X] T002-006 [P] [US1] Create `test-vault/.obsidian/community-plugins.json` containing `["obsidian-usm-plugin"]` so the plugin is enabled when the vault is opened
- [X] T002-007 [US1] Run `npm run e2e:setup` to install the plugin into the test vault, then open `test-vault/` in Obsidian and verify: the board renders with the baseline structure from contracts/test-vault-structure.md — 4 task columns (`.usm-header-cell--task`), 3 activity columns, 3 release rows (`section.usm-release`), 8 story cards (`.usm-story-card`: 7 notes + 1 broken-link placeholder); notes with missing attributes land in "Unassigned" sections without errors (FR-002-003, SC-002-004 baseline)

**Checkpoint**: User Story 1 complete — the isolated, reproducible test vault renders the known board structure; a fresh clone + `npm run e2e:setup` reproduces it (FR-002-004)

---

### Phase 4: User Story 2 (US-002-02) - Remote Debugging Access (Priority: P2)

**Goal**: A dedicated, idempotent launch command that opens Obsidian on the test vault with a CDP remote-debugging port (FR-002-006…FR-002-009)

**Independent Test**: Run `npm run e2e:launch` and confirm an external CDP client can connect to `http://127.0.0.1:9222/json/version` and see the application's UI

#### Implementation for User Story 2 (US-002-02)

- [X] T002-008 [US2] Implement `e2e/launch.mjs` (Node ESM, Node 22+, English comments) per contracts/launch-cli.md: parse `--port <number>` (default `9222`); pre-flight build check — `test-vault/.obsidian/plugins/obsidian-usm-plugin/main.js` must exist and its `manifest.json` version must equal the repository `manifest.json` version, otherwise print `run npm run e2e:setup` and exit non-zero (FR-002-015, SC-002-008); idempotency probe — `fetch http://127.0.0.1:<port>/json/version` with a short timeout, on success print "Instance already available on port <port>" and exit 0 without launching (FR-002-007, SC-002-007); launch via `open -a Obsidian --args --remote-debugging-port=<port> <absolute test-vault path>` (vault path passed explicitly — never a private vault); bounded readiness poll of `/json/version` (≤ 30 s, SC-002-003); if the port is bound but does not serve a CDP endpoint after launch, print an actionable error suggesting `--port <alternate>` and exit non-zero (spec edge case: port occupied by an unrelated process)

**Checkpoint**: User Story 2 complete — `npm run e2e:launch` is idempotent, port-configurable, and always targets the test vault; repeated runs spawn no duplicates

---

### Phase 5: User Story 3 (US-002-03) - Automated Visual & DOM Verification (Priority: P3)

**Goal**: A committed, versioned verification script that connects over CDP, performs the standard checks, and emits a machine-readable pass/fail report (FR-002-010…FR-002-014, FR-002-016)

**Independent Test**: With a debuggable instance running, `npm run e2e:verify` reports the expected task-column count (4), writes a screenshot, detects a source-note change within 5 seconds, and exits 0 with `status: "pass"`

#### Implementation for User Story 3 (US-002-03)

- [X] T002-009 [US3] Implement `e2e/cdp.mjs` (Node ESM, Node 22+, English comments): a minimal CDP client using only Node built-ins (global `fetch` + global `WebSocket` — no NPM dependencies, per research.md R-002-4): `probe(port)` → GET `http://127.0.0.1:<port>/json/version` with timeout, returns version info or null; `listTargets(port)` → GET `http://127.0.0.1:<port>/json`, returns page targets with `webSocketDebuggerUrl`; `connect(port)` → attaches a WebSocket to the first page target and exposes `evaluate(expression)` (CDP `Runtime.evaluate`, `returnByValue: true`) and `screenshot(filePath)` (CDP `Page.captureScreenshot`, writes PNG); all failures reject with a diagnostic message including a connection-failure hint (spec edge case: browser tool cannot connect)
- [X] T002-010 [US3] Implement `e2e/verify.mjs` (Node ESM, Node 22+, English comments) per contracts/verification-report.md: parse `--port <number>` (default `9222`); pre-flight — CDP probe must succeed (else exit 2 with a connection-failure hint in `errors`) and the build check from contracts/launch-cli.md must pass (else exit 2); open the board in map view — navigate the page to the `Board.md` note (e.g., `obsidian://open?path=<vault>/Board.md`) and, if the view is not `map`, click the view-switch control (`button[aria-label="Change view"]` → menu item "USM board") via `evaluate` (FR-002-010); wait until `.usm-board` is present in the DOM (bounded wait)
- [X] T002-011 [US3] Add the standard checks to `e2e/verify.mjs` (depends on T002-010): (1) task-columns — count `.usm-board-header .usm-header-cell--task` via `evaluate` and compare against expected `4` from contracts/test-vault-structure.md (FR-002-011, SC-002-004); (2) screenshot — capture the map to `e2e/output/board.png` via `screenshot()` (FR-002-012, SC-002-005); (3) reactivity — record a structural signature (e.g., `.usm-story-card` count, expected baseline `8`), modify a story note in the test vault (e.g., append a new story link to `Board.md`), poll the signature via `evaluate` until it changes or the `5000` ms bound elapses, record `delayMs`, then restore the fixture file to its committed content so the vault stays reproducible (FR-002-013, SC-002-006)
- [X] T002-012 [US3] Add report emission and exit codes to `e2e/verify.mjs` (depends on T002-011): build the JSON report exactly per contracts/verification-report.md — `status` (`"pass"` only if every check passed, else `"fail"`), `port`, `timestamp` (ISO-8601 UTC), `checks[]` (each: `id`, `name`, `passed`, `actual`, `expected`, optional `detail`), `taskColumns`, `screenshot` (relative path), `reactivity` (`{ detected, delayMs, boundMs: 5000 }`), `errors[]`; write it to `e2e/output/report.json` and print it to stdout; exit `0` on pass, `1` on failed checks, `2` on environment error before checks ran (FR-002-014)

**Checkpoint**: User Story 3 complete — `npm run e2e:verify` runs the full standard-check suite against a live instance and produces an agent-interpretable JSON report; the agent can additionally perform ad-hoc CDP inspection (FR-002-017)

---

### Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and end-to-end validation of the complete feature

- [X] T002-013 [P] Write `e2e/README.md` (English): prerequisites (macOS, Obsidian desktop, Node 22+), the three npm scripts and their options, the CDP endpoints, the output locations (`e2e/output/`), and a pointer to `specs/002-e2e-test-env/quickstart.md`
- [X] T002-014 Run the full quickstart.md validation sequence from a clean state: `npm run e2e:setup` → `npm run e2e:launch` (twice, to confirm idempotency) → `npm run e2e:verify` (expect `status: "pass"`, `taskColumns: 4`, `reactivity.delayMs <= 5000`, exit 0) → delete `test-vault/.obsidian/plugins/obsidian-usm-plugin/main.js` and re-run verify (expect exit 2 with the setup hint, SC-002-008) → confirm `git status` shows no untracked/modified files outside the committed fixture set (SC-002-002 isolation, FR-002-004 reproducibility)

**Checkpoint**: Feature complete — all quickstart scenarios pass; documentation in place

---

### Dependencies & Execution Order

#### Story Completion Order

1. **Phase 1 (Setup) + Phase 2 (Foundational)** — MUST complete first (T002-001–T002-003)
2. **User Story 1 (T002-004–T002-007)** — depends on Phase 2 (setup script installs the plugin)
3. **User Story 2 (T002-008)** — depends on US-002-01 (launch targets the test vault and pre-flights its build)
4. **User Story 3 (T002-009–T002-012)** — depends on US-002-02 (verification attaches to a launched instance); T002-009 is independent of T002-010–T002-012 and can start as soon as US-002-02 exists
5. **Polish (T002-013–T002-014)** — depends on all stories; T002-013 is independent of T002-014

#### Parallel Opportunities

- **Phase 1**: T002-001 ∥ T002-002 (different files)
- **US-002-01**: T002-004 ∥ T002-005 ∥ T002-006 (independent fixture files) — then T002-007 (integration verification)
- **US-002-03**: T002-009 ∥ T002-010 (separate files: `e2e/cdp.mjs` vs `e2e/verify.mjs` scaffolding) — T002-011 and T002-012 extend `e2e/verify.mjs` sequentially
- **Polish**: T002-013 ∥ T002-014 (README vs live validation run)

#### MVP Scope

**User Story 1 alone is the MVP**: a safe, reproducible environment where the plugin can be loaded and exercised manually. US-002-02 and US-002-03 build the automation on top of it.

---

### Implementation Strategy

1. **MVP first**: deliver Phase 1 → 2 → 3 (Setup, Foundational, US-002-01) and commit per phase. At that point the test vault is usable manually.
2. **Incremental delivery**: add US-002-02 (launch), then US-002-03 (verification), each as a complete, independently testable increment with its own checkpoint.
3. **Validate at every checkpoint**: use the quickstart.md scenarios for the story just completed; finish with the full Phase 6 validation run.
4. **Never test a broken build**: the pre-flight checks (T002-008, T002-010) guarantee SC-002-008 at every entry point.

---

### Phase 7: Convergence

**Purpose**: Close robustness gaps found by the 2026-10-28 convergence assessment (Part 2 runtime findings exposed weaknesses in the Part 1 tooling). All three findings are `partial` / MEDIUM — the base scenarios work, but the tooling and contracts do not reflect the lessons learned in practice.

- [X] T002-015 Scope the standard checks in `e2e/verify.mjs` to the board it opened (FR-002-011, SC-002-004, partial): `checkTaskColumns` and `checkReactivity` currently use global `document.querySelectorAll` calls that sum **every** open board — with a second board open (e.g. `test-vault/boards/Test Board 2.md` from Part 2) the run reports `taskColumns: 6` and a false reactivity failure. Either scope the queries to the `.usm-board` element that `openBoardInMapView` opened (e.g. via a marker or the active leaf's view container), or detect multiple `.usm-board` elements and fail with a clear "single-board precondition" message in `errors` (exit 2). Update `contracts/verification-report.md` with the single-board precondition.
- [X] T002-016 Make `e2e/launch.mjs` recover from an alive-but-windowless instance (FR-002-007, SC-002-007, partial): the idempotency probe checks only the port (`/json/version`), so when Obsidian is alive in the background with no window, launch prints "Instance already available" and exits 0 **without opening a window** — the subsequent `e2e:verify` then fails with "No CDP page targets". When the port responds but `listTargets` returns no page targets, open the test vault window (`open -a Obsidian <absolute test-vault path>`) and continue the readiness poll instead of exiting 0. Document this edge case in `contracts/launch-cli.md` (Behavior step 2).
- [X] T002-017 Replace the URI navigation in `e2e/verify.mjs` with the reliable API open-note method (FR-002-010, partial): `openBoardInMapView` uses `location.href = 'obsidian://open?path=Board.md'`, which is intermittently rejected ("Vault not found"). Use the API method documented in the `usm-e2e` skill — `app.workspace.getLeaf(true).openFile(app.vault.getAbstractFileByPath('Board.md'))` — via `evaluate`, keeping the URI form (or the view-switch fallback) only as a secondary fallback.

**Checkpoint**: `e2e:verify` reports the baseline (`taskColumns: 4`) with multiple boards open or fails with a clear single-board message; `e2e:launch` always leaves a visible, connectable window on the test vault; board opening no longer depends on the flaky URI scheme. Contracts updated in the same change.

---

## Part 2: Manual Test & Preview Workflow (003)

### Phase 1: Setup & Foundational

**Purpose**: Repository-level config and a green-baseline gate. The Part 1 infrastructure (test vault, `e2e:setup` / `e2e:launch` / `e2e:verify`, `cdp.mjs`) is the existing foundation and is unchanged by this feature — there is no separate Foundational phase; the only prerequisite work is registering the new CLI script and confirming the foundation is green before building on it.

- [X] T003-001 [P] Add `"e2e:inspect": "node e2e/inspect.mjs"` to the `scripts` block in `package.json` (a thin wrapper for the ad-hoc inspection CLI delivered in US-003-02; consistent with the existing `e2e:setup` / `e2e:launch` / `e2e:verify` scripts)
- [X] T003-002 Run the Part 1 baseline verification to establish a green starting point: `npm run e2e:setup` → `npm run e2e:launch` → `npm run e2e:verify`, expecting `status: "pass"`, `taskColumns: 4`, exit 0; then confirm `git status --porcelain` shows no modified tracked files (only the untracked `specs/002-e2e-test-env/` design artifacts). This is the blocking gate — no user story work begins until the foundation is confirmed green

**Checkpoint**: The `e2e:inspect` script is registered and the Part 1 baseline is confirmed green (`taskColumns: 4`)

---

### Phase 2: User Story 1 (US-003-01) - Discoverable Manual-Verification Skill (Priority: P1) 🎯 MVP

**Goal**: A discoverable, self-contained project-local skill that documents the core manual/E2E verification workflow — environment preparation, standard checks, the manual-assist protocol, and clean session handling — so any agent in any session can safely bring up a debuggable instance and verify the plugin without rediscovering the infrastructure or touching the private vault (FR-003-001…FR-003-004, FR-003-011, FR-003-012)

**Independent Test**: In a fresh session, the agent discovers the skill from the skill index, follows it to run environment setup and launch, performs the standard check, and completes one manual-assist scenario with the user — all without any instruction outside the repository (SC-003-001, SC-003-002)

> **Note**: US-003-01's independent test also references "one ad-hoc inspection." The dedicated `e2e/inspect.mjs` CLI is delivered by US-003-02 (Phase 3); until then, ad-hoc inspection is available via the Part 1 CDP endpoints (FR-002-017). The full US-003-01 independent test is completed at the US-003-02 checkpoint (T003-007).

#### Implementation for User Story 1 (US-003-01)

- [X] T003-003 [US1] Create `.github/skills/usm-e2e/SKILL.md` (English) with YAML frontmatter — `name: usm-e2e` (stable identifier, do not rename) and a one-sentence `description` discoverable from the skill index that mentions: manual/E2E verification, the test vault, ad-hoc inspection, manual-assist, mobile emulation, and on-demand preview — and the core body sections per `data-model.md`: (1) **prerequisites** (macOS, Obsidian desktop, Node 22+, clean checkout, no private vault); (2) **environment preparation** (`npm run e2e:setup` then `npm run e2e:launch`, idempotency, the `--port` alternate-port option, and the rule that the launch MUST target the test vault explicitly and never attach to, inspect, or modify a private instance); (3) **standard checks** (`npm run e2e:verify`, the `taskColumns: 4` baseline for `Board.md`, the JSON report at `e2e/output/report.json`); (4) **the manual-assist protocol** — classify scenarios into the three modes (automatable / subjective / live interaction) and prescribe the agent's behavior for each: the agent prepares the environment, presents the checklist items to verify, collects the user's judgment (via delivered screenshots and/or by asking the user to check the live instance), and records the outcome in the feature's `checklists/manual-validation.md` per `contracts/manual-checklist-format.md`; the agent MAY set `pass`/`fail` for `automatable` scenarios on its own but MUST NOT set `pass`/`fail` for `subjective` or `live interaction` scenarios without the user's recorded judgment (user unavailable → `[~]` pending user review, never a guess); (5) **known runtime side effects** on the test vault (e.g. Obsidian rewriting committed config files such as `community-plugins.json`, formatting only) and the exact clean-tree restore steps (e.g. `git checkout -- test-vault/.obsidian/community-plugins.json`) (FR-003-011); (6) **ending a session cleanly** — the instance is left running only with the user's explicit consent, otherwise it is closed, and the working tree is left with only intended changes (FR-003-012). The skill MUST be self-contained (FR-003-002) — every command it names must exist in the repository — and MUST never instruct reading from or writing to the private vault (FR-003-010)
- [X] T003-004 [US1] Validate US-003-01 per `quickstart.md` Scenario 1 (fresh-session skill discovery) and Scenario 6 (manual-assist protocol): in a fresh agent session, confirm the `usm-e2e` skill is discoverable from the skill index; the agent follows it to run `npm run e2e:setup` + `npm run e2e:launch` (US-003-01 scenario 1), uses the test vault exclusively with no private-vault access (US-003-01 scenario 2), completes one manual-assist scenario — create `specs/002-e2e-test-env/checklists/manual-validation.md` per `contracts/manual-checklist-format.md`, deliver a screenshot to the user, record the user's judgment (status + committed screenshot + one-line observation), and confirm the agent never guessed a subjective/live outcome (US-003-01 scenario 3) — and ends the session with a clean working tree and the instance closed (or left running only with explicit consent) (US-003-01 scenario 4) (SC-003-001, SC-003-002, FR-003-003, FR-003-004)

**Checkpoint**: User Story 1 complete — a fresh agent session discovers the skill and safely runs the core verification workflow end-to-end; the MVP is delivered

---

### Phase 3: User Story 2 (US-003-02) - Deterministic Ad-Hoc Inspection (Priority: P2)

**Goal**: A committed, deterministic CLI (`e2e/inspect.mjs`: eval / wait / screenshot) that reuses the existing CDP client with zero new dependencies, plus the skill's ad-hoc inspection section (FR-003-005…FR-003-007)

**Independent Test**: With a debuggable instance running on the test vault, run the helper to evaluate a DOM expression, wait for a selector, and capture a screenshot; confirm the outputs are correct and that a missing instance produces a clear, actionable error (SC-003-004)

#### Implementation for User Story 2 (US-003-02)

- [X] T003-005 [US2] Implement `e2e/inspect.mjs` (Node ESM, Node 22+, English comments) per `contracts/inspect-cli.md`: parse `--port <number>` (default `9222`, integer 1–65535; an invalid value exits `2` with a clear message); three operations — `eval <expression>` (pass to CDP `Runtime.evaluate` with `returnByValue: true`, `awaitPromise: true`; print the result to stdout as one-line JSON; a page-side exception prints the exception text to stderr and exits `1`), `wait <css-selector> [--timeout <ms>]` (default timeout `15000` ms, poll interval `200` ms; on success print `ok: <selector> found` and exit `0`; on timeout print `timeout: <selector> not found within <ms> ms` to stderr and exit `1`), `screenshot <path>` (capture a PNG, create parent directories as needed, print the written path and exit `0`); reuse `e2e/cdp.mjs` (`connect(port)` → `evaluate` / `screenshot`) — import only `node:` built-ins and `./cdp.mjs` (FR-003-007); every environment error before the operation ran (no CDP instance on the port) MUST include the hint `(run npm run e2e:launch)` and exit `2` (FR-003-005, FR-003-006)
- [X] T003-006 [US2] Add the "Ad-hoc inspection" section to `.github/skills/usm-e2e/SKILL.md`: the `inspect.mjs` command table (`eval` / `wait` / `screenshot` with `--port`, exit codes 0/1/2), the documented interaction expressions table (open a note via `location.href = 'obsidian://open?path=<path>'`, reload via `location.reload()`, the view-switch fallback — click `button[aria-label="Change view"]` then the `.menu-item` labeled "USM board", enable/disable/toggle mobile emulation via `this.app.emulateMobile(…)`, check `this.app.isMobile`, click by selector, type by selector) per `contracts/inspect-cli.md`, and the mobile emulation sequence — enable emulation → `location.reload()` → wait for the board → capture evidence → disable emulation + `location.reload()` (the restore step is mandatory; relaunching also resets it) (FR-003-004, FR-003-005)
- [X] T003-007 [US2] Validate US-003-02 per `quickstart.md` Scenario 3 (ad-hoc inspection CLI): with a running instance, run `node e2e/inspect.mjs eval "document.querySelectorAll('.usm-story-card').length"` (expect the card count), `node e2e/inspect.mjs wait ".usm-board"` (expect `ok: .usm-board found`, exit 0), `node e2e/inspect.mjs screenshot e2e/output/inspect-check.png` (expect the file written, exit 0); then the fail-fast check — stop the instance (or use a free port) and run `node e2e/inspect.mjs eval "1+1" --port 9999` (expect a clear error including the hint `(run npm run e2e:launch)` and exit code 2, no hang) (SC-003-004, FR-003-006)

**Checkpoint**: User Story 2 complete — `e2e/inspect.mjs` is a committed, deterministic inspection helper; the skill documents it and the mobile emulation sequence; the full US-003-01 independent test (incl. ad-hoc inspection) is now satisfied

---

### Phase 4: User Story 4 (US-003-04) - On-Demand Preview & Interaction During Development (Priority: P2)

**Goal**: The skill documents the on-demand interactive session mode so a developer can, at any time (including mid-development), request a screenshot or an operation and get a result without explaining the infrastructure (FR-003-013)

**Independent Test**: While working on code, the developer asks the agent for a screenshot of the board; the agent ensures the instance is running, navigates to the board, and delivers the screenshot. Then the developer asks the agent to perform an operation (e.g. switch to the map view); the agent performs it and confirms the result (SC-003-006)

#### Implementation for User Story 4 (US-003-04)

- [X] T003-008 [US4] Add the "On-demand interactive sessions" section to `.github/skills/usm-e2e/SKILL.md`: at any time on the developer's request (including mid-development), the agent ensures the test instance is running (`npm run e2e:launch` is idempotent — re-running while an instance is up exits 0), performs operations via `e2e/inspect.mjs` (navigation, view switching, clicks, typing, mobile emulation), captures screenshots for preview, and iterates the cycle change → `npm run e2e:setup` → reload → inspect → screenshot without the developer explaining any infrastructure; for an operation the agent cannot perform programmatically (e.g. a true touch gesture or a drag & drop that cannot be simulated), the agent falls back to the manual-assist protocol and asks the user to perform the operation in the live instance, then records the outcome (FR-003-013, US-003-04 scenario 4)
- [X] T003-009 [US4] Validate US-003-04 per `quickstart.md` Scenario 7 (on-demand interactive session): mid-development, ask the agent for a screenshot of the current board state (the agent ensures the instance is running, navigates to the board, and delivers the screenshot without the developer explaining any infrastructure); then ask the agent to perform an operation (e.g. switch to the map view) and confirm the result with a screenshot or evaluated state; then request a non-automatable operation (e.g. a true touch gesture) and confirm the agent falls back to the manual-assist protocol and asks the user to perform it in the live instance (SC-003-006, FR-003-013)

**Checkpoint**: User Story 4 complete — the on-demand interactive session mode is documented and validated; the day-to-day developer experience works

---

### Phase 5: User Story 3 (US-003-03) - Manual-Test Task Convention & Fixture Migration (Priority: P3)

**Goal**: The extended board fixture lives in the test vault (coexisting with `Board.md`), the task-writing convention is documented and pointed to from `AGENTS.md`, so manual verification is reproducible across sessions and never requires the private vault (FR-003-008, FR-003-009)

**Independent Test**: A newly written manual-test task (per the convention) can be executed end-to-end inside the test vault by an agent following the skill, and the extended board fixture renders in the test vault with the expected structure (SC-003-003)

#### Implementation for User Story 3 (US-003-03)

- [X] T003-010 [P] [US3] Create the extended board fixture in `test-vault/boards/` per `contracts/extended-board-baseline.md`: `Test Board 2.md` (frontmatter `usm-board: true`, `usm-release-order: appearance`; body = an ordered wikilink list referencing `T1`–`T8` with one duplicate of `T1` to exercise duplicate-link rendering, and no broken links) and the eight story notes `T1.md`–`T8.md` per the fixture table — `T1` (activity: Onboarding, task: First run, epic: "[[Onboarding flow]]", release: "1.0 MVP"), `T2` (Onboarding, First run, "[[Onboarding flow]]", "1.0 MVP"), `T3` (Onboarding, Settings, "[[Onboarding flow]]", "1.0 MVP"), `T4` (Billing, Invoices, "[[A very long epic title that must clamp within the fixed column width]]", "2.0"), `T5` (Billing, Invoices, "[[A very long epic title that must clamp within the fixed column width]]", "2.0"), `T6` (Billing, Refunds, "[[Payments]]", "2.0"), `T7` (no frontmatter at all → Unassigned at every level), `T8` (Mobile, Sync, "[[Sync engine]]", "3.0"). The note names MUST be distinct from the root `S1`–`S6` (Obsidian wikilinks resolve vault-wide — reusing `S1`–`S8` would couple the two boards). Both the board and the notes conform to `specs/001-user-story-map/contracts/board-file-format.md` and `story-file-format.md` (FR-003-009)
- [X] T003-011 [US3] Validate the extended board per `quickstart.md` Scenario 4: open `boards/Test Board 2.md` in the map view (via `node e2e/inspect.mjs eval "location.href = 'obsidian://open?path=boards/Test Board 2.md'"` then `node e2e/inspect.mjs wait ".usm-board"`) and confirm the baseline — 4 release sections (Unassigned first, then `1.0 MVP`, `2.0`, `3.0`), 9 story cards (8 notes + 1 duplicate `T1`), 6 task columns, 4 activity columns, and the long epic title clamped within the fixed column width (screenshot). Then confirm multi-board coexistence (US-003-03 scenario 5): open `Board.md` again and re-confirm the Part 1 baseline (`taskColumns: 4`, 8 cards); switching back and forth between the two boards MUST reproduce each board's own baseline with no cross-board interference (FR-003-009)
- [X] T003-012 [P] [US3] Add a pointer to `AGENTS.md` (English): manual/E2E verification of the plugin → follow the `usm-e2e` skill (`.github/skills/usm-e2e/SKILL.md`); manual-test tasks in future iterations MUST follow the convention in `specs/002-e2e-test-env/contracts/task-convention.md` — reference the skill by name, name the checklist file and scenario to update, mark the scenario mode (automatable / subjective / live interaction), and target the test vault (never the private vault or the `deploy` path) (FR-003-008)
- [X] T003-013 [US3] Add the fixture references to `.github/skills/usm-e2e/SKILL.md`: the extended board (`test-vault/boards/Test Board 2.md` + `T1`–`T8`), the multi-board coexistence baseline (each board renders its own structure independently), and the same-folder ad-hoc step — create a variant board file in the vault root (distinct name, e.g. `Board variant.md`), verify it renders independently alongside `Board.md`, delete it, and restore a clean tree (this step is not a committed fixture) per `contracts/extended-board-baseline.md` (FR-003-009)
- [X] T003-014 [US3] Validate US-003-03 per `quickstart.md` Scenario 8 (task-writing convention): confirm `AGENTS.md` contains the pointer to the `usm-e2e` skill and the task convention; confirm the convention contract (`specs/002-e2e-test-env/contracts/task-convention.md`) is complete (the four mandatory rules, the task template, and the three examples); and confirm a convention-conformant manual-test task (the extended-board baseline check from T003-011) is executable end-to-end inside the test vault by an agent following the skill, with no private-vault access (FR-003-008, SC-003-003, US-003-03 scenario 1)

**Checkpoint**: User Story 3 complete — the extended board fixture renders its documented baseline, the task convention is documented and discoverable, and the workflow is complete and universal

---

### Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and the full end-to-end validation of the complete feature

- [X] T003-015 [P] Update `e2e/README.md` (English): add a section for `e2e/inspect.mjs` (the three operations — `eval` / `wait` / `screenshot` — the `--port` option, and the exit codes 0/1/2) and a pointer to the `usm-e2e` skill (`.github/skills/usm-e2e/SKILL.md`) and to `specs/002-e2e-test-env/quickstart.md`
- [X] T003-016 Run the full `quickstart.md` validation sequence (all 9 scenarios) from a clean state: Scenario 1 (fresh-session skill discovery), Scenario 2 (standard `e2e:verify` regression — `taskColumns: 4`), Scenario 3 (inspect CLI + fail-fast), Scenario 4 (extended board + multi-board coexistence + same-folder ad-hoc), Scenario 5 (mobile via emulation — enable → reload → wait → screenshot → disable + reload → confirm `isMobile` is `false`), Scenario 6 (manual-assist protocol, incl. user-unavailable → `[~]`), Scenario 7 (on-demand session, incl. non-automatable fallback), Scenario 8 (task convention), Scenario 9 (clean session end — `git status --porcelain` shows only intended changes; restore any Obsidian runtime side effects on committed test-vault config per the skill's documented steps). **Timing check (SC-003-001)**: from the start of Scenario 1 (fresh session) through the completion of Scenario 2 (standard `e2e:verify` pass), record the wall-clock elapsed time; it MUST be under 5 minutes. Confirm all scenarios pass and the working tree is clean (SC-003-001…SC-003-007, FR-003-011, FR-003-012)

**Checkpoint**: Feature complete — all quickstart scenarios pass; documentation in place; the working tree is clean

---

### Dependencies & Execution Order

#### Story Completion Order

1. **Phase 1 (Setup & Foundational)** — MUST complete first (T003-001–T003-002); T003-002 is the green-baseline gate
2. **User Story 1 (T003-003–T003-004)** — depends on Phase 1 (the skill documents the Part 1 commands, which must be confirmed green)
3. **User Story 2 (T003-005–T003-007)** — depends on US-003-01 (the skill's inspection section is added to the skill created in US-003-01); T003-005 (the CLI) precedes T003-006 (the skill section documents T003-005's actual interface); T003-007 depends on T003-005 + T003-006
4. **User Story 4 (T003-008–T003-009)** — depends on US-003-01 (the skill) and US-003-02 (the helper performs the operations)
5. **User Story 3 (T003-010–T003-014)** — depends on US-003-01 (the convention references the skill); T003-010 (the fixture) is independent of T003-012 (the `AGENTS.md` pointer) and can run in parallel; T003-011 depends on T003-010; T003-013 depends on T003-010; T003-014 depends on T003-012 + T003-013
6. **Polish (T003-015–T003-016)** — depends on all stories; T003-015 is independent of T003-016

#### Parallel Opportunities

- **Phase 1**: T003-001 ∥ T003-002 (different files: `package.json` vs running the Part 1 commands)
- **US-003-03**: T003-010 ∥ T003-012 (different files: `test-vault/boards/` vs `AGENTS.md`) — then T003-011 (depends on T003-010), T003-013 (depends on T003-010), T003-014 (depends on T003-012 + T003-013)
- **Polish**: T003-015 ∥ T003-016 (README vs live validation run)

#### MVP Scope

**User Story 1 alone is the MVP**: a discoverable, self-contained skill that lets any agent in any session safely bring up a debuggable instance and run the core verification workflow. US-003-02 (inspection), US-003-04 (on-demand), and US-003-03 (convention + fixture) build on it.

---

### Implementation Strategy

1. **MVP first**: deliver Phase 1 → 2 (Setup & Foundational, US-003-01) and commit per phase. At that point the skill is usable for the core workflow.
2. **Incremental delivery**: add US-003-02 (inspection CLI), then US-003-04 (on-demand), then US-003-03 (convention + fixture), each as a complete, independently testable increment with its own checkpoint. The skill file (`.github/skills/usm-e2e/SKILL.md`) is extended section-by-section across US-003-02 / US-003-04 / US-003-03, and each increment leaves it valid and usable.
3. **Validate at every checkpoint**: use the `quickstart.md` scenarios for the story just completed; finish with the full Phase 6 validation run (all 9 scenarios).
4. **Never touch the private vault**: every task targets `test-vault/` exclusively (FR-003-010, SC-003-003); the Part 1 contract (`Board.md` + `S1`–`S6`, `taskColumns: 4`) stays untouched.

---

### Phase 7: Convergence

**Purpose**: Close the four documentation gaps found by the convergence assessment (2026-10-28). All findings are skill/contract documentation gaps discovered during the T003-016 live validation run; no plugin code changes are involved.

- [X] T003-017 Document the `workspace-mobile.json` runtime side effect in the "Known runtime side effects" section of `.github/skills/usm-e2e/SKILL.md`: mobile emulation creates an untracked `test-vault/.obsidian/workspace-mobile.json` that the existing `.gitignore` entries do not cover, so it appears in `git status --porcelain` after a mobile scenario; add the path to `.gitignore` (consistent with the existing `workspace.json` entry) and document the side effect in the skill so the clean-tree check holds per FR-003-011, SC-003-005 (partial)
- [X] T003-018 Replace the unreliable URI open-note expression in the "Documented interaction expressions" table of `.github/skills/usm-e2e/SKILL.md` with the reliable API method `app.workspace.getLeaf(true).openFile(app.vault.getAbstractFileByPath('<path>'))`, noting that `location.href = 'obsidian://open?path=…'` is intermittently rejected by Obsidian's vault resolver ("Vault not found"); update the same table in `specs/002-e2e-test-env/contracts/inspect-cli.md` for consistency per FR-003-001, FR-003-013 (partial)
- [X] T003-019 Document the `e2e:launch` "alive but no window" edge case in the "Environment preparation" section of `.github/skills/usm-e2e/SKILL.md`: the launch script probes only the CDP port, so if the app is alive in the background with no window it exits 0 without opening a window; document the workaround (`open -a Obsidian <test-vault path>`) so on-demand sessions can always obtain a debuggable window per FR-003-011, FR-003-013 (partial)
- [X] T003-020 Add a single-board precondition note to the "Standard checks" section of `.github/skills/usm-e2e/SKILL.md`: `e2e:verify` (Part 1, frozen) measures the active board via global DOM queries, so other board leaves (e.g. `boards/Test Board 2.md`) must be closed before running it, otherwise the combined card count fails the `taskColumns: 4` baseline per FR-003-001, FR-003-011 (partial)

**Checkpoint**: All four convergence findings are documented in the skill (and the CLI contract where applicable); a fresh agent session following the skill avoids all four pitfalls discovered in the T003-016 run
