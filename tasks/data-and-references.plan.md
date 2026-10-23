# Implementation plan: local data and note references

## Dependency graph

```text
typed data IPC contract
        |
        v
main-process backup/export service ----> Preferences data controls + notices
        |
        v
reference parser + formatter ----> editor completion ----> preview cards/navigation
        |
        v
shared syntax color tokens
```

## Architecture decisions

- SQLite remains the sole authoritative local store. Backups use the database's
  online backup API, avoiding unsafe copies of a live SQLite/WAL database.
- The configured backup folder stores an app-owned `data/inknote.sqlite` file
  and a small JSON manifest. Backup setup and every successful durable document
  operation refresh that snapshot.
- Restore accepts only that explicit layout, creates a pre-restore safety
  snapshot, then asks the renderer to reload after reopening the store.
- Markdown export is read-only and writes active notes underneath notebook
  hierarchy folders. It does not change local data.
- A reference is standard Markdown containing the app-local, immutable URL
  `inknote://note/<id>`. `[[` is an editor affordance that inserts this format;
  it is not stored as wiki-link syntax.
- Reference parsing stays pure. The preview uses a callback to open a document
  and does not navigate Electron to arbitrary URLs.

## Build order and checkpoints

### `data-management`

1. Define and test serializable data-management IPC types plus a narrow bridge.
2. Implement and test backup configuration/snapshot service with temporary
   directories.
3. Add main-process IPC authorization, native directory selection, restore
   handoff, and Markdown export.
4. Add Preferences data controls, confirmation modal, and success/error toast.

Checkpoint: focused data tests, typecheck, lint and a real Electron smoke run.

### `note-references`

5. Define and test reference URL parsing/formatting helpers.
6. Add the keyboard completion source, fed by the active document collection.
7. Render safe reference cards in preview and wire their open action into the
   document workspace.

Checkpoint: focused reference, editor and preview tests; typecheck and lint.

### `editor-theme`

8. Extend semantic light/dark syntax tokens and apply them to CodeMirror and
   preview code blocks.

Checkpoint: editor/preview tests, typecheck, lint, build and visual smoke.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Replacing a live SQLite file corrupts data | Close the store, validate the selected backup and replace atomically; create a pre-restore safety copy first. |
| Arbitrary path access from renderer | Keep all filesystem access behind authorized main-process IPC and native pickers. |
| Export loses notes with same title | Allocate deterministic filename suffixes. |
| A reference becomes invalid after rename | Address the note by ID and look up its current title at render time. |
| Vim keys collide with completion UI | Completion takes keyboard focus only while the `[[` menu is open; other Vim behavior remains untouched. |
