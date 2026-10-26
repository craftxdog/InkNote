# Capability Map: content organization

Status: approved revision 2 on 2026-10-25.

This map indexes the independently verifiable work for improving notes,
notebooks, and tags while preserving InkNote's local-first SQLite/Yjs
architecture. It captures the approved semantic alignment with Inkdrop's
organization model; it does not adopt CouchDB/PouchDB as a storage engine.

| Module id | Responsibility | Depends on |
| --- | --- | --- |
| `organization-commands` | Renderer command adapter, lifecycle safety, and the first command-driven note creation slice. | — |
| `organization-data-model` | SQLite/Yjs-safe semantic alignment: tag identities, note organization metadata, query indexes, and compatibility migrations. | — |
| `note-organization` | Command-driven note lifecycle, pinning, default-notebook policy, multi-move, and navigation history. | `organization-commands`, `organization-data-model` |
| `notebook-taxonomy` | Editing existing notebooks: name, parent, icon, counts, and command-driven access. | `organization-commands`, `organization-data-model` |
| `tag-taxonomy` | Persistent tag catalogue UI, editable colors, lifecycle operations, and safe propagation to note associations. | `organization-commands`, `organization-data-model` |
| `organization-search` | Indexed global/local note search and documented notebook, tag, status, title, and body qualifiers. | `organization-data-model`, `tag-taxonomy` |
| `organization-discovery` | A command/notebook/tag discovery surface compatible with the command registry. | `organization-commands`, `notebook-taxonomy`, `tag-taxonomy` |

Build order: `organization-commands` → `organization-data-model` →
`note-organization`, `notebook-taxonomy`, `tag-taxonomy` →
`organization-search` → `organization-discovery`.

The first two modules establish independent boundaries: one for user intents
and one for durable data. The three taxonomy modules consume both boundaries.
Search and discovery follow only once they can query stable command and
organization data. Templates, sharing, attachments, remote synchronization,
and a CouchDB/PouchDB engine remain intentionally outside this initiative.
