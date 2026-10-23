# Tasks: `document-core`

## Task 1: Define document primitives and mutation validation

**Description:** Create the immutable domain types, discriminated mutation
union, normalization helpers, and explicit domain-error vocabulary that all
later document consumers share.

**Acceptance criteria:**

- [x] Note IDs, revisions, and mutation IDs cannot be accidentally exchanged
      in TypeScript call sites.
- [x] Markdown body text normalizes CRLF and CR to LF before a mutation is
      accepted.
- [x] Invalid identifiers and mutation payloads use the stable
      `INVALID_MUTATION` code.

**Verification:**

- [x] Tests pass: `npm test -- --runInBand src/__tests__/platform/documents/document.types.test.ts`
- [x] Typecheck passes: `npm run typecheck`

**Dependencies:** None.

**Files likely touched:**

- `src/shared/documents/document.types.ts`
- `src/shared/documents/document.errors.ts`
- `src/__tests__/platform/documents/document.types.test.ts`
- `src/renderer/platform/documents/document.types.type-check.ts`

**Estimated scope:** Medium (3 files).

## Task 2: Define repository port and test-only in-memory repository

**Description:** Introduce the storage boundary required by the session and a
deterministic in-memory implementation used only by tests. It must model
revision checking without adding production persistence.

**Acceptance criteria:**

- [x] `DocumentRepository` accepts valid mutations and returns immutable
      snapshots.
- [x] A stale base revision rejects with `REVISION_CONFLICT` rather than
      overwriting content.
- [x] A missing document rejects with `DOCUMENT_NOT_FOUND` when a mutation is
      applied.
- [x] The in-memory implementation is located only in test support and is not
      imported by production code.

**Verification:**

- [x] Tests pass: `npm test -- --runInBand src/__tests__/platform/documents/document.repository.test.ts`
- [x] Typecheck passes: `npm run typecheck`

**Dependencies:** Task 1.

**Files likely touched:**

- `src/shared/documents/document.repository.ts`
- `src/test-support/documents/InMemoryDocumentRepository.ts`
- `src/__tests__/platform/documents/document.repository.test.ts`

**Estimated scope:** Medium (3 files).

## Checkpoint: After Tasks 1–2

- [x] All focused domain tests pass.
- [x] `npm run typecheck` passes.
- [x] No dependency or existing uncommitted package/platform file changed
      without explicit approval.
- [x] Review the repository boundary before implementing session behavior.

## Task 3: Implement the document session vertical slice

**Description:** Build `DocumentSession` over the repository port so a future
editor and preview can open the same document, observe immutable snapshots,
apply mutations, and unsubscribe safely.

**Acceptance criteria:**

- [x] `open()` publishes an immutable loaded snapshot or returns a typed
      missing-document error.
- [x] `apply()` publishes only the repository-accepted document and preserves
      the previous snapshot when it fails.
- [x] Subscribers receive deterministic changes and receive none after
      `unsubscribe()`.

**Verification:**

- [x] Tests pass: `npm test -- --runInBand src/__tests__/platform/documents/DocumentSession.test.ts`
- [x] Typecheck passes: `npm run typecheck`
- [x] Build succeeds: `npm run build`

**Dependencies:** Tasks 1–2.

**Files likely touched:**

- `src/renderer/platform/documents/DocumentSession.ts`
- `src/renderer/platform/documents/index.ts`
- `src/__tests__/platform/documents/DocumentSession.test.ts`

**Estimated scope:** Medium (3 files).

## Checkpoint: Complete `document-core`

- [x] `npm run lint` passes.
- [x] `npm run typecheck` passes.
- [x] `npm run test:ci` passes.
- [x] `npm run build` passes.
- [x] The module has no imports of React, Electron, CodeMirror, SQLite,
      Supabase, or HTTP clients.
- [x] The result is reviewed before `local-first-store` is specified.
