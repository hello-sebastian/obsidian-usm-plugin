# Data Model: Manual Test & Preview Workflow (E2E Infrastructure Integration)

**Feature**: `003-manual-test-workflow` | **Date**: 2026-10-28

This feature adds no plugin domain logic, so there are no new domain entities
or state machines. The entities below are the *workflow artifacts* the spec's
Key Entities section names; their shapes are fixed by the contracts in
`contracts/`.

## Verification skill

- **Shape**: a Markdown file with YAML frontmatter (`name`, `description`) at
  `.github/skills/usm-e2e/SKILL.md`.
- **Fields (frontmatter)**:
  - `name` — `usm-e2e` (stable identifier; do not rename once released).
  - `description` — one sentence, discoverable from the skill index; must
    mention: manual/E2E verification, the test vault, ad-hoc inspection,
    manual-assist, mobile emulation, on-demand preview.
- **Body sections (required)**: prerequisites; environment preparation
  (setup/launch); standard checks; ad-hoc inspection (the `inspect.mjs`
  command table); the manual-assist protocol (three modes); mobile scenarios
  (emulation sequence incl. the mandatory restore step); on-demand interactive
  sessions; known runtime side effects and clean-tree restore; ending a
  session cleanly.
- **Relationships**: references `e2e/inspect.mjs` (R2), the `002` commands,
  the manual checklist format (contract), and the task convention (contract).
- **Validation rules**: self-contained (FR-002) — every command it names must
  exist in the repository; it must never instruct reading or writing the
  private vault (FR-010).

## Inspection helper

- **Shape**: a Node ESM CLI, `e2e/inspect.mjs` (R2, R3).
- **Operations**:
  - `eval <expression>` — evaluate JS in the page; print the value (JSON) to
    stdout.
  - `wait <css-selector> [--timeout <ms>]` — poll until the selector matches;
    default timeout 15 000 ms.
  - `screenshot <path>` — capture a PNG to the given path; print the path.
- **Common options**: `--port <number>` (default 9222, integer 1–65535).
- **Exit codes**: `0` success; `1` operation failed (wait timeout, page
  evaluation exception); `2` environment error before the operation ran (no
  CDP instance on the port). Every environment error includes the hint
  `(run npm run e2e:launch)`.
- **Validation rules**: no new external dependencies (FR-007); reuses
  `e2e/cdp.mjs` (FR-005); fail-fast with actionable errors (FR-006).
- **Full contract**: `contracts/inspect-cli.md`.

## Manual validation checklist

- **Shape**: a per-feature Markdown file under the feature's `checklists/`
  directory (e.g. `specs/<feature>/checklists/manual-validation.md`).
- **Fields (per scenario entry)**:
  - scenario id (e.g. `M1`, `M2`, …) and a short title;
  - mode: `automatable` | `subjective` | `live interaction` (FR-004);
  - status: `[ ]` pending / `[x]` pass / `[!]` fail / `[~]` pending user
    review;
  - evidence: a path to a committed screenshot (manual-assist) or a note that
    the automated evidence is in `e2e/output/` (gitignored);
  - the user's judgment or the agent's observation, one line.
- **State transitions**: `pending → pass | fail | pending user review`;
  `pending user review → pass | fail` only after the user's judgment is
  recorded. The agent MUST NOT move a subjective/live-interaction scenario to
  `pass`/`fail` on its own (spec edge case: user unavailable).
- **Validation rules**: screenshot persistence follows the hybrid rule (R7);
  a `fail` entry must name the observed defect.
- **Full contract**: `contracts/manual-checklist-format.md`.

## Test vault fixtures

- **Shape**: committed Markdown notes under `test-vault/`.
- **Standard board (unchanged, `002`)**: `Board.md` + `S1.md`–`S6.md` at the
  vault root; baseline in `specs/002-e2e-test-env/contracts/test-vault-structure.md`
  (`taskColumns: 4`, 8 cards). This feature MUST NOT modify it.
- **Extended board (new, R5)**: `test-vault/boards/Test Board 2.md` +
  `T1.md`–`T8.md` (names distinct from the root `S1`–`S6` — Obsidian
  wikilinks resolve vault-wide). Baseline in `contracts/extended-board-baseline.md`.
- **Validation rules**: both boards conform to
  `specs/001-user-story-map/contracts/board-file-format.md` and
  `story-file-format.md`; changing any fixture MUST update its baseline
  contract in the same change (spec edge case: fixture drift).

## Verification result record

- **Shape**: a checklist entry (above) plus, where prescribed, a screenshot
  artifact.
- **Persistence (R7)**:
  - manual-assist screenshots → committed, `specs/<feature>/checklists/<scenario-id>-<slug>.png`;
  - automated-check screenshots → local, `e2e/output/` (gitignored).
- **Validation rules**: a record is complete only when status, evidence, and
  the one-line observation are all present.
