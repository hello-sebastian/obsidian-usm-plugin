# Contract: Verification Report (Machine-Readable Output)

**Feature**: `002-e2e-test-env` (consolidated with `003-manual-test-workflow`) | **Date**: 2026-10-27

The verification script (`e2e/verify.mjs`, npm script `e2e:verify`) emits a machine-readable JSON report (FR-002-014). It is written to `e2e/output/report.json` (gitignored) and also printed to stdout.

## Invocation

```bash
npm run e2e:verify                 # default port 9222
npm run e2e:verify -- --port 9333  # alternate port
```

## Report schema

```json
{
  "status": "pass",
  "port": 9222,
  "timestamp": "2026-10-27T12:00:00.000Z",
  "checks": [
    {
      "id": "task-columns",
      "name": "Task column count",
      "passed": true,
      "actual": 4,
      "expected": 4,
      "detail": "Counted .usm-header-cell--task elements in .usm-board-header"
    },
    {
      "id": "screenshot",
      "name": "Map screenshot captured",
      "passed": true,
      "actual": "e2e/output/board.png",
      "expected": "image file written",
      "detail": "Page.captureScreenshot of the map view"
    },
    {
      "id": "reactivity",
      "name": "Map reacts to source change",
      "passed": true,
      "actual": 640,
      "expected": "<= 5000",
      "detail": "Card count changed after modifying a story note; delayMs=640"
    }
  ],
  "taskColumns": 4,
  "screenshot": "e2e/output/board.png",
  "reactivity": { "detected": true, "delayMs": 640, "boundMs": 5000 },
  "errors": []
}
```

## Field rules

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `status` | string | yes | `"pass"` only if every check in `checks` has `passed: true`; otherwise `"fail"`. |
| `port` | number | yes | The CDP port the run targeted. |
| `timestamp` | string | yes | ISO-8601 UTC time of completion. |
| `checks` | array | yes | One object per standard check (FR-002-011, FR-002-012, FR-002-013). Each: `id`, `name`, `passed` (bool), `actual`, `expected`, optional `detail`. |
| `taskColumns` | number | yes | Counted `.usm-header-cell--task` elements (FR-002-011). |
| `screenshot` | string | yes | Relative path to the captured PNG (FR-002-012). |
| `reactivity` | object | yes | `detected` (bool), `delayMs` (number), `boundMs` (number, fixed `5000`) (FR-002-013, SC-002-006). |
| `errors` | string[] | no | Diagnostic messages; MUST include a connection-failure hint when CDP is unreachable (spec edge case). |

## Exit codes

- `0` — `status: "pass"`.
- `1` — `status: "fail"` (one or more checks failed).
- `2` — environment error before checks ran (CDP unreachable, build missing/outdated, single-board precondition violated). `status` is `"fail"` and `errors` explains why.

## Preconditions

- **Single board**: the standard checks use global DOM queries and are only correct when exactly one `.usm-board` is present in the DOM. If multiple boards are open, the run exits `2` with a "single-board precondition violated" message in `errors` (T002-015).

## Interpretability (FR-002-014)

An agent MUST be able to determine the outcome from `status` and `checks` alone, without opening the screenshot. The screenshot is for human visual confirmation (SC-002-005), not for machine parsing.
