import type { NoteSummary } from '../model/note.types';

import { PinIcon } from './NotesIcons';

type NoteListItemProps = {
  note: NoteSummary;

  selected: boolean;

  onSelect: (noteId: string) => void;
};

export function NoteListItem({ note, selected, onSelect }: NoteListItemProps) {
  return (
    <button
      type="button"
      className={['note-list-item', selected ? 'note-list-item--selected' : '']
        .filter(Boolean)
        .join(' ')}
      onClick={() => onSelect(note.id)}
      aria-current={selected ? 'true' : undefined}
    >
      <div className="note-list-item__title-row">
        {note.pinned && (
          <span className="note-list-item__pin">
            <PinIcon />
          </span>
        )}

        <span className="note-list-item__title">{note.title}</span>
      </div>

      <div className="note-list-item__metadata">
        <span className="note-list-item__updated">{note.updatedLabel}</span>

        {note.totalTasks !== undefined && note.completedTasks !== undefined && (
          <span className="note-list-item__tasks">
            {note.completedTasks} of {note.totalTasks}
          </span>
        )}

        <div className="note-list-item__tags">
          {note.tags.map((tag) => (
            <span
              key={tag.id}
              className={['note-tag', `note-tag--${tag.color}`].join(' ')}
            >
              {tag.label}
            </span>
          ))}
        </div>
      </div>

      <p className="note-list-item__excerpt">{note.excerpt}</p>
    </button>
  );
}
