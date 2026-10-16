# Test Fixtures — Coverage Matrix

These fixtures are the single source of truth for the automated test suite
(T028, FR-023). They are plain Markdown files that mirror the real board and
story file formats defined in `specs/001-user-story-map/contracts/`. The test
harness (T029–T032) reads them and builds a mock `metadataCache` from them —
no Obsidian runtime is required.

## Files

| File | Role |
|------|------|
| `board.md` | Board note: `usm-board: true`, `usm-release-order: appearance`, ordered wikilink list. |
| `S1.md` | Complete story (all four attributes, English names, wikilink epic). |
| `S2.md` | Story missing the **epic** attribute. |
| `S3.md` | Story with **no frontmatter** at all. |
| `S4.md` | Story using **Polish** field names (`aktywność`, `zadanie`, `epik`, `wydanie`). |
| `S5.md` | Story missing the **activity** attribute; lower-cased task value. |
| `S6.md` | Story missing the **release** attribute; lower-cased activity value. |

## Board reference list (`board.md`)

| # | Wikilink | Resolves to | Exercises |
|---|----------|-------------|-----------|
| 1 | `[[S1]]` | `S1.md` | Complete story. |
| 2 | `[[S2]]` | `S2.md` | Missing epic → Unassigned epic. |
| 3 | `[[S3]]` | `S3.md` | No frontmatter → fully Unassigned. |
| 4 | `[[S4]]` | `S4.md` | Polish field names. |
| 5 | `[[S5]]` | `S5.md` | Missing activity; case-insensitive task grouping. |
| 6 | `[[S6]]` | `S6.md` | Missing release; case-insensitive activity grouping. |
| 7 | `[[S1\|Create first board (duplicate)]]` | `S1.md` | **Duplicate** link → separate card (FR-018). |
| 8 | `[[Missing story]]` | *(none)* | **Broken link** → placeholder card (FR-018 edge case). |

## Coverage matrix

| Scenario | FR | Fixture(s) |
|----------|----|-----------|
| Board flag detection (`usm-board: true`) | FR-001 | `board.md` |
| Release row ordering config (`appearance`) | FR-006 | `board.md` |
| Non-wikilink lines ignored (header, text) | FR-003 | `board.md` |
| Complete story (all attributes) | FR-004 | `S1.md` |
| Missing attribute → Unassigned (each level) | FR-011 | `S2.md` (epic), `S5.md` (activity), `S6.md` (release), `S3.md` (all) |
| No frontmatter → fully Unassigned | FR-011 | `S3.md` |
| Polish field name synonyms | FR-012 | `S4.md` |
| Wikilink attribute value (clickable) | FR-007 | `S1.md`, `S4.md`, `S5.md`, `S6.md` |
| Title cascade (story → title → alias → file) | FR-009 | `S1.md` (story), `S2.md`/`S4.md`/`S6.md` (title), `S3.md` (file name) |
| Duplicate links preserved in order | FR-018 | `board.md` (line 7) |
| Broken link → placeholder | FR-018 | `board.md` (line 8) |
| Case-insensitive value grouping | spec edge | `S5.md` vs `S1.md` (task), `S6.md` vs `S1.md` (activity) |

## Notes

- The wikilink targets in `board.md` (`S1`…`S6`) resolve to the sibling
  fixture files by note name (Obsidian resolves `[[S1]]` to `S1.md`).
- `[[Missing story]]` intentionally has no matching file, so it is a broken
  link.
- The `[[Onboarding flow]]` and `[[Auth]]` wikilinks inside story frontmatter
  are attribute *values* (FR-007); they do not need to resolve to fixture
  files for the model to be built — a broken wikilink value degrades to an
  inert label.
