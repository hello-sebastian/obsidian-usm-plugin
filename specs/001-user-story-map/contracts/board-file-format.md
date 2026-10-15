# Contract: Board File Format

**Feature**: `001-user-story-map` | **Date**: 2026-10-15

The board file is the single source of truth for *which* stories appear on the map, *in what order*, and *how the board is configured*. It is a plain Markdown file that must remain fully readable and interpretable without the plugin (Constitution Principle VI).

## File structure

```markdown
---
usm-board: true
usm-release-order: appearance
---

- [[Story: Onboarding]]
- [[Story: First login]]
- [[Story: Profile setup|Setup profile]]
- [[Missing story]]
- [[Story: First login]]
```

## Frontmatter attributes

| Attribute | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `usm-board` | boolean | yes | — | Flag that marks the note as a board. Only `true` activates the map view. |
| `usm-release-order` | string | no | `appearance` | Row ordering strategy. Accepted values: `appearance` (order of first appearance of Release values among the board's stories), `alphabetical` (case-insensitive sort of Release labels). Unknown values fall back to `appearance`. |

Rules:

- Attribute names are matched case-insensitively.
- Unknown frontmatter attributes are **ignored** — they never cause an error (spec edge case).
- The frontmatter must not be modified by the plugin (read-only map, FR-015).

## Body: story link list

- The body is an **ordered list of wikilinks**, one per line (standard Markdown bullet list).
- Every line that is not a wikilink (headers, plain text, comments, empty lines) is **ignored** (FR-003, clarification session 1).
- **Order matters**: the sequence of wikilinks defines (a) the order of first appearance used for column grouping (Activity → Task → Epic, FR-005) and (b) the default Release row order (`appearance`, FR-006).
- **Duplicates are allowed**: each occurrence of a wikilink renders a separate card, in order of appearance (FR-018, clarification session 1).
- Wikilink forms: `[[Note name]]`, `[[Note name|alias]]`, `[[Note name#heading]]`, `[[Note name#^block]]`. The resolved target is the note; the display alias is used as fallback link text.
- **Broken links** (target note does not exist) render a dimmed placeholder card; the map never crashes (spec edge case).

## Portability guarantees (Principle VI)

1. **Self-describing**: a reader (human or AI agent) without the plugin can determine the story set, their order, and the row ordering strategy from the file alone.
2. **Survives sync/copy**: all board-level configuration lives in this file — nothing is stored in plugin settings.
3. **Reinstall-safe**: re-enabling the plugin after uninstall reproduces the identical map from this file alone.
4. **Plugin-disabled readability**: with the plugin disabled, the file is a normal bulleted list of links in any Markdown editor.

## Out of scope (MVP)

- Story-level attributes (Activity, Task, Epic, Release, Story, title) — these live in the story notes' frontmatter (see `story-file-format.md`).
- Board-level column ordering overrides, per-column configuration, and any other board settings beyond `usm-release-order` — deferred to later iterations.
