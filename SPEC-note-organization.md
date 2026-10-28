# Spec: note-organization

Status: proposed on 2026-10-26.

## Assumptions

1. InkNote remains local-first. A note action is expressed through the
   existing renderer command runtime and reaches the document workspace; a
   command plugin never reads SQLite, the preload bridge, or Electron APIs.
2. `organization-commands` and `organization-data-model` are complete
   prerequisites. In particular, `note:new` is lifecycle-safe and the durable
   `pinned` field plus `update-pinned` mutation already exist.
3. The existing document database remains the owner of notes, notebooks, Yjs
   updates, the sync outbox, and trash state. This module does not introduce a
   second note store or migrate document data.
4. Inkdrop's documented behavior is the product reference: creation uses a
   configured default notebook from All Notes, duplicates copy title/content/
   tags into the current notebook, list actions support multi-selection,
   `m` opens move, and note navigation has Back/Forward history.
5. The existing preview bindings, including `Cmd/Ctrl+P`, are not changed.

## Objective

Complete the note-level organization workflow with the same durable semantics
and command boundaries already established in InkNote: contextual note
creation, a persisted default notebook preference, pinning, honest multi-note
move/restore behavior, and navigable note history.

Every migrated action has one named command. UI controls, contextual menus,
and matching shortcuts dispatch that command with an explicit source. The page
validates a command request against its current workspace state before it can
invoke a document mutation.

## In scope

- Typed commands for create, duplicate, move, archive, restore, permanent
  delete, toggle pin, history back, and history forward.
- The established Inkdrop shortcuts: `Cmd/Ctrl+N`, `Cmd/Ctrl+D`, `Delete` /
  `Cmd/Ctrl+Backspace`, `m` from a usable note-list selection, and platform
  Back/Forward (`Cmd+Left`/`Cmd+Right` on macOS; `Alt+Left`/`Alt+Right` on
  Windows/Linux).
- A persisted default-notebook preference, initialized to `inbox`, with a
  bounded main-process/preload/renderer contract and a Preferences control.
- Contextual placement for new and duplicated notes.
- Single-note pin/unpin and pinned-first active-note ordering.
- Multi-note move and restore, including explicit partial-completion feedback.
- In-memory viewed-note history, toolbar controls, and accessible disabled
  states.
- Focused tests, full verification, and a clean-profile Electron smoke test.

## Out of scope

- Notebook rename/reparent/icon editing, notebook taxonomy commands, and tag
  catalogue editing.
- Templates, search, Telescope/command-palette UI, sync, sharing,
  attachments, or remote storage.
- A generic rewrite of the renderer configuration system. The narrow default
  notebook preference is persisted through its own validated app-settings
  boundary because the present generic config storage is intentionally
  in-memory.
- A SQLite schema migration, a new document IPC mutation, or changes to
  backups. Pinning already uses the established Yjs/SQLite document mutation.
- Persisting navigation history across application restarts.

## Public behavior

### Command boundary and shortcuts

The organization command set becomes:

```ts
export const organizationCommandIds = Object.freeze({
  createNote: 'note:new',
  duplicateNote: 'note:duplicate',
  moveNotes: 'note:move',
  archiveNotes: 'note:archive',
  restoreNotes: 'note:restore',
  deleteNotesPermanently: 'note:delete-permanently',
  toggleNotePinned: 'note:toggle-pin',
  goBack: 'note:history-back',
  goForward: 'note:history-forward',
});
```

The pure plugin continues to register static command IDs and declarative
keymaps. Its only input is a callback receiving a kernel `CommandInvocation`.
The page-side adapter owns current callbacks and validates any opaque
`invocation.detail` payload before resolving IDs to active or archived notes.
Malformed, stale, missing, or unauthorised document IDs are rejected without a
mutation.

`Cmd/Ctrl+P` remains outside these bindings. Native defaults are prevented only
after a command resolves in the applicable context; unrecognized keystrokes,
editable field input, dialogs, and unavailable actions remain untouched.

### Default notebook policy

The default notebook is an application preference, not note metadata and not a
syncable document record. Its stored value is a notebook ID and defaults to
the built-in `inbox` notebook. The main process validates writes against the
current notebook catalogue; if a previously stored custom ID no longer exists,
reads resolve safely to `inbox`.

The Preferences dialog exposes only existing notebooks, including Inbox. A
write is atomic and failure is visible to the user; it never changes an
existing note or database row.

Creation and duplication resolve destinations in this order:

1. A selected notebook or project uses that exact notebook.
2. A focused tag or status view scoped to a notebook uses that scope's
   notebook.
3. All Notes, global tag/status views, Templates, Trash, or no usable scope
   use the persisted default notebook.

New notes start untitled, empty, active, and unpinned. Duplicates copy only the
Inkdrop-documented title, body, and tags, and start active/unpinned in the
resolved destination. They do not inherit task progress, deletion state, or
history entries from the source.

### Pinning and ordering

Pinning invokes the existing validated `update-pinned` mutation. Active lists
sort pinned notes before unpinned notes, then by descending update timestamp
and ID. Archived notes remain sorted by deletion time. The renderer projection
must carry `pinned` through `toNoteSummary`, so the existing accessible pin
indicator reflects durable state.

The contextual menu offers Pin or Unpin for one active note. There is no new
pin shortcut in this module.

### Multi-note movement and lifecycle actions

The active selection toolbar and contextual menu provide Move to notebook,
Move to Trash, Duplicate (single only), Pin/Unpin (single only), Restore from
Trash, and Delete permanently as appropriate. `m` opens the notebook picker
only when a non-empty active-list selection is eligible.

Move and restore accept multiple selected notes. The current document bridge
applies one note mutation at a time, so this module must not falsely claim an
atomic transaction. It processes a normalized selection in a stable order and
returns an explicit outcome. On a failure, completed notes stay completed,
unprocessed notes remain selected, the dialog remains open, and the user sees
how many notes moved plus that the remainder can be retried. Successful
operations clear only the affected selection. Permanent deletion retains its
existing explicit confirmation.

### Navigation history

History records successful user-directed opens: list selection, preview
reference, new note, duplicate, and restore. It ignores repeated adjacent
opens, trims forward entries when a new branch is opened, and is not persisted
between launches. Programmatic fallback after archive/delete does not create a
history entry.

Back and Forward skip records that are no longer active (for example, archived
or permanently deleted notes). Their toolbar controls expose correct
`disabled`/`aria-disabled` state and dispatch the same command path as their
keyboard shortcuts.

## Storage and IPC boundary

No document schema change is needed. `LocalDocumentStore` already persists
pinning through Yjs, SQLite projection, and the outbox. This module only
changes active-query ordering to consume that existing durable field.

The default-notebook setting receives a narrow, typed application-settings
contract through the existing main/preload/renderer layering. It is stored
atomically in app data, never in a renderer-only memory cache, document Yjs
state, SQLite note row, or sync outbox. It has no filesystem path exposure to
the renderer.

## Success criteria

1. All note actions above arrive at a named organization command, preserve
   source provenance, and retain lifecycle safety under React Strict Mode.
2. New/duplicated notes use the documented contextual/default-notebook policy
and the configured choice survives restart.
3. Pin state survives reload, visibly renders, and sorts active notes first.
4. Multi-move/restore performs the requested work or reports partial progress
without silently losing the remaining selection.
5. Back/Forward works from toolbar and documented shortcuts, skips unavailable
notes, and does not interfere with preview or unrelated system shortcuts.
