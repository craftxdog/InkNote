# Technical Plan: organization-commands

## Objective

Implement the approved `organization-commands` capability as the first
command-driven vertical slice for content organization. The new-note control
and `Cmd/Ctrl+N` will dispatch one typed `note:new` command, which delegates
to the existing document-workspace creation callback. This establishes the
same command/keymap/lifecycle structure already used by the workspace-view
feature, without changing persistence or preview behavior.

## Evidence and scope boundary

The completed `organization-data-model` work supplies durable note and tag
metadata, but intentionally does not change organization UI behavior. The
capability map requires `organization-commands` before `note-organization`,
`notebook-taxonomy`, and `tag-taxonomy`.

The current implementation still has these direct paths:

- `WorkspacePage` creates a note directly for its new-note control and its
  capture-phase `Cmd/Ctrl+N` listener.
- `NotesPanel` owns direct keyboard listeners for archive and duplicate.
- `useWorkspaceViewCommands` demonstrates the existing safe runtime pattern:
  one renderer-local runtime plus a serialized activation/deactivation queue.

This slice changes only the first direct path: note creation. Archive,
duplicate, move, restore, permanent deletion, pinning, notebooks, tags,
search, templates, and any command palette remain separate approved modules.

## Design

```text
New-note button / Cmd-Ctrl+N / future palette
                    |
                    v
      useOrganizationCommands (React adapter)
       | lifecycle queue + current callback ref
       v
  organization-commands plugin (pure kernel consumer)
       | adds note:new and workspace.global mod-n
       v
         DocumentWorkspace.create()
```

### Command contract

- Define the stable command ID `note:new` and an explicit type guard in a
  feature-local model module.
- The pure plugin receives an asynchronous `onCreateNote` callback. Its
  command handler invokes it exactly once and leaves the invocation source
  (`menu`, `keymap`, `api`, or `context-menu`) intact for future policy and
  diagnostics.
- The plugin neither imports React nor accesses the document bridge, IPC,
  SQLite, or Electron directly.

### React lifecycle and keyboard adapter

- Create a renderer-local plugin runtime once per hook instance.
- Serialize activation and cleanup through one promise queue. Cleanup waits
  for an in-flight activation, and a failed activation is not followed by an
  invalid deactivation.
- Keep the latest `onCreateNote` callback in a ref, so a normal page re-render
  does not create another plugin activation or use a stale workspace callback.
- Make dispatch wait for initial activation and return `false` after cleanup;
  errors are deliberately reported at UI boundaries.
- Listen in the capture phase, resolve only normalized `mod-n` against the
  semantic `workspace.global` target, and call `preventDefault()` only for a
  matching, recognized organization command.

### Page routing

- Replace the page's direct `create()` call and direct `Cmd/Ctrl+N` branch
  with the typed organization dispatcher.
- Retain direct handling for navigation visibility, distraction-free mode,
  preferences, and all workspace-view bindings. In particular, this module
  adds no `Cmd/Ctrl+P` behavior and cannot consume it.

## Ordered implementation tasks

The executable checklist is in
[organization-commands.todo.md](organization-commands.todo.md).

1. Add failing pure-feature tests for `note:new`, provenance forwarding,
   `mod-n` resolution, and contribution disposal; then implement the command
   model and pure plugin.
2. Add failing hook tests for button/API dispatch, native key behavior,
   unmatched-key non-interference, and activation waiting; then implement the
   lifecycle-safe React adapter.
3. Add failing integration coverage for `WorkspacePage`; route the existing
   new-note control through the adapter and remove only the old `Cmd/Ctrl+N`
   page branch.
4. Run focused tests, the full quality gate, and a desktop smoke test under
   React Strict Mode. Record outcomes before starting a later organization
   module.

## Acceptance criteria

- The new-note control and `Cmd/Ctrl+N` each dispatch `note:new`, and that
  command invokes the current document-workspace creation callback exactly
  once.
- API/menu/keymap provenance reaches the plugin handler unchanged.
- The adapter prevents the native event only after its exact `mod-n` binding
  matches; unmatched keys, Alt-modified input, and `Cmd/Ctrl+P` are untouched
  by this module.
- Strict Mode reconnection never leaves duplicate `note:new` registrations,
  calls a stale callback, or produces `PLUGIN_LIFECYCLE_IN_PROGRESS`.
- No persistence, IPC, schema, migration, package, or preview-keymap change
  is made.

## Verification

- Focused unit and hook suites created for this capability.
- Existing workspace-view hook suite stays green.
- `npm run lint`, `npm run typecheck`, `npm run test:ci`, `npm run build`, and
  `npm run verify` pass.
- Manual Electron smoke test: new-note button and `Cmd/Ctrl+N` create one
  note each; preview controls retain their existing behavior; DevTools has no
  plugin-lifecycle error while mounting, unmounting, and remounting.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Strict Mode reconnects effects while activation is pending. | One runtime per hook, serialized lifecycle queue, cleanup that waits for activation, and an explicit Strict Mode test. |
| A page re-render re-registers the command or captures an old workspace callback. | Hold the callback in a ref; do not make plugin activation depend on callback identity. |
| The new key listener steals system or preview shortcuts. | Resolve only `mod-n`, reject Alt-modified keys, and prevent default only after a recognized keymap match. |
| This foundational slice expands into all note operations. | Limit command IDs and page routing to `note:new`; later actions belong to `note-organization`. |

## Out of scope

No command palette, `Cmd/Ctrl+P` changes, archive/duplicate/move commands,
pinning, notebook/tag CRUD, selection policy, database changes, IPC changes,
sync changes, or dependencies are included.
