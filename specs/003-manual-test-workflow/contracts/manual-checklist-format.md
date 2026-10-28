# Contract: Manual Validation Checklist Format

**Feature**: `003-manual-test-workflow` | **Date**: 2026-10-28

Defines the format of the per-feature manual validation checklist that records
manual-assist verification outcomes (FR-003, FR-004, Key Entities: "Manual
validation checklist" and "Verification result record").

## File location

One checklist file per feature, under the feature's `checklists/` directory:

```text
specs/<feature>/checklists/manual-validation.md
```

Committed screenshots referenced by the checklist live in the same directory
(R7 hybrid rule).

## File structure

```markdown
# Manual Validation Checklist — <feature title>

**Feature**: `<feature-id>` | **Tasks**: <task ids that drive this checklist>

## Setup (once)

- [x] <environment preparation steps, e.g. `npm run e2e:setup`, `npm run e2e:launch>`

## Scenarios

- [x] **M1** — <title> _(mode: automatable)_
      Evidence: `e2e/output/board.png` (automated, gitignored)
      Observation: <one line — what the agent observed / the user judged>.
- [~] **M2** — <title> _(mode: subjective)_
      Evidence: `M2-aesthetics.png` (committed)
      Observation: pending user review — user unavailable at run time.
- [!] **M3** — <title> _(mode: live interaction)_
      Evidence: `M3-dnd.png` (committed)
      Observation: FAIL — <observed defect, one line>.

## Result

- [ ] All scenarios pass → mark <task ids> `[X]` in `tasks.md`.
- [ ] Any failure → record it here, fix, and re-run the affected scenario.
```

## Scenario entry fields

| Field | Rule |
|-------|------|
| Scenario id | `M1`, `M2`, … — unique within the file, stable once assigned. |
| Title | One short sentence naming the verified behavior. |
| Mode | Exactly one of `automatable`, `subjective`, `live interaction` (FR-004). Mobile scenarios are `automatable` (run via emulation). |
| Status marker | `[ ]` pending · `[x]` pass · `[!]` fail · `[~]` pending user review. |
| Evidence | A path: committed screenshots are relative to the checklist file (e.g. `M2-aesthetics.png`); automated evidence is named as `e2e/output/…` (gitignored, reproducible on demand). |
| Observation | One line: the agent's observation (automatable) or the user's judgment (subjective / live interaction). A `fail` entry MUST name the observed defect. |

## Status transitions

```text
[ ] pending ──────────────► [x] pass
[ ] pending ──────────────► [!] fail
[ ] pending ──(user unavailable)──► [~] pending user review
[~] pending user review ──(user judgment recorded)──► [x] pass | [!] fail
```

- The agent MAY set `pass`/`fail` for `automatable` scenarios on its own.
- The agent MUST NOT set `pass`/`fail` for `subjective` or `live interaction`
  scenarios without the user's recorded judgment (spec edge case: user
  unavailable → `[~]`, never a guess).

## Screenshot persistence (hybrid rule, R7)

| Kind | Location | Committed? |
|------|----------|------------|
| Manual-assist evidence (subjective / live interaction, and any screenshot delivered to the user as judgment evidence) | `specs/<feature>/checklists/<scenario-id>-<slug>.png` | **yes** |
| Automated-check evidence (standard checks, ad-hoc inspection during an automatable scenario) | `e2e/output/` | **no** (gitignored) |

Naming: `<scenario-id>-<slug>.png`, lowercase slug, e.g. `M3-mobile-layout.png`.

## Invariants

- A scenario entry is complete only when status, evidence, and observation
  are all present.
- The checklist is updated **during** the verification session (immediately
  after each scenario), not reconstructed afterwards.
- Changing a fixture that a scenario depends on MUST update the scenario's
  expected values in the same change (spec edge case: fixture drift).
