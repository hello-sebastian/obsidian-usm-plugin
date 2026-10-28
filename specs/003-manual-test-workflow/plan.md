# Implementation Plan: Manual Test & Preview Workflow (E2E Infrastructure Integration)

**Branch**: `003-manual-test-workflow` | **Date**: 2026-10-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-manual-test-workflow/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

This feature makes the `002` E2E infrastructure the single, discoverable workflow for manual testing and previewing the plugin in Obsidian. Technical approach: a project-local agent skill (`usm-e2e`, `.github/skills/usm-e2e/SKILL.md`) documents the complete workflow — environment preparation, standard checks, ad-hoc inspection, the manual-assist protocol (three verification modes), mobile scenarios via Obsidian's built-in mobile emulation, and the on-demand interactive session mode (US-01, US-04). A small ad-hoc inspection CLI (`e2e/inspect.mjs`: eval / wait / screenshot) reuses the existing CDP client with zero new dependencies (US-02). A task-writing convention (FR-008) plus an `AGENTS.md` pointer ensure future iterations write manual-test tasks against the test vault (US-03). The extended "Test Board 2" fixture is recreated from its documented baseline into `test-vault/boards/`, coexisting with `Board.md` (the `002` contract stays untouched), with both folder arrangements testable (FR-009).

## Technical Context

**Language/Version**: Node.js 22+ (ESM, `.mjs`) for the new inspection CLI — consistent with the `002` tooling (global `fetch` + `WebSocket`). The plugin itself remains TypeScript strict (unchanged by this feature).

**Primary Dependencies**: None new. `e2e/inspect.mjs` imports the existing `e2e/cdp.mjs` client and uses only Node built-ins (`node:fs`, `node:path`, `node:url`). No Playwright/Puppeteer, no new NPM packages (FR-007).

**Storage**: Files. The skill is Markdown (`.github/skills/usm-e2e/`); the fixtures are Markdown notes in `test-vault/`; manual-assist screenshots are committed under the feature's `checklists/` directory; automated screenshots remain in the gitignored `e2e/output/`.

**Testing**: The existing Vitest suite is unchanged (no plugin code changes). Verification is live: the `002` commands (`e2e:setup` / `e2e:launch` / `e2e:verify`) plus the new `e2e/inspect.mjs` against a running test-vault instance.

**Target Platform**: macOS with the Obsidian desktop app (consistent with `002`). Mobile scenarios run on the same desktop instance via `emulateMobile` (no physical device required).

**Project Type**: Obsidian plugin repository + local E2E test tooling (Node scripts + fixture vault) + a project-local agent skill.

**Performance Goals**: A single `inspect.mjs` operation completes in under 10 s against a running instance; a fresh session prepares the environment and completes the standard verification in under 5 minutes (SC-001).

**Constraints**: No new runtime NPM dependencies; localhost-only CDP (127.0.0.1); the workflow never reads from or writes to the user's private vault (FR-010); no build artifacts are committed; the `002` report contract (`taskColumns: 4` for `Board.md`) stays untouched.

**Scale/Scope**: One skill (SKILL.md), one CLI (three operations), one extended fixture board (8 story notes) coexisting with the existing 6-note board, one task-writing convention, and one `AGENTS.md` pointer.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**GATE result: PASS** (no violations; re-checked after Phase 1 design — still PASS).

| # | Constitution gate | Result | Notes |
|---|-------------------|--------|-------|
| I | Obsidian ecosystem & view architecture | N/A | No plugin code changes; the workflow drives the existing plugin as-is via the documented `emulateMobile` API (official docs) and the standard CDP debug port. |
| II | Security, privacy, fault tolerance | PASS | Localhost-only CDP; no network calls, no telemetry; the test vault is isolated from the private vault (FR-010, SC-003); the deploy path remains user-only. |
| III | Lifecycle, code quality, TDD | PASS | `inspect.mjs` is plain Node ESM with English comments. TDD is N/A — this feature adds no plugin domain logic (only tooling, fixtures, and docs); the TDD rule applies to domain logic, which is unchanged. |
| IV | UX/UI, accessibility | N/A | No plugin UI changes. |
| V | Performance, simplicity | PASS | The CLI reuses the existing CDP client (no new abstraction); the skill is a single Markdown entry point — simple over "magic". |
| VI | Data portability, self-describing config | PASS | The extended board fixture conforms to the board/story file format contracts and is self-describing. |
| VII | Pragmatic architecture, dependency minimization | PASS | Zero new NPM dependencies; the 3-layer `src/` structure is unchanged; the skill is project-local (survives `speckit update`, the `usm-task-protocol` pattern). |
| — | Language policy (docs/code in English) | PASS | All artifacts (skill, CLI comments, contracts, checklists) are in English. |

## Project Structure

### Documentation (this feature)

```text
specs/003-manual-test-workflow/
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

### Source Code (repository root)

```text
.github/skills/usm-e2e/
└── SKILL.md                            # the discoverable manual/E2E verification skill (FR-001…FR-004, FR-011…FR-013)

e2e/
├── inspect.mjs                         # NEW — ad-hoc inspection CLI: eval / wait / screenshot (FR-005…FR-007)
├── cdp.mjs                             # unchanged — reused by inspect.mjs
├── setup.mjs / launch.mjs / verify.mjs # unchanged (002)
└── README.md                           # + a section pointing at inspect.mjs

test-vault/
├── Board.md                            # unchanged — the 002 standard-verify target (contract untouched)
├── S1.md … S6.md                       # unchanged
├── boards/                             # NEW — the extended board, separate-folder arrangement (FR-009)
│   ├── Test Board 2.md                 # the extended board fixture (recreated from the documented baseline)
│   └── T1.md … T8.md                   # its story notes (names distinct from the root S1–S6)
└── .obsidian/                          # unchanged

AGENTS.md                               # + a pointer: manual/E2E verification → the usm-e2e skill (FR-008)
package.json                            # + script: e2e:inspect (thin wrapper for node e2e/inspect.mjs)
```

**Structure Decision**: The single-project layout is extended with three additions: (1) the project-local skill under `.github/skills/usm-e2e/` (the `usm-task-protocol` pattern — not listed in any integration manifest, so `speckit update` cannot overwrite it); (2) one new CLI file in the existing `e2e/` tooling directory, reusing `cdp.mjs`; (3) the `test-vault/boards/` subfolder for the extended board fixture. The same-folder board arrangement is not committed — it is a documented ad-hoc verification step (create a variant board in the root folder, verify, delete, restore a clean tree), keeping the committed vault stable. The plugin's `src/` three-layer structure is untouched.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

_No Constitution Check violations — no complexity justification required._
