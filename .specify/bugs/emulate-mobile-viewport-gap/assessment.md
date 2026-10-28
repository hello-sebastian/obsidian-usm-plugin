# Bug Assessment: Mobile emulation sequence does not apply the mobile viewport — Q14 mobile layout cannot be verified with the documented sequence

- **Slug**: emulate-mobile-viewport-gap
- **Created**: 2026-10-28
- **Source**: pasted text (agent-prepared bug report, live e2e verification 2026-10-28)
- **Verdict**: valid
- **Severity**: medium

## Report (verbatim or summarized)

> **Bug: Mobile emulation sequence in the usm-e2e skill does not apply the mobile viewport — Q14 mobile layout cannot be verified with the documented sequence**
>
> **Component**: `002-e2e-test-env` (e2e tooling + `usm-e2e` skill) — blocks proper verification of `001-user-story-map` Q14 (FR-030, SC-011, US7).
>
> **Symptom**: Following the documented mobile emulation sequence in `.github/skills/usm-e2e/SKILL.md` ("Mobile scenarios (emulation sequence)"), the captured screenshot shows the **desktop** layout: `--usm-col-w` stays `240px`, the release header is not compacted to ≤ 32px. The plugin's mobile CSS (`@media (max-width: 768px)` in `styles.css`) is never triggered, because `emulateMobile(true)` does not resize the viewport.
>
> **Root cause (verified live, 2026-10-28, Obsidian 1.14.5, CDP port 9222)**: `app.emulateMobile(true)` only switches Obsidian's mobile UI mode — it sets `app.isMobile = true`, adds `emulate-mobile is-tablet is-mobile` classes to `<body>`, and creates `test-vault/.obsidian/workspace-mobile.json` — but does **not** change `window.innerWidth` (stays 1635px in the test instance). The plugin's mobile layout is viewport-based (`@media (max-width: 768px)`), not class-based, so the flag alone cannot trigger it.
>
> **Workaround currently in use** (recorded in the Q14 observation, `specs/001-user-story-map/checklists/manual-validation.md`): force a 375px viewport via CDP `Emulation.setDeviceMetricsOverride` (throwaway script in gitignored `e2e/output/`), then run the documented sequence. This is what actually made Q14 pass (`e2e/output/q14-mobile.png`: release header 32px, `--usm-col-w` 160px).
>
> **Remediation options (for the assessment to weigh)**:
> - **A** — Extend the e2e tooling with a viewport-override operation (e.g. `e2e/inspect.mjs viewport 375x667` / `viewport reset` via CDP `Emulation.setDeviceMetricsOverride` / `clearDeviceMetricsOverride`) and update the skill's mobile sequence to include it. (002-feature change)
> - **B** — Key the plugin's mobile CSS off Obsidian's mobile classes (`body.is-mobile`) in addition to / instead of the media query, so the flag alone triggers the layout. (Plugin change — alters product behavior)
> - **C** — Document the limitation in the skill (the sequence requires a viewport override via CDP) and commit the throwaway override script as a proper helper. (Docs/tooling-only change)

## Symptom

When the agent runs the documented mobile emulation sequence (`emulateMobile(true)` → reload → wait → screenshot), the captured board shows the **desktop** layout (`--usm-col-w: 240px`, non-compact release header) instead of the mobile layout (`--usm-col-w: 160px`, release header ≤ 32px). Expected: the mobile layout is applied after the documented sequence. Actual: only Obsidian's mobile UI mode is active; the viewport is unchanged, so the viewport-based mobile CSS never matches.

## Reproduction

1. `npm run e2e:setup && npm run e2e:launch`
2. Open `test-vault/boards/Test Board 2.md` in board view.
3. Run the documented sequence from `.github/skills/usm-e2e/SKILL.md` ("Mobile scenarios (emulation sequence)"):
   ```bash
   node e2e/inspect.mjs eval "this.app.emulateMobile(true)"
   node e2e/inspect.mjs eval "location.reload()"
   node e2e/inspect.mjs wait ".usm-board"
   node e2e/inspect.mjs screenshot e2e/output/mobile-emulated.png
   ```
4. `node e2e/inspect.mjs eval "JSON.stringify({isMobile: app.isMobile, innerWidth: window.innerWidth, colW: getComputedStyle(document.querySelector('.usm-board')).getPropertyValue('--usm-col-w')})"`
5. Observe: `isMobile: true` but `innerWidth` unchanged (1635px) and `colW: "240px"` (desktop layout).

Live evidence captured 2026-10-28 (CDP eval, with a settle delay after the async `emulateMobile` call; script `e2e/output/mobile-check2.mjs`, gitignored):

```
BEFORE:  { isMobile: false, innerWidth: 1635, bodyClass: "...obsidian-app show-inline-title...", colW: "240px" }
AFTER:   { isMobile: true,  innerWidth: 1635, bodyClass: "...obsidian-app emulate-mobile is-tablet is-mobile ...", colW: "240px" }
RESTORED:{ isMobile: false, innerWidth: 1635, bodyClass: "...obsidian-app show-inline-title...", colW: "240px" }
```

Secondary pitfall observed: `emulateMobile()` is **async** — immediately after the call, `<body>` carries an `in-progress` class and state reads are unreliable; reads need a settle delay. The documented sequence's `location.reload()` masks this, but any eval-based state check right after the toggle will read stale state.

## Suspected Code Paths

- `.github/skills/usm-e2e/SKILL.md` — "Mobile scenarios (emulation sequence)" section: documents the sequence (enable → reload → wait → screenshot → restore) with **no viewport-override step**, and implies the mobile layout is applied after the reload.
- `specs/002-e2e-test-env/contracts/inspect-cli.md` — "Mobile emulation MUST be followed by a page reload for the mobile layout to apply" — the misleading statement that equates the reload with applying the mobile layout.
- `specs/002-e2e-test-env/research.md` — R-003-4 (Mobile emulation application): the decision + rationale that assumes the reload applies the mobile layout.
- `specs/002-e2e-test-env/quickstart.md` — Scenario 5 (Mobile scenario via emulation): repeats the same sequence.
- `specs/002-e2e-test-env/spec.md` — **SC-003-007** ("Mobile scenarios are verified by the agent via mobile emulation in the desktop instance, with the desktop state restored after the scenario, without a physical device") and **FR-003-004**: the acceptance criterion checks the `isMobile` flag / restored state, **not** the applied layout — the root of the gap.
- `e2e/cdp.mjs` — the CDP client exposes only `evaluate` / `screenshot` / `close`; there is **no Emulation-domain / viewport-override operation**.
- `e2e/inspect.mjs` — the CLI offers only `eval` / `wait` / `screenshot`; no viewport operation.
- `styles.css` — `@media (max-width: 768px)` (the viewport-based mobile CSS). This is the *correct* side of the mismatch, not the defect, but it is the reason the flag alone cannot trigger the layout.

## Root Cause Hypothesis

**Confidence: high.** There is a mismatch between two independent mechanisms. The plugin's mobile layout is **viewport-based** — it is gated by `@media (max-width: 768px)` in `styles.css`, which only matches when the rendered viewport is ≤ 768px wide. Obsidian's `app.emulateMobile(true)` is **flag/class-based** — it flips `app.isMobile`, adds `emulate-mobile is-tablet is-mobile` to `<body>`, and swaps the workspace to `workspace-mobile.json`, but it does **not** resize the window or the CDP viewport. The documented sequence (and SC-003-007) conflates "enable mobile mode" with "apply the mobile layout," assuming the reload bridges the two. It does not: after the reload the viewport is still the desktop width, so the media query never matches and the desktop layout renders. The only reason Q14 passed is that the agent additionally forced a 375px viewport via a throwaway CDP `Emulation.setDeviceMetricsOverride` script — a step that is not part of the documented sequence and is not reproducible from the committed tooling.

## Proposed Remediation

**Preferred (Option A — extend the e2e tooling with a viewport-override operation and update the documented sequence).** Add a first-class viewport operation to the committed tooling so the documented mobile sequence is complete and deterministic:

- Extend `e2e/cdp.mjs` with an Emulation-domain helper (e.g. `setViewport(width, height, deviceScaleFactor, mobile)` → `Emulation.setDeviceMetricsOverride`, and `clearViewport()` → `Emulation.clearDeviceMetricsOverride`), exposed on the session object alongside `evaluate` / `screenshot`.
- Extend `e2e/inspect.mjs` with a `viewport <WxH> [--scale N] [--mobile]` operation and a `viewport reset` operation, following the existing CLI conventions (exit codes, `--port`, fail-fast, no new dependencies — Node built-ins only).
- Update the skill's "Mobile scenarios (emulation sequence)" to insert the viewport step **before** the reload and a `viewport reset` in the mandatory restore step, e.g.:
  ```bash
  node e2e/inspect.mjs eval "this.app.emulateMobile(true)"
  node e2e/inspect.mjs viewport 375x667 --mobile
  node e2e/inspect.mjs eval "location.reload()"
  node e2e/inspect.mjs wait ".usm-board"
  node e2e/inspect.mjs screenshot e2e/output/mobile-emulated.png
  # ... restore (mandatory):
  node e2e/inspect.mjs eval "this.app.emulateMobile(false)"
  node e2e/inspect.mjs viewport reset
  node e2e/inspect.mjs eval "location.reload()"
  node e2e/inspect.mjs wait ".usm-board"
  node e2e/inspect.mjs eval "this.app.isMobile"   # → false
  ```
- Correct the misleading statement in `specs/002-e2e-test-env/contracts/inspect-cli.md` ("…for the mobile layout to apply") to state that the **viewport override** is what applies the mobile layout, and the reload applies the mobile UI mode.
- Update `specs/002-e2e-test-env/research.md` R-003-4, `specs/002-e2e-test-env/quickstart.md` Scenario 5, and `specs/002-e2e-test-env/spec.md` SC-003-007 so the acceptance criterion checks the **applied layout** (e.g. `--usm-col-w: 160px` / release header ≤ 32px), not just the `isMobile` flag.

This directly addresses the root cause (the documented sequence is missing the viewport-override step), keeps the fix inside the 002 feature (tooling + docs), and makes the sequence reproducible from committed tooling without a throwaway script.

**Alternatives**:
- **Option C (document the limitation + commit the throwaway as a helper)** — lower effort: keep the tooling as-is, add a committed `e2e/viewport.mjs` helper (or fold the override into the skill as a documented one-liner), and document that the mobile sequence requires it. Trade-off: the sequence still needs an extra, non-CLI step; less discoverable and less deterministic than A, but no CLI surface change.
- **Option B (key the plugin CSS off `body.is-mobile`)** — change the plugin so the flag alone triggers the mobile layout. Trade-off: this is a **product behavior change** to work around a tooling gap; on real devices the viewport is already narrow so the media query works, and keying off the class would make a desktop user who enables `emulateMobile` get the mobile layout at a wide viewport. It also couples the plugin's layout to Obsidian's internal class names. Least preferred.

**Files likely to change**:
- `e2e/cdp.mjs`
- `e2e/inspect.mjs`
- `.github/skills/usm-e2e/SKILL.md`
- `specs/002-e2e-test-env/contracts/inspect-cli.md`
- `specs/002-e2e-test-env/research.md`
- `specs/002-e2e-test-env/quickstart.md`
- `specs/002-e2e-test-env/spec.md`
- (Option C only) a new committed `e2e/viewport.mjs` helper

**Tests to add or update**:
- The e2e tooling (`inspect.mjs` / `cdp.mjs`) is a CLI that requires a live Obsidian instance and is **not** covered by the automated Vitest suite (the `tests/` integration tests target the board pipeline, not the tooling). The primary verification is therefore a **re-run of Q14** using the updated documented sequence, asserting the applied layout (`--usm-col-w: 160px`, release header ≤ 32px) rather than only `isMobile`.
- If a `viewport` operation is added to `inspect.mjs`, add a lightweight unit test for its argument parsing / CDP command construction (the `WxH` / `--scale` / `--mobile` / `reset` forms and the invalid-input exit code 2), consistent with the existing CLI fail-fast contract — but the actual override effect can only be confirmed against a live instance.
- Update the Q14 entry in `specs/001-user-story-map/checklists/manual-validation.md` to drop the "throwaway script" note once the committed sequence is sufficient.

## Risks & Considerations

- **Async `emulateMobile`**: any eval-based state check immediately after the toggle reads stale state (`in-progress` body class). The updated sequence should keep the reload (or an explicit settle) before asserting layout, and the skill should note the settle requirement.
- **Viewport-override state leak**: `Emulation.setDeviceMetricsOverride` persists for the target until cleared — the mandatory restore step **must** include `viewport reset` (or a relaunch), mirroring the existing "mobile emulation state leak" edge case. A leaked override would make later desktop checks render at the mobile width.
- **SC-003-007 / spec change**: tightening the acceptance criterion to check the applied layout is a spec change to the 002 feature; it should go through the normal spec/contract update path, not a silent edit.
- **No product impact for Option A/C**: the plugin's shipped mobile CSS is unchanged and already correct on real devices; the fix is confined to verification tooling and docs.
- **Option B risk (if ever chosen)**: couples the plugin layout to Obsidian's internal `is-mobile` class names and changes desktop-emulation behavior; would need its own spec/clarification.

## Open Questions

- [NEEDS CLARIFICATION: which remediation option to pursue — A (preferred, tooling + docs), C (docs + committed helper), or B (plugin CSS change)?]
- [NEEDS CLARIFICATION: should SC-003-007 be tightened to assert the applied mobile layout (recommended), and if so, is that in scope for this bug fix or a separate 002 spec change?]
- [NEEDS CLARIFICATION: exact mobile viewport to standardize on in the documented sequence — 375×667 (iPhone-class, matches Q14's "~375 px") is the working assumption; confirm.]
