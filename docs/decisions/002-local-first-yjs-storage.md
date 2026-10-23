# ADR 002: Persist note content as Yjs state from the first local store

- Status: accepted
- Date: 2026-10-20

## Context

InkNote must work offline, synchronize a person's own notes across devices from
the first release, and keep a future shared-collaboration option open. A plain
`replace-body` operation plus a per-note revision can detect a conflict, but it
cannot preserve two concurrent text edits without forcing one device to lose
work.

The editor-domain module deliberately exposes plain `title` and `body` strings
so React, CodeMirror, and Markdown rendering do not need to understand a CRDT.
That projection remains useful, but it must not become the synchronization
protocol.

## Decision

Each note owns one `Y.Doc` in the main process. Its `title` and `body` are
`Y.Text` values; timestamps, deletion state, and the latest operation ID are in
a `Y.Map` named `metadata`. The renderer sees an immutable `NoteDocument`
projection only; it never receives a database handle or a privileged sync
credential.

The first storage implementation stores stable Yjs v1 update messages, not the
experimental `updateV2` format. A local edit is translated into a Yjs
transaction, and the update emitted by that transaction is the durable unit of
replication. `replace-body` remains an editor-facing intent in document-core;
it is never sent to another device as a whole-document overwrite.

Every accepted local update is committed in one SQLite transaction with:

1. the note projection used by queries and the UI;
2. the append-only CRDT update record; and
3. an idempotent outbox envelope that references that update.

Remote Yjs updates are validated at the IPC/network boundary, applied in a
transaction, persisted, and projected locally. They do **not** create another
outbox record, which prevents echo loops. Outbox acknowledgement is keyed by a
stable envelope ID. Yjs updates themselves are commutative, associative, and
idempotent; the envelope key makes retries and observability deterministic.

## Durable layout

The exact migration names may change, but the normalized responsibility split is
fixed:

| Table                 | Responsibility                                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `schema_migrations`   | Applied SQLite schema versions.                                                                                   |
| `notes`               | Queryable projection: ID, created/updated timestamps, soft-delete state, and local projection generation.         |
| `note_crdt_snapshots` | One compacted Yjs state/update plus state vector per note.                                                        |
| `note_crdt_updates`   | Append-only binary Yjs updates, their stable IDs, origin, and timestamps.                                         |
| `sync_outbox`         | Retry/acknowledgement state for local envelopes; references an update rather than duplicating its binary payload. |
| `sync_checkpoints`    | Per-account/device remote cursor or checkpoint, never mixed into note content.                                    |

Pending outbox updates are retained during compaction. A compactor may merge
acknowledged history into a fresh snapshot only after doing so cannot remove an
update still needed for retry. Tags, notebooks, attachments, full-text search,
and accounts get separate relations when introduced; they are not denormalized
into the note or CRDT-update tables.

## IPC contract

Electron IPC transports structured-clone data, not `Error` instances. Main and
renderer exchange discriminated DTOs:

```ts
type DocumentIpcResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: DocumentDomainErrorCode; message: string } };
```

The renderer repository adapter reconstructs a `DocumentDomainError` from a
validated error DTO before `DocumentSession` observes it. No caller relies on
`instanceof` surviving an IPC hop.

## Consequences

- Concurrent body and title edits converge without a last-writer-wins body
  overwrite.
- The first SQLite schema must be designed around snapshots, updates, outbox
  records, and compaction; it cannot be a simple revisioned text table.
- Yjs is a required runtime dependency for the main-process local store, but
  its types do not leak into renderer UI components.
- A later NestJS/Supabase service transports and stores envelopes/updates; it
  does not receive direct SQLite access or renderer credentials.
- Encryption at rest, key ownership, account identity, retention, and remote
  authorization remain explicit product/security decisions. They are not
  silently chosen by this ADR.

## Verification required before implementation

This section records the checks required before the first local-store
implementation. The local unit suite now covers persistence, duplicate and
convergence behavior, transaction failure, and the IPC-contract portions;
compaction and cross-platform packaged smoke testing remain release work.

- Tests prove offline edits survive reopen, duplicate update application is
  harmless, and two independently edited replicas converge.
- A failed transaction leaves neither a projection change nor a dangling outbox
  row.
- Compaction preserves the projected note and all pending retry payloads.
- IPC tests prove typed domain errors are reconstructed from DTOs.
- Packaged macOS, Windows, and Linux smoke tests open the SQLite store and load
  the native module used by it.
