# Technical Plan: note-organization

Status: proposed on 2026-10-26. Implementation requires explicit user
approval after review of this plan.

## Audit summary

The two prerequisites are complete and verified:

- `organization-commands` owns one lifecycle-safe runtime but currently
  exposes only `note:new` and `mod-n`.
- `organization-data-model` already supplies `NoteDocument.pinned`, the
  validated `update-pinned` mutation, a SQLite projection, an index, and Yjs /
  outbox coverage.

The present gaps are concrete:

| Area | Existing behavior | Required outcome |
| --- | --- | --- |
| Creation | New notes omit a destination; duplicates use the source notebook from All Notes. | Resolve the current scope or the persisted default notebook. |
| Default preference | Generic config is intentionally in-memory; no default-notebook setting exists. | Add a small validated persistent settings boundary and Preferences selector. |
| Pinning | The database supports it, but `toNoteSummary` drops it and active queries sort only by `updated_at`. | Pin/unpin through the mutation and sort active notes pinned-first. |
| Multi-move | The picker accepts many notes but its callback returns without moving when `length !== 1`. | Move every selected note with explicit partial-failure behavior. |
| Commands | Archive, duplicate, move, restore, deletion, and pin call workspace callbacks directly. | Route intents through typed lifecycle-safe commands. |
| History | Back/Forward buttons have no handlers or disabled state. | Add ephemeral, availability-aware viewed-note history. |

## Decisions fixed by this plan

1. **Preference storage:** the default notebook is stored in a dedicated
   app-data settings file behind main/preload IPC. It is not a SQLite document
   field, generic in-memory config value, or synchronized Yjs value.
2. **Initial/fallback destination:** `inbox` is the initial value and fallback
   if a stored notebook was deleted. No migration is required.
3. **Batch semantics:** multi-note operations are serial rather than falsely
   transactional. Partial completion stays visible and retryable.
4. **History lifetime:** viewed-note history is renderer-session state only.
   It does not survive restart and excludes programmatic selection fallback.
5. **Shortcuts:** retain documented Inkdrop bindings only; do not introduce a
   `Cmd/Ctrl+P` or command palette behavior.
6. **Database scope:** consume the existing pin persistence and change only
   the active-list ordering. There is no schema migration or parallel store.

## Implementation phases

### Phase 1 — Formalize note-intent commands without reopening lifecycle risk

Extend the organization command model, pure plugin, and hook to register the
note command set from [SPEC-note-organization.md](../SPEC-note-organization.md).
Keep the plugin free of React, IPC, Electron, SQLite, note objects, and
selection state. Replace the individual creation callback with a current,
typed command-router callback so all actions retain `menu`, `context-menu`,
`keymap`, or `api` provenance.

Add declarative contextual keymaps for the documented lifecycle/history keys.
The renderer adapter must resolve a key only when the relevant note-list or
document-history context is eligible, normalize macOS/Windows/Linux Back and
Forward bindings correctly, and call `preventDefault()` only after a match.
Opaque command detail is validated at the page boundary before any document
operation.

**Likely files**

- `src/renderer/features/organization/model/organizationCommands.ts`
- `src/renderer/features/organization/runtime/organizationCommandsPlugin.ts`
- `src/renderer/features/organization/hooks/useOrganizationCommands.ts`
- `src/__tests__/features/organization/organizationCommands.test.ts`
- `src/__tests__/features/organization/useOrganizationCommands.test.tsx`

**Acceptance criteria**

- Every listed note command registers/disposes once, even under Strict Mode.
- The adapter uses current callbacks without reactivation and rejects invalid
  command IDs/details before they reach a mutation.
- `Cmd/Ctrl+P`, unmatched keys, editable inputs, unavailable actions, and
  system shortcuts are not consumed.
- The existing `note:new` behavior remains covered before its destination
  policy changes in Phase 3.

### Phase 2 — Add the bounded default-notebook preference port

Define a minimal shared DTO and validator for the default notebook ID. Add a
main-process settings service that atomically reads/writes an app-data file,
validates an update against the current `LocalDocumentStore` notebook list,
and returns Inbox for a missing/stale setting. Expose only `get` and `set`
through an authorized IPC handler and the preload bridge, then add a renderer
hook with loading/error state.

Extend Workspace Preferences with a native accessible select sourced from the
current notebook list. Show a durable error without optimistically claiming a
failed write succeeded. Deleting a selected default notebook must not block
future note creation: the next read resolves to Inbox.

**Likely files**

- `src/shared/note-organization/noteOrganizationPreferences.types.ts` (new)
- `src/shared/ipc/channels.ts`
- `src/shared/bridge.ts`
- `src/main/note-organization/NoteOrganizationPreferencesService.ts` (new)
- `src/main/main.ts`
- `src/main/preload.ts`
- `src/renderer/features/notes/hooks/useDefaultNotebookPreference.ts` (new)
- `src/renderer/components/workspace/WorkspacePreferences.tsx`
- `src/renderer/layouts/WorkspaceLayout.tsx`
- focused shared, main, preload/bridge, and renderer tests

**Acceptance criteria**

- An absent setting returns `inbox`; only an existing notebook or Inbox can be
  persisted.
- Settings writes are serialized and atomic; malformed IPC values and
  untrusted senders receive the existing safe failure shape.
- The renderer never receives an app-data path or direct filesystem access.
- The selected preference survives a main-service restart and stale notebook
  IDs safely fall back to Inbox.

### Phase 3 — Centralize destination policy and workspace batch primitives

Introduce a pure resolver for the destination rules in the spec. The page
uses it for `note:new` and duplicate, so current notebook/project and scoped
tag/status selections take precedence while global views use the persisted
choice. Creation from Trash/Templates uses the fallback rather than creating
an archived or template note.

In `useDocumentWorkspace`, add a pin action and an explicit batch move action
with a structured outcome. Normalize duplicate note IDs, run items in stable
selection order, and expose completed versus remaining IDs on failure. Reuse
the same safe primitive for multi-restore. Keep permanent deletion's existing
batch IPC operation and confirmation policy.

Update active-note sorting both when initially queried and when an optimistic
workspace collection is upserted: `pinned DESC`, then `updatedAt DESC`, then
ID. Do not pin-sort the trash.

**Likely files**

- `src/renderer/features/notes/model/noteDestinationPolicy.ts` (new)
- `src/renderer/platform/documents/useDocumentWorkspace.ts`
- `src/main/documents/LocalDocumentStore.ts`
- `src/renderer/platform/documents/IpcDocumentRepository.ts` only if typed
  batch result adaptation needs it
- document-store/workspace/model tests

**Acceptance criteria**

- New/duplicate calls use the exact resolved destination and preserve the
  documented duplicate copy set (title/body/tags only).
- Pin/unpin persists through the existing mutation, survives reload, and
  active ordering is stable in SQL and renderer state.
- A failed multi-move/restore reports completed and remaining notes; it does
  not silently close the dialog or clear retryable selection.
- No new SQLite table, migration, note IPC mutation, or dependency is added.

### Phase 4 — Make the note list command-driven and finish pin/multi-move UI

Lift the action selection/context needed by the command adapter to a controlled
boundary, keeping the list focused on rendering and accessibility. Replace
direct workspace mutation callbacks with command requests whose detail carries
only validated note IDs and an explicitly selected destination. The page maps
those commands to the Phase 3 actions.

Complete active and Trash selection controls: move selected active notes,
move a contextual note, archive, restore, permanently delete, duplicate one,
and Pin/Unpin one. Ensure the `m` picker works for multiple selected active
notes; retain its j/k/Enter and Escape behavior. Include the durable
`pinned` field in `toNoteSummary`, and surface an accessible pin indicator.

**Likely files**

- `src/renderer/features/notes/components/NotesPanel.tsx`
- `src/renderer/features/notes/components/NotesList.tsx`
- `src/renderer/features/notes/components/NoteListItem.tsx`
- `src/renderer/features/notes/components/MoveNoteDialog.tsx`
- `src/renderer/pages/WorkspacePage.tsx`
- `src/__tests__/features/notes/NotesPanel.test.tsx`
- page integration tests

**Acceptance criteria**

- UI buttons, context menus, and shortcuts invoke command IDs rather than a
  direct page/document mutation.
- Multi-move actually calls the batch workspace action for every selected
  note; a multi-selection no longer resolves as a no-op.
- Pin/unpin updates the marker and list order after successful persistence.
- Archive/delete behavior preserves confirmation, context cleanup, and the
  editor's selection safety.

### Phase 5 — Add view-history model and connect toolbar/shortcuts

Create a pure, immutable viewed-note history model and a small page hook. It
records only successful user-driven opens, deduplicates adjacent entries,
truncates forward state on a new branch, and selects the nearest active record
when an entry disappears. Connect it to list selection, preview-reference
opens, creation, duplication, and restore. Do not record automatic fallback
after archive or permanent delete.

Wire `WorkspaceNavbar` Back/Forward controls through the organization command
dispatcher. Give the controls disabled and accessible state derived from the
history model. The same command route serves platform-specific keyboard
bindings.

**Likely files**

- `src/renderer/features/notes/model/noteNavigationHistory.ts` (new)
- `src/renderer/features/notes/hooks/useNoteNavigationHistory.ts` (new)
- `src/renderer/components/workspace/WorkspaceNavbar.tsx`
- `src/renderer/layouts/WorkspaceLayout.tsx`
- `src/renderer/pages/WorkspacePage.tsx`
- focused model/hook/navbar/page tests

**Acceptance criteria**

- Back/Forward works from the toolbar and the documented platform bindings.
- Buttons accurately reflect availability and never open trashed/deleted IDs.
- Repeated opens do not grow history; a branch truncates Forward history.
- History stays in memory and never writes a note, preference, or database row.

### Phase 6 — Verify behavior across the actual desktop boundary

Run focused red-green suites while each phase is built, then complete the
project verification. Use a temporary Electron user-data profile to avoid
touching user notes. Inspect renderer console output while exercising every
new binding and no-binding regression.

**Verification commands**

```sh
npm test -- --runInBand src/__tests__/features/organization
npm test -- --runInBand src/__tests__/features/notes
npm test -- --runInBand src/__tests__/main/documents/LocalDocumentStore.test.ts
npm run lint
npm run typecheck
npm run test:ci
npm run verify:native-sqlite
npm run build
npm run verify
```

**Manual smoke matrix**

| Scenario | Evidence |
| --- | --- |
| Default preference | Set a custom notebook, restart the isolated profile, create from All Notes, and verify its destination. |
| Context policy | Create/duplicate from notebook, scoped tag/status, All Notes, and Trash; verify the resolved notebook and active/unpinned defaults. |
| Multi-move | Move two notes with `m`; inject one controlled failure and verify partial progress plus retryable selection. |
| Pinning | Pin/unpin, relaunch, and confirm durable marker plus pinned-first ordering. |
| History | Open A → B → C, use both buttons and platform shortcuts, archive B, then verify unavailable entries are skipped. |
| Shortcut safety | Verify `Cmd/Ctrl+P` remains preview-only, text input is editable, and no lifecycle error is logged. |

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Expanding the command hook reintroduces `PLUGIN_LIFECYCLE_IN_PROGRESS`. | Preserve one runtime, serialized lifecycle queue, stable callback refs, and Strict Mode tests before UI migration. |
| A global key listener steals CodeMirror/browser shortcuts. | Resolve only matching contextual bindings and prevent default only after a match; regression-test editable targets and `Cmd/Ctrl+P`. |
| Sequential batch movement yields a partial result. | Return completed/remaining IDs, retain retryable selection, and never report full success after an error. |
| Deleted notebooks leave an unusable preference. | Validate writes, fallback stale reads to Inbox, and test deletion/restart. |
| Pin order differs after optimistic updates. | Share the exact comparator contract with tests for SQL list and renderer upsert. |
| History reopens unavailable notes. | Resolve only active IDs at navigation time and skip missing/archive entries. |

## Explicit boundaries

- **Always:** start each code slice with a focused failing test; preserve the
  typed main/preload/renderer boundary; surface command and persistence errors;
  use the existing Yjs-backed pin mutation.
- **Ask first:** adding dependencies; changing the plugin-kernel public API;
  adding shortcuts beyond those listed here; changing the database schema,
  backup behavior, or note sync semantics.
- **Never:** persist default notebook in a note/Yjs document; bypass command
  dispatch from migrated UI; consume `Cmd/Ctrl+P`; silently discard a partial
  batch failure; use user data for tests; or replace SQLite/Yjs with an
  Inkdrop storage engine.
