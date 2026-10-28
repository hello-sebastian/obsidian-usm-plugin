# Contract: Extended Board Fixture & Verification Baseline

**Feature**: `003-manual-test-workflow` | **Date**: 2026-10-28

Defines the committed layout of the extended board fixture in `test-vault/`
and the fixed rendered structure that serves as its verification baseline
(FR-009, US-03 scenario 2). The fixture is the "Test Board 2" board previously
used for the Iteration 2 layout checks (Q11–Q14); it is recreated from that
documented baseline because the original lives in the user's private vault,
which the workflow must never read (FR-010, research R5).

## Directory layout

```text
test-vault/
├── Board.md                  # unchanged — the 002 standard-verify target
├── S1.md … S6.md             # unchanged
└── boards/                   # NEW — separate-folder arrangement (FR-009)
    ├── Test Board 2.md       # the extended board fixture
    └── T1.md … T8.md         # its story notes (names distinct from S1–S6)
```

**Note naming is a hard rule**: Obsidian wikilinks resolve vault-wide, so the
extended board's story notes MUST use names that do not collide with the root
`S1`–`S6` set. `T1`–`T8` are the canonical names. Reusing `S1`–`S8` would make
the two boards share notes and would make cross-board interference
untestable (FR-009, US-03 scenario 5).

## Board file (`boards/Test Board 2.md`)

Conforms to `specs/001-user-story-map/contracts/board-file-format.md`.
Frontmatter: `usm-board: true`, `usm-release-order: appearance`. Body: an
ordered wikilink list referencing `T1`–`T8` (one duplicate of `T1` allowed to
exercise duplicate-link rendering; no broken links in this fixture — the
standard board already covers that case).

## Story notes (fixture set)

Conform to `specs/001-user-story-map/contracts/story-file-format.md`. The set
MUST exercise the Iteration 2 layout characteristics that Q11–Q14 verified:
multiple releases, long epic titles (clamp check), and unassigned sections.

| Note | activity | task | epic | release | Purpose |
|------|----------|------|------|---------|---------|
| `T1` | Onboarding | First run | `[[Onboarding flow]]` | 1.0 MVP | Fully attributed; linked twice (duplicate). |
| `T2` | Onboarding | First run | `[[Onboarding flow]]` | 1.0 MVP | Second card in the same cell. |
| `T3` | Onboarding | Settings | `[[Onboarding flow]]` | 1.0 MVP | Third task under the same activity. |
| `T4` | Billing | Invoices | `[[A very long epic title that must clamp within the fixed column width]]` | 2.0 | Long epic title (Q13 clamp check). |
| `T5` | Billing | Invoices | `[[A very long epic title that must clamp within the fixed column width]]` | 2.0 | Second card in the long-epic column. |
| `T6` | Billing | Refunds | `[[Payments]]` | 2.0 | Third task under Billing. |
| `T7` | — | — | — | — | No frontmatter → Unassigned at every level (Q12). |
| `T8` | Mobile | Sync | `[[Sync engine]]` | 3.0 | Third release; exercises ≥ 3 release sections. |

## Verification baseline (expected rendered structure)

Derived from the fixture set using the plugin's grouping rules (first-appearance
column order, case-insensitive value matching, Unassigned fallback):

| Metric | Expected value | DOM selector counted |
|--------|----------------|----------------------|
| Release sections | **4** (Unassigned first, then `1.0 MVP`, `2.0`, `3.0`) | `section.usm-release` |
| Story cards | **9** (8 notes + 1 duplicate `T1`) | `.usm-story-card` |
| Task columns | **6** | `.usm-board-header .usm-header-cell--task` |
| Activity columns | **4** (Onboarding, Billing, Unassigned, Mobile) | `.usm-board-header .usm-header-cell--activity` |
| Long-epic clamp | the long epic title clamps within the fixed column width | visual check (screenshot) |

Task column breakdown (Activity → Task):
1. Onboarding → First run (T1 ×2, T2)
2. Onboarding → Settings (T3)
3. Billing → Invoices (T4, T5)
4. Billing → Refunds (T6)
5. Unassigned → Unassigned (T7)
6. Mobile → Sync (T8)

Release sections (rendered order): `Unassigned` (auto-generated, always first),
then the assigned releases in appearance order: `1.0 MVP`, `2.0`, `3.0`.

## Multi-board coexistence baseline (FR-009, US-03 scenario 5)

With both boards present in the vault:

| Board | Expected when opened in map view |
|-------|----------------------------------|
| `Board.md` | the `002` baseline — `taskColumns: 4`, 8 cards (unchanged by this feature) |
| `boards/Test Board 2.md` | the extended baseline above — 4 release sections, 9 cards |

Opening each board in turn (and switching back and forth) MUST reproduce its
own baseline with no cross-board interference. The `usm-view` frontmatter
attribute is per-file, so view state cannot leak between boards.

## Same-folder arrangement (ad-hoc, R6)

The committed vault uses the separate-folder arrangement. The same-folder
arrangement is verified ad-hoc: create a variant board file in the vault root
(distinct name, e.g. `Board variant.md`, referencing the `T` notes or a small
new set), verify it renders independently alongside `Board.md`, delete it, and
restore a clean tree. This step is documented in the skill and in
`quickstart.md`; it is not a committed fixture.

## Invariants

- **Reproducibility**: a fresh clone + `npm run e2e:setup` yields this exact
  structure.
- **Isolation**: nothing outside `test-vault/` is read or modified during a
  run (SC-003).
- **Baseline stability**: changing any fixture file changes the baseline and
  MUST update this contract in the same change (spec edge case: fixture
  drift).
- **002 contract untouched**: `Board.md`, `S1`–`S6`, and the
  `002` test-vault-structure contract are not modified by this feature.
