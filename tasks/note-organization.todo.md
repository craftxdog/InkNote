# Tasks: note-organization

Status: proposed on 2026-10-26. Do not implement until the user explicitly
approves [the technical plan](note-organization.plan.md).

This checklist implements only [SPEC-note-organization.md](../SPEC-note-organization.md).
It does not include notebook/tag taxonomy, templates, search, remote sync, a
generic preferences rewrite, or a document-schema migration.

## Task 1: Expand lifecycle-safe note command routing

**Acceptance criteria:**

- [ ] The complete typed note command set registers and disposes through one
      organization plugin runtime.
- [ ] UI sources and matching keymaps preserve command provenance.
- [ ] Strict Mode, stale callbacks, invalid command details, editable targets,
      unmatched keys, and `Cmd/Ctrl+P` have focused regression coverage.

## Task 2: Persist and expose default notebook preference

**Acceptance criteria:**

- [ ] A main/preload/renderer contract reads/writes one validated notebook ID
      atomically, with Inbox as initial and stale-value fallback.
- [ ] Preferences shows only usable notebooks and reports failed writes.
- [ ] The renderer has no direct filesystem path/access and the document DB is
      unchanged.

## Task 3: Add destination, pin, and batch workspace behavior

**Acceptance criteria:**

- [ ] Creation/duplication resolve the spec's scoped/default destination.
- [ ] Existing `update-pinned` persistence drives durable pin UI and
      pinned-first active ordering.
- [ ] Multi-move/restore returns explicit completed/remaining results and
      preserves retryable selection after partial failure.

## Task 4: Route list UI through commands

**Acceptance criteria:**

- [ ] Move, archive, restore, permanent delete, duplicate, and pin actions
      dispatch a command rather than call a workspace mutation directly.
- [ ] `m` moves any active multi-selection; the current no-op path is removed.
- [ ] Context menus, selection controls, confirmation, accessibility, and
      result/error state remain coherent.

## Task 5: Implement note view history

**Acceptance criteria:**

- [ ] History records qualified opens, deduplicates adjacent entries, trims
      forward entries, and skips unavailable active documents.
- [ ] Toolbar and platform shortcut actions dispatch the same history commands
      with correct disabled state.
- [ ] No history state persists across restart or mutates a note.

## Checkpoint: complete note-organization

- [ ] Focused command, preference, document, notes, history, and page tests
      pass.
- [ ] `npm run lint`, `npm run typecheck`, `npm run test:ci`,
      `npm run verify:native-sqlite`, `npm run build`, and `npm run verify`
      pass.
- [ ] A clean-profile Electron smoke test passes the default preference,
      destination policy, multi-move failure recovery, pin persistence/order,
      history, and shortcut-safety matrix.
- [ ] A human has reviewed the result before the next organization module is
      specified or implemented.
