import type { NoteSummary } from '../model/note.types';

import { NoteListItem } from './NoteListItem';

type NotesListProps = {
  notes: NoteSummary[];

  selectedNoteId: string | null;

  onSelectNote: (noteId: string) => void;
};

export function NotesList({
  notes,
  selectedNoteId,
  onSelectNote,
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
    <div className="notes-list">
      {notes.map((note) => (
        <NoteListItem
          key={note.id}
          note={note}
          selected={selectedNoteId === note.id}
          onSelect={onSelectNote}
        />
      ))}
    </div>
  );
}
