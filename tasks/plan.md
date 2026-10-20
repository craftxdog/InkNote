# Implementation Plan: `document-core`

## Overview

Implement a framework-free document-domain module that makes one note snapshot
available to future editor and preview consumers. The module ends at the
repository boundary: it models local-first mutations but performs no disk,
IPC, HTTP, Supabase, React, or CodeMirror work.

## Dependency Graph

```text
document types + validation + domain errors
                │
                ├── repository port
                │       │
                │       └── test-only in-memory repository
                │
                └── document session
                         │
                         └── session behavior tests
```

The implementation follows this graph bottom-up. The test-only repository is
the minimum vertical slice that lets the session prove its contract before the
SQLite-backed repository exists.

## Architecture Decisions

- `NoteDocument` is the canonical immutable Markdown snapshot; React and
  CodeMirror remain consumers, not owners, of it.
- Mutations are discriminated unions with stable operation IDs and base
  revisions. The session delegates acceptance to `DocumentRepository`, then
  publishes the accepted immutable result.
- Subscription uses the module-local `DocumentSubscription.unsubscribe()` API.
  The current uncommitted shared disposable helper is intentionally untouched;
  the future `plugin-kernel` will establish the public plugin disposable API.
- The in-memory repository exists only under test support. Production disk
  persistence and durable idempotency belong to `local-first-store`.
- Revision conflicts are explicit domain errors; this module never silently
  overwrites a snapshot whose base revision is stale.

## Task List

Tasks are tracked in [todo.md](todo.md). They are intentionally small and
ordered by the dependency graph.

### Phase 1: Domain foundation

- [x] Task 1: Define immutable document primitives and mutation validation.
- [x] Task 2: Define the repository boundary and a test-only in-memory fake.

### Checkpoint: Domain foundation

- [x] Focused domain tests pass.
- [x] `npm run typecheck` passes without unapproved package changes.
- [x] Confirm no production dependency imports React, Electron, CodeMirror,
      SQLite, Supabase, or HTTP.

### Phase 2: Usable document session

- [x] Task 3: Implement and test document opening, mutation application, and
      subscriptions through the repository port.

### Checkpoint: Complete `document-core`

- [x] `npm run lint` passes.
- [x] `npm run typecheck` passes.
- [x] `npm run test:ci` passes.
- [x] The document-session tests prove normalization, revision handling,
      immutability, errors, and unsubscription.
- [x] Review the completed module before specifying `local-first-store`.

## Verification Strategy

- Start each implementation task with focused failing Jest tests.
- Run the relevant test file while iterating.
- At each checkpoint, run the complete typecheck and test command from
  `package.json`.
- Build only at the final checkpoint because this capability adds no Electron
  runtime dependency; run `npm run build` before merging the capability.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Existing package/lockfile changes downgrade unrelated tooling | High | Do not change dependency files except for an explicitly approved baseline repair; verify the resulting lockfile and surface unrelated changes. |
| A session leaks UI/editor implementation details | High | Enforce import-free domain files and unit-test only the port contract. |
| Whole-document replacement hides concurrency failures | High | Require stable mutation IDs and base revisions; reject revision conflicts explicitly. |
| Test fake becomes a production storage substitute | Medium | Locate it only beneath test support and exclude it from production imports. |
| Yjs design is prematurely embedded into the editor model | Medium | Keep revision opaque and defer CRDT representation to `remote-sync-adapter`. |

## Open Questions

- The SQLite package, migration workflow, and encryption design will be
  selected in the `local-first-store` specification.
- The remote sync protocol and the mapping of Yjs updates to durable outbox
  operations will be specified only after local persistence is proven.
