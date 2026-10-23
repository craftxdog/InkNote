# Spec: `local-first-store`

Status: implemented for local persistence and renderer-to-main IPC on
2026-10-21. A remote transport is intentionally not implemented yet.

## Objective

Implement the main-process persistence boundary for InkNote. It must accept
document intents from the renderer through a narrow IPC bridge, keep notes
available while offline, and durably record the Yjs updates that a future sync
adapter will exchange between the user's own devices.

## Prerequisites

- The packaged application must own, externalize, rebuild, and smoke-test its
  native SQLite dependency on macOS, Windows, and Linux.
- The Yjs dependency and version must be added deliberately with its package
  lock update reviewed.
- Electron security defaults, a typed preload bridge, and serializable result
  DTOs must exist before any database operation is exposed to the renderer.

## Boundaries

- `src/main` owns SQLite connections, migrations, Yjs documents, and all
  durable writes.
- `src/preload` exposes only validated document methods; it never exposes a
  path, SQL statement, database handle, or secret.
- `src/renderer` receives immutable DTOs through a `DocumentRepository`
  adapter. It never imports a native database package.
- `src/shared/documents` owns serializable domain DTOs and error codes, but not
  Electron or SQLite implementations.
- Local storage has no network dependency. Sync is an injected later consumer
  of the durable outbox.

## Data model

`notes` is a query projection, not the authority for collaborative text.
`note_crdt_snapshots` and `note_crdt_updates` retain the authority needed to
rebuild a Yjs document. `sync_outbox` references local updates with stable
envelope IDs and retry state. See ADR 002 for compaction and idempotency rules.

`title` and `body` are Yjs text values; creation/deletion/timestamps are kept
in a Yjs metadata map. `replace-body` is translated to a main-process Yjs
transaction. The update emitted by Yjs, not the original replacement request,
is written to the outbox. Metadata mutations use the same transaction and must
not silently overwrite CRDT text.

## Required operations

```ts
interface DocumentRepository {
  get(id: NoteId): Promise<NoteDocument | null>;
  apply(mutation: DocumentMutation): Promise<NoteDocument>;
}
```

The renderer implementation of this existing port invokes a preload method and
maps a `DocumentIpcResult` into a document or reconstructed domain error.
Main-process handlers validate the DTO before opening the repository.

## Atomicity and ordering

For a local mutation, one short SQLite transaction must:

1. load or rebuild the note Yjs state;
2. apply the typed editor intent;
3. obtain the emitted Yjs update and refresh the note projection;
4. append the update; and
5. insert an outbox envelope for that update.

Only after commit may the handler return the projection. Mutation IDs and
outbox IDs make retries idempotent. Remote updates follow the same projection
and append path but do not enqueue an outgoing envelope.

The current implementation enables SQLite foreign keys, WAL mode, a bounded
busy timeout, and `NORMAL` synchronous mode. It stores schema version `1` in
`schema_migrations`; future schema changes must be additive migrations rather
than edits to the initial-schema branch.

## Non-goals for this slice

- No direct Supabase/Appwrite client, HTTP request, or remote credential.
- No arbitrary SQL exposed by IPC.
- No multi-user sharing UI, presence, or awareness state.
- No at-rest encryption policy without a separate decision on keys and
  recovery.
- No FTS, attachment, or tag implementation until their schemas and retention
  rules are specified.

## Acceptance criteria

- Opening and changing a note works without network access and survives app
  restart.
- Concurrent changes produced from two independent Yjs replicas converge.
- Each local accepted update has exactly one durable outbox envelope; retries
  do not duplicate it.
- A simulated database failure rolls back projection, update, and outbox
  together.
- IPC rejects malformed requests and returns serialized error DTOs.
- Native database loading is verified in packaged macOS, Windows, and Linux
  builds before release.

## Current verification

- Unit tests cover restart persistence, idempotent local and remote updates,
  Yjs convergence, active-note queries, no remote-update echo, and transaction
  rollback on stale revisions and outbox insertion failure.
- The Electron smoke test opens the real main-process store through the
  restricted preload bridge and checks that active-note listing is serializable.
- Release packaging and the native SQLite loading check run in the project
  verification command. Cross-platform release artifacts still need CI runners
  for every target before a public release.
