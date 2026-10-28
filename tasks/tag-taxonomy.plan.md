# Technical Plan: `tag-taxonomy`

Status: proposed on 2026-10-26. Implements only the approved
[tag-taxonomy specification](../SPEC-tag-taxonomy.md). A detailed task
checklist and production implementation require a separate approval.

## Audit result

The required foundations already exist:

- `tags` has a stable ID primary key, a case-insensitive unique `name`, every
  approved Inkdrop-compatible color, and creation/update timestamps.
- `note_tags` associates notes with a tag ID, so changing a display name does
  not require a relational schema migration.
- `LocalDocumentStore` writes every local Yjs update and its corresponding
  `sync_outbox` envelope inside one SQLite transaction. Its projection rebuild
  resolves the note's Yjs tag-name array back to catalogue IDs.
- `listTags` already follows the authorized main → preload → renderer read
  path and returns immutable summaries with active-note counts.
- The sidebar does not consume that read path: it currently derives tag names
  and name-hashed colors directly from active notes. No tag lifecycle command
  or UI exists.

The critical constraint is that a SQL-only rename or deletion would be
undone by a future projection rebuild, because Yjs still stores tag names.
The implementation therefore needs one authoritative main-process batch
operation that updates the catalogue plus every affected Yjs note update,
projection, and local outbox row in one SQLite transaction. It must support
archived notes without restoring them.

## Dependency graph

```text
shared tag lifecycle DTOs + request parser
                    |
                    v
atomic catalogue/Yjs/projection/outbox transaction
                    |
                    v
authorized IPC / preload / renderer repository
                    |
                    v
workspace catalogue state + focused-note refresh
                    |
                    v
lifecycle-safe tag commands + accessible sidebar UI
                    |
                    v
quality gate + disposable Electron smoke
```

The durable batch operation is deliberately first. Renderer commands and UI
cannot be allowed to invent their own note-by-note propagation policy.

## Architecture decisions

1. **Stable, additive write port:** add a `TagRepository` alongside the
   current read-only `TagQueryRepository`. It exposes `createTag`,
   `updateTag`, and `deleteTag` with complete typed inputs and immutable
   results. It does not overload `DocumentMutation`, expose a raw query, or
   remove the existing `listTags` behavior.
2. **Canonical name policy:** retain current lower-case normalization and
   case-insensitive uniqueness. New and updated values must be trimmed,
   non-empty, at most 64 characters, and use an existing `TagColor`. Legacy
   IDs remain valid for update/delete; new catalogue entries use the existing
   generated `tag:` IDs.
3. **All-or-nothing propagation:** color-only updates modify only the
   catalogue row. A rename first makes the new name resolvable in the
   catalogue, then emits one local Yjs update/outbox envelope per affected
   note and rewrites its projection. A delete emits equivalent tag-removal
   updates, then removes the now-unreferenced row. Any error rolls back the
   complete SQLite transaction.
4. **Archived notes stay archived:** the batch helper is private to
   `LocalDocumentStore`. It derives the affected notes from `note_tags`,
   preserves each note's deletion metadata, revision sequence, and other
   content, and is never exposed as an unrestricted renderer mutation.
5. **Narrow privilege boundary:** main handlers authorize senders, validate
   unknown IPC values through `DocumentIpcService`, and refresh the configured
   backup only after an accepted tag write. Preload forwards three explicit
   functions; renderer responses are revalidated.
6. **One command runtime, no keys:** `tag:new`, `tag:update`, `tag:delete`,
   and `tag:open` extend the current organization command contribution and
   typed request parser. They gain no declarative keymap, so `Cmd/Ctrl+P`,
   editor input, and existing organization shortcuts remain untouched.
7. **Durable catalogue UI:** `useDocumentWorkspace` owns a `tags` collection
   from the repository and refreshes document lists plus the focused document
   after an accepted rename/delete. Navigation uses saved colors/counts and
   supports tag creation and edit/delete actions without calling durable
   workspace mutations directly.
8. **Selection compatibility:** note filtering continues to match the
   normalized tag names currently stored in notes. Tag rows use their stable
   `TagId` as React/command identity; a successful rename replaces the old
   name inside an active tag filter, while deletion falls back to All Notes if
   it removed the selected tag.
9. **Explicit destructive UI:** deletion offers the current tag name and
   warns that all associations, including archived-note associations, will be
   removed. No mutation is dispatched after cancellation.

## Implementation phases

### Phase 1 — Contract and durable lifecycle transaction

Add pure shared `CreateTagInput`, `UpdateTagInput`, `DeleteTagInput`, and
result validation with focused invalid-input coverage. Extend the repository
interfaces and `LocalDocumentStore` with three SQLite transactions.

The rename/delete transactions first collect an ID-sorted affected-note set,
validate all invariants, then write the catalogue and replay a constrained
tag-array change for each note into Yjs, projections, `note_crdt_updates`,
and `sync_outbox`. The existing single-note public lifecycle guard remains in
place; the private helper deliberately preserves archived state rather than
using a renderer-accessible mutation.

Checkpoint: tests prove create/recolor/rename/delete with active and archived
fixtures; duplicate/invalid and injected-mid-batch failures preserve all
catalogue, note, update, and outbox state. No migration or dependency is
introduced.

### Phase 2 — Authorized transport and coherent workspace state

Carry the write port through IPC channels, `DocumentIpcService`, sender
authorization, preload, bridge, and `IpcDocumentRepository`, matching
notebook error envelopes and configured-backup behavior.

Add `tags` to the document workspace snapshot and load it in the existing
parallel refresh. After a successful tag lifecycle operation, refresh the
catalogue and note lists and re-open the selected document if necessary so an
editor cannot show a stale name. Failed operations preserve the prior visible
state and surface the existing workspace error path.

Checkpoint: focused IPC, preload/repository, and workspace tests prove
untrusted input cannot cross the boundary, accepted changes refresh all
affected projections, and failures never optimistically alter the UI.

### Phase 3 — Command contribution and intent routing

Extend the organization command ID union and pure plugin registration, then
add a tag request parser/executor patterned after the notebook request model.
The workspace page resolves an invocation only when the command and typed
request agree, passes current callbacks, and preserves provenance.

`tag:open` returns a current catalogue row for the navigation layer; create,
update, and delete delegate only to the workspace's tag actions. No keymap
descriptor is added.

Checkpoint: Strict Mode tests show one registration and fresh callbacks;
malformed detail and unmatched commands are no-ops; existing keymap tests
prove no new interception.

### Phase 4 — Accessible catalogue navigation

Replace the note-derived sidebar tag list with the workspace catalogue. Render
the persisted color and active count, include zero-count tags, retain search
and existing tag-filter semantics, and introduce accessible create/edit form
state plus edit/delete context actions.

Use explicit labelled controls for name/color, initial focus, Escape/cancel,
visible validation failure, and a destructive confirmation that names the
tag's association-removal effect. Reconcile a selected filter after accepted
rename/delete without changing unrelated notebook/status selection.

Checkpoint: navigation tests cover colors, counts, zero-count visibility,
focus/errors, confirmation/cancel, accepted rename/delete selection behavior,
and command provenance. Existing editor add/remove-tag and note-list tag
tests remain green.

### Phase 5 — Regression and user-safe smoke

Run the complete quality gate, review the final diff and command/keymap
ownership, and run an Electron smoke test with a fresh empty tag and only a
fresh disposable note. Verify create, recolor, rename, assignment,
selection/filtering, and delete confirmation; delete only the owned test
objects after a fresh explicit confirmation.

Checkpoint: no production profile content is edited or deleted; the
temporary tag and disposable note are absent after cleanup; the read-only
catalogue/tree integrity observations remain stable.

## Verification matrix

| Area | Automated evidence | Manual evidence |
| --- | --- | --- |
| Contracts | Shared validation, ID, color, uniqueness, and result tests | Inspect that current legacy IDs can still be read/targeted. |
| Store | Transaction rollback, active/archived propagation, Yjs/projection/outbox agreement | Use only a temporary tag and temporary note. |
| Boundary | Service, sender authorization, preload and renderer-repository tests | Confirm renderer code never receives a database path or Node API. |
| Commands | Plugin lifecycle, request parser, provenance, Strict Mode, no-keymap tests | Confirm `Cmd/Ctrl+P` and editor typing are unchanged. |
| UI | Navigation/component tests for catalog rows, color, count, dialog and selection | Inspect focus, error, cancel, confirmation, and narrow layout in Electron. |
| Final | `npm run verify` | Create/recolor/rename/delete only disposable objects, then re-check cleanup. |

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| SQL rename/delete diverges from Yjs and reappears after projection rebuild | High | Update all associated Yjs arrays and projections in one transaction; test a reopen/rebuild path. |
| Archived notes cannot accept the existing public tag mutation | High | Use a private main-process propagation helper that preserves archived state; keep the public guard unchanged. |
| Partial batch write leaves an outbox/projection mismatch | High | Preflight IDs and capture all local updates under one SQLite transaction; inject a failure mid-batch in tests. |
| Rename collides with an existing tag | Medium | Enforce case-insensitive uniqueness before any Yjs update; reject rather than merge. |
| Sidebar accidentally changes existing filters or colors | Medium | Preserve name-based filter compatibility, change only catalogue source/color, and add navigation regression tests. |
| Command extension reintroduces a lifecycle/shortcut regression | High | Reuse the one runtime, add IDs only, add no keymap, and retain Strict Mode/keymap tests. |
| Smoke alters user data | High | Use a clearly owned empty tag and note; request explicit deletion confirmation immediately before cleanup. |

## Sequencing and parallelism

- Phases 1 → 2 → 3 → 4 are sequential because each consumes the previous
  durable contract.
- Focused tests can be authored alongside their owning phase, but no UI work
  begins until the transport returns canonical accepted values.
- Phase 5 occurs only after all automated checks pass. No source edits, new
  dependencies, migration, global shortcut, search expansion, or remote sync
  are authorized by this plan.

## Approval gate

Approve this technical plan to create the detailed `tag-taxonomy` task
checklist. After that checklist is separately approved, implementation will
proceed in the phases above with one tested, atomic commit per vertical slice.
