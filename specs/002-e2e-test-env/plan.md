# Implementation Plan: E2E Test Infrastructure — Isolated Test Environment & Manual Test/Preview Workflow

**Branch**: `002-e2e-test-env` (consolidated with `003-manual-test-workflow`) | **Date**: 2026-10-27 (Part 1) · 2026-10-28 (Part 2) | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-e2e-test-env/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

> **Merge note**: This plan consolidates the implementation plans of two previously separate features that together form the plugin's E2E test infrastructure: **Part 1** — the isolated E2E test environment & GUI automation (originally `002-e2e-test-env`), and **Part 2** — the manual test & preview workflow (originally `003-manual-test-workflow`). Part 2 builds on Part 1. All requirement, success-criterion, and user-story IDs are namespaced (`-002-` / `-003-`). No content from either original plan has been omitted or altered in meaning; only IDs, cross-references, and the post-merge artifact locations were updated.

---

## Part 1: E2E Test Environment (002)

### Summary

This feature adds an isolated, reproducible E2E test environment for the Obsidian User Story Map plugin, plus a GUI automation mechanism that lets an AI agent (and the developer) verify the rendered story map visually and functionally without manual interaction.

Technical approach: a committed `test-vault/` directory (board file + sample story notes + installed plugin) provides a safe, reproducible environment (US-002-01). A Node ESM launch script (`e2e/launch.mjs`) opens Obsidian on the test vault with a CDP remote-debugging port — idempotent and with a configurable port (US-002-02). A Node ESM verification script (`e2e/verify.mjs`) connects over CDP using only Node built-ins (`fetch` + `WebSocket`, no new NPM dependencies), performs the standard checks (task-column count, screenshot, reactivity), and emits a machine-readable JSON pass/fail report (US-002-03). The agent may additionally perform ad-hoc CDP inspection for deeper diagnostics (FR-002-017).

### Technical Context

**Language/Version**: Node.js LTS — E2E scripts require Node 22+ (stable global `WebSocket`, used for the CDP connection); the plugin build remains Node 18+ compatible. E2E tooling is plain Node ESM (`.mjs`), no TypeScript build step. The plugin itself stays TypeScript strict.

**Primary Dependencies**: None new. E2E scripts use only Node built-ins (`node:fs`, `node:child_process`, global `fetch`, global `WebSocket`). Browser automation relies on the agent's built-in CDP-based browser capability; no Playwright/Puppeteer package is added.

**Storage**: Files. `test-vault/` (Markdown board + story notes + `.obsidian/` config + installed plugin artifacts). Verification screenshots are written to a local, gitignored output directory. No database.

**Testing**: Existing Vitest (unit/integration/perf) is unchanged. New E2E verification is a standalone Node script (`e2e/verify.mjs`) run against a live Obsidian instance over CDP; it is not part of the Vitest suite.

**Target Platform**: macOS (Obsidian desktop app). Cross-platform launch is out of scope.

**Project Type**: Obsidian plugin repository + local E2E test tooling (Node scripts + fixture vault).

**Performance Goals**: CDP connect + structure retrieval < 30 s (SC-002-003); map reactivity detected < 5 s (SC-002-006); environment setup from a clean checkout < 5 min (SC-002-001).

**Constraints**: No new runtime NPM dependencies; localhost-only (CDP on 127.0.0.1); no network calls / no telemetry; must not read or modify any private vault; must not commit build artifacts (`main.js`).

**Scale/Scope**: A single small fixture vault (8 cards, 4 task columns, 3 release rows); a single debuggable instance by default (alternate ports for multiple instances).

### Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**GATE result: PASS** (no violations; re-checked after Phase 1 design — still PASS).

| # | Constitution gate | Result | Notes |
|---|-------------------|--------|-------|
| I | Obsidian ecosystem & view architecture | N/A | No plugin code changes; the test vault exercises the existing plugin as-is. Launch uses the standard Electron `--remote-debugging-port` flag. |
| II | Security, privacy, fault tolerance | PASS | Localhost-only CDP (127.0.0.1); no network calls, no telemetry; the test vault is isolated from any private vault (SC-002-002). |
| III | Lifecycle, code quality, TDD | PASS | E2E scripts are plain Node ESM with English comments. TDD is N/A here — this feature adds no domain/business logic (only fixtures + tooling); the TDD rule applies to plugin domain logic, which is unchanged. |
| IV | UX/UI, accessibility | N/A | No plugin UI changes. |
| V | Performance, simplicity | N/A | No plugin code changes. |
| VI | Data portability, self-describing config | PASS | `test-vault/Board.md` conforms to the board file format contract and is self-describing. |
| VII | Pragmatic architecture, dependency minimization | PASS | Zero new NPM dependencies (Node built-ins only). The 3-layer `src/` structure is unchanged; E2E tooling lives outside `src/` (it is not plugin code). |
| — | Language policy (docs/code in English) | PASS | All artifacts and script comments are in English. |

### Project Structure

#### Documentation (this feature)

```text
specs/002-e2e-test-env/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── launch-cli.md
│   ├── verification-report.md
│   └── test-vault-structure.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

#### Source Code (repository root)
```text
test-vault/
├── Board.md                              # board file (committed; conforms to board-file-format)
├── S1.md … S6.md                         # sample story notes (committed; full + missing attributes)
└── .obsidian/
    ├── community-plugins.json            # enables the plugin (committed)
    └── plugins/
        └── obsidian-usm-plugin/
            ├── manifest.json             # installed by e2e:setup (source file)
            ├── styles.css                # installed by e2e:setup (source file)
            └── main.js                   # installed by e2e:setup (BUILD ARTIFACT — gitignored)

e2e/
├── setup.mjs                             # build plugin + install artifacts into test-vault
├── launch.mjs                            # idempotent launch with CDP port (--port)
├── verify.mjs                            # standard checks → machine-readable JSON report
└── README.md                             # usage guide

package.json                              # + scripts: e2e:setup, e2e:launch, e2e:verify
.gitignore                                # + test-vault/.obsidian/plugins/obsidian-usm-plugin/main.js
```

**Structure Decision**: Single-project layout extended with two top-level additions: `test-vault/` (the isolated fixture vault) and `e2e/` (the Node ESM test tooling). The existing `src/` three-layer plugin structure is unchanged — this feature adds no plugin code, only test environment and tooling. Build artifacts (`main.js`) are generated into the test vault by `e2e:setup` and are gitignored, per the project's no-committed-artifacts rule.

### Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

_No Constitution Check violations — no complexity justification required._

---

## Part 2: Manual Test & Preview Workflow (003)

### Summary

This feature makes the Part 1 E2E infrastructure the single, discoverable workflow for manual testing and previewing the plugin in Obsidian. Technical approach: a project-local agent skill (`usm-e2e`, `.github/skills/usm-e2e/SKILL.md`) documents the complete workflow — environment preparation, standard checks, ad-hoc inspection, the manual-assist protocol (three verification modes), mobile scenarios via Obsidian's built-in mobile emulation, and the on-demand interactive session mode (US-003-01, US-003-04). A small ad-hoc inspection CLI (`e2e/inspect.mjs`: eval / wait / screenshot) reuses the existing CDP client with zero new dependencies (US-003-02). A task-writing convention (FR-003-008) plus an `AGENTS.md` pointer ensure future iterations write manual-test tasks against the test vault (US-003-03). The extended "Test Board 2" fixture is recreated from its documented baseline into `test-vault/boards/`, coexisting with `Board.md` (the Part 1 contract stays untouched), with both folder arrangements testable (FR-003-009).

### Technical Context

**Language/Version**: Node.js 22+ (ESM, `.mjs`) for the new inspection CLI — consistent with the Part 1 tooling (global `fetch` + `WebSocket`). The plugin itself remains TypeScript strict (unchanged by this feature).

**Primary Dependencies**: None new. `e2e/inspect.mjs` imports the existing `e2e/cdp.mjs` client and uses only Node built-ins (`node:fs`, `node:path`, `node:url`). No Playwright/Puppeteer, no new NPM packages (FR-003-007).

**Storage**: Files. The skill is Markdown (`.github/skills/usm-e2e/`); the fixtures are Markdown notes in `test-vault/`; manual-assist screenshots are committed under the feature's `checklists/` directory; automated screenshots remain in the gitignored `e2e/output/`.

**Testing**: The existing Vitest suite is unchanged (no plugin code changes). Verification is live: the Part 1 commands (`e2e:setup` / `e2e:launch` / `e2e:verify`) plus the new `e2e/inspect.mjs` against a running test-vault instance.

**Target Platform**: macOS with the Obsidian desktop app (consistent with Part 1). Mobile scenarios run on the same desktop instance via `emulateMobile` (no physical device required).

**Project Type**: Obsidian plugin repository + local E2E test tooling (Node scripts + fixture vault) + a project-local agent skill.

**Performance Goals**: A single `inspect.mjs` operation completes in under 10 s against a running instance; a fresh session prepares the environment and completes the standard verification in under 5 minutes (SC-003-001).

**Constraints**: No new runtime NPM dependencies; localhost-only CDP (127.0.0.1); the workflow never reads from or writes to the user's private vault (FR-003-010); no build artifacts are committed; the Part 1 report contract (`taskColumns: 4` for `Board.md`) stays untouched.

**Scale/Scope**: One skill (SKILL.md), one CLI (three operations), one extended fixture board (8 story notes) coexisting with the existing 6-note board, one task-writing convention, and one `AGENTS.md` pointer.

### Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**GATE result: PASS** (no violations; re-checked after Phase 1 design — still PASS).

| # | Constitution gate | Result | Notes |
|---|-------------------|--------|-------|
| I | Obsidian ecosystem & view architecture | N/A | No plugin code changes; the workflow drives the existing plugin as-is via the documented `emulateMobile` API (official docs) and the standard CDP debug port. |
| II | Security, privacy, fault tolerance | PASS | Localhost-only CDP; no network calls, no telemetry; the test vault is isolated from the private vault (FR-003-010, SC-003-003); the deploy path remains user-only. |
| III | Lifecycle, code quality, TDD | PASS | `inspect.mjs` is plain Node ESM with English comments. TDD is N/A — this feature adds no plugin domain logic (only tooling, fixtures, and docs); the TDD rule applies to domain logic, which is unchanged. |
| IV | UX/UI, accessibility | N/A | No plugin UI changes. |
| V | Performance, simplicity | PASS | The CLI reuses the existing CDP client (no new abstraction); the skill is a single Markdown entry point — simple over "magic". |
| VI | Data portability, self-describing config | PASS | The extended board fixture conforms to the board/story file format contracts and is self-describing. |
| VII | Pragmatic architecture, dependency minimization | PASS | Zero new NPM dependencies; the 3-layer `src/` structure is unchanged; the skill is project-local (survives `speckit update`, the `usm-task-protocol` pattern). |
| — | Language policy (docs/code in English) | PASS | All artifacts (skill, CLI comments, contracts, checklists) are in English. |

### Project Structure

#### Documentation (this feature)

```text
specs/002-e2e-test-env/          # merged feature folder (Part 2 artifacts consolidated here)
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── inspect-cli.md
│   ├── manual-checklist-format.md
│   ├── extended-board-baseline.md
│   └── task-convention.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

#### Source Code (repository root)

```text
.github/skills/usm-e2e/
└── SKILL.md                            # the discoverable manual/E2E verification skill (FR-003-001…FR-003-004, FR-003-011…FR-003-013)

e2e/
├── inspect.mjs                         # NEW — ad-hoc inspection CLI: eval / wait / screenshot (FR-003-005…FR-003-007)
├── cdp.mjs                             # unchanged — reused by inspect.mjs
├── setup.mjs / launch.mjs / verify.mjs # unchanged (Part 1)
└── README.md                           # + a section pointing at inspect.mjs

test-vault/
├── Board.md                            # unchanged — the Part 1 standard-verify target (contract untouched)
├── S1.md … S6.md                       # unchanged
├── boards/                             # NEW — the extended board, separate-folder arrangement (FR-003-009)
│   ├── Test Board 2.md                 # the extended board fixture (recreated from the documented baseline)
│   └── T1.md … T8.md                   # its story notes (names distinct from the root S1–S6)
└── .obsidian/                          # unchanged

AGENTS.md                               # + a pointer: manual/E2E verification → the usm-e2e skill (FR-003-008)
package.json                            # + script: e2e:inspect (thin wrapper for node e2e/inspect.mjs)
```

**Structure Decision**: The single-project layout is extended with three additions: (1) the project-local skill under `.github/skills/usm-e2e/` (the `usm-task-protocol` pattern — not listed in any integration manifest, so `speckit update` cannot overwrite it); (2) one new CLI file in the existing `e2e/` tooling directory, reusing `cdp.mjs`; (3) the `test-vault/boards/` subfolder for the extended board fixture. The same-folder board arrangement is not committed — it is a documented ad-hoc verification step (create a variant board in the root folder, verify, delete, restore a clean tree), keeping the committed vault stable. The plugin's `src/` three-layer structure is untouched.

### Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

_No Constitution Check violations — no complexity justification required._
