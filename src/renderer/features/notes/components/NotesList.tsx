import type { NoteSummary } from '../model/note.types';

import { NoteListItem } from './NoteListItem';
import { ArchiveNoteIcon } from './NotesIcons';

type NotesListProps = {
  notes: NoteSummary[];

  selectedNoteId: string | null;

  onSelectNote: (noteId: string) => void;

  onArchiveNote?: (noteId: string) => void;

  onMoveNote?: (noteId: string) => void;
};

export function NotesList({
  notes,
  selectedNoteId,
  onSelectNote,
  onArchiveNote,
  onMoveNote,
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
            selected={selectedNoteId === note.id}
            onSelect={onSelectNote}
            onMove={onMoveNote}
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
