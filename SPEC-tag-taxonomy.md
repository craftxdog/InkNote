# Spec: Tag taxonomy

Status: proposed on 2026-10-26. This specification defines the
`tag-taxonomy` module already approved by
[SPEC-content-organization-map.md](SPEC-content-organization-map.md). A
separate technical plan and task checklist require approval before any source
implementation begins.

## Assumptions

1. InkNote remains a local-first Electron application. SQLite owns the durable
   tag catalogue and its relational projection; Yjs remains the authority for
   each note's editable tag-name array and its sync/outbox history.
2. InkNote preserves its existing normalized, case-insensitive tag-name
   behavior for compatibility. A new or renamed tag has a trimmed,
   non-empty canonical name of at most 64 characters; legacy catalogue rows
   remain readable even if a historic name exceeds that new-input limit.
3. Inkdrop's documented tag identity, 14-color vocabulary, timestamps, and
   lifecycle model are semantic references. InkNote does not add CouchDB,
   PouchDB, `_rev`, remote synchronization, or a second storage engine.
4. Deleting a tag from InkNote is an explicit destructive catalogue action:
   it removes the association from every note that has it, including archived
   notes, and deletes the catalogue row only after that propagation succeeds.
   This differs from Inkdrop's low-level `remove()` caveat because leaving
   InkNote's Yjs arrays unchanged would recreate the tag on the next
   projection rebuild.
5. This module adds no global keyboard shortcut, command palette, template,
   search qualifier, note-reference, or notebook behavior. Existing editor
   add/remove-tag controls continue to work.

## Objective

Let a writer manage a persistent tag catalogue in the same useful shape as
Inkdrop: a stable `tag:` identity, normalized name, color, timestamps, and a
derived active-note count. In addition to the existing editor-driven creation
of default-color tags, the writer can create a catalogue tag, edit its name
and color, and deliberately delete it with a clear account of which note
associations will be removed.

All tag lifecycle actions pass through InkNote's existing lifecycle-safe
organization command runtime and typed main/preload/renderer boundary. The
sidebar renders the durable catalogue (including zero-count tags), uses the
saved color rather than a name-derived color, and refreshes the visible
selection coherently after accepted changes. Renderer components remain
unprivileged and never receive SQLite, Node, filesystem, or Electron access.

## Existing baseline and gap

| Area | Already implemented | This module adds |
| --- | --- | --- |
| Durable model | `tag:` IDs for newly projected rows; 14 persisted colors; timestamps; case-insensitive unique name; active-note count query | Validated tag create/update/delete contracts and lifecycle transactions |
| Note association | Editor updates normalized tag names through existing Yjs document mutations; SQLite rebuilds relational links | Safe bulk propagation for rename/delete so Yjs and the projection cannot diverge |
| Renderer read path | Authorized `listTags` IPC/preload/repository query revalidates immutable `TagSummary` values | A bounded tag write port and workspace tag state refreshed from accepted results |
| Sidebar | Filters note-derived names, hashes a display color, and hides zero-count catalogue rows | Durable catalogue rows, stored colors, create/edit/delete affordances, and accessible errors/confirmation |
| Commands | Lifecycle-safe organization runtime with note and notebook command IDs | Typed `tag:*` intents, provenance preservation, and no new keymap |

## User-visible behavior

### Catalogue and colors

- The Tags sidebar lists the durable tag catalogue in case-insensitive name
  order, including tags whose active count is zero. Counts remain derived from
  active notes; archived notes never inflate the visible count.
- Each row uses its persisted color from the existing `TAG_COLORS` vocabulary:
  `default`, `red`, `orange`, `yellow`, `olive`, `green`, `teal`, `blue`,
  `violet`, `purple`, `pink`, `brown`, `grey`, or `black`.
- Creating a tag supplies a non-empty, unique normalized name and defaults to
  `default` color unless the form explicitly chooses another supported color.
  Adding the same name through the existing note editor continues to reuse the
  catalogue row rather than creating a duplicate.
- Editing a tag presents a labelled, keyboard-accessible name and color form.
  Saving keeps its ID and `createdAt`, changes `updatedAt`, and either updates
  color only or renames the tag everywhere it is associated.

### Rename and deletion safety

- A rename is rejected if its canonical name belongs to a different tag. It
  never silently merges two tags. Invalid ID, whitespace name, overlong new
  name, unsupported color, malformed timestamp, or duplicate name leaves the
  catalogue and every note unchanged.
- Deleting a tag asks for explicit confirmation and describes that it will
  remove the tag from all of its associated notes. The confirmation is still
  shown when its active count is zero because archived notes may be affected.
- Accepted rename/delete operations update all relevant note Yjs tag arrays,
  the local relational projection, and durable outbox state as one logical
  operation. A failure rolls back the whole request; it must not leave an old
  name in Yjs or an orphaned/partially deleted catalogue row.
- After a rename the sidebar row, note tags, active tag filter, and current
  selected tag label use the accepted name. After deletion, the sidebar and
  selection fall back to All Notes when the removed tag was selected.

### Commands and navigation

- Create, edit, delete, and open/select intents dispatch typed `tag:*`
  commands through the existing organization plugin. The plugin retains
  `menu`, `context-menu`, and API provenance and owns no React, Electron,
  SQLite, note, or selection state.
- No new global keybinding is introduced. `Cmd/Ctrl+N`, `Cmd/Ctrl+P`, preview,
  history, editor input, and current note commands retain their existing
  behavior.
- Existing tag filtering remains scoped to a selected notebook where that
  selection already supports it. This module changes its source from a
  note-derived ad-hoc list to the persisted catalogue, not its filtering
  semantics.

## Typed contract

The catalogue write port uses explicit complete inputs for mutable properties;
it does not overload a note mutation or expose a database operation. IDs and
responses are always validated at shared, IPC, and renderer boundaries.

```ts
export type CreateTagInput = Readonly<{
  id: TagId;
  name: string;
  color: TagColor;
  occurredAt: string;
}>;

export type UpdateTagInput = Readonly<{
  id: TagId;
  name: string;
  color: TagColor;
  occurredAt: string;
}>;

export type DeleteTagInput = Readonly<{
  id: TagId;
  occurredAt: string;
}>;

export type DeleteTagResult = Readonly<{
  deletedTagId: TagId;
  affectedNoteIds: readonly NoteId[];
}>;

export interface TagRepository extends TagQueryRepository {
  createTag(input: CreateTagInput): Promise<TagSummary>;
  updateTag(input: UpdateTagInput): Promise<TagSummary>;
  deleteTag(input: DeleteTagInput): Promise<DeleteTagResult>;
}
```

The main-process handler authorizes the sender and refreshes the configured
backup only after an accepted write. It returns the established serializable
document IPC result envelope. The preload bridge exposes precisely the three
tag operations and no path, SQL, raw database, or bulk-document capability.

## Tech stack

- Electron 44.4.0, React 19.3.0, TypeScript 7.0.2, and Jest 30.5.1.
- better-sqlite3 13.0.3 and the existing Yjs document/outbox path in the
  main-process `LocalDocumentStore`.
- Existing `PluginManager`, command registry, and keymap registry for
  lifecycle-safe command registration.
- No new runtime dependency and no schema migration are assumed. A migration
  discovery during the approved planning phase must stop for authorization.

## Commands

Development:

```sh
npm start
```

Focused tests during implementation:

```sh
npm test -- --runInBand src/__tests__/shared/documents/document.types.test.ts
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
src/shared/documents/document.types.ts           # tag DTOs, validation, result types
src/shared/documents/document.query.ts           # explicit tag query/write ports
src/shared/bridge.ts                             # narrow tag lifecycle API
src/shared/ipc/channels.ts                       # tag lifecycle IPC channels
src/main/documents/LocalDocumentStore.ts         # atomic catalogue/Yjs/projection changes
src/main/documents/DocumentIpcService.ts         # untrusted IPC validation
src/main/main.ts                                 # sender authorization and backup refresh
src/main/preload.ts                              # limited preload forwarding
src/renderer/platform/documents/IpcDocumentRepository.ts
src/renderer/platform/documents/useDocumentWorkspace.ts
src/renderer/features/organization/              # tag command IDs, request parser, routing
src/renderer/features/navigation/                # catalogue sidebar and tag editor/dialog
src/__tests__/main/documents/                    # durable and IPC tests
src/__tests__/platform/documents/                # renderer transport/workspace tests
src/__tests__/features/organization/             # command lifecycle tests
src/__tests__/features/navigation/               # accessible catalogue UI tests
```

## Code style

- Use named exports, `Readonly` DTOs, branded `TagId`/`NoteId`, immutable
  validated values, explicit public return types, and the existing document
  IPC envelope.
- Keep tag commands and request parsing pure. The React adapter only bridges
  current workspace callbacks through the already serialized organization
  runtime.
- Keep the durable operation small and transactional: validate first, derive
  the affected note set once, apply canonical Yjs/outbox changes and
  relational projections together, then return the accepted immutable result.
- Keep presentation components focused: the workspace owns durable request
  construction and refresh; the tag form owns only draft state, focus,
  validation feedback, and confirmation.

```ts
export const updateTag = async (
  input: UpdateTagInput,
): Promise<TagSummary> => {
  const accepted = validateUpdateTagInput(input);

  return updateTagTransaction(accepted);
};
```

## Testing strategy

| Level | Required evidence |
| --- | --- |
| Domain | Tag IDs, colors, names, timestamps, legacy reads, complete inputs, and delete result validation accept valid values and reject malformed/duplicate requests. |
| SQLite/Yjs | Create, recolor, rename, and delete are atomic; rename/delete update active and archived note tag arrays plus projections/outbox; errors preserve prior rows and documents. |
| IPC/preload | Unauthorized senders and malformed payloads return the standard safe failure; renderer responses are revalidated and expose no privileged objects. |
| Workspace | Accepted catalogue results refresh tags and related note projections; failures keep visible state intact. |
| Commands | `tag:*` registrations are single-instance under Strict Mode, preserve provenance, reject bad details, dispose cleanly, and consume no new keys. |
| UI | Stored colors and zero-count rows render correctly; forms have labels/focus/error states; filtering, current selection, confirmation, and fallback behave accessibly. |
| Regression | Existing editor tag add/remove, note list tags, data export/backup, notebook behavior, preview, and current shortcuts remain green. |
| Human smoke | A fresh empty test tag can be created, recolored, renamed, assigned to a disposable note, deleted after confirmation, and verified absent without modifying existing user notes. |

## Boundaries

- **Always:** preserve existing tag IDs and supported colors; validate at
  shared/IPC/renderer boundaries; retain the renderer privilege boundary;
  refresh backups after accepted writes; derive counts; make destructive UI
  explicit and keyboard accessible; add focused regression coverage before
  refactoring a direct tag path.
- **Ask first:** add a dependency; add or modify a schema migration; change
  the delete-propagation semantics; add a global shortcut; change public
  plugin-kernel behavior; alter backup/restore/export policy; introduce a
  remote tag sync/revision protocol; or change normalized tag-name semantics.
- **Never:** expose SQLite, Node, Electron, SQL, or filesystem access to the
  renderer; leave a rename/delete only half-propagated between Yjs and SQLite;
  silently merge duplicate tags; mutate user notes merely to recolor a tag;
  use a name-derived display color for a persisted catalogue row; or expand
  this module into templates, search, note references, or notebooks.

## Success criteria

1. The sidebar uses the durable catalogue and stored color, includes
   zero-count tags, and preserves existing tag filtering behavior.
2. A writer can create, rename, recolor, and explicitly delete tags through
   accessible command-routed UI; accepted results persist after refresh.
3. Renaming or deleting a tag cannot leave stale tag names in a note's Yjs
   array, its relational projection, or its durable outbox state.
4. Invalid or duplicate lifecycle requests fail without changing the
   catalogue, any note association, selection, or configured backup.
5. Tag command lifecycle and all existing shortcuts remain safe under React
   Strict Mode, with no new global key interception.
6. Focused and complete quality gates pass, followed by a user-safe Electron
   smoke review using only disposable test data.

## Open questions

- None block the specification. The detailed technical plan must confirm that
  `LocalDocumentStore` can batch the required Yjs/outbox propagation without
  a schema migration. If not, that discovery requires approval before source
  work changes the schema.

## Sources

- User-provided Inkdrop tag reference:
  `/Users/craftzdog/.codex/attachments/bcbbefc3-c125-4736-a60e-ccd377914870/Pasted text.txt`.
- Existing approved module boundary:
  [SPEC-content-organization-map.md](SPEC-content-organization-map.md).
- Existing data and command boundaries:
  [SPEC-organization-data-model.md](SPEC-organization-data-model.md) and
  [SPEC-organization-commands.md](SPEC-organization-commands.md).
