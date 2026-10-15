import { useState } from 'react';

import { notesMock } from '../data/notes.mock';
import { useNotesFilter } from '../hooks/useNotesFilter';

import { NotesFilter } from './NotesFilter';
import { NotesList } from './NotesList';

import '../styles/notes.css';

export const NotesPanel = () => {
  const [filterQuery, setFilterQuery] = useState('');

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(
    notesMock[0]?.id ?? null,
  );

  const filteredNotes = useNotesFilter(notesMock, filterQuery);

  return (
    <>
      <div className="notes-panel">
        <div className="notes-panel__filter">
          <NotesFilter value={filterQuery} onChange={setFilterQuery} />
        </div>

        <div className="notes-panel__results" aria-live="polite">
          <NotesList
            notes={filteredNotes}
            selectedNoteId={selectedNoteId}
            onSelectNote={setSelectedNoteId}
          />
        </div>
      </div>
    </>
  );
};
