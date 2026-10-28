# Contract: Manual-Test Task-Writing Convention

**Feature**: `002-e2e-test-env` (consolidated with `003-manual-test-workflow`) | **Date**: 2026-10-28

Defines how manual-verification tasks are written in future iterations'
`tasks.md` files (FR-003-008, US-003-03 scenario 1). The convention is pointed to
from `AGENTS.md` so that task authors (agents) see it before writing tasks.

## Rule

A manual-verification task in `tasks.md` MUST:

1. **Reference the skill by name** — the task text MUST contain `usm-e2e`
   (the skill's stable identifier), so the executing agent loads the skill
   instead of rediscovering the infrastructure.
2. **Name the checklist file and section to update** — e.g. "update
   `specs/<feature>/checklists/manual-validation.md`, scenario M3".
3. **Mark the scenario mode** — exactly one of `automatable`, `subjective`,
   `live interaction` (FR-003-004). Mobile scenarios are `automatable` (run via
   mobile emulation).
4. **Target the test vault** — the task MUST be executable entirely within
   `test-vault/`; it MUST NOT reference the private vault or the `deploy`
   path (FR-003-010).

## Task template

```markdown
- [ ] T0XX — Manual verification: <short title>
  - Mode: <automatable | subjective | live interaction>
  - Skill: `usm-e2e` (follow the skill's <environment preparation |
    manual-assist protocol | mobile scenario> section).
  - Fixture: <board/note in test-vault, e.g. `boards/Test Board 2.md`>.
  - Checklist: update `specs/<feature>/checklists/manual-validation.md`,
    scenario M<n> (status + evidence + one-line observation).
  - Expected: <the documented baseline or the user's judgment criterion>.
```

## Examples

Automatable (agent runs it end-to-end):

```markdown
- [ ] T012 — Manual verification: extended board renders the documented baseline
  - Mode: automatable
  - Skill: `usm-e2e` (environment preparation + ad-hoc inspection).
  - Fixture: `test-vault/boards/Test Board 2.md`.
  - Checklist: update `specs/004-…/checklists/manual-validation.md`, scenario M1.
  - Expected: 4 release sections (Unassigned first), 9 cards, long epic title
    clamped — per `specs/002-e2e-test-env/contracts/extended-board-baseline.md`.
```

Subjective (user judgment required):

```markdown
- [ ] T013 — Manual verification: header block aesthetics at 1440 px
  - Mode: subjective
  - Skill: `usm-e2e` (manual-assist protocol — deliver a screenshot, record
    the user's judgment).
  - Fixture: `test-vault/Board.md`.
  - Checklist: update `specs/004-…/checklists/manual-validation.md`, scenario M2
    (commit the screenshot as `M2-header-aesthetics.png`).
  - Expected: user confirms the header block reads cleanly (no judgment by the agent).
```

Live interaction (user performs it in the running instance):

```markdown
- [ ] T014 — Manual verification: drag & drop feel on the map
  - Mode: live interaction
  - Skill: `usm-e2e` (manual-assist protocol — the user performs the
    interaction in the live instance; the agent records the outcome).
  - Fixture: `test-vault/Board.md`.
  - Checklist: update `specs/004-…/checklists/manual-validation.md`, scenario M3.
  - Expected: user reports the interaction feels native (no judgment by the agent).
```

## Invariants

- A task that omits any of the four rules is incomplete and MUST be fixed
  before `/speckit-implement` executes it.
- The convention applies to **all** future iterations; the `001`/`002`
  checklists remain as historical records (they predate this convention).
- The convention is documentation, not tooling: no script enforces it; the
  `AGENTS.md` pointer and the skill are the enforcement mechanism.
