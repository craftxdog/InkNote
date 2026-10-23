# Capability Map: Editor Platform

Status: approved by the product owner on 2026-10-20.

## Goal

Build InkNote's local-first Markdown editor as an extensible platform inspired
by the public Inkdrop module contracts. The platform uses CodeMirror 6 and its
Vim extension; it does not claim compatibility with arbitrary VimScript, Lua,
Neovim, or third-party Inkdrop packages.

| Module id             | Responsibility                                                                        | Depends on                                            |
| --------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `document-core`       | Canonical note-document types, sessions, revisions, mutations, and storage/sync ports | —                                                     |
| `local-first-store`   | SQLite persistence, Yjs snapshots/updates, migrations, durable outbox, and repository implementation | `document-core` |
| `plugin-kernel`       | Injected environment, configuration, commands, disposables, and context-aware keymaps | —                                                     |
| `editor-runtime`      | CodeMirror Markdown editor, active-editor lifecycle, extension registry, and Vim mode | `document-core`, `local-first-store`, `plugin-kernel` |
| `preview-runtime`     | Markdown rendering, sanitization, preview events, and renderer extension registries   | `document-core`, `plugin-kernel`                      |
| `ui-contributions`    | Component registry, layouts, context menus, and application-menu contributions        | `plugin-kernel`, `editor-runtime`                     |
| `remote-sync-adapter` | NestJS/Supabase sync client that exchanges idempotent Yjs update envelopes from the durable outbox | `local-first-store` |

Build order: `document-core` → `local-first-store` and `plugin-kernel` →
`editor-runtime` and `preview-runtime` → `ui-contributions` →
`remote-sync-adapter`.

## Non-negotiable boundaries

- Every local note intent follows `editor/command/preview → document session →
local Yjs transaction + durable update/outbox → future sync adapter`. A plain
body replacement is never the remote conflict-resolution protocol.
- The renderer process never receives database credentials, privileged Supabase
  credentials, or direct access to the future HTTP sync service.
- Cursor position, scroll position, and Vim mode are local ephemeral state.
  Note content, revisions, and explicit synchronization operations are durable.
- Yjs update state is introduced with the first local store so own-device
concurrent editing can converge from v1. Multi-user presence remains a later
feature built on the same update protocol.
- Extensions register only through InkNote-owned APIs and clean up their
  contributions when deactivated.
- Current uncommitted package and platform files are user work and remain
  untouched unless explicitly included in an approved task.
