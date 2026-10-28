# Implementation plan: notebook taxonomy

Status: proposed on 2026-10-26. Implements only
[SPEC-notebook-taxonomy.md](../SPEC-notebook-taxonomy.md) after this plan and
its task list are approved.

## Observed compatibility baseline

A read-only structural inspection of the authorized active InkNote profile
found schema version 9, six active notes, four notebooks (three root and one
nested), two explicit icons, nine catalogue tags, no orphan parent, and no
cycle. Every existing notebook ID is a legacy non-`book:` ID.

This confirms that the module must prove legacy-ID compatibility against the
existing store rather than assume a new-only `book:` population. Note titles,
bodies, and notebook names were not read.

## Dependency graph

```text
shared notebook update DTO + validation
                  |
                  v
SQLite atomic update and tree validation
                  |
                  v
authorized IPC / preload / renderer adapter
                  |
                  v
workspace update action ----> command request model + organization plugin
                  |                             |
                  v                             v
accessible edit form / detail & context routing
                  |
                  v
full regression + disposable-profile smoke
```

The durable update is deliberately completed and tested before a command or
UI can invoke it. The UI starts only after the IPC adapter proves that no
untrusted renderer input can bypass graph validation.

## Architecture decisions

- Keep the existing `Notebook` DTO and SQLite schema. Add an immutable
  `UpdateNotebookInput` whose nullable `parentId` and `icon` explicitly mean
  root and no icon; no optional field silently preserves a stale value.
- Put all mutable-tree rules in the shared validator and authoritative SQLite
  transaction. The store rejects Inbox updates, missing parents, self-links,
  and descendant parents before writing a row. It updates `updated_at` but
  never changes the notebook ID or note associations.
- Reuse the existing document IPC result envelope, sender authorization,
  narrow preload bridge, and configured-backup refresh hook. This preserves
  the same security and recovery behavior as notebook creation/deletion.
- Extend the existing lifecycle-safe organization plugin with notebook command
  IDs and a feature-local typed request parser. No command is associated with
  a new global keybinding. Current sidebar/detail controls dispatch commands
  whose page-level handler owns the durable workspace action.
- Extract a focused, accessible notebook editor surface instead of extending
  the already dense sidebar component. It owns form state and focus; the
  workspace owns data refresh; pure tree helpers derive valid parent choices.
- Preserve the current deletion transaction exactly. Improve its routing and
  confirmation state but do not modify its direct-note archive or child-lift
  policy.
- Human verification uses the authorized profile read-only for structural
  comparison. Any write smoke test creates a fresh empty test notebook,
  exercises edit/reparent/icon reset, and deletes that same empty notebook;
  it never edits, moves, archives, or deletes an existing user note or
  notebook.

## Build order and checkpoints

### Phase 1: durable contract

1. Add the shared update DTO, validation, and typed repository method.
2. Implement the prepared-statement SQLite update transaction and its tree
   integrity checks.

Checkpoint: focused domain/store tests prove rejected updates leave legacy
IDs, existing hierarchy, timestamps, and note associations unchanged.

### Phase 2: privileged boundary and renderer state

3. Carry the operation through IPC channels, main-process authorization,
   preload, and renderer revalidation; refresh the configured backup only
   after success.
4. Add the workspace update action and coherent in-memory refresh/selection
   reconciliation.

Checkpoint: focused IPC/adapter/workspace tests prove no privileged object
crosses into renderer code and accepted changes refresh a notebook projection.

### Phase 3: command and UI integration

5. Extend the organization command contribution and request parser with
   lifecycle-safe notebook create, edit, delete, and open-detail operations.
6. Add the accessible notebook editor, permitted-parent chooser, focused error
   handling, confirmation behavior, and command routing from sidebar/detail
   controls.

Checkpoint: Strict Mode and keyboard tests prove no duplicate plugin
registration, stale handler, global-key interception, direct durable UI call,
or inaccessible interaction state.

### Phase 4: regression and user-safe smoke

7. Run all quality gates, inspect the diff, re-run the read-only structural
   profile report, and exercise a disposable empty notebook in Electron only
   after the automated tests pass.

Checkpoint: the test notebook is absent after cleanup; pre-existing profile
counts and tree integrity remain unchanged; any unexpected discrepancy stops
the smoke test and is reported rather than repaired automatically.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Reparenting introduces an unreachable cyclic tree | Reject self and descendant targets inside the SQLite transaction; cover legacy IDs and multi-level trees. |
| A renderer path bypasses commands or validation | Keep UI intents typed; dispatch via the organization runtime; validate again at IPC and renderer adapter boundaries. |
| `undefined` versus `null` retains or clears an icon incorrectly | Use a replacement DTO with explicit nullable fields and test both set/clear outcomes. |
| An update invalidates a selected sidebar/detail view | Refresh the projection after acceptance and fall back only when the prior selection no longer exists. |
| A user smoke test modifies existing notes | Use aggregate read-only observations and an empty, self-owned temporary notebook; do not target existing content. |
| A new write loses configured backup protection | Reuse and test the existing post-success main-process backup refresh hook. |

## Verification strategy

- Start each task with the focused failing Jest coverage described in
  [notebook-taxonomy.todo.md](notebook-taxonomy.todo.md).
- Run `npm run typecheck` after each cross-process contract checkpoint.
- Run `npm run verify:native-sqlite` after durable-store work and `npm run
  verify` before the Electron smoke review.
- Treat a clean automated run as necessary but not sufficient: the final
  profile check compares aggregate structural counts only and does not disclose
  user content.
