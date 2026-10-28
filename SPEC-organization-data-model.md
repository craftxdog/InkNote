# Spec: organization-data-model

Status: approved on 2026-10-25.

## Assumptions

1. InkNote continues to use SQLite with Yjs snapshots, updates, and its local outbox as the durable authority. Inkdrop's CouchDB-specific revision token is not adopted as a second revision system.
2. Existing user records, note references, ISO-8601 timestamps, opaque IDs, and configured backups remain valid. New records may use Inkdrop-style prefixes, but this module never rekeys existing records.
3. The goal is semantic compatibility for notes, notebooks, and tags, not a file-level or transport-level import/export compatibility promise.
4. A tag's persisted identity is separate from its display name. Existing note mutations keep their display-name tag arrays during this transition; the store resolves those names to durable tag IDs.
5. Sharing, attachments, templates, full-text search, command UI, and remote collection synchronization have separate specifications and remain out of scope.

## Objective

Strengthen InkNote's organization data model so its local SQLite/Yjs store represents the useful semantics of Inkdrop notes, notebooks, and tags without replacing a working local-first architecture.

The result is a normalized, migration-safe tag catalogue; durable note organization metadata; compatibility query indexes; and typed boundaries that later notebook and tag features can consume. A user upgrading an existing database must retain every note, notebook, tag association, CRDT record, trash state, and backup capability.

### In scope

- An additive, monotonic SQLite migration after the current schema version 7.
- Durable tag entities with a tag-prefixed ID, case-insensitive unique name, Inkdrop-compatible color token, and created/updated timestamps.
- Migration of note_tags from display-name associations to tag ID associations without altering the current Yjs tag arrays or losing unused tags.
- Additive note projection/Yjs metadata for Markdown doctype, pin state, and derived task totals.
- One shared, pure Markdown task counter used by both the main-process projection and note-list presentation, so persisted counts cannot drift from the displayed result.
- New-record ID factories that generate note:, book:, and tag: prefixes while validators continue accepting legacy non-empty IDs.
- Query indexes for active/trash, notebook, status, pinning, and tag lookups.
- Typed tag read contracts through repository, IPC, preload, and renderer adapters. The UI does not yet consume them.
- Transactional validation, the approved pre-migration preservation policy, and regression tests for the current database schema.

### Out of scope

- CouchDB/PouchDB, external revision tokens, HTTP synchronization, account identity, sharing, attachments, or arbitrary Inkdrop-plugin compatibility.
- Tag rename, recoloring, deletion, and editor/sidebar UI. Those are tag-taxonomy responsibilities.
- Notebook rename/reparent/icon editing and default-notebook preferences.
- Pin/unpin controls, note-list pin sorting, templates, navigation history, FTS, search qualifiers, Telescope, or new keyboard shortcuts.
- Rewriting existing note, notebook, or inknote:// reference IDs.

## Public behavior

### Durable identities and timestamps

New IDs are generated with these prefixes:

- note:<random> for notes;
- book:<random> for user-created notebooks; and
- tag:<random> for tag entities.

inbox remains the stable built-in notebook ID. Validators accept both new prefixed IDs and legacy non-empty IDs so an existing workspace, test fixture, or existing inknote://note/<id> reference keeps working.

InkNote continues to store and expose ISO-8601 timestamps. Inkdrop's public API represents timestamps as Unix milliseconds, but that is an external document API convention rather than a reason to rewrite InkNote's local date contract. Any future interchange adapter performs conversion at its boundary.

### Tag catalogue and association migration

The durable schema becomes:

~~~text
tags(
  id TEXT PRIMARY KEY,             -- tag:<random>
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  color TEXT NOT NULL,             -- one supported TagColor token
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)

note_tags(
  note_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (note_id, tag_id)
)
~~~

note_tags.note_id and note_tags.tag_id use restrictive foreign keys. A future tag deletion must remove its associations inside one transaction before removing the tag. The migration preserves zero-count tag rows because a tag catalogue may intentionally contain an unused tag.

The next migration creates replacement tables, copies each legacy tag once with a generated tag: ID, remaps every association, verifies referential integrity, swaps the tables, creates indexes, and records its schema version only after the transaction succeeds. Failure leaves the prior schema version and tables intact. Before opening the migratable store, the approved startup preflight creates one online SQLite safety snapshot in the app-data directory if this migration remains pending. The snapshot is retained and its location is surfaced through Preferences.

The Yjs array inside a note continues to hold normalized tag display names in this module. Whenever a note projection is written, the store resolves each name to a catalogue row, creates a default-color row if needed, and writes the matching tag ID relation. This deliberately bridges existing note mutations; tag-taxonomy later owns bulk rename/delete propagation through Yjs.

### Typed domain contracts

The shared document model adds opaque TagId, TagColor, Tag, and TagSummary contracts. TagSummary.count is an immutable query result, calculated from active, non-trashed note associations; it is not a mutable counter column.

~~~ts
export type TagColor =
  | 'default'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'olive'
  | 'green'
  | 'teal'
  | 'blue'
  | 'violet'
  | 'purple'
  | 'pink'
  | 'brown'
  | 'grey'
  | 'black';

export type TagSummary = Readonly<{
  id: TagId;
  name: string;
  color: TagColor;
  count: number;
  createdAt: string;
  updatedAt: string;
}>;
~~~

NoteDocument gains the following projection fields:

- doctype: markdown;
- pinned: boolean; and
- numOfTasks plus numOfCheckedTasks, both non-negative integers.

These fields are validated at IPC and repository boundaries, returned for all migrated records, and default safely for legacy test-only DTOs during the additive contract transition. pinned has a typed document mutation so its later UI action uses the same Yjs/outbox transaction as title and body edits.

Task totals are recalculated after every body mutation from Markdown task list syntax, excluding fenced code. They are derived projection values: users never edit them directly.

DocumentQueryRepository gains listTags(): Promise<readonly TagSummary[]>. That read operation flows through the existing typed IPC/preload bridge. No tag mutation is exposed until tag-taxonomy specifies its lifecycle and confirmation policy.

### Notebook and query semantics

Notebooks retain their existing local hierarchy and optional icon. New user notebooks receive book: IDs, while inbox and legacy IDs remain accepted. Notebook counts are query-derived for direct, non-trashed notes; a counter is not persisted because a denormalized count can diverge during CRDT or trash transitions.

The migration adds indexes that serve the established query shapes:

- active/trash notes ordered by pin and modification time;
- notes by notebook and trash state;
- notes by status and trash state; and
- tag-to-note and note-to-tag association lookups.

There is intentionally no foreign key from notes.notebook_id to notebooks.id: archived notes retain their former notebook ID after deleting a notebook so they can be restored without inventing a new destination. The repository validates active notebook placement and continues to reparent children before deleting a notebook.

## Tech stack

- Electron 44.4.0, React 19.3.0, TypeScript 7.0.2, and Jest 30.5.1.
- better-sqlite3 13.0.3 for the main-process store.
- Yjs 13.6.33 for note authority, snapshots, updates, and the future-sync outbox already owned by LocalDocumentStore.
- No new runtime dependency.

## Commands

Development:

~~~sh
npm start
~~~

Focused tests after implementation:

~~~sh
npm test -- --runInBand src/__tests__/main/documents/LocalDocumentStore.test.ts
npm test -- --runInBand src/__tests__/shared/documents
npm test -- --runInBand src/__tests__/platform/documents
~~~

Quality checks:

~~~sh
npm run lint
npm run typecheck
npm run test:ci
npm run verify:native-sqlite
npm run build
npm run verify
~~~

## Project structure

~~~text
src/shared/documents/
  document.types.ts          # Note/tag DTOs, branded IDs, and mutations
  document.query.ts          # Typed read ports including tag summaries
  document.repository.ts     # Durable note write port
  document.ipc.ts            # Serializable validated result shape
  taskProgress.ts            # Pure Markdown task-count projection
src/main/documents/
  LocalDocumentStore.ts      # SQLite migration, projection, indexes, joins
  DocumentIpcService.ts      # Validates and exposes typed tag reads
src/shared/bridge.ts         # Renderer-safe typed listTags bridge
src/main/preload.ts          # Narrow Electron implementation of the bridge
src/renderer/platform/documents/
  IpcDocumentRepository.ts   # Renderer adapter for tag query DTOs
src/__tests__/
  main/documents/            # Migration, transaction, and store tests
  shared/documents/          # DTO, validation, and task-counter tests
  platform/documents/        # IPC adapter and query-contract tests
SPEC-organization-data-model.md
~~~

## Code style

- Keep type definitions, runtime validation, repository ports, IPC adapters, and SQLite implementation in their existing layers.
- Prefer additive DTO fields and branded IDs over a string convention enforced only by UI code.
- Validate untrusted IPC input at the service boundary; internal store methods consume typed values.
- Use short SQLite transactions, prepared statements, and explicit schema migration records. Do not embed user data in SQL strings.
- Make derived task parsing a pure shared function.

~~~ts
export type TagSummary = Readonly<{
  id: TagId;
  name: string;
  color: TagColor;
  count: number;
  createdAt: string;
  updatedAt: string;
}>;

export interface TagQueryRepository {
  listTags(): Promise<readonly TagSummary[]>;
}
~~~

## Testing strategy

| Level | Coverage |
| --- | --- |
| Domain | Tag colors, tag: IDs, legacy ID acceptance, note metadata defaults, pin mutation validation, and Markdown task totals. |
| SQLite migration | A schema-version-7 fixture migrates tags, associations, notes, notebooks, CRDT snapshots/updates, trash state, and unused tags without loss. |
| Transaction failure | Injected migration or association-copy failure rolls back tables and leaves the prior migration record intact. |
| Projection | Title/body/tag/pin mutations update Yjs, note projection, outbox, task totals, and ID-based tag links consistently. |
| Query/IPC | listTags returns validated immutable summaries with correct active-note counts and never leaks a database handle. |
| Backup/regression | A configured backup after migration contains a readable upgraded SQLite database; existing export and restore tests continue to pass. |
| Full verification | Run lint, typecheck, serial Jest suite, native SQLite verification, renderer build, and npm run verify. |

## Boundaries

- Always: preserve existing records and links; use one transaction per migration; verify foreign keys before recording the version; keep Yjs and SQLite projections coherent; refresh configured backups after new durable writes; test migration from the real prior schema.
- Ask first: add a dependency; alter remote-sync/outbox semantics; change timestamp representation; rekey existing records; expose tag writes to the renderer; add sharing, attachment, encryption, or a CouchDB/PouchDB engine.
- Never: drop an old table before copied rows and associations are verified; silently collapse case-distinct tags; turn a derived count into a user-editable field; expose SQL, filesystem paths, or database handles to the renderer; break legacy inknote:// references.

## Success criteria

1. An existing schema-version-7 database upgrades atomically with no lost note, notebook, tag, association, Yjs history, or trash record.
2. Tags have stable tag: identities, validated colors, timestamps, and correctly derived active-note counts; their SQLite associations use IDs.
3. Existing notes continue to display and edit their tag names while the store maintains the ID-based relation required by future tag lifecycle features.
4. New notes and user-created notebooks use note: and book: IDs without invalidating legacy IDs or inknote:// links.
5. Every note projection exposes Markdown doctype, pin state, and correct task totals, all derived through one shared task parser.
6. Tag queries cross only typed repository/IPC/preload boundaries, and the renderer never gains SQLite or Electron privileges.
7. The focused and full verification commands pass after implementation.

## Approved data protection policy

- When the organization-data-model migration is pending, startup creates one
  automatic online SQLite snapshot under the app-data directory before
  migration, in addition to any configured backup. It is retained after a
  successful upgrade and its location is visible in Preferences. A failed
  snapshot stops startup before any migration runs.

## Sources

- https://developers.inkdrop.app/data-access/notes
- https://developers.inkdrop.app/data-access/books
- https://developers.inkdrop.app/data-access/tags
- https://docs.inkdrop.app/reference/search-and-filter-notes
