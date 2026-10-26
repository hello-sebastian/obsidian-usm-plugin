# Contract: Story File Format

**Feature**: `001-user-story-map` | **Date**: 2026-10-15

A story file is a plain Markdown note referenced by a wikilink in a board file. Its frontmatter carries the attributes that position the story on the map. The note body (description, acceptance criteria) is **not** rendered on the map in MVP — the map shows only the card (title + Release badge).

## Frontmatter attributes

| Canonical attribute | Accepted field names (case-insensitive) | Type | Required | Description |
|---------------------|------------------------------------------|------|----------|-------------|
| Activity | `activity`, `aktywność` | text or wikilink | no | Top-level column group (horizontal axis). |
| Task | `task`, `zadanie` | text or wikilink | no | Second-level column group, nested under Activity. |
| Epic | `epic`, `epik` | text or wikilink | no | Third-level column group, nested under Task. |
| Release | `release`, `wydanie`, `row` | text or wikilink | no | Row (vertical axis); also rendered as the card footer badge (FR-010: Release value only in MVP). |
| Story | `story` | text | no | Explicit card title (first in the title cascade). |
| Title | `title` | text | no | Card title fallback (second in the cascade). |

Rules:

- **Field name matching** is case-insensitive and uses the built-in PL/EN synonym dictionary above (FR-012). The dictionary is not user-configurable in MVP (spec Assumptions).
- **Value matching** is case-insensitive: `Login` and `login` are the same value and group together (spec edge case).
- **Value types**: a plain string renders as a visual label; a wikilink (e.g., `Epic: "[[Logowanie]]"`) renders as a clickable header that opens the linked note (FR-007).
- **Missing attributes**: any missing attribute (or a note with no frontmatter at all) places the story in the corresponding "Unassigned" section — no error, no crash (FR-011, spec edge case).
- **Unknown attributes** in the story frontmatter are ignored.
- Current versin of the plugin never writes to story files (read-only map, FR-015) – however edition/adding/delete/modifiing funcjins will be added in next specs.

## Title cascade (FR-009)

The card title is resolved in this order (first non-empty value wins):

1. `Story` frontmatter attribute
2. `title` frontmatter attribute
3. First alias of the note (from `metadataCache` aliases)
4. File name (without extension)

The title is clamped to a small fixed number of lines (2–3, an interface detail) via CSS.

## Example

```markdown
---
activity: Onboarding
task: First run
epic: "[[Onboarding flow]]"
release: "1.0 MVP"
story: Create first board
---

As a user I want to create my first board so that I can map my user journey.

## Acceptance criteria
- ...
```

## Out of scope (MVP)

- A separate `status` attribute (e.g., To Do / In Progress / Done) — the badge shows the Release value only (clarification session 2).
- Rendering of the note body (description, acceptance criteria) on the card or in a popup — deferred to a later iteration (spec Assumptions).
- User-configurable field name mapping — deferred (spec Assumptions).
