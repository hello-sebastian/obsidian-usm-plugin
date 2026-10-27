# Tasks: Isolated E2E Test Environment & GUI Automation

**Input**: Design documents from `/specs/002-e2e-test-env/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: No TDD/test tasks — the feature specification does not request them and this feature adds no plugin domain logic (Constitution TDD rule applies to domain logic only). Validation is performed via the quickstart.md scenarios and the `e2e/verify.mjs` script itself, which is the test mechanism.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

**Commit cadence (Constitution — Logical Atomicity Protocol)**: one commit per phase, bundling the phase's code changes and all of the phase's task checkoffs.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Repository-level scaffolding shared by all user stories

- [ ] T001 Create the `e2e/` directory at the repository root and add npm scripts to `package.json`: `"e2e:setup": "node e2e/setup.mjs"`, `"e2e:launch": "node e2e/launch.mjs"`, `"e2e:verify": "node e2e/verify.mjs"`
- [ ] T002 [P] Add to `.gitignore`: `test-vault/.obsidian/plugins/obsidian-usm-plugin/main.js` (build artifact — never committed) and `e2e/output/` (generated screenshots and reports)

**Checkpoint**: `e2e/` exists, npm scripts are registered, gitignore rules in place

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The build/install pipeline that every user story depends on (US-01 needs the plugin installed; US-02/US-03 pre-flight check the build)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Implement `e2e/setup.mjs` (Node ESM, Node 22+, English comments): run `npm run build`, then copy `main.js`, `manifest.json`, and `styles.css` from the repository root into `test-vault/.obsidian/plugins/obsidian-usm-plugin/` (create directories as needed); verify each copied file's SHA-256 matches the source (abort non-zero on mismatch); print a summary (files copied, sizes, manifest version). Per contracts/test-vault-structure.md: `manifest.json` and `styles.css` are committed source files refreshed by setup; `main.js` is the gitignored build artifact

**Checkpoint**: `npm run e2e:setup` produces a complete, hash-verified plugin installation in the test vault

---

## Phase 3: User Story 1 - Isolated Test Vault (Priority: P1) 🎯 MVP

**Goal**: A dedicated, self-contained, reproducible test vault in the repository so the plugin can be exercised without any risk to private notes (FR-001…FR-005)

**Independent Test**: Open `test-vault/` in Obsidian with the plugin enabled and confirm the board renders from the sample notes; no file outside `test-vault/` is read or modified

### Implementation for User Story 1

- [ ] T004 [P] [US1] Create `test-vault/Board.md` conforming to `specs/001-user-story-map/contracts/board-file-format.md`: frontmatter `usm-board: true`, `usm-release-order: appearance`; body = ordered wikilink list `- [[S1]]`, `- [[S2]]`, `- [[S3]]`, `- [[S4]]`, `- [[S5]]`, `- [[S6]]`, `- [[S1|Create first board (duplicate)]]`, `- [[Missing story]]` (broken link on purpose — must render a dimmed placeholder, never crash)
- [ ] T005 [P] [US1] Create the six sample story notes in `test-vault/` per the fixture table in contracts/test-vault-structure.md: `S1.md` (activity: Onboarding, task: First run, epic: "[[Onboarding flow]]", release: "1.0 MVP", story: Create first board), `S2.md` (activity: Onboarding, task: First run, release: "1.0 MVP", title: First login — epic intentionally missing), `S3.md` (no frontmatter at all — Unassigned at every level, title falls through to file name), `S4.md` (Polish field names: aktywność: Logowanie, zadanie: Login, epik: "[[Auth]]", wydanie: "2.0", title: Historia po polsku), `S5.md` (task: first run, epic: "[[Onboarding flow]]", release: "2.0", story: Profile setup — activity missing, lower-cased task), `S6.md` (activity: onboarding, task: First run, epic: "[[Onboarding flow]]", title: Login flow — release missing, lower-cased activity)
- [ ] T006 [P] [US1] Create `test-vault/.obsidian/community-plugins.json` containing `["obsidian-usm-plugin"]` so the plugin is enabled when the vault is opened
- [ ] T007 [US1] Run `npm run e2e:setup` to install the plugin into the test vault, then open `test-vault/` in Obsidian and verify: the board renders with the baseline structure from contracts/test-vault-structure.md — 4 task columns (`.usm-header-cell--task`), 3 activity columns, 3 release rows (`section.usm-release`), 8 story cards (`.usm-story-card`: 7 notes + 1 broken-link placeholder); notes with missing attributes land in "Unassigned" sections without errors (FR-003, SC-004 baseline)

**Checkpoint**: User Story 1 complete — the isolated, reproducible test vault renders the known board structure; a fresh clone + `npm run e2e:setup` reproduces it (FR-004)

---

## Phase 4: User Story 2 - Remote Debugging Access (Priority: P2)

**Goal**: A dedicated, idempotent launch command that opens Obsidian on the test vault with a CDP remote-debugging port (FR-006…FR-009)

**Independent Test**: Run `npm run e2e:launch` and confirm an external CDP client can connect to `http://127.0.0.1:9222/json/version` and see the application's UI

### Implementation for User Story 2

- [ ] T008 [US2] Implement `e2e/launch.mjs` (Node ESM, Node 22+, English comments) per contracts/launch-cli.md: parse `--port <number>` (default `9222`); pre-flight build check — `test-vault/.obsidian/plugins/obsidian-usm-plugin/main.js` must exist and its `manifest.json` version must equal the repository `manifest.json` version, otherwise print `run npm run e2e:setup` and exit non-zero (FR-015, SC-008); idempotency probe — `fetch http://127.0.0.1:<port>/json/version` with a short timeout, on success print "Instance already available on port <port>" and exit 0 without launching (FR-007, SC-007); launch via `open -a Obsidian --args --remote-debugging-port=<port> <absolute test-vault path>` (vault path passed explicitly — never a private vault); bounded readiness poll of `/json/version` (≤ 30 s, SC-003); if the port is bound but does not serve a CDP endpoint after launch, print an actionable error suggesting `--port <alternate>` and exit non-zero (spec edge case: port occupied by an unrelated process)

**Checkpoint**: User Story 2 complete — `npm run e2e:launch` is idempotent, port-configurable, and always targets the test vault; repeated runs spawn no duplicates

---

## Phase 5: User Story 3 - Automated Visual & DOM Verification (Priority: P3)

**Goal**: A committed, versioned verification script that connects over CDP, performs the standard checks, and emits a machine-readable pass/fail report (FR-010…FR-014, FR-016)

**Independent Test**: With a debuggable instance running, `npm run e2e:verify` reports the expected task-column count (4), writes a screenshot, detects a source-note change within 5 seconds, and exits 0 with `status: "pass"`

### Implementation for User Story 3

- [ ] T009 [US3] Implement `e2e/cdp.mjs` (Node ESM, Node 22+, English comments): a minimal CDP client using only Node built-ins (global `fetch` + global `WebSocket` — no NPM dependencies, per research.md R4): `probe(port)` → GET `http://127.0.0.1:<port>/json/version` with timeout, returns version info or null; `listTargets(port)` → GET `http://127.0.0.1:<port>/json`, returns page targets with `webSocketDebuggerUrl`; `connect(port)` → attaches a WebSocket to the first page target and exposes `evaluate(expression)` (CDP `Runtime.evaluate`, `returnByValue: true`) and `screenshot(filePath)` (CDP `Page.captureScreenshot`, writes PNG); all failures reject with a diagnostic message including a connection-failure hint (spec edge case: browser tool cannot connect)
- [ ] T010 [US3] Implement `e2e/verify.mjs` (Node ESM, Node 22+, English comments) per contracts/verification-report.md: parse `--port <number>` (default `9222`); pre-flight — CDP probe must succeed (else exit 2 with a connection-failure hint in `errors`) and the build check from contracts/launch-cli.md must pass (else exit 2); open the board in map view — navigate the page to the `Board.md` note (e.g., `obsidian://open?path=<vault>/Board.md`) and, if the view is not `map`, click the view-switch control (`button[aria-label="Change view"]` → menu item "USM board") via `evaluate` (FR-010); wait until `.usm-board` is present in the DOM (bounded wait)
- [ ] T011 [US3] Add the standard checks to `e2e/verify.mjs` (depends on T010): (1) task-columns — count `.usm-board-header .usm-header-cell--task` via `evaluate` and compare against expected `4` from contracts/test-vault-structure.md (FR-011, SC-004); (2) screenshot — capture the map to `e2e/output/board.png` via `screenshot()` (FR-012, SC-005); (3) reactivity — record a structural signature (e.g., `.usm-story-card` count, expected baseline `8`), modify a story note in the test vault (e.g., append a new story link to `Board.md`), poll the signature via `evaluate` until it changes or the `5000` ms bound elapses, record `delayMs`, then restore the fixture file to its committed content so the vault stays reproducible (FR-013, SC-006)
- [ ] T012 [US3] Add report emission and exit codes to `e2e/verify.mjs` (depends on T011): build the JSON report exactly per contracts/verification-report.md — `status` (`"pass"` only if every check passed, else `"fail"`), `port`, `timestamp` (ISO-8601 UTC), `checks[]` (each: `id`, `name`, `passed`, `actual`, `expected`, optional `detail`), `taskColumns`, `screenshot` (relative path), `reactivity` (`{ detected, delayMs, boundMs: 5000 }`), `errors[]`; write it to `e2e/output/report.json` and print it to stdout; exit `0` on pass, `1` on failed checks, `2` on environment error before checks ran (FR-014)

**Checkpoint**: User Story 3 complete — `npm run e2e:verify` runs the full standard-check suite against a live instance and produces an agent-interpretable JSON report; the agent can additionally perform ad-hoc CDP inspection (FR-017)

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and end-to-end validation of the complete feature

- [ ] T013 [P] Write `e2e/README.md` (English): prerequisites (macOS, Obsidian desktop, Node 22+), the three npm scripts and their options, the CDP endpoints, the output locations (`e2e/output/`), and a pointer to `specs/002-e2e-test-env/quickstart.md`
- [ ] T014 Run the full quickstart.md validation sequence from a clean state: `npm run e2e:setup` → `npm run e2e:launch` (twice, to confirm idempotency) → `npm run e2e:verify` (expect `status: "pass"`, `taskColumns: 4`, `reactivity.delayMs <= 5000`, exit 0) → delete `test-vault/.obsidian/plugins/obsidian-usm-plugin/main.js` and re-run verify (expect exit 2 with the setup hint, SC-008) → confirm `git status` shows no untracked/modified files outside the committed fixture set (SC-002 isolation, FR-004 reproducibility)

**Checkpoint**: Feature complete — all quickstart scenarios pass; documentation in place

---

## Dependencies & Execution Order

### Story Completion Order

1. **Phase 1 (Setup) + Phase 2 (Foundational)** — MUST complete first (T001–T003)
2. **User Story 1 (T004–T007)** — depends on Phase 2 (setup script installs the plugin)
3. **User Story 2 (T008)** — depends on US-01 (launch targets the test vault and pre-flights its build)
4. **User Story 3 (T009–T012)** — depends on US-02 (verification attaches to a launched instance); T009 is independent of T010–T012 and can start as soon as US-02 exists
5. **Polish (T013–T014)** — depends on all stories; T013 is independent of T014

### Parallel Opportunities

- **Phase 1**: T001 ∥ T002 (different files)
- **US-01**: T004 ∥ T005 ∥ T006 (independent fixture files) — then T007 (integration verification)
- **US-03**: T009 ∥ T010 (separate files: `e2e/cdp.mjs` vs `e2e/verify.mjs` scaffolding) — T011 and T012 extend `e2e/verify.mjs` sequentially
- **Polish**: T013 ∥ T014 (README vs live validation run)

### MVP Scope

**User Story 1 alone is the MVP**: a safe, reproducible environment where the plugin can be loaded and exercised manually. US-02 and US-03 build the automation on top of it.

---

## Implementation Strategy

1. **MVP first**: deliver Phase 1 → 2 → 3 (Setup, Foundational, US-01) and commit per phase. At that point the test vault is usable manually.
2. **Incremental delivery**: add US-02 (launch), then US-03 (verification), each as a complete, independently testable increment with its own checkpoint.
3. **Validate at every checkpoint**: use the quickstart.md scenarios for the story just completed; finish with the full Phase 6 validation run.
4. **Never test a broken build**: the pre-flight checks (T008, T010) guarantee SC-008 at every entry point.
