---
name: "usm-task-protocol"
description: "Inject the mandatory per-task checkoff protocol before /speckit-implement executes tasks (Constitution: Logical Atomicity Protocol — Immediate Checkpointing & Progress Tracking)."
---

## Purpose

This hook runs **before** `/speckit-implement` starts executing tasks. It
injects the project's mandatory per-task checkoff protocol so that task
progress in `tasks.md` is updated **immediately after each task**, never in a
batch at the end of the session.

This file is project-local: it is NOT listed in
`.specify/integrations/*.manifest.json`, so `speckit update` will not
overwrite or remove it.

## Task Execution Protocol (MANDATORY)

For **each** task in `tasks.md`, in this exact order:

1. **Implement** — follow TDD where applicable (failing test first, then
   implementation; Constitution Principle III).
2. **Verify** — type-check (`npx tsc --noEmit`) and the task's targeted tests
   pass. The project MUST be left in a compilable, verifiable state
   (Constitution: *Self-Contained & Compilable*).
3. **Check off IMMEDIATELY** — edit `tasks.md` and change that task's
   `[ ]` to `[X]`. Do not defer this to the end of the session.
4. **Commit at phase end** — do NOT commit after each task. Only when the
   LAST task of the current phase is checked off, commit the phase's code
   changes **together with** all of the phase's `tasks.md` checkoffs in a
   single commit, so the git history is an auditable per-phase trail.
5. **Report** — one line: `T0XX done — <summary> (tests: n/n)`.

### Hard gates

- Do **NOT** start task N+1 until task N is marked `[X]` in `tasks.md`
  (Constitution: *Sequencing Gate*).
- **Batch checkoff** of multiple tasks in a single edit is **FORBIDDEN**
  (Constitution: *Immediate Task Checkoff*).
- Parallel tasks `[P]` may be implemented together, and each still gets its
  own checkoff as soon as it is verified; the commit still happens once, at
  the end of the phase.

### After an interruption or context compaction

1. Re-read `tasks.md` **first**.
2. Check off any completed-but-unmarked tasks (verify each before marking).
3. Only then continue with the next unmarked task.

## Verification

After this hook runs, the agent MUST acknowledge the protocol in its first
implementation message (one line is enough) and then execute tasks strictly
per the protocol above.
