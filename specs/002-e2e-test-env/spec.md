# Feature Specification: E2E Test Infrastructure — Isolated Test Environment & Manual Test/Preview Workflow

**Feature Branch**: `002-e2e-test-env` (consolidated with `003-manual-test-workflow`)

**Created**: 2026-10-27 (Part 1) · 2026-10-28 (Part 2)

**Status**: Draft

> **Merge note**: This specification consolidates two previously separate features that together form the plugin's E2E test infrastructure: **Part 1** — the isolated E2E test environment & GUI automation (originally `002-e2e-test-env`), and **Part 2** — the manual test & preview workflow (originally `003-manual-test-workflow`). Part 2 builds on Part 1. All requirement, success-criterion, user-story, task, and research IDs are namespaced (`-002-` / `-003-`) so the two parts stay unambiguous. No content from either original feature has been omitted or altered in meaning; only IDs and cross-references were updated for the consolidation.

---

## Part 1: E2E Test Environment (002)

**Input**: User description: "Stworzenie izolowanego środowiska testowego oraz mechanizmu automatyzacji interfejsu (GUI) dla wtyczki Obsidian User Story Map, umożliwiającego agentowi AI oraz deweloperowi weryfikację wizualną i funkcjonalną wtyczki bez ręcznej interakcji." (Creation of an isolated test environment and a GUI automation mechanism for the Obsidian User Story Map plugin, enabling an AI agent and the developer to perform visual and functional verification of the plugin without manual interaction.)

### Clarifications

#### Session 2026-10-27

- Q: Should automated map verification be a committed, versioned script in the repository (invoked via the agent's built-in browser tool), or should the agent perform ad-hoc verification on each run? (FR-002-014) → A: Both — a committed, versioned verification script performs the standard checks, and the agent may additionally perform ad-hoc inspection for deeper diagnostics.
- Q: What is the maximum acceptable delay within which the verification must detect a map update after a source note change? (SC-002-006) → A: 5 seconds.

### User Scenarios & Testing *(mandatory)*

#### User Story 1 - Isolated Test Vault (Priority: P1)

As a developer or AI agent, I want a dedicated, self-contained test vault in the repository so that I can run the plugin in a clean, controlled environment without any risk of damaging my private notes.

**Why this priority**: This is the foundation of the entire feature. Without a safe, reproducible environment, no automated verification is possible, and any manual or automated testing risks the user's real data. It delivers standalone value immediately: a guaranteed-safe place to load and exercise the plugin.

**Independent Test**: Open the test vault in Obsidian, enable the plugin, and confirm the board renders from the sample notes. No private vault is touched. This can be verified entirely within the test vault.

**Acceptance Scenarios**:

1. **Given** a clean checkout of the repository, **When** the test vault is opened in Obsidian with the plugin enabled, **Then** the board renders correctly from the sample notes and no file outside the test vault is read or modified.
2. **Given** the test vault, **When** it is re-created from the repository (e.g., after a fresh clone), **Then** the environment is identical to the previous one (same board, same notes, same plugin configuration).
3. **Given** the test vault contains notes with missing or incomplete attributes, **When** the board is rendered, **Then** those notes are grouped into the appropriate fallback sections (e.g., "Unassigned") without errors or rendering interruption.

---

#### User Story 2 - Remote Debugging Access (Priority: P2)

As an AI agent, I want to launch the Obsidian application in a remote-debugging mode so that I can attach to its process and inspect the state of the user interface.

**Why this priority**: This is the bridge between the isolated environment (US-002-01) and automated verification (US-002-03). It provides programmatic access to the running UI. On its own it delivers value: a reliable, repeatable way to bring up a debuggable instance.

**Independent Test**: Run the dedicated launch command and confirm that an external tool can connect to the running instance over the debugging port and see the application's UI.

**Acceptance Scenarios**:

1. **Given** the test vault and a current plugin build, **When** the dedicated launch command is executed, **Then** Obsidian opens on the test vault with a remote-debugging port active (default port 9222).
2. **Given** an instance is already listening on the debug port, **When** the launch command is executed again, **Then** it does not spawn a duplicate instance or fail — it reports that an instance is already available.
3. **Given** the default port is in use by another process, **When** the launch command is executed with an alternate port, **Then** the instance starts on the alternate port and remains connectable.

---

#### User Story 3 - Automated Visual & DOM Verification (Priority: P3)

As an AI agent, I want to capture screenshots and inspect the DOM structure of the rendered story map using the built-in browser tool, so that I can automatically verify the correctness of the 2D layout and the map's reaction to file changes.

**Why this priority**: This is the ultimate value of the feature — replacing manual visual inspection with automated, repeatable verification. It depends on US-002-01 (something to render) and US-002-02 (a way to attach), so it is the final slice that completes the capability.

**Independent Test**: With a debuggable instance running on the test vault, connect via the built-in browser tool, open the board note, switch to the map view, and confirm the tool reports the expected number of task columns and produces a screenshot.

**Acceptance Scenarios**:

1. **Given** a debuggable instance running on the test vault, **When** the built-in browser tool connects and opens the board note in the map view, **Then** it reports the number of rendered task columns matching the known structure of the sample board.
2. **Given** the map is rendered, **When** a screenshot is captured, **Then** the screenshot shows the 2D board layout (header rows, release sections, epic columns, story cards) that a human can visually confirm.
3. **Given** the map is rendered, **When** a source note is modified (e.g., a story is added or an attribute changed), **Then** the verification detects that the map has updated to reflect the change within 5 seconds.
4. **Given** the verification runs, **When** it completes, **Then** it reports a machine-readable pass/fail result that an agent can interpret without manual review.

---

#### Edge Cases

- **Port already occupied by an unrelated process**: The launch command MUST detect the conflict and either use the configured alternate port or report a clear, actionable error (not a silent failure).
- **Stale or half-built plugin**: The launch/verification flow MUST detect that the plugin is not correctly built and report it, rather than testing a broken build.
- **Malformed board file in the test vault**: The verification MUST surface the rendering problem (consistent with the plugin's defensive behavior) rather than crashing or hanging.
- **Obsidian already open on a different (private) vault**: The launch command MUST target the test vault explicitly and MUST NOT attach to or modify a private vault instance.
- **Browser tool cannot connect (e.g., Obsidian crashed)**: The verification MUST report a clear connection failure with a diagnostic hint, not hang indefinitely.

### Requirements *(mandatory)*

#### Functional Requirements

- **FR-002-001**: The repository MUST contain a dedicated, self-contained test vault directory (`test-vault/`) that is isolated from any user's private vault.
- **FR-002-002**: The test vault MUST contain a valid board file (`Board.md`) whose frontmatter and structure conform to the project's board file format.
- **FR-002-003**: The test vault MUST contain sample story notes that cover both fully-attributed notes and notes with missing or incomplete attributes, so that defensive grouping (e.g., "Unassigned") is exercised.
- **FR-002-004**: The test vault MUST be reproducible: re-creating it from the repository MUST yield an identical environment (same board, notes, and plugin configuration).
- **FR-002-005**: The test vault MUST include the plugin (or a documented, repeatable way to install it) so that the plugin can be enabled and run inside the test vault.
- **FR-002-006**: The environment MUST provide a dedicated launch command that opens Obsidian pointed at the test vault with a remote-debugging port enabled (default port 9222).
- **FR-002-007**: The launch command MUST be idempotent: if an instance is already listening on the debug port, it MUST NOT spawn a duplicate or fail; it MUST report that an instance is already available.
- **FR-002-008**: The debug port MUST be configurable (with 9222 as the default) to allow avoiding port conflicts and running multiple instances.
- **FR-002-009**: The launched Obsidian instance MUST expose its user interface to an external, CDP-based browser automation tool (the agent's built-in browser capability).
- **FR-002-010**: The environment MUST allow the built-in browser tool to connect to the running instance, open a specified board note, and switch it to the visual map view.
- **FR-002-011**: The verification MUST be able to count and report the number of rendered task columns (and other key structural elements) in the map.
- **FR-002-012**: The verification MUST be able to capture a screenshot of the rendered map for visual verification.
- **FR-002-013**: The verification MUST be able to detect that the map has updated in response to a change in a source note.
- **FR-002-014**: The verification MUST report its outcome in a machine-readable pass/fail form suitable for an agent to interpret.
- **FR-002-015**: The launch and verification flow MUST detect and clearly report a missing or outdated plugin build, rather than testing a broken build.
- **FR-002-016**: The standard verification checks (FR-002-011, FR-002-012, FR-002-013) MUST be packaged as a committed, versioned verification script in the repository, invoked via the agent's built-in browser capability.
- **FR-002-017**: The environment MUST allow the agent to perform ad-hoc inspection of the running instance for diagnostics beyond the standard checks.

#### Key Entities

- **Test Vault**: The isolated, self-contained vault directory. Key attributes: location in the repository, board file, set of sample story notes, plugin installation, and a known/documented board structure used as the verification baseline.
- **Board File**: The `Board.md` note that defines the map's structure and general settings via frontmatter. Key attributes: conformance to the board file format, row/column hierarchy, and the set of linked story notes.
- **Story Note**: A sample note representing a single story on the map. Key attributes: presence/absence of column and row hierarchy attributes (to exercise both normal and fallback grouping), title, and any story-level attributes.
- **Debug Session**: A running Obsidian instance bound to the test vault with a remote-debugging port active. Key attributes: the active port, the target vault, and its readiness for an external CDP connection.
- **Verification Report**: The output of an automated verification run. Key attributes: the reported structural counts (e.g., task columns), the captured screenshot reference, the reactivity result, and an overall pass/fail status.
- **Verification Script**: The committed, versioned script that performs the standard verification checks. Key attributes: the set of standard checks it performs, its invocation via the agent's built-in browser capability, and its machine-readable output.

### Success Criteria *(mandatory)*

#### Measurable Outcomes

- **SC-002-001**: A developer or agent can set up the isolated test environment from a clean checkout in under 5 minutes, without touching any private vault.
- **SC-002-002**: The test environment is 100% isolated: zero private notes are read or modified during any test run.
- **SC-002-003**: An external automation tool can connect to the running instance and retrieve the rendered map's structure within 30 seconds of a successful launch.
- **SC-002-004**: The automated verification reports the correct number of rendered task columns for the sample board with 100% accuracy against the known fixture.
- **SC-002-005**: The captured screenshot of the rendered map is visually confirmable by a human as matching the expected 2D layout (header rows, release sections, epic columns, story cards).
- **SC-002-006**: The verification detects a change in the map (e.g., an added story or changed attribute) within 5 seconds after the source note is modified.
- **SC-002-007**: The launch command is idempotent: repeated execution while an instance is already up produces no duplicates and no errors.
- **SC-002-008**: A missing or outdated plugin build is detected and reported before any verification is attempted (no silent testing of a broken build).

### Assumptions

- **Target platform**: The launch command is developed and verified for macOS (the developer's environment). Cross-platform launch support (Windows/Linux) is out of scope for this feature.
- **Automation mechanism**: Automated verification relies on the agent's built-in, CDP-based browser capability (e.g., the `browser` / `runPlaywrightCode` tool). Verification is hybrid: a committed, versioned verification script in the repository performs the standard checks, and the agent may additionally perform ad-hoc inspection for deeper diagnostics. This feature does NOT add a project-level test framework or a new runtime NPM dependency for browser automation, in line with the project's dependency-minimization principle.
- **Plugin build prerequisite**: A current plugin build exists before the test environment is used. The environment detects and reports a missing/outdated build rather than building it as part of verification.
- **Known verification baseline**: The test vault's board has a fixed, documented structure (a known number of task columns, releases, and epics) that serves as the expected baseline for automated checks.
- **Single-instance default**: By default the environment assumes a single debuggable instance on the default port (9222); multiple simultaneous instances are supported only via explicit alternate-port configuration.
- **Reactivity scope**: The reactivity check verifies that the map reflects a source change (structure/count or content update), not a pixel-perfect diff of the entire board.
- **Out of scope**: A dedicated CI/CD test framework and performance testing on vaults exceeding 1000 notes are explicitly out of scope for this feature.

---

## Part 2: Manual Test & Preview Workflow (003)

**Input**: User description: "druga iteracja — scalenie infrastruktury do zautomatyzowanych testów manualnych oraz podglądu działania projektu w Obsidianie. `002-e2e-test-env` stworzyło połączenie z testowym vaultem Obsidianu; `001-user-story-map` zawiera pełną specyfikację wdrażanego pluginu łącznie z instrukcjami dla testów manualnych (quickstart, tasks). Zadaniem jest opracowanie rozwiązania, które pozwoli w kolejnych sesjach i iteracjach agentom łatwo prowadzić testy manualne i podglądać działanie pluginu w Obsidianie. Przykładowe rozwiązania: instrukcje w tasks.md jak przeprowadzić zautomatyzowane testy manualne, zestaw skilli, tooli, itp. Rozwiązanie powinno być elastyczne i uniwersalne."

### Clarifications

#### Session 2026-10-27

- Q: What tooling scope does this iteration cover? (Q1) → A: **Skill + a small ad-hoc inspection CLI** (`e2e/inspect.mjs`: eval / wait / screenshot) reusing the existing CDP client. No Playwright, no new NPM dependencies.
- Q: Who performs "manual" verification in the new workflow? (Q2) → A: **Hybrid, decided per test.** Some scenarios are automatable (agent runs them), some require the user's subjective judgment (aesthetics, perception), and some require live interaction in a running Obsidian instance (keyboard, drag & drop) where the code works but the human experience is what matters. The agent may ask questions — e.g., by delivering a screenshot or by asking the user to check the live instance.
- Q: Do manual tests run exclusively through `test-vault/`, or does the deploy path to the private vault remain? (Q3) → A: **Exclusively `test-vault/`.** Manual-scenario fixtures (e.g., the extended "Test Board 2" board) are migrated into the test vault. The deploy path to the private vault remains a user-only action; the agent never uses it.
- Q: Should screenshots taken during manual-assist verification be committed to the repository, or remain local artifacts only? (FR-003-003, SC-003-005) → A: **Hybrid.** Manual-assist screenshots are committed in the feature's `checklists/` directory (evidence of a human judgment that is not easily reproducible); automated-check screenshots remain local in `e2e/output/` (gitignored, reproducible on demand).
- Q: Should the extended board (used for the Iteration 2 layout checks) replace the current `Board.md` in the test vault, or coexist with it as a second file? (FR-003-009, US-003-03) → A: **Coexist.** `Board.md` remains the target of the standard automated verification (the Part 1 contract, `taskColumns: 4`, stays untouched); the extended board is added as a second file. Multiple boards MUST coexist in one vault without conflicts — the absence of cross-board interference is itself a test target. Additional boards may live in separate folders, or in the same folder when they are variants of the same board; both arrangements MUST work and be testable.
- Q: How are mobile scenarios verified — by the user on a physical device, or by the agent? → A: **Agent via mobile emulation.** Obsidian supports emulating a mobile device on desktop (`this.app.emulateMobile(true)` in the page context, disabled with `emulateMobile(false)`). The agent enables mobile emulation in the running instance, performs the mobile scenario, captures evidence, and restores the desktop state. Physical-device checks remain an optional user-performed step for true-device verification (real touch behavior, OS-specific quirks).
- Q: Can the developer request on-demand operations (screenshots, interactions) from the agent at any time, including mid-development? → A: **Yes — on-demand interactive sessions are a first-class mode.** The developer can ask the agent at any time to take a screenshot or perform operations in the test instance; the agent launches the instance if needed, performs the operations (navigation, view switching, clicks, typing, mobile emulation), delivers the result (screenshot / evaluated state), and can iterate (change → reload → inspect) while working on code.

### User Scenarios & Testing *(mandatory)*

#### User Story 1 - Discoverable Manual-Verification Skill (Priority: P1)

As an AI agent starting a new session on this repository, I want a discoverable, self-contained skill that tells me how to prepare the test environment, run the standard automated checks, perform ad-hoc inspection, and assist the user with manual verification, so that I can run manual tests and preview the plugin in Obsidian in any session without rediscovering the infrastructure or touching the user's private vault.

**Why this priority**: This is the core of the feature. Without a procedural entry point, every new session must re-derive how the Part 1 infrastructure works (or worse, fall back to the old private-vault workflow). The skill is the single source of truth that makes the capability reusable across sessions and iterations. It delivers standalone value immediately: any agent that reads it can safely bring up a debuggable instance and verify the plugin.

**Independent Test**: In a fresh session, the agent discovers the skill from the skill index, follows it to run environment setup and launch, performs one standard check and one ad-hoc inspection, and completes one manual-assist scenario with the user — all without any instruction outside the repository.

**Acceptance Scenarios**:

1. **Given** a fresh agent session with only the repository, **When** a task requires manual verification of the plugin, **Then** the agent finds the skill via its name/description and follows it to prepare the environment without asking the user how the infrastructure works.
2. **Given** the skill, **When** the agent prepares the environment, **Then** it uses the test vault exclusively and never reads from or writes to the user's private vault.
3. **Given** a manual verification task, **When** the agent executes it per the skill, **Then** the outcome (pass/fail/pending) is recorded in the feature's manual validation checklist, with a screenshot attached where the skill prescribes one.
4. **Given** the skill, **When** the agent finishes a verification session, **Then** it leaves the repository working tree clean (only intended changes) and either leaves the instance running with the user's explicit consent or closes it.

---

#### User Story 2 - Deterministic Ad-Hoc Inspection (Priority: P2)

As an AI agent, I want a single documented command-line helper that evaluates JavaScript in the running instance, waits for a selector, and captures a screenshot, so that I can inspect the DOM and the rendered UI beyond the standard checks without writing a custom CDP client in every session. The evaluate operation also serves as the interaction channel: operations such as navigation, clicks, typing, and mobile emulation are performed by evaluating documented expressions in the page.

**Why this priority**: Part 1 proved that ad-hoc inspection is needed (FR-002-017), but each session currently re-implements a throwaway CDP script — slow, error-prone, and inconsistent. A committed, deterministic helper makes inspection repeatable and keeps the skill lean. It depends on the Part 1 CDP client but delivers standalone value: any agent can probe a running instance with one command.

**Independent Test**: With a debuggable instance running on the test vault, run the helper to evaluate a DOM expression, wait for a selector, and capture a screenshot; confirm the outputs are correct and that a missing instance produces a clear, actionable error.

**Acceptance Scenarios**:

1. **Given** a debuggable instance running on the test vault, **When** the helper is asked to evaluate a JavaScript expression in the page, **Then** it prints the result to stdout and exits 0.
2. **Given** a debuggable instance, **When** the helper is asked to wait for a CSS selector, **Then** it exits 0 when the element appears and reports a clear timeout error otherwise.
3. **Given** a debuggable instance, **When** the helper is asked to capture a screenshot to a given path, **Then** the image file is written and the path is reported.
4. **Given** no instance listening on the target port, **When** any helper command is run, **Then** it fails fast with a clear, actionable error (including the hint to launch the instance) and a non-zero exit code.
5. **Given** the helper, **When** it is used, **Then** it introduces no new external dependencies.

---

#### User Story 3 - Manual-Test Task Convention & Fixture Migration (Priority: P3)

As a developer, I want manual-test tasks in future iterations to be written against the test vault with an explicit reference to the skill, and the manual-scenario fixtures (including the extended board used for the Iteration 2 layout checks) to live in the test vault, so that manual verification is reproducible across sessions and never requires the private vault.

**Why this priority**: The skill and the helper are useless if future tasks keep pointing at the old private-vault workflow. This story closes the loop: it defines how tasks are written (the convention) and moves the fixtures so that every manual scenario in the plugin spec can be executed inside the test vault. It depends on US-003-01 (the convention references the skill) and delivers the final slice: the workflow is complete and universal.

**Independent Test**: A newly written manual-test task (per the convention) can be executed end-to-end inside the test vault by an agent following the skill, and the extended board fixture renders in the test vault with the expected structure.

**Acceptance Scenarios**:

1. **Given** the task-writing convention, **When** a future iteration's tasks include a manual verification step, **Then** the task text explicitly references the skill and names the checklist section to update.
2. **Given** the test vault, **When** the extended board fixture (the one previously used for the Iteration 2 layout checks) is opened in the map view, **Then** it renders with the expected structure (multiple releases, long epic titles, unassigned sections) matching the documented baseline.
3. **Given** a manual scenario from the plugin spec that previously required the private vault, **When** it is re-run per the new workflow, **Then** it completes entirely within the test vault with no private-vault access.
4. **Given** the convention, **When** a scenario requires the user's subjective judgment or a live interaction, **Then** the task marks it as such, and the agent follows the skill's manual-assist protocol instead of guessing the outcome.
5. **Given** a test vault containing multiple boards (the standard `Board.md` and the extended board), **When** each board is opened in the map view, **Then** each renders its own structure independently with no cross-board interference, regardless of whether the boards live in the same folder or in separate folders.

---

#### User Story 4 - On-Demand Preview & Interaction During Development (Priority: P2)

As a developer working on the plugin, I want to ask the agent at any time — including in the middle of writing code — to take a screenshot of the current state or to perform operations in the test instance, so that I can preview and interact with the running plugin without leaving my workflow or explaining the infrastructure.

**Why this priority**: The value of the workflow is not only in formal verification runs but in continuous, on-demand feedback during development. The developer must be able to say "show me the board" or "open that note and click the card" and get a result. This story depends on US-003-01 (the skill documents the mode) and US-003-02 (the helper performs the operations) and delivers the day-to-day developer experience.

**Independent Test**: While working on code, the developer asks the agent for a screenshot of the board; the agent ensures the instance is running, navigates to the board, and delivers the screenshot. Then the developer asks the agent to perform an operation (e.g., switch to the map view); the agent performs it and confirms the result.

**Acceptance Scenarios**:

1. **Given** the developer asks the agent for a screenshot of the current board state, **When** the agent follows the skill, **Then** the agent ensures the test instance is running (launching it if needed), navigates to the board, and delivers the screenshot without the developer explaining any infrastructure.
2. **Given** the developer asks the agent to perform an operation in the instance (e.g., open a note, switch views, click a card, enable mobile emulation), **When** the agent executes it via the inspection helper, **Then** the operation is performed in the running instance and the result is confirmed with a screenshot or an evaluated state.
3. **Given** the agent is iterating on code and needs to preview behavior, **When** it launches the test instance, **Then** it can repeat the cycle change → reload → inspect → screenshot without developer intervention.
4. **Given** an operation the agent cannot perform programmatically (e.g., a true touch gesture or a drag & drop that cannot be simulated), **When** the agent attempts it, **Then** it falls back to the manual-assist protocol and asks the user to perform the operation in the live instance.

---

#### Edge Cases

- **Obsidian already open on a private vault**: the launch flow MUST target the test vault explicitly; the agent MUST NOT attach to, inspect, or modify the private instance. If the default port is occupied by the private instance, the agent uses an alternate port for the test vault.
- **Instance crashes mid-verification**: the inspection helper and the standard checks MUST report a clear connection failure with a diagnostic hint (re-launch), not hang.
- **User unavailable for a subjective judgment**: the agent MUST record the scenario as "pending user review" in the checklist — it MUST NOT guess pass/fail for subjective or live-interaction scenarios.
- **Mobile scenarios**: the agent performs them via Obsidian's built-in mobile emulation in the desktop instance (enable emulation, run the scenario, capture evidence, restore the desktop state). Physical-device checks remain an optional user-performed step for true-device verification; the agent records the user's reported outcome.
- **Mobile emulation state leak**: if the agent enables mobile emulation and the session is interrupted before restoring it, the emulation state MUST be restored (the skill documents the restore step; relaunching the instance also resets it).
- **Non-automatable operations**: operations that cannot be performed programmatically (e.g., true touch gestures) MUST fall back to the manual-assist protocol — the user performs them in the live instance and the agent records the outcome.
- **Fixture drift**: if a test-vault fixture changes, the documented baseline (counts, structure) MUST be updated in the same change.
- **Runtime side effects on committed fixtures**: the launched instance may rewrite committed test-vault config files (formatting only). The workflow MUST restore them so the working tree stays clean.

### Requirements *(mandatory)*

#### Functional Requirements

- **FR-003-001**: The repository MUST contain a project-local skill (a `SKILL.md` with a discoverable name and description) that documents the complete manual/E2E verification workflow: environment preparation, standard automated checks, ad-hoc inspection, and the manual-assist protocol.
- **FR-003-002**: The skill MUST be self-contained and project-local (surviving tooling updates), relying only on repository artifacts — no external services or undocumented prerequisites.
- **FR-003-003**: The skill MUST document the manual-assist protocol: the agent prepares the environment, presents the checklist items to verify, collects the user's judgment (via delivered screenshots and/or by asking the user to check the live instance), and records the outcome in the feature's manual validation checklist. Screenshots taken during manual-assist verification MUST be committed in the feature's `checklists/` directory as evidence of the recorded judgment; screenshots from automated checks remain local in `e2e/output/` (gitignored, reproducible on demand).
- **FR-003-004**: The skill MUST classify manual scenarios into verification modes — (a) automatable (the agent runs the check), (b) subjective (the user's judgment is required), (c) live interaction (the user performs keyboard/drag/UX interactions in the running instance) — and MUST prescribe the agent's behavior for each mode. Mobile scenarios are automatable: the agent runs them via Obsidian's built-in mobile emulation in the desktop instance (enable emulation before the scenario, restore the desktop state after).
- **FR-003-005**: The environment MUST provide a deterministic ad-hoc inspection command-line helper that can evaluate JavaScript in the running instance, wait for a CSS selector, and capture a screenshot to a given path, reusing the existing CDP client.
- **FR-003-006**: The inspection helper MUST fail fast with a clear, actionable error (including the hint to launch the instance) when no instance is listening on the target port, and MUST support an alternate port.
- **FR-003-007**: The inspection helper MUST NOT introduce new external dependencies (runtime built-ins only).
- **FR-003-008**: The repository MUST document a task-writing convention: manual verification tasks in future iterations MUST be written against the test vault, MUST explicitly reference the skill, and MUST name the checklist section to update.
- **FR-003-009**: The test vault MUST contain the fixtures required by the plugin spec's manual scenarios, including the extended board previously used for the Iteration 2 layout checks, so that manual verification never requires a private vault. The test vault MUST support multiple coexisting boards without conflicts: `Board.md` remains the target of the standard automated verification (the Part 1 contract stays untouched), and the extended board coexists as a second file. Boards may live in separate folders, or in the same folder when they are variants of the same board; both arrangements MUST work and be testable.
- **FR-003-010**: The workflow MUST never read from or write to the user's private vault; the deploy path to the private vault remains a user-only action that the agent never performs.
- **FR-003-011**: The skill MUST document known runtime side effects on the test vault (e.g., the app rewriting committed config files) and the exact steps to restore a clean working tree after a verification run.
- **FR-003-012**: The skill MUST document how to end a verification session cleanly: the instance is left running only with the user's explicit consent, otherwise it is closed; the repository working tree is left with only intended changes.
- **FR-003-013**: The skill MUST document the on-demand interactive session mode: at any time on the developer's request (including mid-development), the agent can launch the test instance if it is not running, perform operations in the instance (navigation, view switching, clicks, typing, mobile emulation), capture screenshots for preview, and iterate (change → reload → inspect) without the developer explaining the infrastructure.

#### Key Entities

- **Verification skill**: the discoverable `SKILL.md` (plus optional reference files) carrying the workflow, the manual-assist protocol, the scenario-mode classification, and the gotchas.
- **Inspection helper**: the committed CLI with three operations (evaluate, wait-for-selector, screenshot) targeting a running instance on a configurable port.
- **Manual validation checklist**: the per-feature checklist file (under the feature's `checklists/`) that records each scenario's outcome (pass / fail / pending user review) and references attached screenshots.
- **Test vault fixtures**: the board and story notes (including the extended board) that make every manual scenario reproducible inside the test vault. Multiple boards coexist in the vault without conflicts, in the same folder or in separate folders.
- **Verification result record**: a checklist entry plus, where prescribed, a screenshot artifact captured during the run. Manual-assist screenshots are committed in the feature's `checklists/` directory; automated-check screenshots are local in `e2e/output/` (gitignored).

### Success Criteria *(mandatory)*

#### Measurable Outcomes

- **SC-003-001**: An agent in a fresh session, given only the repository, prepares the test environment and completes the standard automated verification with zero user intervention in under 5 minutes.
- **SC-003-002**: An agent in a fresh session completes a full manual-assist scenario (environment preparation → user judgment → recorded checklist result) without the user needing to explain any part of the infrastructure.
- **SC-003-003**: 100% of the plugin spec's manual verification scenarios can be executed entirely within the test vault, with zero private-vault access.
- **SC-003-004**: Ad-hoc inspection (evaluate / wait / screenshot) is available as a single documented command with no per-session custom scripting.
- **SC-003-005**: After any verification run, the repository working tree can be restored to a clean state (only intended changes remain) by following the documented steps.
- **SC-003-006**: A developer's on-demand request (a screenshot or an operation) is fulfilled by the agent — launching the instance if needed — without the developer explaining any part of the infrastructure.
- **SC-003-007**: Mobile scenarios are verified by the agent via mobile emulation in the desktop instance, with the desktop state restored after the scenario, without a physical device.

### Assumptions

- The Part 1 infrastructure (test vault, setup/launch/CDP/verify commands, report contract) exists and is stable; Part 2 builds on it and does not redesign it.
- macOS with the Obsidian desktop app is the primary environment (consistent with Part 1); the workflow is documented for that platform first.
- The user is available during manual-verification sessions for subjective and live-interaction judgments; when unavailable, scenarios are recorded as pending.
- Mobile verification is primarily performed by the agent via Obsidian's built-in mobile emulation on desktop (`emulateMobile` in the page context); physical-device checks are optional and user-performed for true-device verification.
- The developer may request on-demand preview and interaction at any time, including mid-development; the agent can launch and drive the test instance autonomously for that purpose.
- The skill is project-local (not listed in tooling integration manifests), following the existing `usm-task-protocol` pattern, so tooling updates do not overwrite it.
- No new external dependencies are introduced (runtime built-ins only), consistent with the Part 1 constraint and the constitution's dependency-minimization rule.
- The private-vault deploy path (`npm run deploy`) remains available for the user's own production use but is out of scope for agent-driven verification.
