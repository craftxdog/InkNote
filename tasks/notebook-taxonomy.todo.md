# Tasks: notebook taxonomy

Status: proposed on 2026-10-26. This checklist implements only
[SPEC-notebook-taxonomy.md](../SPEC-notebook-taxonomy.md) and the approved
[technical plan](notebook-taxonomy.plan.md). It does not implement tag
taxonomy, search, discovery, templates, sync, a command palette, or a schema
migration.

## Task 1: Define and validate the notebook update contract

**Description:** Add an immutable replacement input for editable notebook
properties, its shared validation, and the `NotebookRepository` update port.

**Acceptance criteria:**

- [ ] A valid non-Inbox notebook update preserves its ID and accepts legacy as
      well as generated `book:` IDs.
- [ ] Empty/whitespace names, unsupported icons, malformed timestamps, Inbox
      updates, and invalid identifiers fail with the existing stable domain
      error vocabulary.
- [ ] `parentId: null` and `icon: null` are explicit valid clear operations;
      no ambiguous optional value reaches persistence.

**Verification:**

- [ ] Red → green: `npm test -- --runInBand src/__tests__/platform/documents/document.types.test.ts`
- [ ] `npm run typecheck`

**Dependencies:** None.

**Likely files:**

- `src/shared/documents/document.types.ts`
- `src/shared/documents/document.query.ts`
- `src/__tests__/platform/documents/document.types.test.ts`
- `src/renderer/platform/documents/document.types.type-check.ts`

## Task 2: Add an atomic SQLite notebook update with graph safety

**Description:** Implement a short prepared-statement transaction that
validates the persisted parent graph, updates one notebook, and leaves all
other durable state unchanged on failure.

**Acceptance criteria:**

- [ ] Rename, valid reparent, icon set, and icon clear update `updated_at`
      without changing ID, created time, direct-note associations, or child
      relationships unrelated to the edited notebook.
- [ ] Missing parent, self-parent, descendant-parent, and Inbox updates are
      rejected atomically for both legacy and `book:` notebook IDs.
- [ ] Existing creation/deletion policy and list ordering stay unchanged.

**Verification:**

- [ ] Red → green: `npm test -- --runInBand src/__tests__/main/documents/LocalDocumentStore.test.ts`
- [ ] `npm run verify:native-sqlite`

**Dependencies:** Task 1.

**Likely files:**

- `src/main/documents/LocalDocumentStore.ts`
- `src/__tests__/main/documents/LocalDocumentStore.test.ts`

## Checkpoint: durable notebook boundary

- [ ] Focused domain and SQLite tests pass.
- [ ] A rejected update leaves the representative legacy hierarchy exactly
      intact.
- [ ] No schema migration or new dependency was introduced.

## Task 3: Expose notebook updates through the authorized IPC boundary

**Description:** Add the typed IPC channel, service method, main-process
authorization, preload forwarding, renderer adapter, and configured-backup
refresh behavior.

**Acceptance criteria:**

- [ ] An authorized renderer request receives a revalidated immutable
      notebook; malformed input and untrusted senders receive the standard
      failure shape.
- [ ] Preload exposes only `updateNotebook`; renderer code gains no Electron,
      filesystem, or SQLite capability.
- [ ] A successful update refreshes configured backup; a failed update does
      not trigger it.

**Verification:**

- [ ] Red → green: `npm test -- --runInBand src/__tests__/main/documents/DocumentIpcService.test.ts src/__tests__/platform/documents/IpcDocumentRepository.test.ts src/__tests__/main/data/DataManagementService.test.ts`
- [ ] `npm run typecheck`

**Dependencies:** Task 2.

**Likely files:**

- `src/shared/bridge.ts`
- `src/shared/ipc/channels.ts`
- `src/main/documents/DocumentIpcService.ts`
- `src/main/main.ts`
- `src/main/preload.ts`
- `src/renderer/platform/documents/IpcDocumentRepository.ts`
- focused tests

## Task 4: Add the workspace notebook-update action

**Description:** Make the document workspace construct validated update
requests, reconcile the notebook projection after success, and preserve a
valid notebook/detail selection.

**Acceptance criteria:**

- [ ] The action returns the accepted durable notebook and replaces its stale
      projection without reordering unrelated notebooks arbitrarily.
- [ ] A failure preserves visible notebook state and reports through the
      existing workspace error path.
- [ ] Existing note create/move/delete/pin workflows remain unchanged.

**Verification:**

- [ ] Focused workspace/App regression tests pass.
- [ ] `npm run typecheck`

**Dependencies:** Task 3.

**Likely files:**

- `src/renderer/platform/documents/useDocumentWorkspace.ts`
- `src/renderer/pages/WorkspacePage.tsx`
- focused workspace tests

## Task 5: Extend lifecycle-safe organization commands for notebooks

**Description:** Add a typed notebook intent/request model and register
notebook create, edit, delete, and open-detail commands through the current
organization plugin without adding a global keybinding.

**Acceptance criteria:**

- [ ] Valid UI/API requests retain command provenance; malformed command
      details cause no durable mutation.
- [ ] React Strict Mode leaves exactly one active command contribution and no
      lifecycle error or stale callback.
- [ ] Existing note commands and shortcut behavior, especially `Cmd/Ctrl+P`,
      remain unchanged and unconsumed by notebook commands.

**Verification:**

- [ ] Red → green: `npm test -- --runInBand src/__tests__/features/organization`
- [ ] `npm run typecheck`

**Dependencies:** Task 4.

**Likely files:**

- `src/renderer/features/organization/model/organizationCommands.ts`
- `src/renderer/features/organization/model/notebookCommandRequest.ts`
- `src/renderer/features/organization/runtime/organizationCommandsPlugin.ts`
- `src/renderer/features/organization/hooks/useOrganizationCommands.ts`
- focused organization tests

## Task 6: Build accessible notebook editing and command-routed navigation

**Description:** Add the focused editor surface and make existing sidebar and
detail actions dispatch notebook commands rather than invoke durable workspace
mutations directly.

**Acceptance criteria:**

- [ ] The edit surface has labeled name, parent, and icon controls; starts
      with current values; moves focus correctly; supports keyboard submit and
      cancel; and displays actionable errors.
- [ ] The parent list includes root, excludes Inbox-as-child, the edited
      notebook, and all descendants; icon clear is available.
- [ ] Create, edit, delete, and detail paths dispatch their typed command;
      direct component-to-workspace durable notebook calls are absent.
- [ ] Counts remain derived and deletion keeps its existing explicit
      confirmation and outcome semantics.

**Verification:**

- [ ] Red → green: `npm test -- --runInBand src/__tests__/features/navigation src/__tests__/App.test.tsx`
- [ ] `npm run lint`
- [ ] `npm run typecheck`

**Dependencies:** Task 5.

**Likely files:**

- `src/renderer/features/navigation/components/NotebookEditorDialog.tsx`
- `src/renderer/features/navigation/components/NavigationLibraryView.tsx`
- `src/renderer/features/navigation/components/NavigationNotebookDetailView.tsx`
- `src/renderer/features/navigation/model/notebookTree.ts`
- `src/renderer/features/navigation/styles/navigation.css`
- focused navigation/App tests

## Task 7: Complete compatibility, quality, and user-safe smoke checks

**Description:** Verify the completed module against automated gates and the
authorized profile without exposing or modifying existing user content.

**Acceptance criteria:**

- [ ] All focused and complete quality commands pass with no skipped update,
      command, or cycle test.
- [ ] The read-only profile report continues to show valid parent references,
      one Inbox, and no cycles; note and notebook aggregate counts are
      unchanged before/after the smoke check.
- [ ] Electron smoke uses a new empty test notebook only, proves rename,
      reparent, icon set/clear, rejection of invalid parent choices, and
      delete cleanup; it never targets an existing user note/notebook.
- [ ] Final diff review confirms no migration, dependency, tag/search/template
      work, global keybinding, or privileged renderer access was added.

**Verification:**

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test:ci`
- [ ] `npm run verify:native-sqlite`
- [ ] `npm run build`
- [ ] `npm run verify`
- [ ] clean-profile and authorized-profile Electron smoke review

**Dependencies:** Tasks 1–6.

**Likely files:**

- No intended production files; only narrowly scoped test/documentation fixes
  if a verified defect requires them.

## Approval gate

Do not start Task 1 until the user approves this technical plan and task
checklist.
