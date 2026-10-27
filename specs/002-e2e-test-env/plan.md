# Implementation Plan: Isolated E2E Test Environment & GUI Automation

**Branch**: `002-e2e-test-env` | **Date**: 2026-10-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-e2e-test-env/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

This feature adds an isolated, reproducible E2E test environment for the Obsidian User Story Map plugin, plus a GUI automation mechanism that lets an AI agent (and the developer) verify the rendered story map visually and functionally without manual interaction.

Technical approach: a committed `test-vault/` directory (board file + sample story notes + installed plugin) provides a safe, reproducible environment (US-01). A Node ESM launch script (`e2e/launch.mjs`) opens Obsidian on the test vault with a CDP remote-debugging port — idempotent and with a configurable port (US-02). A Node ESM verification script (`e2e/verify.mjs`) connects over CDP using only Node built-ins (`fetch` + `WebSocket`, no new NPM dependencies), performs the standard checks (task-column count, screenshot, reactivity), and emits a machine-readable JSON pass/fail report (US-03). The agent may additionally perform ad-hoc CDP inspection for deeper diagnostics (FR-017).

## Technical Context

**Language/Version**: Node.js LTS — E2E scripts require Node 22+ (stable global `WebSocket`, used for the CDP connection); the plugin build remains Node 18+ compatible. E2E tooling is plain Node ESM (`.mjs`), no TypeScript build step. The plugin itself stays TypeScript strict.

**Primary Dependencies**: None new. E2E scripts use only Node built-ins (`node:fs`, `node:child_process`, global `fetch`, global `WebSocket`). Browser automation relies on the agent's built-in CDP-based browser capability; no Playwright/Puppeteer package is added.

**Storage**: Files. `test-vault/` (Markdown board + story notes + `.obsidian/` config + installed plugin artifacts). Verification screenshots are written to a local, gitignored output directory. No database.

**Testing**: Existing Vitest (unit/integration/perf) is unchanged. New E2E verification is a standalone Node script (`e2e/verify.mjs`) run against a live Obsidian instance over CDP; it is not part of the Vitest suite.

**Target Platform**: macOS (Obsidian desktop app). Cross-platform launch is out of scope.

**Project Type**: Obsidian plugin repository + local E2E test tooling (Node scripts + fixture vault).

**Performance Goals**: CDP connect + structure retrieval < 30 s (SC-003); map reactivity detected < 5 s (SC-006); environment setup from a clean checkout < 5 min (SC-001).

**Constraints**: No new runtime NPM dependencies; localhost-only (CDP on 127.0.0.1); no network calls / no telemetry; must not read or modify any private vault; must not commit build artifacts (`main.js`).

**Scale/Scope**: A single small fixture vault (8 cards, 4 task columns, 3 release rows); a single debuggable instance by default (alternate ports for multiple instances).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**GATE result: PASS** (no violations; re-checked after Phase 1 design — still PASS).

| # | Constitution gate | Result | Notes |
|---|-------------------|--------|-------|
| I | Obsidian ecosystem & view architecture | N/A | No plugin code changes; the test vault exercises the existing plugin as-is. Launch uses the standard Electron `--remote-debugging-port` flag. |
| II | Security, privacy, fault tolerance | PASS | Localhost-only CDP (127.0.0.1); no network calls, no telemetry; the test vault is isolated from any private vault (SC-002). |
| III | Lifecycle, code quality, TDD | PASS | E2E scripts are plain Node ESM with English comments. TDD is N/A here — this feature adds no domain/business logic (only fixtures + tooling); the TDD rule applies to plugin domain logic, which is unchanged. |
| IV | UX/UI, accessibility | N/A | No plugin UI changes. |
| V | Performance, simplicity | N/A | No plugin code changes. |
| VI | Data portability, self-describing config | PASS | `test-vault/Board.md` conforms to the board file format contract and is self-describing. |
| VII | Pragmatic architecture, dependency minimization | PASS | Zero new NPM dependencies (Node built-ins only). The 3-layer `src/` structure is unchanged; E2E tooling lives outside `src/` (it is not plugin code). |
| — | Language policy (docs/code in English) | PASS | All artifacts and script comments are in English.

## Project Structure

### Documentation (this feature)

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

### Source Code (repository root)
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

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

_No Constitution Check violations — no complexity justification required._
