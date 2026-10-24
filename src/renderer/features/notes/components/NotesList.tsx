import type { MouseEvent } from 'react';

import type { NoteSummary } from '../model/note.types';

import { NoteListItem } from './NoteListItem';
import { ArchiveNoteIcon } from './NotesIcons';

type NotesListProps = {
  notes: NoteSummary[];

  selectedNoteId: string | null;

  selectedNoteIds?: readonly string[];

  onSelectNote: (noteId: string, isAdditive: boolean) => void;

  onContextMenu?: (
    noteId: string,
    event: MouseEvent<HTMLButtonElement>,
  ) => void;

  onArchiveNote?: (noteId: string) => void;

  onMoveNote?: (noteId: string) => void;

  onTagClick?: (tag: string, event: MouseEvent<HTMLButtonElement>) => void;
};

export function NotesList({
  notes,
  selectedNoteId,
  selectedNoteIds = [],
  onSelectNote,
  onContextMenu,
  onArchiveNote,
  onMoveNote,
  onTagClick,
}: NotesListProps) {
  if (notes.length === 0) {
    return (
      <div className="notes-empty-state">
        <strong>No notes found</strong>

        <span>Try another filter.</span>
      </div>
    );
  }

  return (
    <div className="notes-list" role="list" aria-label="Notes">
      {notes.map((note) => (
        <div key={note.id} role="listitem" className="note-tree-row">
          <NoteListItem
            note={note}
            selected={
              selectedNoteIds.length > 0
                ? selectedNoteIds.includes(note.id)
                : selectedNoteId === note.id
            }
            onSelect={(noteId, event) =>
              onSelectNote(noteId, event.metaKey || event.ctrlKey)
            }
            onContextMenu={
              onContextMenu === undefined
                ? undefined
                : (noteId, event) => onContextMenu(noteId, event)
            }
            onMove={onMoveNote}
            onTagClick={onTagClick}
          />
          {onArchiveNote !== undefined && (
            <button
              type="button"
              className="note-tree-row__archive"
              aria-label={`Move ${note.title} to Trash`}
              title="Move note to Trash"
              onClick={() => onArchiveNote(note.id)}
            >
              <ArchiveNoteIcon />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
