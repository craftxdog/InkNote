import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react';

import type { NoteSummary } from '../model/note.types';

import { NoteStatusIcon, PinIcon, TaskProgressIcon } from './NotesIcons';

type NoteListItemProps = {
  note: NoteSummary;

  selected: boolean;

  onSelect: (noteId: string, event: MouseEvent<HTMLButtonElement>) => void;

  onContextMenu?: (
    noteId: string,
    event: MouseEvent<HTMLButtonElement>,
  ) => void;

  onMove?: (noteId: string) => void;
};

const statusLabels = {
  active: 'Active',
  'on-hold': 'On hold',
  completed: 'Completed',
  dropped: 'Dropped',
} as const;

export function NoteListItem({
  note,
  selected,
  onSelect,
  onContextMenu,
  onMove,
}: NoteListItemProps) {
  const visibleTags = note.tags.slice(0, 2);
  const hiddenTagCount = note.tags.length - visibleTags.length;
  const taskProgress =
    note.totalTasks !== undefined && note.completedTasks !== undefined
      ? Math.round((note.completedTasks / note.totalTasks) * 100)
      : null;

  return (
    <button
      type="button"
      className={['note-list-item', selected ? 'note-list-item--selected' : '']
        .filter(Boolean)
        .join(' ')}
      onClick={(event) => onSelect(note.id, event)}
      onContextMenu={(event) => {
        if (onContextMenu === undefined) {
          return;
        }

        event.preventDefault();
        onContextMenu(note.id, event);
      }}
      onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key !== 'm' || onMove === undefined) {
          return;
        }

        event.preventDefault();
        onMove(note.id);
      }}
      aria-keyshortcuts={onMove === undefined ? undefined : 'm'}
      aria-current={selected ? 'true' : undefined}
    >
      <div className="note-list-item__title-row">
        {note.pinned && (
          <span
            className="note-list-item__pin"
            aria-label="Pinned note"
            title="Pinned note"
          >
            <PinIcon />
          </span>
        )}

        {note.status !== undefined && (
          <span
            className={[
              'note-list-item__status',
              `note-list-item__status--${note.status}`,
            ].join(' ')}
            aria-label={`${statusLabels[note.status]} status`}
            title={`${statusLabels[note.status]} status`}
          >
            <NoteStatusIcon status={note.status} />
          </span>
        )}

        <span className="note-list-item__title">{note.title}</span>
      </div>

      <div className="note-list-item__metadata">
        <span className="note-list-item__updated">{note.updatedLabel}</span>

        {taskProgress !== null && (
          <span className="note-list-item__tasks">
            <span className="note-list-item__task-icon">
              <TaskProgressIcon />
            </span>
            <span
              className="note-list-item__progress"
              role="progressbar"
              aria-label={`${note.completedTasks} of ${note.totalTasks} tasks completed`}
              aria-valuemin={0}
              aria-valuemax={note.totalTasks}
              aria-valuenow={note.completedTasks}
              aria-valuetext={`${note.completedTasks} of ${note.totalTasks} tasks completed`}
              style={{ '--task-progress': `${taskProgress}%` } as CSSProperties}
            >
              <span className="note-list-item__progress-fill" />
            </span>
            <span>
              {note.completedTasks} of {note.totalTasks}
            </span>
          </span>
        )}

        <div className="note-list-item__tags" aria-label="Note tags">
          {visibleTags.map((tag) => (
            <span
              key={tag.id}
              className={['note-tag', `note-tag--${tag.color}`].join(' ')}
            >
              {tag.label}
            </span>
          ))}
          {hiddenTagCount > 0 && (
            <span
              className="note-tag note-tag--more"
              title={note.tags
                .slice(visibleTags.length)
                .map((tag) => tag.label)
                .join(', ')}
              aria-label={`${hiddenTagCount} more tags`}
            >
              +{hiddenTagCount}
            </span>
          )}
        </div>
      </div>

      <p className="note-list-item__excerpt">{note.excerpt}</p>
    </button>
  );
}
