# Spec: Notebook taxonomy

Status: approved on 2026-10-26. This specification implements the
`notebook-taxonomy` module already approved in
[SPEC-content-organization-map.md](SPEC-content-organization-map.md). The
technical plan and task checklist require approval before implementation.

## Assumptions

1. InkNote remains a local-first Electron application: SQLite owns notebook
   metadata, while Yjs remains the authority for note content and note
   lifecycle mutations.
2. Existing `notebooks` columns (`id`, `name`, `parent_id`, `icon`,
   `created_at`, and `updated_at`) are sufficient; this module requires no
   database migration.
3. The currently approved delete policy remains unchanged: Inbox is
   undeletable, direct active notes are moved to Trash, and direct children
   are lifted to the deleted notebook's parent.
4. Inkdrop's notebook identifiers and metadata guide semantic compatibility,
   but InkNote does not adopt CouchDB revisions or replace its local storage
   model.
5. Notebook edits are explicit user actions. This module adds no global
   keyboard shortcut, command palette, template, tag, search, remote-sync, or
   sharing behavior.

## Objective

Let a writer manage existing notebooks with the same useful model documented
by Inkdrop: a durable `book:`-style identity, name, optional parent,
optional icon, and derived note count. In addition to the already available
creation and deletion flows, the writer can rename a notebook, choose or
clear its icon, and move it within the valid notebook tree without creating
cycles.

Every notebook lifecycle action flows through the existing command registry
and the typed main/preload/renderer boundary. The sidebar and notebook-detail
views reflect the accepted durable notebook immediately, retain accessible
empty/error/confirmation states, and never expose SQLite, Electron, or file
system capability to renderer components.

## Existing baseline and gap

| Area | Already implemented | This module adds |
| --- | --- | --- |
| Durable model | `book:` IDs for new notebooks; name, parent, icon, timestamps; SQLite list/create/delete | Validated update contract and atomic durable update |
| Tree integrity | Creation verifies the chosen parent exists; deletion reparents direct children | Reparent validation that rejects Inbox moves, self-parenting, descendants, and missing parents |
| UI | Sidebar creation, nested creation, details, icons, direct-note counts, and deletion confirmation | An accessible edit surface for name, parent, and icon; command-routed lifecycle actions |
| Commands | Lifecycle-safe organization runtime and note commands | Typed notebook command contribution with no new global shortcut |
| Data safety | Authorized IPC, backup refresh after notebook writes, transactional deletion | The same authorization, backup refresh, immutable validation, and atomicity for update |

## User-visible behavior

### Notebook editing

- An editable notebook can be opened from its existing detail/context
  affordance and saved with a non-empty trimmed name, a valid parent, and an
  optional icon.
- The parent chooser includes the library root and excludes the edited
  notebook and every descendant. It never offers Inbox as a child notebook.
- Choosing `No icon` clears an existing icon. Choosing a supported icon
  persists it. Unsupported icons, empty names, missing parents, self-parenting,
  and cycles produce actionable errors and leave the prior notebook unchanged.
- Inbox can be opened and counted but cannot be renamed, reparented,
  re-iconed, or deleted by this module.
- Existing legacy notebook IDs remain valid. New notebooks continue to use
  the existing generated `book:` prefix.

### Command and navigation behavior

- Create, edit, delete, and open-detail intents dispatch typed
  `notebook:*` commands through the existing lifecycle-safe organization
  runtime. Components do not call a durable notebook mutation directly.
- The command contribution registers and disposes atomically with the current
  organization plugin. Its handlers preserve menu, context-menu, and API
  provenance.
- There is deliberately no new globally intercepted keybinding. Current
  `Cmd/Ctrl+N`, preview, navigation, history, and platform shortcuts remain
  unchanged.
- After a successful update, the workspace refreshes its notebook projection,
  preserves a valid focused selection, and renders the renamed/reparented
  notebook in its durable tree location.

### Counts and deletion

- Sidebar and detail counts remain query-derived from active direct notes;
  this module adds no mutable notebook counter.
- Deletion keeps the existing explicit confirmation and transactional policy.
  The confirmation describes the direct-note archive and child reparenting
  outcome before the destructive command is dispatched.
- A successful create, update, or delete remains a durable main-process write
  and refreshes a configured SQLite backup through the existing handler path.

## Typed contract

The update uses a full, validated replacement of mutable notebook properties.
`null` is meaningful only for clearing an icon or returning to the root; it
does not mean an omitted field.

```ts
export type UpdateNotebookInput = Readonly<{
  id: string;
  name: string;
  parentId: string | null;
  icon: NotebookIconName | null;
  occurredAt: string;
}>;

export interface NotebookRepository {
  createNotebook(input: CreateNotebookInput): Promise<Notebook>;
  updateNotebook(input: UpdateNotebookInput): Promise<Notebook>;
  deleteNotebook(input: DeleteNotebookInput): Promise<DeleteNotebookResult>;
}
```

Validation takes place at the shared domain boundary and again after IPC's
structured clone in the renderer adapter. The main-process handler authorizes
the sender, invokes the service, and returns the existing serializable result
envelope. No database handle, SQL string, filesystem path, or Electron object
crosses preload.

## Tech stack

- Electron 44.4.0, React 19.3.0, TypeScript 7.0.2, and Jest 30.5.1.
- better-sqlite3 13.0.3 for the main-process SQLite repository.
- Existing `PluginManager`, command registry, and keymap registry for
  lifecycle-safe command registration.
- No new runtime dependency and no schema migration.

## Commands

Development:

```sh
npm start
```

Focused tests during implementation:

```sh
npm test -- --runInBand src/__tests__/main/documents/LocalDocumentStore.test.ts
npm test -- --runInBand src/__tests__/main/documents/DocumentIpcService.test.ts
npm test -- --runInBand src/__tests__/platform/documents/IpcDocumentRepository.test.ts
npm test -- --runInBand src/__tests__/features/organization
npm test -- --runInBand src/__tests__/features/navigation
```

Completion checks:

```sh
npm run lint
npm run typecheck
npm run test:ci
npm run verify:native-sqlite
npm run build
npm run verify
```

## Project structure

```text
src/shared/documents/document.types.ts          # update DTO and validation
src/shared/documents/document.query.ts          # existing notebook write port
src/shared/bridge.ts                            # narrow updateNotebook API
src/shared/ipc/channels.ts                      # update-notebook channel
src/main/documents/LocalDocumentStore.ts        # transactional update/cycle checks
src/main/documents/DocumentIpcService.ts        # untrusted IPC validation
src/main/main.ts                                # sender authorization + backup refresh
src/main/preload.ts                             # limited preload forwarding
src/renderer/platform/documents/IpcDocumentRepository.ts
src/renderer/platform/documents/useDocumentWorkspace.ts
src/renderer/features/organization/             # notebook command IDs/plugin routing
src/renderer/features/navigation/               # accessible edit/detail/context UI
src/__tests__/main/documents/                   # repository and IPC tests
src/__tests__/platform/documents/               # renderer transport tests
src/__tests__/features/organization/            # command lifecycle tests
src/__tests__/features/navigation/              # editing and keyboard UI tests
```

## Code style

- Use named exports, `Readonly` DTOs, explicit return types at public
  boundaries, immutable validated values, and the existing document IPC
  result envelope.
- Keep pure command IDs/plugin contribution separate from the React command
  adapter; serialize plugin activation/deactivation through the existing
  organization runtime.
- Use prepared SQLite statements and one short transaction for a notebook
  update. Validate the final parent graph before persisting it.
- Keep presentation components focused: the workspace action owns durable
  request construction; the navigation edit surface owns only transient form,
  focus, error, and confirmation state.

```ts
export const updateNotebook = async (
  input: UpdateNotebookInput,
): Promise<Notebook> => {
  const accepted = validateUpdateNotebookInput(input);

  return updateNotebookTransaction(accepted);
};
```

## Testing strategy

| Level | Required evidence |
| --- | --- |
| Domain | Validation accepts legacy/book IDs and valid icon clearing; rejects empty names, Inbox mutations, bad icons, self-parenting, missing parents, and cycles. |
| SQLite | Update is atomic, keeps timestamps coherent, preserves notebook IDs/direct-note associations, and leaves prior data unchanged on validation failure. |
| IPC/preload | Untrusted input/senders receive the standard safe failure; typed renderer responses are revalidated and never expose privileged objects. |
| Commands | Create/edit/delete/open register once, preserve provenance, dispose under Strict Mode without lifecycle errors, and do not consume unrelated or global keys. |
| UI | Keyboard-accessible edit controls display valid parents only; success refreshes tree/detail selection; cancellation/error leaves durable and visible state coherent. |
| Regression | Existing create/delete semantics, direct-note count rendering, configured backup refresh, data export, and note shortcuts remain green. |
| Human smoke | A clean Electron profile verifies rename, reparent, icon clear/set, prohibited cycle/Inbox actions, delete confirmation, and backup-safe persistence. |

## Boundaries

- **Always:** retain existing notebook and note IDs; validate at domain and IPC
  boundaries; keep renderer unprivileged; use explicit confirmation for
  deletion; preserve backup refresh; derive counts; retain keyboard access and
  visible error states; add focused regression tests before refactoring each
  direct UI mutation.
- **Ask first:** add a dependency; add or modify a database migration; change
  deletion/archive semantics; add a global shortcut; modify the public plugin
  kernel; change backup/restore/export policies; introduce remote notebook
  sync or a revision protocol.
- **Never:** let Inbox be edited/deleted/reparented; create a cyclic tree;
  delete or move notes as an incidental edit side effect; persist a mutable
  notebook count; bypass the command/IPC boundary; expose SQLite, Node, or
  Electron APIs to the renderer; alter tags, search, templates, or note
  references in this module.

## Success criteria

1. A writer can rename a non-Inbox notebook, select a permitted parent, and
   set or clear its icon; the durable result survives a workspace refresh.
2. Invalid edits fail safely without altering the existing notebook, its
   hierarchy, or its note associations.
3. The notebook tree cannot acquire self-links or cycles, and valid child
   notebooks relocate deterministically after a parent edit.
4. Creation, edit, deletion, and opening flow through one lifecycle-safe
   notebook command contribution without adding a global shortcut or
   regressing existing shortcuts.
5. Notebook counts remain derived, deletion behavior remains explicit and
   transactional, and all durable notebook writes preserve configured backup
   refresh behavior.
6. Focused and complete automated checks pass, followed by a clean-profile
   Electron smoke review.

## Sources

- User-provided Inkdrop notebook reference: `/Users/craftzdog/.codex/attachments/74c522da-dc18-49e9-b022-83dfaa1a5af8/Pasted text.txt`.
- Existing approved boundaries: [SPEC-content-organization-map.md](SPEC-content-organization-map.md), [SPEC-organization-data-model.md](SPEC-organization-data-model.md), and [SPEC-organization-commands.md](SPEC-organization-commands.md).
