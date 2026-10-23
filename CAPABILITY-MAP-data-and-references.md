# Capability map: local data and note references

| Module | Responsibility | Depends on |
| --- | --- | --- |
| `data-management` | Expose the local data directory; configure, create and restore local backups; export all notes as Markdown. | document core |
| `note-references` | Insert stable note links, render them as cards, and open their target note. | document core, `data-management` export format |
| `editor-theme` | Apply the existing semantic theme tokens to Markdown and code syntax in the editor and preview. | existing workspace preferences |

Build order: `data-management` → `note-references` → `editor-theme`.

The modules only communicate through typed, preload-backed contracts. No renderer code receives filesystem access.
