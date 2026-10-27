# Feature Specification: Isolated E2E Test Environment & GUI Automation

**Feature Branch**: `002-e2e-test-env`

**Created**: 2026-10-27

**Status**: Draft

**Input**: User description: "Stworzenie izolowanego środowiska testowego oraz mechanizmu automatyzacji interfejsu (GUI) dla wtyczki Obsidian User Story Map, umożliwiającego agentowi AI oraz deweloperowi weryfikację wizualną i funkcjonalną wtyczki bez ręcznej interakcji." (Creation of an isolated test environment and a GUI automation mechanism for the Obsidian User Story Map plugin, enabling an AI agent and the developer to perform visual and functional verification of the plugin without manual interaction.)

## Clarifications

### Session 2026-10-27

- Q: Should automated map verification be a committed, versioned script in the repository (invoked via the agent's built-in browser tool), or should the agent perform ad-hoc verification on each run? (FR-014) → A: Both — a committed, versioned verification script performs the standard checks, and the agent may additionally perform ad-hoc inspection for deeper diagnostics.
- Q: What is the maximum acceptable delay within which the verification must detect a map update after a source note change? (SC-006) → A: 5 seconds.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Isolated Test Vault (Priority: P1)

As a developer or AI agent, I want a dedicated, self-contained test vault in the repository so that I can run the plugin in a clean, controlled environment without any risk of damaging my private notes.

**Why this priority**: This is the foundation of the entire feature. Without a safe, reproducible environment, no automated verification is possible, and any manual or automated testing risks the user's real data. It delivers standalone value immediately: a guaranteed-safe place to load and exercise the plugin.

**Independent Test**: Open the test vault in Obsidian, enable the plugin, and confirm the board renders from the sample notes. No private vault is touched. This can be verified entirely within the test vault.

**Acceptance Scenarios**:

1. **Given** a clean checkout of the repository, **When** the test vault is opened in Obsidian with the plugin enabled, **Then** the board renders correctly from the sample notes and no file outside the test vault is read or modified.
2. **Given** the test vault, **When** it is re-created from the repository (e.g., after a fresh clone), **Then** the environment is identical to the previous one (same board, same notes, same plugin configuration).
3. **Given** the test vault contains notes with missing or incomplete attributes, **When** the board is rendered, **Then** those notes are grouped into the appropriate fallback sections (e.g., "Unassigned") without errors or rendering interruption.

---

### User Story 2 - Remote Debugging Access (Priority: P2)

As an AI agent, I want to launch the Obsidian application in a remote-debugging mode so that I can attach to its process and inspect the state of the user interface.

**Why this priority**: This is the bridge between the isolated environment (US-01) and automated verification (US-03). It provides programmatic access to the running UI. On its own it delivers value: a reliable, repeatable way to bring up a debuggable instance.

**Independent Test**: Run the dedicated launch command and confirm that an external tool can connect to the running instance over the debugging port and see the application's UI.

**Acceptance Scenarios**:

1. **Given** the test vault and a current plugin build, **When** the dedicated launch command is executed, **Then** Obsidian opens on the test vault with a remote-debugging port active (default port 9222).
2. **Given** an instance is already listening on the debug port, **When** the launch command is executed again, **Then** it does not spawn a duplicate instance or fail — it reports that an instance is already available.
3. **Given** the default port is in use by another process, **When** the launch command is executed with an alternate port, **Then** the instance starts on the alternate port and remains connectable.

---

### User Story 3 - Automated Visual & DOM Verification (Priority: P3)

As an AI agent, I want to capture screenshots and inspect the DOM structure of the rendered story map using the built-in browser tool, so that I can automatically verify the correctness of the 2D layout and the map's reaction to file changes.

**Why this priority**: This is the ultimate value of the feature — replacing manual visual inspection with automated, repeatable verification. It depends on US-01 (something to render) and US-02 (a way to attach), so it is the final slice that completes the capability.

**Independent Test**: With a debuggable instance running on the test vault, connect via the built-in browser tool, open the board note, switch to the map view, and confirm the tool reports the expected number of task columns and produces a screenshot.

**Acceptance Scenarios**:

1. **Given** a debuggable instance running on the test vault, **When** the built-in browser tool connects and opens the board note in the map view, **Then** it reports the number of rendered task columns matching the known structure of the sample board.
2. **Given** the map is rendered, **When** a screenshot is captured, **Then** the screenshot shows the 2D board layout (header rows, release sections, epic columns, story cards) that a human can visually confirm.
3. **Given** the map is rendered, **When** a source note is modified (e.g., a story is added or an attribute changed), **Then** the verification detects that the map has updated to reflect the change within 5 seconds.
4. **Given** the verification runs, **When** it completes, **Then** it reports a machine-readable pass/fail result that an agent can interpret without manual review.

---

### Edge Cases

- **Port already occupied by an unrelated process**: The launch command MUST detect the conflict and either use the configured alternate port or report a clear, actionable error (not a silent failure).
- **Stale or half-built plugin**: The launch/verification flow MUST detect that the plugin is not correctly built and report it, rather than testing a broken build.
- **Malformed board file in the test vault**: The verification MUST surface the rendering problem (consistent with the plugin's defensive behavior) rather than crashing or hanging.
- **Obsidian already open on a different (private) vault**: The launch command MUST target the test vault explicitly and MUST NOT attach to or modify a private vault instance.
- **Browser tool cannot connect (e.g., Obsidian crashed)**: The verification MUST report a clear connection failure with a diagnostic hint, not hang indefinitely.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The repository MUST contain a dedicated, self-contained test vault directory (`test-vault/`) that is isolated from any user's private vault.
- **FR-002**: The test vault MUST contain a valid board file (`Board.md`) whose frontmatter and structure conform to the project's board file format.
- **FR-003**: The test vault MUST contain sample story notes that cover both fully-attributed notes and notes with missing or incomplete attributes, so that defensive grouping (e.g., "Unassigned") is exercised.
- **FR-004**: The test vault MUST be reproducible: re-creating it from the repository MUST yield an identical environment (same board, notes, and plugin configuration).
- **FR-005**: The test vault MUST include the plugin (or a documented, repeatable way to install it) so that the plugin can be enabled and run inside the test vault.
- **FR-006**: The environment MUST provide a dedicated launch command that opens Obsidian pointed at the test vault with a remote-debugging port enabled (default port 9222).
- **FR-007**: The launch command MUST be idempotent: if an instance is already listening on the debug port, it MUST NOT spawn a duplicate or fail; it MUST report that an instance is already available.
- **FR-008**: The debug port MUST be configurable (with 9222 as the default) to allow avoiding port conflicts and running multiple instances.
- **FR-009**: The launched Obsidian instance MUST expose its user interface to an external, CDP-based browser automation tool (the agent's built-in browser capability).
- **FR-010**: The environment MUST allow the built-in browser tool to connect to the running instance, open a specified board note, and switch it to the visual map view.
- **FR-011**: The verification MUST be able to count and report the number of rendered task columns (and other key structural elements) in the map.
- **FR-012**: The verification MUST be able to capture a screenshot of the rendered map for visual verification.
- **FR-013**: The verification MUST be able to detect that the map has updated in response to a change in a source note.
- **FR-014**: The verification MUST report its outcome in a machine-readable pass/fail form suitable for an agent to interpret.
- **FR-015**: The launch and verification flow MUST detect and clearly report a missing or outdated plugin build, rather than testing a broken build.
- **FR-016**: The standard verification checks (FR-011, FR-012, FR-013) MUST be packaged as a committed, versioned verification script in the repository, invoked via the agent's built-in browser capability.
- **FR-017**: The environment MUST allow the agent to perform ad-hoc inspection of the running instance for diagnostics beyond the standard checks.

### Key Entities

- **Test Vault**: The isolated, self-contained vault directory. Key attributes: location in the repository, board file, set of sample story notes, plugin installation, and a known/documented board structure used as the verification baseline.
- **Board File**: The `Board.md` note that defines the map's structure and general settings via frontmatter. Key attributes: conformance to the board file format, row/column hierarchy, and the set of linked story notes.
- **Story Note**: A sample note representing a single story on the map. Key attributes: presence/absence of column and row hierarchy attributes (to exercise both normal and fallback grouping), title, and any story-level attributes.
- **Debug Session**: A running Obsidian instance bound to the test vault with a remote-debugging port active. Key attributes: the active port, the target vault, and its readiness for an external CDP connection.
- **Verification Report**: The output of an automated verification run. Key attributes: the reported structural counts (e.g., task columns), the captured screenshot reference, the reactivity result, and an overall pass/fail status.
- **Verification Script**: The committed, versioned script that performs the standard verification checks. Key attributes: the set of standard checks it performs, its invocation via the agent's built-in browser capability, and its machine-readable output.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer or agent can set up the isolated test environment from a clean checkout in under 5 minutes, without touching any private vault.
- **SC-002**: The test environment is 100% isolated: zero private notes are read or modified during any test run.
- **SC-003**: An external automation tool can connect to the running instance and retrieve the rendered map's structure within 30 seconds of a successful launch.
- **SC-004**: The automated verification reports the correct number of rendered task columns for the sample board with 100% accuracy against the known fixture.
- **SC-005**: The captured screenshot of the rendered map is visually confirmable by a human as matching the expected 2D layout (header rows, release sections, epic columns, story cards).
- **SC-006**: The verification detects a change in the map (e.g., an added story or changed attribute) within 5 seconds after the source note is modified.
- **SC-007**: The launch command is idempotent: repeated execution while an instance is already up produces no duplicates and no errors.
- **SC-008**: A missing or outdated plugin build is detected and reported before any verification is attempted (no silent testing of a broken build).

## Assumptions

- **Target platform**: The launch command is developed and verified for macOS (the developer's environment). Cross-platform launch support (Windows/Linux) is out of scope for this feature.
- **Automation mechanism**: Automated verification relies on the agent's built-in, CDP-based browser capability (e.g., the `browser` / `runPlaywrightCode` tool). Verification is hybrid: a committed, versioned verification script in the repository performs the standard checks, and the agent may additionally perform ad-hoc inspection for deeper diagnostics. This feature does NOT add a project-level test framework or a new runtime NPM dependency for browser automation, in line with the project's dependency-minimization principle.
- **Plugin build prerequisite**: A current plugin build exists before the test environment is used. The environment detects and reports a missing/outdated build rather than building it as part of verification.
- **Known verification baseline**: The test vault's board has a fixed, documented structure (a known number of task columns, releases, and epics) that serves as the expected baseline for automated checks.
- **Single-instance default**: By default the environment assumes a single debuggable instance on the default port (9222); multiple simultaneous instances are supported only via explicit alternate-port configuration.
- **Reactivity scope**: The reactivity check verifies that the map reflects a source change (structure/count or content update), not a pixel-perfect diff of the entire board.
- **Out of scope**: A dedicated CI/CD test framework and performance testing on vaults exceeding 1000 notes are explicitly out of scope for this feature.
