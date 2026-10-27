# Tasks: `tag-taxonomy`

Status: proposed on 2026-10-26. This checklist implements only the approved
[technical plan](tag-taxonomy.plan.md) and
[specification](../SPEC-tag-taxonomy.md). It remains planning-only until a
human explicitly approves the checklist.

## Task 1: Define validated tag lifecycle contracts

**Description:** Add immutable shared inputs/results for tag create, update,
and delete while keeping legacy rows readable.

**Acceptance criteria:**

- [x] New tags use generated `tag:` IDs; legacy non-empty IDs remain valid
      targets for update/delete.
- [x] Create/update accept a trimmed, normalized, non-empty name up to 64
      characters, a supported color, and a valid timestamp.
- [x] Delete returns immutable deterministic affected note IDs; malformed
      inputs fail before storage and existing `TagSummary` stays compatible.

**Verification:**

- [x] Red → green: `npm test -- --runInBand src/__tests__/platform/documents/document.types.test.ts`
- [x] `npm run typecheck`

**Dependencies:** None.

**Files likely touched:**

- `src/shared/documents/document.types.ts`
- `src/shared/documents/document.query.ts`
- `src/__tests__/platform/documents/document.types.test.ts`

**Estimated scope:** Medium.

## Task 2: Add atomic durable tag create and recolor

**Description:** Extend the durable port/store with creation and color-only
update before touching any note association.

**Acceptance criteria:**

- [x] Create persists ID/name/color/timestamps and rejects a
      case-insensitive duplicate without modifying notes.
- [x] A color-only update preserves ID, name, `createdAt`, note links, and
      outbox rows while advancing `updatedAt`.
- [x] Rejection rolls back completely and adds neither schema migration nor
      dependency.

**Verification:**

- [x] Red → green: `npm test -- --runInBand src/__tests__/main/documents/LocalDocumentStore.test.ts`
- [x] `npm run verify:native-sqlite`

**Dependencies:** Task 1.

**Files likely touched:**

- `src/shared/documents/document.query.ts`
- `src/main/documents/LocalDocumentStore.ts`
- `src/__tests__/main/documents/LocalDocumentStore.test.ts`

**Estimated scope:** Medium.

## Task 3: Propagate tag rename and deletion through Yjs

**Description:** Add the private store transaction that changes all affected
active/archived Yjs tag arrays, projections, CRDT updates, and outbox rows.

**Acceptance criteria:**

- [x] Rename survives reopening the store, preserves unrelated note fields,
      and never recreates the previous name.
- [x] Delete removes the association from every active/archived note before
      deleting links and the catalogue row; it never restores or purges notes.
- [x] A duplicate, missing tag, or injected mid-batch failure rolls back the
      catalogue, notes, update history, and outbox as one transaction.

**Verification:**

- [x] Red → green: `npm test -- --runInBand src/__tests__/main/documents/LocalDocumentStore.test.ts`
- [x] `npm run verify:native-sqlite`

**Dependencies:** Task 2.

**Files likely touched:**

- `src/main/documents/LocalDocumentStore.ts`
- `src/__tests__/main/documents/LocalDocumentStore.test.ts`

**Estimated scope:** Medium.

## Checkpoint: durable tag boundary

- [x] Domain and SQLite tests pass.
- [x] A failed batch preserves an active note, archived note, catalogue row,
      CRDT-update history, and outbox row.
- [x] No migration, dependency, public mutation loophole, or renderer database
      access was introduced.

## Task 4: Add main-process tag lifecycle handlers

**Description:** Expose the durable port through the document IPC service and
authorized Electron handlers, including backup refresh after success.

**Acceptance criteria:**

- [x] Unknown payloads return the established safe error envelope before
      reaching storage.
- [x] Each write handler authorizes its sender and refreshes configured backup
      exactly once after success, never after rejection.
- [x] Tag channels are additive; existing query and notebook handlers remain
      unchanged.

**Verification:**

- [x] Red → green: `npm test -- --runInBand src/__tests__/main/documents/DocumentIpcService.test.ts src/__tests__/main/data/DataManagementService.test.ts`
- [x] `npm run typecheck`

**Dependencies:** Task 3.

**Files likely touched:**

- `src/shared/ipc/channels.ts`
- `src/main/documents/DocumentIpcService.ts`
- `src/main/main.ts`
- `src/__tests__/main/documents/DocumentIpcService.test.ts`

**Estimated scope:** Medium.

## Task 5: Add narrow preload and renderer tag transport

**Description:** Forward the authorized writes through preload/bridge and
reconstruct canonical immutable values in the renderer adapter.

**Acceptance criteria:**

- [x] Preload exposes only the explicit tag functions, never a path, SQL,
      database, or Electron object.
- [x] The renderer adapter revalidates structured-cloned results before
      application state can consume them.
- [x] Existing `listTags` and unrelated document adapter operations remain
      compatible.

**Verification:**

- [x] Red → green: `npm test -- --runInBand src/__tests__/platform/documents/IpcDocumentRepository.test.ts`
- [x] `npm run typecheck`

**Dependencies:** Task 4.

**Files likely touched:**

- `src/shared/bridge.ts`
- `src/main/preload.ts`
- `src/renderer/platform/documents/IpcDocumentRepository.ts`
- `src/__tests__/platform/documents/IpcDocumentRepository.test.ts`

**Estimated scope:** Medium.

## Task 6: Reconcile catalogue and focused-note workspace state

**Description:** Make the workspace own durable tag summaries and refresh
catalogue/list/selected-note state only after an accepted operation.

**Acceptance criteria:**

- [x] Refresh includes zero-count tags alongside active and archived notes.
- [x] Accepted tag operations refresh the catalogue and focused note so the
      editor never retains a stale name.
- [x] Failure preserves visible documents, tags, and selection while exposing
      the existing error state.

**Verification:**

- [x] Red → green: `npm test -- --runInBand src/__tests__/platform/documents/useDocumentWorkspace.test.tsx`
- [x] `npm run typecheck`

**Dependencies:** Task 5.

**Files likely touched:**

- `src/renderer/platform/documents/useDocumentWorkspace.ts`
- `src/renderer/platform/documents/DocumentSession.ts` (only if required)
- `src/__tests__/platform/documents/useDocumentWorkspace.test.tsx`

**Estimated scope:** Medium.

## Checkpoint: authorized renderer boundary

- [x] Store, service, preload, repository, and workspace tests pass.
- [x] The renderer remains unprivileged and rejected requests did not refresh
      backup or visible state.
- [x] A focused document refreshes after accepted rename/delete.

## Task 7: Register pure typed tag commands

**Description:** Add command IDs and a typed request parser to the existing
lifecycle-safe organization plugin without a keymap change.

**Acceptance criteria:**

- [x] `tag:new`, `tag:update`, `tag:delete`, and `tag:open` register/dispose
      exactly once under Strict Mode.
- [x] Only matching complete requests reach a page-level action; malformed
      detail is rejected first.
- [x] Existing commands and all keymap descriptors retain behavior/provenance.

**Verification:**

- [x] Red → green: `npm test -- --runInBand src/__tests__/features/organization/organizationCommands.test.ts src/__tests__/features/organization/tagCommandRequest.test.ts`
- [x] `npm run typecheck`

**Dependencies:** Task 6.

**Files likely touched:**

- `src/renderer/features/organization/model/organizationCommands.ts`
- `src/renderer/features/organization/model/tagCommandRequest.ts` (new)
- `src/renderer/features/organization/runtime/organizationCommandsPlugin.ts`
- focused organization command/request tests

**Estimated scope:** Medium.

## Task 8: Route tag commands at the workspace boundary

**Description:** Resolve valid tag requests to the workspace's current
callbacks while preserving menu/context/API provenance.

**Acceptance criteria:**

- [x] Create/update/delete use only workspace actions; `tag:open` returns the
      current summary without a durable write.
- [x] Mismatched commands/requests and unavailable tags are safe no-ops.
- [x] Existing note/notebook routing remains unchanged.

**Verification:**

- [x] Red → green: `npm test -- --runInBand src/__tests__/features/organization/executeTagCommand.test.ts src/__tests__/App.test.tsx`
- [x] `npm run typecheck`

**Dependencies:** Task 7.

**Files likely touched:**

- `src/renderer/features/organization/model/executeTagCommand.ts` (new)
- `src/renderer/pages/WorkspacePage.tsx`
- focused organization/page tests

**Estimated scope:** Medium.

## Checkpoint: command lifecycle boundary

- [x] Command/adapter tests pass with no skipped tag path.
- [x] Strict Mode leaves one active contribution and no lifecycle operation in
      progress.
- [x] `Cmd/Ctrl+P`, editor input, and existing keys remain unconsumed.

## Task 9: Render the durable sidebar catalogue

**Description:** Replace note-derived tag rows with the durable workspace
catalogue while retaining current search/filter semantics.

**Acceptance criteria:**

- [x] Rows use persisted color/count, follow catalogue order, and include
      zero-count tags.
- [x] Stable tag ID drives row/selection identity while note filtering retains
      normalized names.
- [x] Catalogue refresh does not change unrelated notebook/status selection.

**Verification:**

- [x] Red → green: `npm test -- --runInBand src/__tests__/features/navigation/NavigationLibraryView.test.tsx src/__tests__/features/navigation/navigation.selections.test.ts`
- [x] `npm run typecheck`

**Dependencies:** Task 8.

**Files likely touched:**

- `src/renderer/features/navigation/components/NavigationLibraryView.tsx`
- `src/renderer/features/navigation/model/navigation.selections.ts`
- `src/renderer/features/navigation/model/navigation.types.ts`
- focused navigation tests

**Estimated scope:** Medium.

## Task 10: Build the accessible tag editor dialog

**Description:** Add an isolated create/edit form with labelled name/color
controls, focus handling, cancellation, and visible error feedback.

**Acceptance criteria:**

- [ ] The dialog supplies initial focus, labeled colors, Escape/Cancel, and
      focus containment consistent with the notebook editor.
- [ ] Error retains the draft and does not claim durable success.
- [ ] The component owns transient state only and emits typed callbacks.

**Verification:**

- [ ] Red → green: `npm test -- --runInBand src/__tests__/features/navigation/TagEditorDialog.test.tsx`
- [ ] `npm run lint`

**Dependencies:** Task 9.

**Files likely touched:**

- `src/renderer/features/navigation/components/TagEditorDialog.tsx` (new)
- `src/renderer/features/navigation/styles/navigation.css`
- `src/__tests__/features/navigation/TagEditorDialog.test.tsx`

**Estimated scope:** Medium.

## Task 11: Connect lifecycle UI and selection reconciliation

**Description:** Connect sidebar create/edit/delete controls to commands and
reconcile the active tag selection after accepted rename/delete.

**Acceptance criteria:**

- [ ] UI actions dispatch typed menu/context-menu commands and never invoke a
      durable operation directly.
- [ ] Delete confirmation describes association removal; cancellation dispatches
      nothing.
- [ ] Rename updates the active filter name; deleting its selected tag falls
      back to All Notes without changing unrelated views.

**Verification:**

- [ ] Red → green: `npm test -- --runInBand src/__tests__/features/navigation/NavigationLibraryView.test.tsx src/__tests__/features/navigation/NavigationPanel.test.tsx src/__tests__/App.test.tsx`
- [ ] `npm run lint`
- [ ] `npm run typecheck`

**Dependencies:** Task 10.

**Files likely touched:**

- `src/renderer/features/navigation/components/NavigationLibraryView.tsx`
- `src/renderer/features/navigation/components/NavigationPanel.tsx`
- focused navigation/App tests

**Estimated scope:** Medium.

## Task 12: Run regression, profile, and disposable-object smoke checks

**Description:** Complete the approved quality gate and test Electron only
with a new temporary tag and new temporary note. Cleanup requires a fresh
explicit deletion confirmation.

**Acceptance criteria:**

- [ ] The final diff adds no migration, dependency, shortcut, direct renderer
      privilege, or unrelated template/search/reference work.
- [ ] Read-only profile checks show no orphan tag links or unexpected existing
      content changes.
- [ ] Electron smoke proves create, recolor, rename, assignment/filtering,
      delete confirmation, and post-cleanup absence for owned test objects.

**Verification:**

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test:ci`
- [ ] `npm run verify:native-sqlite`
- [ ] `npm run build`
- [ ] `npm run verify`
- [ ] clean-profile and authorized-profile Electron smoke review

**Dependencies:** Task 11.

**Files likely touched:**

- `SPEC-tag-taxonomy.md`
- `tasks/tag-taxonomy.plan.md`
- `tasks/tag-taxonomy.todo.md`

**Estimated scope:** Small.
