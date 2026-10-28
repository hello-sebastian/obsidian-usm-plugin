# Tasks: Manual Test & Preview Workflow (E2E Infrastructure Integration)

**Input**: Design documents from `/specs/003-manual-test-workflow/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: No TDD/test tasks — the feature specification does not request them and this feature adds no plugin domain logic (Constitution TDD rule applies to domain logic only). Validation is performed via the `quickstart.md` scenarios against a live test-vault instance; the `e2e/verify.mjs` and `e2e/inspect.mjs` scripts are the test mechanisms.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

**Commit cadence (Constitution — Logical Atomicity Protocol)**: one commit per phase, bundling the phase's code changes and all of the phase's task checkoffs.

---

## Phase 1: Setup & Foundational

**Purpose**: Repository-level config and a green-baseline gate. The `002` infrastructure (test vault, `e2e:setup` / `e2e:launch` / `e2e:verify`, `cdp.mjs`) is the existing foundation and is unchanged by this feature — there is no separate Foundational phase; the only prerequisite work is registering the new CLI script and confirming the foundation is green before building on it.

- [X] T001 [P] Add `"e2e:inspect": "node e2e/inspect.mjs"` to the `scripts` block in `package.json` (a thin wrapper for the ad-hoc inspection CLI delivered in US-02; consistent with the existing `e2e:setup` / `e2e:launch` / `e2e:verify` scripts)
- [X] T002 Run the `002` baseline verification to establish a green starting point: `npm run e2e:setup` → `npm run e2e:launch` → `npm run e2e:verify`, expecting `status: "pass"`, `taskColumns: 4`, exit 0; then confirm `git status --porcelain` shows no modified tracked files (only the untracked `specs/003-manual-test-workflow/` design artifacts). This is the blocking gate — no user story work begins until the foundation is confirmed green

**Checkpoint**: The `e2e:inspect` script is registered and the `002` baseline is confirmed green (`taskColumns: 4`)

---

## Phase 2: User Story 1 - Discoverable Manual-Verification Skill (Priority: P1) 🎯 MVP

**Goal**: A discoverable, self-contained project-local skill that documents the core manual/E2E verification workflow — environment preparation, standard checks, the manual-assist protocol, and clean session handling — so any agent in any session can safely bring up a debuggable instance and verify the plugin without rediscovering the infrastructure or touching the private vault (FR-001…FR-004, FR-011, FR-012)

**Independent Test**: In a fresh session, the agent discovers the skill from the skill index, follows it to run environment setup and launch, performs the standard check, and completes one manual-assist scenario with the user — all without any instruction outside the repository (SC-001, SC-002)

> **Note**: US1's independent test also references "one ad-hoc inspection." The dedicated `e2e/inspect.mjs` CLI is delivered by US-02 (Phase 3); until then, ad-hoc inspection is available via the `002` CDP endpoints (`002` FR-017). The full US1 independent test is completed at the US-02 checkpoint (T007).

### Implementation for User Story 1

- [ ] T003 [US1] Create `.github/skills/usm-e2e/SKILL.md` (English) with YAML frontmatter — `name: usm-e2e` (stable identifier, do not rename) and a one-sentence `description` discoverable from the skill index that mentions: manual/E2E verification, the test vault, ad-hoc inspection, manual-assist, mobile emulation, and on-demand preview — and the core body sections per `data-model.md`: (1) **prerequisites** (macOS, Obsidian desktop, Node 22+, clean checkout, no private vault); (2) **environment preparation** (`npm run e2e:setup` then `npm run e2e:launch`, idempotency, the `--port` alternate-port option, and the rule that the launch MUST target the test vault explicitly and never attach to, inspect, or modify a private instance); (3) **standard checks** (`npm run e2e:verify`, the `taskColumns: 4` baseline for `Board.md`, the JSON report at `e2e/output/report.json`); (4) **the manual-assist protocol** — classify scenarios into the three modes (automatable / subjective / live interaction) and prescribe the agent's behavior for each: the agent prepares the environment, presents the checklist items to verify, collects the user's judgment (via delivered screenshots and/or by asking the user to check the live instance), and records the outcome in the feature's `checklists/manual-validation.md` per `contracts/manual-checklist-format.md`; the agent MAY set `pass`/`fail` for `automatable` scenarios on its own but MUST NOT set `pass`/`fail` for `subjective` or `live interaction` scenarios without the user's recorded judgment (user unavailable → `[~]` pending user review, never a guess); (5) **known runtime side effects** on the test vault (e.g. Obsidian rewriting committed config files such as `community-plugins.json`, formatting only) and the exact clean-tree restore steps (e.g. `git checkout -- test-vault/.obsidian/community-plugins.json`) (FR-011); (6) **ending a session cleanly** — the instance is left running only with the user's explicit consent, otherwise it is closed, and the working tree is left with only intended changes (FR-012). The skill MUST be self-contained (FR-002) — every command it names must exist in the repository — and MUST never instruct reading from or writing to the private vault (FR-010)
- [ ] T004 [US1] Validate US1 per `quickstart.md` Scenario 1 (fresh-session skill discovery) and Scenario 6 (manual-assist protocol): in a fresh agent session, confirm the `usm-e2e` skill is discoverable from the skill index; the agent follows it to run `npm run e2e:setup` + `npm run e2e:launch` (US-01 scenario 1), uses the test vault exclusively with no private-vault access (US-01 scenario 2), completes one manual-assist scenario — create `specs/003-manual-test-workflow/checklists/manual-validation.md` per `contracts/manual-checklist-format.md`, deliver a screenshot to the user, record the user's judgment (status + committed screenshot + one-line observation), and confirm the agent never guessed a subjective/live outcome (US-01 scenario 3) — and ends the session with a clean working tree and the instance closed (or left running only with explicit consent) (US-01 scenario 4) (SC-001, SC-002, FR-003, FR-004)

**Checkpoint**: User Story 1 complete — a fresh agent session discovers the skill and safely runs the core verification workflow end-to-end; the MVP is delivered

---

## Phase 3: User Story 2 - Deterministic Ad-Hoc Inspection (Priority: P2)

**Goal**: A committed, deterministic CLI (`e2e/inspect.mjs`: eval / wait / screenshot) that reuses the existing CDP client with zero new dependencies, plus the skill's ad-hoc inspection section (FR-005…FR-007)

**Independent Test**: With a debuggable instance running on the test vault, run the helper to evaluate a DOM expression, wait for a selector, and capture a screenshot; confirm the outputs are correct and that a missing instance produces a clear, actionable error (SC-004)

### Implementation for User Story 2

- [ ] T005 [US2] Implement `e2e/inspect.mjs` (Node ESM, Node 22+, English comments) per `contracts/inspect-cli.md`: parse `--port <number>` (default `9222`, integer 1–65535; an invalid value exits `2` with a clear message); three operations — `eval <expression>` (pass to CDP `Runtime.evaluate` with `returnByValue: true`, `awaitPromise: true`; print the result to stdout as one-line JSON; a page-side exception prints the exception text to stderr and exits `1`), `wait <css-selector> [--timeout <ms>]` (default timeout `15000` ms, poll interval `200` ms; on success print `ok: <selector> found` and exit `0`; on timeout print `timeout: <selector> not found within <ms> ms` to stderr and exit `1`), `screenshot <path>` (capture a PNG, create parent directories as needed, print the written path and exit `0`); reuse `e2e/cdp.mjs` (`connect(port)` → `evaluate` / `screenshot`) — import only `node:` built-ins and `./cdp.mjs` (FR-007); every environment error before the operation ran (no CDP instance on the port) MUST include the hint `(run npm run e2e:launch)` and exit `2` (FR-005, FR-006)
- [ ] T006 [US2] Add the "Ad-hoc inspection" section to `.github/skills/usm-e2e/SKILL.md`: the `inspect.mjs` command table (`eval` / `wait` / `screenshot` with `--port`, exit codes 0/1/2), the documented interaction expressions table (open a note via `location.href = 'obsidian://open?path=<path>'`, reload via `location.reload()`, the view-switch fallback — click `button[aria-label="Change view"]` then the `.menu-item` labeled "USM board", enable/disable/toggle mobile emulation via `this.app.emulateMobile(…)`, check `this.app.isMobile`, click by selector, type by selector) per `contracts/inspect-cli.md`, and the mobile emulation sequence — enable emulation → `location.reload()` → wait for the board → capture evidence → disable emulation + `location.reload()` (the restore step is mandatory; relaunching also resets it) (FR-004, FR-005)
- [ ] T007 [US2] Validate US2 per `quickstart.md` Scenario 3 (ad-hoc inspection CLI): with a running instance, run `node e2e/inspect.mjs eval "document.querySelectorAll('.usm-story-card').length"` (expect the card count), `node e2e/inspect.mjs wait ".usm-board"` (expect `ok: .usm-board found`, exit 0), `node e2e/inspect.mjs screenshot e2e/output/inspect-check.png` (expect the file written, exit 0); then the fail-fast check — stop the instance (or use a free port) and run `node e2e/inspect.mjs eval "1+1" --port 9999` (expect a clear error including the hint `(run npm run e2e:launch)` and exit code 2, no hang) (SC-004, FR-006)

**Checkpoint**: User Story 2 complete — `e2e/inspect.mjs` is a committed, deterministic inspection helper; the skill documents it and the mobile emulation sequence; the full US1 independent test (incl. ad-hoc inspection) is now satisfied

---

## Phase 4: User Story 4 - On-Demand Preview & Interaction During Development (Priority: P2)

**Goal**: The skill documents the on-demand interactive session mode so a developer can, at any time (including mid-development), request a screenshot or an operation and get a result without explaining the infrastructure (FR-013)

**Independent Test**: While working on code, the developer asks the agent for a screenshot of the board; the agent ensures the instance is running, navigates to the board, and delivers the screenshot. Then the developer asks the agent to perform an operation (e.g. switch to the map view); the agent performs it and confirms the result (SC-006)

### Implementation for User Story 4

- [ ] T008 [US4] Add the "On-demand interactive sessions" section to `.github/skills/usm-e2e/SKILL.md`: at any time on the developer's request (including mid-development), the agent ensures the test instance is running (`npm run e2e:launch` is idempotent — re-running while an instance is up exits 0), performs operations via `e2e/inspect.mjs` (navigation, view switching, clicks, typing, mobile emulation), captures screenshots for preview, and iterates the cycle change → `npm run e2e:setup` → reload → inspect → screenshot without the developer explaining any infrastructure; for an operation the agent cannot perform programmatically (e.g. a true touch gesture or a drag & drop that cannot be simulated), the agent falls back to the manual-assist protocol and asks the user to perform the operation in the live instance, then records the outcome (FR-013, US-04 scenario 4)
- [ ] T009 [US4] Validate US4 per `quickstart.md` Scenario 7 (on-demand interactive session): mid-development, ask the agent for a screenshot of the current board state (the agent ensures the instance is running, navigates to the board, and delivers the screenshot without the developer explaining any infrastructure); then ask the agent to perform an operation (e.g. switch to the map view) and confirm the result with a screenshot or evaluated state; then request a non-automatable operation (e.g. a true touch gesture) and confirm the agent falls back to the manual-assist protocol and asks the user to perform it in the live instance (SC-006, FR-013)

**Checkpoint**: User Story 4 complete — the on-demand interactive session mode is documented and validated; the day-to-day developer experience works

---

## Phase 5: User Story 3 - Manual-Test Task Convention & Fixture Migration (Priority: P3)

**Goal**: The extended board fixture lives in the test vault (coexisting with `Board.md`), the task-writing convention is documented and pointed to from `AGENTS.md`, so manual verification is reproducible across sessions and never requires the private vault (FR-008, FR-009)

**Independent Test**: A newly written manual-test task (per the convention) can be executed end-to-end inside the test vault by an agent following the skill, and the extended board fixture renders in the test vault with the expected structure (SC-003)

### Implementation for User Story 3

- [ ] T010 [P] [US3] Create the extended board fixture in `test-vault/boards/` per `contracts/extended-board-baseline.md`: `Test Board 2.md` (frontmatter `usm-board: true`, `usm-release-order: appearance`; body = an ordered wikilink list referencing `T1`–`T8` with one duplicate of `T1` to exercise duplicate-link rendering, and no broken links) and the eight story notes `T1.md`–`T8.md` per the fixture table — `T1` (activity: Onboarding, task: First run, epic: "[[Onboarding flow]]", release: "1.0 MVP"), `T2` (Onboarding, First run, "[[Onboarding flow]]", "1.0 MVP"), `T3` (Onboarding, Settings, "[[Onboarding flow]]", "1.0 MVP"), `T4` (Billing, Invoices, "[[A very long epic title that must clamp within the fixed column width]]", "2.0"), `T5` (Billing, Invoices, "[[A very long epic title that must clamp within the fixed column width]]", "2.0"), `T6` (Billing, Refunds, "[[Payments]]", "2.0"), `T7` (no frontmatter at all → Unassigned at every level), `T8` (Mobile, Sync, "[[Sync engine]]", "3.0"). The note names MUST be distinct from the root `S1`–`S6` (Obsidian wikilinks resolve vault-wide — reusing `S1`–`S8` would couple the two boards). Both the board and the notes conform to `specs/001-user-story-map/contracts/board-file-format.md` and `story-file-format.md` (FR-009)
- [ ] T011 [US3] Validate the extended board per `quickstart.md` Scenario 4: open `boards/Test Board 2.md` in the map view (via `node e2e/inspect.mjs eval "location.href = 'obsidian://open?path=boards/Test Board 2.md'"` then `node e2e/inspect.mjs wait ".usm-board"`) and confirm the baseline — 4 release sections (Unassigned first, then `1.0 MVP`, `2.0`, `3.0`), 9 story cards (8 notes + 1 duplicate `T1`), 6 task columns, 4 activity columns, and the long epic title clamped within the fixed column width (screenshot). Then confirm multi-board coexistence (US-03 scenario 5): open `Board.md` again and re-confirm the `002` baseline (`taskColumns: 4`, 8 cards); switching back and forth between the two boards MUST reproduce each board's own baseline with no cross-board interference (FR-009)
- [ ] T012 [P] [US3] Add a pointer to `AGENTS.md` (English): manual/E2E verification of the plugin → follow the `usm-e2e` skill (`.github/skills/usm-e2e/SKILL.md`); manual-test tasks in future iterations MUST follow the convention in `specs/003-manual-test-workflow/contracts/task-convention.md` — reference the skill by name, name the checklist file and scenario to update, mark the scenario mode (automatable / subjective / live interaction), and target the test vault (never the private vault or the `deploy` path) (FR-008)
- [ ] T013 [US3] Add the fixture references to `.github/skills/usm-e2e/SKILL.md`: the extended board (`test-vault/boards/Test Board 2.md` + `T1`–`T8`), the multi-board coexistence baseline (each board renders its own structure independently), and the same-folder ad-hoc step — create a variant board file in the vault root (distinct name, e.g. `Board variant.md`), verify it renders independently alongside `Board.md`, delete it, and restore a clean tree (this step is not a committed fixture) per `contracts/extended-board-baseline.md` (FR-009)
- [ ] T014 [US3] Validate US3 per `quickstart.md` Scenario 8 (task-writing convention): confirm `AGENTS.md` contains the pointer to the `usm-e2e` skill and the task convention; confirm the convention contract (`specs/003-manual-test-workflow/contracts/task-convention.md`) is complete (the four mandatory rules, the task template, and the three examples); and confirm a convention-conformant manual-test task (the extended-board baseline check from T011) is executable end-to-end inside the test vault by an agent following the skill, with no private-vault access (FR-008, SC-003, US-03 scenario 1)

**Checkpoint**: User Story 3 complete — the extended board fixture renders its documented baseline, the task convention is documented and discoverable, and the workflow is complete and universal

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and the full end-to-end validation of the complete feature

- [ ] T015 [P] Update `e2e/README.md` (English): add a section for `e2e/inspect.mjs` (the three operations — `eval` / `wait` / `screenshot` — the `--port` option, and the exit codes 0/1/2) and a pointer to the `usm-e2e` skill (`.github/skills/usm-e2e/SKILL.md`) and to `specs/003-manual-test-workflow/quickstart.md`
- [ ] T016 Run the full `quickstart.md` validation sequence (all 9 scenarios) from a clean state: Scenario 1 (fresh-session skill discovery), Scenario 2 (standard `e2e:verify` regression — `taskColumns: 4`), Scenario 3 (inspect CLI + fail-fast), Scenario 4 (extended board + multi-board coexistence + same-folder ad-hoc), Scenario 5 (mobile via emulation — enable → reload → wait → screenshot → disable + reload → confirm `isMobile` is `false`), Scenario 6 (manual-assist protocol, incl. user-unavailable → `[~]`), Scenario 7 (on-demand session, incl. non-automatable fallback), Scenario 8 (task convention), Scenario 9 (clean session end — `git status --porcelain` shows only intended changes; restore any Obsidian runtime side effects on committed test-vault config per the skill's documented steps). **Timing check (SC-001)**: from the start of Scenario 1 (fresh session) through the completion of Scenario 2 (standard `e2e:verify` pass), record the wall-clock elapsed time; it MUST be under 5 minutes. Confirm all scenarios pass and the working tree is clean (SC-001…SC-007, FR-011, FR-012)

**Checkpoint**: Feature complete — all quickstart scenarios pass; documentation in place; the working tree is clean

---

## Dependencies & Execution Order

### Story Completion Order

1. **Phase 1 (Setup & Foundational)** — MUST complete first (T001–T002); T002 is the green-baseline gate
2. **User Story 1 (T003–T004)** — depends on Phase 1 (the skill documents the `002` commands, which must be confirmed green)
3. **User Story 2 (T005–T007)** — depends on US-01 (the skill's inspection section is added to the skill created in US-01); T005 (the CLI) precedes T006 (the skill section documents T005's actual interface); T007 depends on T005 + T006
4. **User Story 4 (T008–T009)** — depends on US-01 (the skill) and US-02 (the helper performs the operations)
5. **User Story 3 (T010–T014)** — depends on US-01 (the convention references the skill); T010 (the fixture) is independent of T012 (the `AGENTS.md` pointer) and can run in parallel; T011 depends on T010; T013 depends on T010; T014 depends on T012 + T013
6. **Polish (T015–T016)** — depends on all stories; T015 is independent of T016

### Parallel Opportunities

- **Phase 1**: T001 ∥ T002 (different files: `package.json` vs running the `002` commands)
- **US-03**: T010 ∥ T012 (different files: `test-vault/boards/` vs `AGENTS.md`) — then T011 (depends on T010), T013 (depends on T010), T014 (depends on T012 + T013)
- **Polish**: T015 ∥ T016 (README vs live validation run)

### MVP Scope

**User Story 1 alone is the MVP**: a discoverable, self-contained skill that lets any agent in any session safely bring up a debuggable instance and run the core verification workflow. US-02 (inspection), US-04 (on-demand), and US-03 (convention + fixture) build on it.

---

## Implementation Strategy

1. **MVP first**: deliver Phase 1 → 2 (Setup & Foundational, US-01) and commit per phase. At that point the skill is usable for the core workflow.
2. **Incremental delivery**: add US-02 (inspection CLI), then US-04 (on-demand), then US-03 (convention + fixture), each as a complete, independently testable increment with its own checkpoint. The skill file (`.github/skills/usm-e2e/SKILL.md`) is extended section-by-section across US-02 / US-04 / US-03, and each increment leaves it valid and usable.
3. **Validate at every checkpoint**: use the `quickstart.md` scenarios for the story just completed; finish with the full Phase 6 validation run (all 9 scenarios).
4. **Never touch the private vault**: every task targets `test-vault/` exclusively (FR-010, SC-003); the `002` contract (`Board.md` + `S1`–`S6`, `taskColumns: 4`) stays untouched.
