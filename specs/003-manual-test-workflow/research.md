# Research: Manual Test & Preview Workflow (E2E Infrastructure Integration)

**Feature**: `003-manual-test-workflow` | **Date**: 2026-10-28

Resolves the unknowns from the plan's Technical Context and records the design
decisions for Phase 1. All decisions favor the constitution's dependency
minimization and "simplicity over magic" rules.

## R1 — Skill placement and discoverability

- **Decision**: A single project-local skill at `.github/skills/usm-e2e/SKILL.md`
  (YAML frontmatter: `name: usm-e2e`, a discoverable `description`), following
  the existing `usm-task-protocol` precedent. No reference files in the first
  iteration — one self-contained SKILL.md (FR-002).
- **Rationale**: Project-local skills under `.github/skills/` are listed in the
  agent's skill index (name + description preloaded, body on demand) and are
  NOT listed in `.specify/integrations/*.manifest.json`, so `speckit update`
  cannot overwrite or remove them. This is the exact pattern already proven by
  `usm-task-protocol`.
- **Alternatives considered**: (a) a top-level `E2E.md` doc — rejected: not
  discoverable from the skill index, agents would have to be told to read it;
  (b) a skill listed in an integration manifest — rejected: `speckit update`
  would overwrite it (FR-002 requires surviving tooling updates).

## R2 — Inspection CLI shape

- **Decision**: One file, `e2e/inspect.mjs`, with three subcommands —
  `eval <expression>`, `wait <css-selector> [--timeout <ms>]`,
  `screenshot <path>` — all accepting `--port <number>` (default 9222). It
  imports `connect()` from the existing `e2e/cdp.mjs` and uses only Node
  built-ins. A thin `package.json` script `e2e:inspect` wraps it.
- **Rationale**: `cdp.mjs` already exposes exactly the primitives needed
  (`evaluate`, `screenshot`, `probe`) with fail-fast hints; the CLI is a thin
  argument-parsing layer over them (FR-005, FR-007). One file keeps the skill
  lean (SC-004: a single documented command).
- **Alternatives considered**: (a) one file per operation — rejected: three
  near-identical files, over-engineering; (b) adding the operations to
  `verify.mjs` — rejected: `verify.mjs` is the standard-checks runner with its
  own report contract; mixing ad-hoc operations into it would blur the two
  purposes; (c) Playwright/Puppeteer — rejected: new NPM dependency, forbidden
  by FR-007 and the constitution.

## R3 — CLI exit codes and output

- **Decision**: Exit codes consistent with the `002` tooling: `0` = success;
  `1` = operation failed (wait timeout, page evaluation exception); `2` =
  environment error before the operation ran (no CDP instance on the port).
  `eval` prints the evaluated value (JSON) to stdout; `wait` prints a one-line
  result; `screenshot` prints the written path. Every environment error
  includes the hint `(run npm run e2e:launch)`.
- **Rationale**: Consistency with `e2e:verify` (0/1/2) means the skill can
  document one exit-code table for the whole `e2e/` toolset (FR-006).
- **Alternatives considered**: distinct exit codes per operation — rejected:
  no added value, harder to document.

## R4 — Mobile emulation application

- **Decision**: The skill documents a deterministic mobile-scenario sequence:
  (1) `eval` `this.app.emulateMobile(true)` in the page context, (2) reload the
  page (`location.reload()`) so the mobile layout is applied, (3) wait for the
  board selector, (4) capture evidence, (5) restore: `eval`
  `this.app.emulateMobile(false)` + reload. The restore step is documented as
  mandatory (spec edge case: mobile emulation state leak).
- **Rationale**: The official docs confirm `emulateMobile(true/false)` works in
  the page context (Developer Tools Console), which is exactly what the
  `eval` operation drives. The docs do not guarantee an immediate re-render,
  so the explicit reload makes the sequence deterministic and idempotent; a
  relaunch also resets the state (documented fallback).
- **Alternatives considered**: (a) assume the layout switches without reload —
  rejected: non-deterministic, would make mobile scenarios flaky; (b) physical
  device only — rejected: the user explicitly wants the agent to run mobile
  scenarios (clarification, Session 2026-10-27).

## R5 — Extended board fixture: source and naming

- **Decision**: The extended "Test Board 2" fixture is **recreated from its
  documented baseline** (the Iteration 2 layout checks Q11–Q14 in
  `specs/001-user-story-map/checklists/manual-validation.md`: 8 stories,
  multiple releases, long epic titles, unassigned sections) and committed to
  `test-vault/boards/` as `Test Board 2.md` + story notes **`T1.md`–`T8.md`**.
  The exact expected rendered structure is fixed in
  `contracts/extended-board-baseline.md`.
- **Rationale**: The original fixture lives in the user's private vault
  (`projects/Story Map Builder/Test Board 2/`), which the workflow must never
  read (FR-010) — so it cannot be copied; it is recreated from the documented
  baseline. Distinct note names (`T1`–`T8`) are **required**: Obsidian
  wikilinks resolve vault-wide, so reusing `S1`–`S6` names would make the two
  boards share story notes and cross-board interference would be impossible to
  test (FR-009, US-03 scenario 5).
- **Alternatives considered**: (a) copy from the private vault — rejected:
  FR-010; (b) replace `Board.md` — rejected: the user chose coexistence
  (clarification), and the `002` contract (`taskColumns: 4`) must stay
  untouched; (c) reuse `S1`–`S8` names — rejected: vault-wide wikilink
  resolution would couple the boards.

## R6 — Same-folder board arrangement

- **Decision**: The committed vault uses the **separate-folder** arrangement
  (`test-vault/boards/`). The **same-folder** arrangement is a documented
  ad-hoc verification step in the skill and quickstart: create a variant board
  file in the vault root (distinct name, e.g. `Board variant.md`), verify it
  renders independently, delete it, and restore a clean tree.
- **Rationale**: FR-009 requires both arrangements to work and be testable,
  but committing a third board in the root would permanently change the
  standard-verify environment; an ad-hoc step keeps the committed vault stable
  while still making the arrangement testable on demand.
- **Alternatives considered**: committing both arrangements — rejected:
  fixture drift risk and a dirtier standard-verify baseline.

## R7 — Screenshot persistence

- **Decision**: Manual-assist screenshots are committed under the feature's
  `checklists/` directory with the naming `<scenario-id>-<slug>.png`
  (e.g. `M3-mobile-layout.png`); automated-check screenshots stay in the
  gitignored `e2e/output/`. The skill prescribes which kind a given scenario
  produces.
- **Rationale**: Direct implementation of the user's hybrid decision
  (clarification): human-judgment evidence is not easily reproducible and must
  survive; automated evidence is reproducible on demand and must not bloat the
  repo (FR-003).
- **Alternatives considered**: all screenshots committed — rejected:
  reproducible artifacts would bloat the repo; all local — rejected:
  subjective judgments would lose their evidence.

## R8 — Task-writing convention

- **Decision**: The convention is documented in
  `contracts/task-convention.md` and pointed to from `AGENTS.md`. A
  manual-verification task in `tasks.md` MUST: (1) reference the skill by name
  (`usm-e2e`), (2) name the checklist file and section to update, (3) mark the
  scenario mode (automatable / subjective / live interaction), (4) target the
  test vault (never the private vault).
- **Rationale**: FR-008 requires the convention to be documented and
  discoverable; `AGENTS.md` is loaded into every agent session, so a one-line
  pointer there makes the convention effective without relying on the agent
  finding the contract file.
- **Alternatives considered**: encoding the convention only in the skill —
  rejected: task authors (agents writing `tasks.md`) may not load the skill
  before writing tasks; the `AGENTS.md` pointer guarantees visibility.

## R9 — On-demand interactive sessions

- **Decision**: No new tooling. The skill documents the on-demand loop:
  probe the port (`e2e:launch` is idempotent — it exits 0 when an instance is
  already up) → perform operations via `e2e/inspect.mjs` (navigation, view
  switching, clicks, typing, mobile emulation — all `eval` expressions) →
  deliver the result (screenshot / evaluated state) → iterate
  (change → `e2e:setup` if the build changed → reload → inspect).
- **Rationale**: US-04/FR-013 are a *mode* of using the existing tools, not
  new capability; the `002` launch idempotency (SC-007 there) already makes
  "ensure the instance is running" a single command.
- **Alternatives considered**: a dedicated "session" subcommand in
  `inspect.mjs` — rejected: a persistent interactive session would require a
  REPL/daemon, adding complexity with no value over the probe-then-operate
  loop.

## R10 — Multi-board coexistence verification

- **Decision**: Coexistence is verified by opening each board in turn and
  checking its own baseline: `Board.md` → the `002` baseline
  (`taskColumns: 4`, 8 cards); `Test Board 2.md` → the extended baseline
  (4 release sections, 8 cards, long epic titles). Switching back and forth
  must reproduce both baselines; the `usm-view` frontmatter attribute is
  per-file, so view state cannot leak between boards.
- **Rationale**: FR-009/US-03 scenario 5 define the test target as "each
  board renders its own structure independently with no cross-board
  interference" — the two-baseline check is the direct, deterministic
  expression of that.
- **Alternatives considered**: a dedicated multi-board check in `verify.mjs` —
  rejected: `verify.mjs`'s report contract is fixed by `002` and must stay
  untouched; coexistence is a manual/inspection scenario, not a standard
  check.
