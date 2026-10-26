# Tasks: note-organization

Status: implementation complete on 2026-10-26. Awaiting the final human
desktop smoke review in [the technical plan](note-organization.plan.md).

This checklist implements only [SPEC-note-organization.md](../SPEC-note-organization.md).
It does not include notebook/tag taxonomy, templates, search, remote sync, a
generic preferences rewrite, or a document-schema migration.

## Task 1: Expand lifecycle-safe note command routing

**Acceptance criteria:**

- [x] The complete typed note command set registers and disposes through one
      organization plugin runtime.
- [x] UI sources and matching keymaps preserve command provenance.
- [x] Strict Mode, stale callbacks, invalid command details, editable targets,
      unmatched keys, and `Cmd/Ctrl+P` have focused regression coverage.

## Task 2: Persist and expose default notebook preference

**Acceptance criteria:**

- [x] A main/preload/renderer contract reads/writes one validated notebook ID
      atomically, with Inbox as initial and stale-value fallback.
- [x] Preferences shows only usable notebooks and reports failed writes.
- [x] The renderer has no direct filesystem path/access and the document DB is
      unchanged.

## Task 3: Add destination, pin, and batch workspace behavior

**Acceptance criteria:**

- [x] Creation/duplication resolve the spec's scoped/default destination.
- [x] Existing `update-pinned` persistence drives durable pin UI and
      pinned-first active ordering.
- [x] Multi-move/restore returns explicit completed/remaining results and
      preserves retryable selection after partial failure.

## Task 4: Route list UI through commands

**Acceptance criteria:**

- [x] Move, archive, restore, permanent delete, duplicate, and pin actions
      dispatch a command rather than call a workspace mutation directly.
- [x] `m` moves any active multi-selection; the current no-op path is removed.
- [x] Context menus, selection controls, confirmation, accessibility, and
      result/error state remain coherent.

## Task 5: Implement note view history

**Acceptance criteria:**

- [x] History records qualified opens, deduplicates adjacent entries, trims
      forward entries, and skips unavailable active documents.
- [x] Toolbar and platform shortcut actions dispatch the same history commands
      with correct disabled state.
- [x] No history state persists across restart or mutates a note.

## Checkpoint: complete note-organization

- [x] Focused command, preference, document, notes, history, and page tests
      pass.
- [x] `npm run lint`, `npm run typecheck`, `npm run test:ci`,
      `npm run verify:native-sqlite`, `npm run build`, and `npm run verify`
      pass.
- [ ] A clean-profile Electron smoke test passes the default preference,
      destination policy, multi-move failure recovery, pin persistence/order,
      history, and shortcut-safety matrix.
- [ ] A human has reviewed the result before the next organization module is
      specified or implemented.
