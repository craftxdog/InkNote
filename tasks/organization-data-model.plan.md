# Technical Plan: organization-data-model

Status: approved on 2026-10-25.

## Overview

Implement the approved organization-data-model specification without changing InkNote's local-first engine. The work adds a recoverable pre-migration safety snapshot, normalizes durable tags around IDs, extends note projections with organization metadata, and exposes read-only tag summaries through the existing typed bridge.

This technical plan governs the approved design. Its detailed task checklist is
tracked separately; no production migration or source-code change is
authorized until that checklist is also approved.

## Architecture decisions

- SQLite remains the only local database and Yjs remains the authority for editable note content. No CouchDB, PouchDB, remote transport, or alternate revision token is introduced.
- A startup preflight runs before LocalDocumentStore is constructed when the organization-data-model migration is pending. It creates an online SQLite snapshot under the app-data directory, writes a small manifest, closes the bootstrap connection, and only then permits the normal store migration.
- The preflight is asynchronous, so main-process initialization must await it before registering document handlers or creating the first window. A failed snapshot blocks startup before any schema mutation.
- Existing identifiers remain valid. Factories generate note:, book:, and tag: prefixes only for new records; validators keep accepting legacy non-empty strings.
- The migration replaces the tags and note_tags tables inside one SQLite transaction. Tags receive stable IDs, default colors, and updated timestamps; note-to-tag rows move from tag names to tag IDs.
- Note Yjs tag arrays continue to store normalized display names in this slice. LocalDocumentStore resolves them into tag IDs when rebuilding the relational projection. This avoids a wide, unsafe rewrite of existing Yjs snapshots.
- doctype, pinned, and task totals are projection metadata. Existing Yjs records default safely when their metadata is absent. The future pin mutation writes Yjs metadata; task counts remain derived from Markdown and are never directly editable.
- Tag and notebook counts are query-derived, not stored counters. This prevents drift across trash, restoration, and future CRDT updates.
- The new tag read port follows the existing chain: shared contract → main service → authorized IPC channel → preload bridge → renderer repository. It exposes no SQL, database handle, path, or mutation capability.

## Dependency graph

~~~text
pending-migration detection
        |
        v
pre-migration online snapshot + manifest
        |
        v
main-process store initialization
        |
        +--------------------------+
        |                          |
        v                          v
shared IDs/types/task parser   SQLite v8 migration + projections
        |                          |
        +-------------+------------+
                      v
        tag summary query + validation
                      |
                      v
authorized IPC/preload/repository bridge
                      |
                      v
backup, migration, and full-regression verification
~~~

The snapshot preflight and domain contracts are independent preparation work. The SQLite migration consumes the contracts and cannot run before the snapshot path is proven. IPC follows only after LocalDocumentStore returns stable tag summaries.

## Implementation slices

### Slice 1: Migration-safety startup boundary

Create a main-process safety service and manifest contract that can inspect a raw SQLite connection for a pending organization migration and take an online backup before the store constructor migrates.

Update the Electron bootstrap to await this preflight before it registers document IPC handlers and creates the window. Reuse better-sqlite3 online backup behavior, retain the successful snapshot in a timestamped app-data migration-safety directory, and expose its location through the existing data-management information rendered in Preferences.

The service must treat a fresh empty database as having no user data to preserve, reuse an already-valid snapshot for an unfinished retry, and fail closed when an existing database needs migration but its snapshot cannot be written.

Checkpoint: node tests prove no migration begins after an injected snapshot failure, and a valid safety snapshot plus manifest exists before a pending migration is allowed to start.

### Slice 2: Shared semantic contracts and pure task projection

Extend the shared document domain with TagId, the fixed TagColor vocabulary, immutable TagSummary validation, generated ID helpers, optional legacy-safe note metadata defaults, and an update-pinned mutation.

Move the existing Markdown task-list parser from the renderer feature into a pure shared document helper. It must keep the current treatment of fenced code and provide non-negative total/checked counts to both the store projection and note-list presentation.

Update repository/query interfaces and their test fakes so compilation exposes every intended consumer before SQLite behavior is changed.

Checkpoint: focused shared/domain tests prove legacy DTO acceptance, tag color validation, ID generation, pin-mutation validation, and identical task counts for renderer and storage callers.

### Slice 3: Transactional SQLite organization migration

Add the next monotonic LocalDocumentStore migration. It adds note projection columns and supporting indexes, rebuilds tags and note_tags through replacement tables, maps each legacy tag name to one generated tag ID, preserves unused tag rows, verifies the copy with foreign_key_check, then records the version only after success.

Update projection writes and reads so Yjs display-name tags resolve to the durable tag catalogue, tag links use tag IDs, missing legacy pin/doctype values become safe defaults, and task counts recalculate whenever a note body changes. Add the pin mutation to the Yjs transaction/outbox path without changing current UI behavior or sorting.

Keep archived-note notebook behavior unchanged: do not add a notes-to-notebooks foreign key that would make the documented archive-and-delete notebook flow invalid.

Checkpoint: a real version-7 fixture with active, archived, tagged, untagged, unused-tag, nested-notebook, and Yjs-history data upgrades atomically; reopening the database returns equivalent notes and associations.

### Slice 4: Read-only tag query boundary

Implement the aggregate tag-summary query with deterministic name ordering and counts over non-trashed note associations. Validate it in the shared IPC contract and pass it through DocumentIpcService, the IPC channel registry, preload, the public bridge type, and IpcDocumentRepository.

The slice deliberately stops at a read-only catalog. No editor, sidebar, command, rename, color-edit, or delete UI is added; those belong to tag-taxonomy after its own approval.

Checkpoint: a renderer-side repository test receives immutable, validated tag summaries, malformed IPC data is rejected, and no renderer module imports better-sqlite3, Electron, or a filesystem API.

### Slice 5: Protection and end-to-end verification

Prove the configured-backup refresh captures the upgraded schema after the first successful write, and the retained migration-safety snapshot remains usable as a raw SQLite recovery point. Run the full verification suite and inspect an Electron launch against a copied version-7 fixture, confirming that the app opens only after the safety snapshot exists.

Review the final diff for accidental schema changes outside the approved tables, direct UI data access, or any unplanned command/search/template scope expansion.

Checkpoint: all approved data-model success criteria have automated evidence, the upgrade flow has been manually exercised against disposable data, and a human reviews the result before the next module begins.

## Affected areas

| Area | Planned responsibility |
| --- | --- |
| src/main/main.ts | Async store preflight and ordered startup; no renderer privilege expansion. |
| src/main/data/ | Migration-safety snapshot service and Preferences-facing info. |
| src/main/documents/LocalDocumentStore.ts | Versioned schema migration, tag joins, projection fields, indexes, and pin Yjs mutation. |
| src/shared/documents/ | IDs, tags, task projection, mutations, query ports, and IPC validation. |
| src/shared/ipc/channels.ts, src/shared/bridge.ts, src/main/preload.ts | Narrow read-only tag query surface. |
| src/renderer/platform/documents/ | Typed renderer adapter; no organization UI change. |
| src/renderer/features/notes/ | Consume the shared task projection helper only. |
| src/__tests__/ | Domain, migration, preflight, IPC, backup, and regression coverage. |

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| A schema migration runs before a recoverable copy exists | High | Detect the pending version with a raw connection and require an online snapshot before LocalDocumentStore construction. Fail closed on snapshot failure. |
| Existing migration records do not match table shape | High | Feature-detect required columns/tables as the current status repair does; test a version-7 fixture and malformed historical combinations. |
| Rebuilding tag tables loses associations or unused tags | High | Copy in one transaction, retain a name-to-ID map, run foreign_key_check, compare counts, and record the version last. |
| Yjs tag names and relational tag IDs diverge | High | Keep display names as the transitional Yjs format and make every projection write resolve them atomically to catalogue IDs. |
| Pin/task fields create a second content authority | High | Pin flows through the Yjs/outbox mutation path; task totals are projection-only and recomputed from body. |
| A preflight changes Electron startup timing | Medium | Initialize before handlers/window, surface actionable startup errors, and test no store creation after snapshot failure. |
| Schema changes leak SQLite into the renderer | Medium | Keep all access behind typed repository/IPC/preload validation and test malformed responses. |
| New indexes or pin fields alter current list UX prematurely | Medium | Add data support only; preserve existing list ordering until note-organization explicitly consumes pinning. |
| Automatic safety copies accumulate | Low | Use a versioned manifest and idempotent retry detection; retain only the one approved snapshot for this migration until a separate retention policy is approved. |

## Verification matrix

| Stage | Automated evidence | Manual evidence |
| --- | --- | --- |
| Safety preflight | Service tests cover success, retry reuse, and write failure. | Confirm safety location is visible in Preferences on a disposable upgraded profile. |
| Contracts | Shared type, validation, and task-parser tests. | Inspect no caller can pass a notebook ID where a tag ID is required. |
| SQLite migration | LocalDocumentStore fixture, transaction rollback, reopen, foreign-key, and Yjs/outbox tests. | Open a copied v7 database and inspect notes, trash, notebooks, and tag counts. |
| IPC query | Main service, preload/bridge, and IpcDocumentRepository tests. | Confirm the renderer has no direct database capability. |
| Final gate | npm run lint, npm run typecheck, npm run test:ci, npm run verify:native-sqlite, npm run build, and npm run verify. | Launch Electron against disposable data; inspect console and Preferences safety backup location. |

## Task list

Implementation tasks are tracked in
[organization-data-model.todo.md](organization-data-model.todo.md). This
dedicated checklist does not overwrite tasks/plan.md or tasks/todo.md, which
belong to completed or independent work.

## Open questions

None. The automatic app-data migration-safety snapshot and retention policy were approved with the specification.

## Approval gate

The dedicated task checklist was approved on 2026-10-25.
