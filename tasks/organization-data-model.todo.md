# Tasks: organization-data-model

Status: approved on 2026-10-25; implementation in progress.

This checklist implements only [SPEC-organization-data-model.md](../SPEC-organization-data-model.md) and its approved [technical plan](organization-data-model.plan.md). It must not add tag-management UI, search, templates, command UI, remote sync, or a second storage engine.

## Task 1: Extend the shared organization domain contract

**Description:** Add branded tag identity, the fixed tag-color vocabulary, generated ID helpers for new notes/notebooks/tags, and the validated pin mutation while preserving legacy opaque IDs and legacy note DTOs.

**Acceptance criteria:**

- [x] New ID factories generate note:, book:, and tag: IDs; existing non-empty note/notebook IDs remain accepted.
- [x] Tag color and tag-summary validation reject malformed values at the shared boundary.
- [x] NoteDocument safely exposes doctype, pin, and task metadata defaults; update-pinned is an explicit validated mutation.

**Verification:**

- [x] Red → green: npm test -- --runInBand src/__tests__/platform/documents/document.types.test.ts
- [x] npm run typecheck

**Dependencies:** None.

**Files likely touched:**

- src/shared/documents/document.types.ts
- src/__tests__/platform/documents/document.types.test.ts
- src/renderer/platform/documents/document.types.type-check.ts
- src/renderer/platform/documents/useDocumentWorkspace.ts

**Actual scope:** Medium (5 files, including the test repository update needed for the new mutation kind).

## Task 2: Make Markdown task counts a shared pure projection

**Description:** Extract the note-list task parser into a shared document helper and make the existing note presentation consume it, preserving its fenced-code behavior exactly.

**Acceptance criteria:**

- [x] The helper reports total and checked Markdown tasks as non-negative immutable values and ignores fenced examples.
- [x] The note list renders the same task progress as before using the shared helper.
- [x] The store can import the helper without depending on renderer code.

**Verification:**

- [x] Red → green: npm test -- --runInBand src/__tests__/shared/documents/taskProgress.test.ts src/__tests__/features/notes/NotesPanel.test.tsx
- [x] npm run typecheck

**Dependencies:** Task 1.

**Files likely touched:**

- src/shared/documents/taskProgress.ts
- src/__tests__/shared/documents/taskProgress.test.ts
- src/renderer/features/notes/components/NotesPanel.tsx
- src/__tests__/features/notes/NotesPanel.test.tsx

**Estimated scope:** Medium (4 files).

## Task 3: Add the transactional tag-ID schema migration

**Description:** Add the next monotonic LocalDocumentStore migration to rebuild tags and note_tags, assign stable tag IDs and default colors, preserve unused tags, copy associations, add organization indexes, and record the migration only after integrity validation succeeds.

**Acceptance criteria:**

- [x] A representative schema-version-7 fixture upgrades with every tag and note association preserved, including archived notes and zero-count tags.
- [x] A forced copy failure rolls back tables and does not record the new schema version.
- [x] Tag links use tag_id; the old tag_name association schema no longer remains after a successful migration.

**Verification:**

- [x] Red → green: npm test -- --runInBand src/__tests__/main/documents/LocalDocumentStore.test.ts
- [x] npm run verify:native-sqlite

**Dependencies:** Task 1.

**Files likely touched:**

- src/main/documents/LocalDocumentStore.ts
- src/__tests__/main/documents/LocalDocumentStore.test.ts

**Estimated scope:** Medium (2 files).

## Task 4: Project metadata through Yjs and SQLite consistently

**Description:** Add projection columns and defaults for Markdown doctype, pinning, and shared task totals. Update read/write projections, local outbox handling, and tag-name resolution so normal note mutations preserve the new schema invariants.

**Acceptance criteria:**

- [x] Body changes recalculate task totals while pin changes create one valid Yjs update and one outbox record.
- [x] Legacy Yjs metadata reads as Markdown/unpinned without rewriting user content.
- [x] Tag display names in Yjs resolve atomically to migrated tag IDs in SQLite for create and update operations.

**Verification:**

- [x] Red → green: npm test -- --runInBand src/__tests__/main/documents/LocalDocumentStore.test.ts
- [x] npm run typecheck

**Dependencies:** Tasks 1–3.

**Files likely touched:**

- src/main/documents/LocalDocumentStore.ts
- src/__tests__/main/documents/LocalDocumentStore.test.ts

**Estimated scope:** Medium (2 files).

## Checkpoint: durable migration boundary

- [x] Tasks 1–4 pass their focused tests and npm run typecheck.
- [x] A v7 fixture can be migrated, reopened, and queried without lost notes, notebooks, Yjs history, trash state, tags, or associations.
- [ ] No startup integration has been enabled yet; no user database can reach the migration without the safety-preflight tasks below.

## Task 5: Add a recoverable migration-safety snapshot service

**Description:** Implement a main-process service that detects the pending organization migration from a raw SQLite connection, creates/reuses the approved online safety snapshot plus manifest under app data, and fails closed on snapshot error.

**Acceptance criteria:**

- [x] Existing databases pending this migration receive one online SQLite snapshot before migration; fresh empty databases do not create a needless user-data safety copy.
- [x] An incomplete retry reuses only a validated snapshot for the same source version; invalid manifests/snapshots are rejected.
- [x] A snapshot write failure leaves the source database unchanged and returns an actionable main-process error.

**Verification:**

- [x] Red → green: npm test -- --runInBand src/__tests__/main/data/OrganizationMigrationSafetyService.test.ts
- [x] npm run typecheck

**Dependencies:** Task 3.

**Files likely touched:**

- src/main/data/OrganizationMigrationSafetyService.ts
- src/__tests__/main/data/OrganizationMigrationSafetyService.test.ts
- src/main/documents/LocalDocumentStore.ts

**Estimated scope:** Medium (3 files).

## Task 6: Gate main-process startup on the safety preflight

**Description:** Replace lazy first-use store construction with ordered, awaited initialization: preflight snapshot first, LocalDocumentStore migration second, IPC registration and window creation last. Preserve restore and shutdown behavior.

**Acceptance criteria:**

- [x] A failed pending-migration snapshot prevents document handlers and the main window from starting.
- [x] A successful preflight initializes one store instance before renderer requests; restore still clears/reopens the store correctly.
- [x] Existing databases with no pending organization migration retain current startup behavior.

**Verification:**

- [x] Focused node/main tests: npm test -- --runInBand src/__tests__/main/data/OrganizationMigrationSafetyService.test.ts src/__tests__/main/documents/LocalDocumentStore.test.ts
- [x] npm run typecheck

**Dependencies:** Task 5.

**Files likely touched:**

- src/main/main.ts
- src/main/data/OrganizationMigrationSafetyService.ts
- src/__tests__/main/data/OrganizationMigrationSafetyService.test.ts

**Estimated scope:** Medium (3 files).

## Checkpoint: protected application startup

- [ ] Tasks 5–6 prove that migration cannot start without a recoverable safety copy.
- [ ] The store still opens and closes once per application lifecycle.
- [ ] Existing restore, export, and configured-backup tests remain green.

## Task 7: Implement deterministic tag-summary reads

**Description:** Add the repository query that joins normalized tags to active note associations, derives counts without mutable counters, and returns typed immutable summaries in a deterministic order.

**Acceptance criteria:**

- [x] Counts include active non-trashed associations and retain tags whose current count is zero.
- [x] Results validate the tag color, timestamps, identity, and non-negative count before leaving the store.
- [x] The query performs no tag mutation and exposes no SQLite implementation detail.

**Verification:**

- [x] Red → green: npm test -- --runInBand src/__tests__/main/documents/LocalDocumentStore.test.ts
- [x] npm run typecheck

**Dependencies:** Tasks 1 and 4.

**Files likely touched:**

- src/shared/documents/document.query.ts
- src/main/documents/LocalDocumentStore.ts
- src/__tests__/main/documents/LocalDocumentStore.test.ts

**Estimated scope:** Medium (3 files).

## Task 8: Expose tag summaries through authorized main-process IPC

**Description:** Add the typed list-tags operation to the document IPC service, channel registry, and authorized main-process handler. Validate every result using the same serializable document IPC envelope already used by note and notebook operations.

**Acceptance criteria:**

- [x] An authorized request receives immutable tag summaries; an untrusted sender receives the existing safe failure shape.
- [x] The service rejects malformed repository output rather than forwarding it as trusted data.
- [x] The handler remains read-only and refreshes no backup.

**Verification:**

- [x] Red → green: npm test -- --runInBand src/__tests__/main/documents/DocumentIpcService.test.ts src/__tests__/shared/documents/document.ipc.test.ts
- [x] npm run typecheck

**Dependencies:** Task 7.

**Files likely touched:**

- src/main/documents/DocumentIpcService.ts
- src/__tests__/main/documents/DocumentIpcService.test.ts
- src/shared/ipc/channels.ts
- src/main/main.ts

**Estimated scope:** Medium (5 files).

## Task 9: Complete the preload and renderer read adapter

**Description:** Wire the read-only tag operation through the restricted preload API and renderer repository adapter, validating structured-cloned responses without adding a tag UI.

**Acceptance criteria:**

- [ ] Renderer callers receive validated frozen summaries through IpcDocumentRepository.
- [ ] Invalid IPC response shapes raise the existing transport error rather than reaching a component.
- [ ] The renderer gains no Node, Electron, path, or SQLite capability.

**Verification:**

- [ ] Red → green: npm test -- --runInBand src/__tests__/platform/documents/IpcDocumentRepository.test.ts
- [ ] npm run typecheck

**Dependencies:** Task 8.

**Files likely touched:**

- src/main/preload.ts
- src/renderer/platform/documents/IpcDocumentRepository.ts
- src/__tests__/platform/documents/IpcDocumentRepository.test.ts

**Estimated scope:** Medium (3 files).

## Task 10: Surface the retained safety snapshot and verify backups

**Description:** Extend the existing data-management information and Preferences UI to show the retained migration-safety snapshot location. Prove configured backups are refreshed from the upgraded store without changing restore or Markdown-export behavior.

**Acceptance criteria:**

- [ ] Preferences shows the safety snapshot location only when one exists.
- [ ] A configured backup after the upgraded store opens contains the current schema and is accepted by the existing restore validation.
- [ ] Existing backup, restore, and export behavior remains unchanged when no organization migration has occurred.

**Verification:**

- [ ] Red → green: npm test -- --runInBand src/__tests__/main/data/DataManagementService.test.ts src/__tests__/main/data/RestoreDatabaseService.test.ts src/__tests__/App.test.tsx
- [ ] npm run typecheck

**Dependencies:** Tasks 5, 6, and 9.

**Files likely touched:**

- src/shared/data/data.types.ts
- src/main/data/DataManagementService.ts
- src/__tests__/main/data/DataManagementService.test.ts
- src/renderer/components/workspace/WorkspacePreferences.tsx
- src/__tests__/App.test.tsx

**Estimated scope:** Medium (5 files).

## Task 11: Run upgrade and regression completion gates

**Description:** Verify the complete data-model change against disposable version-7 fixtures, a local Electron launch, and the full repository quality gate. Review the final diff for scope, data safety, security, and performance.

**Acceptance criteria:**

- [ ] Full automated verification passes with no skipped/disabled migration tests.
- [ ] A disposable v7 database creates a safety snapshot, upgrades, opens in Electron, and preserves notes, trash, notebooks, tags, and exports.
- [ ] Final review confirms no unapproved template, search, tag UI, command palette, sync, or dependency change was introduced.

**Verification:**

- [ ] npm run lint
- [ ] npm run typecheck
- [ ] npm run test:ci
- [ ] npm run verify:native-sqlite
- [ ] npm run build
- [ ] npm run verify
- [ ] npm start manual disposable-profile check

**Dependencies:** Tasks 1–10.

**Files likely touched:**

- No intended production files; test or documentation changes only when a verified defect requires a separate focused follow-up.

**Estimated scope:** Small (verification only).

## Checkpoint: complete organization-data-model

- [ ] All task acceptance criteria and verification commands have evidence.
- [ ] The retained safety snapshot is visible in Preferences and a configured backup/restore remains valid after migration.
- [ ] A human has reviewed the result before a later organization module is specified or implemented.

## Approval gate

Approved on 2026-10-25; implementation is underway.
