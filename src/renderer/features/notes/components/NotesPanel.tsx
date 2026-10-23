import { useMemo, useState } from 'react';

import type { NavigationSelection } from '../../navigation/model/navigation.types';
import { descendantNotebookIds } from '../../navigation/model/notebookTree';

import type {
  NoteDocument,
  NoteId,
  Notebook,
} from '../../../../shared/documents/document.types';

import { useNotesFilter } from '../hooks/useNotesFilter';
import type { NoteSummary } from '../model/note.types';
import { colorForTag } from '../model/notePresentation';

import { NotesFilter } from './NotesFilter';
import { NotesList } from './NotesList';
import { MoveNoteDialog } from './MoveNoteDialog';

import '../styles/notes.css';

type NotesPanelProps = {
  navigationSelection: NavigationSelection;
  documents: readonly NoteDocument[];
  notebooks?: readonly Notebook[];
  selectedNoteId: NoteId | null;
  isLoading: boolean;
  error: unknown;
  onSelectNote: (noteId: NoteId) => void;
  onArchiveNote?: (note: NoteDocument) => Promise<unknown>;
  onMoveNote?: (note: NoteDocument, notebookId: string) => Promise<unknown>;
};

export function NotesPanel({
  navigationSelection,
  documents,
  notebooks = [],
  selectedNoteId,
  isLoading,
  error,
  onSelectNote,
  onArchiveNote,
  onMoveNote,
}: NotesPanelProps) {
  const [filterQuery, setFilterQuery] = useState('');
  const [moveNoteId, setMoveNoteId] = useState<NoteId | null>(null);
  const scopedDocuments = useMemo(
    () =>
      filterDocumentsForNavigation(documents, navigationSelection, notebooks),
    [documents, navigationSelection, notebooks],
  );
  const notes = useMemo(
    () => scopedDocuments.map(toNoteSummary),
    [scopedDocuments],
  );
  const filteredNotes = useNotesFilter(notes, filterQuery);
  const archiveNote = (id: string): void => {
    const note = scopedDocuments.find((document) => document.id === id);

    if (note === undefined || onArchiveNote === undefined) {
      return;
    }

    const description = `Move “${note.title || 'Untitled'}” to Trash?`;

    if (globalThis.confirm(description)) {
      void onArchiveNote(note);
    }
  };
  const noteToMove =
    moveNoteId === null
      ? null
      : (scopedDocuments.find((document) => document.id === moveNoteId) ??
        null);

  return (
    <div
      className="notes-panel"
      aria-label={`${navigationSelection.label} notes`}
      data-navigation-view={navigationSelection.view.type}
    >
      <div className="notes-panel__filter">
        <NotesFilter value={filterQuery} onChange={setFilterQuery} />
      </div>

      <div className="notes-panel__results" aria-live="polite">
        {isLoading ? (
          <div className="notes-empty-state">Loading notes…</div>
        ) : error !== null ? (
          <div className="notes-empty-state" role="alert">
            Unable to load notes.
          </div>
        ) : (
          <NotesList
            notes={filteredNotes}
            selectedNoteId={selectedNoteId}
            onSelectNote={(id) => onSelectNote(id as NoteId)}
            onArchiveNote={
              onArchiveNote === undefined ||
              navigationSelection.view.type === 'trash'
                ? undefined
                : archiveNote
            }
            onMoveNote={
              onMoveNote === undefined ||
              navigationSelection.view.type === 'trash'
                ? undefined
                : (noteId) => setMoveNoteId(noteId as NoteId)
            }
          />
        )}
      </div>
      {noteToMove !== null && onMoveNote !== undefined && (
        <MoveNoteDialog
          note={noteToMove}
          notebooks={notebooks}
          onMove={onMoveNote}
          onClose={() => setMoveNoteId(null)}
        />
      )}
    </div>
  );
}

export const toNoteSummary = (document: NoteDocument): NoteSummary => {
  const taskProgress = summarizeTaskProgress(document.body);

  return {
    id: document.id,
    title: document.title || 'Untitled',
    excerpt: excerptFromMarkdown(document.body) || 'Empty note',
    updatedLabel: formatUpdatedAt(document.updatedAt),
    status: document.status,
    ...(taskProgress === null
      ? {}
      : {
          completedTasks: taskProgress.completed,
          totalTasks: taskProgress.total,
        }),
    tags: document.tags.map((tag) => ({
      id: tag,
      label: tag,
      color: colorForTag(tag),
    })),
  };
};

type TaskProgress = Readonly<{
  completed: number;
  total: number;
}>;

const TASK_ITEM = /^\s*[-+*]\s+\[([ xX])\]\s+/;
const FENCED_CODE = /^\s*(`{3,}|~{3,})/;

/**
 * Lightweight task parsing for the note list. It deliberately skips fenced
 * code, so examples such as `- [x]` do not pretend to be note progress.
 */
export const summarizeTaskProgress = (
  markdown: string,
): TaskProgress | null => {
  let total = 0;
  let completed = 0;
  let activeFence: '`' | '~' | null = null;

  for (const line of markdown.split('\n')) {
    const fence = line.match(FENCED_CODE)?.[1];

    if (fence !== undefined) {
      const fenceCharacter = fence[0] as '`' | '~';

      if (activeFence === null) {
        activeFence = fenceCharacter;
      } else if (activeFence === fenceCharacter) {
        activeFence = null;
      }

      continue;
    }

    if (activeFence !== null) {
      continue;
    }

    const task = line.match(TASK_ITEM);

    if (task === null) {
      continue;
    }

    total += 1;
    completed += task[1].toLocaleLowerCase() === 'x' ? 1 : 0;
  }

  return total === 0 ? null : { completed, total };
};

const excerptFromMarkdown = (markdown: string): string | null => {
  for (const rawLine of markdown.split('\n')) {
    const line = rawLine
      .trim()
      .replace(/^#{1,6}\s+/, '')
      .replace(/^[-+*]\s+\[[ xX]\]\s+/, '')
      .replace(/^[-+*]\s+/, '')
      .replace(/^>\s?/, '')
      .replace(/[`*_~]/g, '');

    if (line.length > 0 && !FENCED_CODE.test(line)) {
      return line;
    }
  }

  return null;
};

export const filterDocumentsForNavigation = (
  documents: readonly NoteDocument[],
  selection: NavigationSelection,
  notebooks: readonly Notebook[] = [],
): readonly NoteDocument[] => {
  switch (selection.view.type) {
    case 'all-notes':
      return documents;
    case 'inbox':
      return documents.filter((document) => document.notebookId === 'inbox');
    case 'notebook': {
      const { notebookId, includeDescendants = false } = selection.view;
      const notebookIds = includeDescendants
        ? descendantNotebookIds(notebooks, notebookId)
        : new Set([notebookId]);

      return documents.filter((document) =>
        notebookIds.has(document.notebookId),
      );
    }
    case 'project': {
      const projectId = selection.view.projectId;

      return documents.filter((document) => document.notebookId === projectId);
    }
    case 'status': {
      const { notebookId, status } = selection.view;
      const notebookIds =
        notebookId === undefined
          ? null
          : descendantNotebookIds(notebooks, notebookId);

      return documents.filter(
        (document) =>
          document.status === status &&
          (notebookIds === null || notebookIds.has(document.notebookId)),
      );
    }
    case 'tag': {
      const { notebookId, tagId } = selection.view;
      const notebookIds =
        notebookId === undefined
          ? null
          : descendantNotebookIds(notebooks, notebookId);

      return documents.filter(
        (document) =>
          document.tags.includes(tagId) &&
          (notebookIds === null || notebookIds.has(document.notebookId)),
      );
    }
    case 'templates':
    case 'trash':
      return [];
  }
};

const formatUpdatedAt = (value: string): string => {
  const updatedAt = new Date(value);

  if (Number.isNaN(updatedAt.getTime())) {
    return value;
  }

  const elapsed = Date.now() - updatedAt.getTime();

  if (elapsed >= 0 && elapsed < 60_000) {
    return 'Just now';
  }

  if (elapsed >= 60_000 && elapsed < 3_600_000) {
    const minutes = Math.floor(elapsed / 60_000);

    return `${minutes} min ago`;
  }

  if (elapsed >= 3_600_000 && elapsed < 86_400_000) {
    const hours = Math.floor(elapsed / 3_600_000);

    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  if (elapsed >= 86_400_000 && elapsed < 604_800_000) {
    const days = Math.floor(elapsed / 86_400_000);

    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  return updatedAt.toLocaleDateString();
};
