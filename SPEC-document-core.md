# Spec: `document-core`

Status: implemented as the document-core vertical slice on 2026-10-21.

## Objective

Define an editor-independent canonical note-document model and an in-memory
document session contract. It must give the future CodeMirror editor and
Markdown preview one consistent source of truth, while leaving persistence and
remote synchronization behind explicit ports.

This module exists so the editor can be local-first without coupling React,
CodeMirror, SQLite, Supabase, or HTTP into the note model.

## Scope

### Included

- Branded identifiers for notes, revisions, and mutation operations.
- A canonical `NoteDocument` snapshot containing note metadata, Markdown body,
  timestamps, a revision, and soft-deletion state.
- Immutable document-session state and subscriptions for a selected note.
- Explicit note mutations for creation, title/body updates, archive, and
  restore.
- Repository and active-document query interfaces, plus a serializable IPC DTO
  contract. Concrete SQLite, Electron IPC, and renderer adapters live outside
  this framework-free core.
- Normalization rules needed by every editor input path: Markdown body text uses
  LF line endings; identifiers and operation IDs are opaque strings.
- A uniform domain-error vocabulary for missing documents, invalid mutations,
  and revision conflicts.

### Excluded

- SQLite schema, encryption, migrations, disk writes, or an outbox
  implementation (`local-first-store`).
- CodeMirror, Vim, rendering, commands, menus, React components, or keymaps.
- Yjs persistence, transport, and conflict resolution. The later
  `local-first-store` owns the durable Yjs representation defined in ADR 002;
  this core remains a UI-facing, framework-free projection contract.
- Notebooks, tags, attachments, search, authentication, and user profiles.
- Any direct compatibility promise for an external Inkdrop or Vim plugin.

## Tech Stack

- TypeScript 7, React 19, Electron 44, and Jest are already configured in the
  repository.
- The module itself must remain framework-free TypeScript so it can be unit
  tested outside the browser.
- Existing CodeMirror 6, Unified, and Vim packages are consumers of this
  module in later capabilities, not dependencies of it.

## Contract

```ts
type NoteDocument = Readonly<{
  id: NoteId;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  revision: Revision;
  deletedAt: string | null;
}>;

type DocumentMutation =
  | CreateDocumentMutation
  | UpdateTitleMutation
  | ReplaceBodyMutation
  | ArchiveDocumentMutation
  | RestoreDocumentMutation;

type DocumentSessionSnapshot = Readonly<{
  selectedDocumentId: NoteId | null;
  document: NoteDocument | null;
  lastError: DocumentDomainError | null;
  isLoading: boolean;
}>;

type DocumentDomainError = Readonly<{
  code: 'DOCUMENT_NOT_FOUND' | 'INVALID_MUTATION' | 'REVISION_CONFLICT';
  message: string;
}>;

type DocumentSubscription = Readonly<{
  unsubscribe(): void;
}>;

interface DocumentSession {
  getSnapshot(): DocumentSessionSnapshot;
  subscribe(
    listener: (snapshot: DocumentSessionSnapshot) => void,
  ): DocumentSubscription;
  open(id: NoteId): Promise<NoteDocument>;
  apply(mutation: DocumentMutation): Promise<NoteDocument>;
}

interface DocumentRepository {
  get(id: NoteId): Promise<NoteDocument | null>;
  apply(mutation: DocumentMutation): Promise<NoteDocument>;
}
```

`DocumentMutation` is a concrete discriminated TypeScript union: `create`
carries a `title` and `body`; `update-title` carries a `title`;
`replace-body` carries a `body`; and `archive` and `restore` have no additional
payload. All five kinds carry a stable operation ID and a base revision so the
storage and sync layers can detect conflicts instead of silently overwriting
content.

`create` uses `INITIAL_DOCUMENT_REVISION` (`'initial'` as an opaque
`Revision`) because a new note has no prior stored revision. The sentinel is a
repository contract rather than a user-visible version. The core accepts every
declared source, including `system`, so imports and local maintenance can use
the same mutation vocabulary; authorization policy belongs to later layers.

`document-core` operates on JavaScript text strings and only normalizes CRLF or
CR line endings to LF. Local persistence is responsible for UTF-8 encoding;
this module intentionally does not impose a separate Unicode validity policy.

Factories are the ergonomic construction API, while
`validateDocumentMutation()` is the runtime boundary used by repositories. It
rebuilds a canonical immutable mutation or raises `INVALID_MUTATION`, so a
future plugin or IPC caller cannot bypass validation with a TypeScript cast.

An active document can change title/body or be archived. An archived document
can only be restored; archive/restore state mistakes are `INVALID_MUTATION`
after the repository has first checked the supplied base revision. Replaying a
durably accepted mutation ID is intentionally not modeled by the in-memory
fake; durable idempotency belongs to `local-first-store`.

`DocumentSession` publishes a new immutable document snapshot only after
`open()` finds a document or its repository accepts a mutation. A failed active
`open()` clears the prior document and exposes its typed error through
`lastError`; a failed active `apply()` preserves the current document and
exposes the typed error. Unknown errors are re-thrown without changing the
snapshot. The session must not mutate a prior snapshot in place.

The session treats `open()` as an immediate selection intent. Each open gets a
generation token, so an older request or its late error cannot overwrite a
newer selection. A background mutation can persist through the repository but
only updates the session if it still targets the active selection and
generation. Subscriber callbacks are isolated: their failures are reported to
the optional `onListenerError` callback and cannot make an accepted operation
fail or prevent other subscribers from receiving the snapshot. Domain errors,
documents, and snapshots are frozen before publication. The local-first store
makes repository acceptance an atomic SQLite transaction that also records an
outbox item.

The session also publishes the selected note ID and loading state, so a renderer
can distinguish an empty selection from an in-flight open. Accepted mutations
have a per-note epoch; therefore a late `get()` response cannot replace a
document already accepted by `apply()`.

## Local-first and synchronization rules

1. The document session has no network dependency.
2. A future repository implementation persists the accepted note change and
   durable sync operation together before acknowledging it to the session.
3. A future sync adapter may retry the operation using the same mutation ID;
   neither the editor nor the preview generates a new ID for a retry.
4. The current `revision` is an opaque local projection version. It is not a
   concurrency authority for title or body. `local-first-store` translates
   editor intents into Yjs updates and persists those updates with an outbox;
   React continues to consume only the projected strings.
5. Transient editor state such as selection, scroll, and Vim mode never becomes
   a document mutation.

## Commands

```bash
npm run lint
npm run typecheck
npm run test:ci
npm run build
```

## Project Structure

```text
src/shared/documents/
  document.types.ts        # Canonical types and discriminated mutations
  document.errors.ts       # Domain error codes/classes
  document.repository.ts   # Persistence/outbox port
  document.query.ts        # Active-note query port
  document.ipc.ts          # Serializable IPC result contract
src/renderer/platform/documents/
  DocumentSession.ts       # Session state and repository coordination
src/__tests__/platform/documents/
  DocumentSession.test.ts  # Session behavior and revision tests
src/test-support/documents/
  InMemoryDocumentRepository.ts  # Test-only repository fake
```

## Code Style

```ts
export type UpdateBodyMutation = Readonly<{
  id: MutationId;
  documentId: NoteId;
  baseRevision: Revision;
  source: DocumentMutationSource;
  kind: 'replace-body';
  body: string;
  occurredAt: string;
}>;
```

- Prefer discriminated unions over optional mutation fields.
- Keep public values immutable and validate input at the session/repository
  boundary.
- Do not import React, Electron, CodeMirror, or infrastructure adapters here.
- Preserve the repository's existing single-quote formatting and TypeScript
  naming conventions.

## Testing Strategy

- Jest unit tests must cover successful creation, body normalization,
  revision advancement, immutable snapshots, unsubscription, and each
  domain error.
- A fake in-memory repository may be used only in tests and in the first
  vertical slice; it must implement the same repository and query ports used by
  the consumer under test.
- Primitive factories reject malformed identifiers, sources, and mutation
  payload types with `INVALID_MUTATION`. Missing-document and revision-conflict
  behavior needs a repository and is tested in the following slices.
- The later `local-first-store` module must prove durable idempotency when it
  implements retries against the same mutation ID.
- No browser, Electron, or remote service is required for this module's tests.

## Boundaries

- Always: preserve immutable snapshots, normalize body text at the boundary,
  use stable mutation IDs, and run focused tests plus the project typecheck.
- Ask first: add a runtime dependency, alter existing UI models, change the
  current package/lockfile work, or choose an encryption/key-management design.
- Never: write directly to Supabase/HTTP from the renderer, store secrets in a
  note model, mutate a prior snapshot, or overwrite existing uncommitted work.

## Success Criteria

- An editor and preview can subscribe to the same active `NoteDocument`
  snapshot without knowing how it is stored.
- Every accepted content change is represented by a typed mutation with a
  stable ID and base revision.
- The module compiles and its unit tests demonstrate deterministic state,
  revision, and subscription behavior.
- No code in the module imports Electron, React, CodeMirror, SQLite, Supabase,
  or an HTTP client.

## Open Questions

- Encryption/key management and remote account authorization require separate
  approvals.
- The durable Yjs snapshot/update/outbox design is implemented in
  `src/main/documents/LocalDocumentStore.ts`; transport, compaction scheduling,
  and account authentication remain the next separate slices.
