import { useCallback, useEffect, useMemo, useState } from 'react';

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
  onArchiveNotes?: (notes: readonly NoteDocument[]) => Promise<unknown>;
  onMoveNote?: (note: NoteDocument, notebookId: string) => Promise<unknown>;
  onRestoreNotes?: (
    notes: readonly NoteDocument[],
    notebookId: string,
  ) => Promise<unknown>;
  onDeletePermanently?: (notes: readonly NoteDocument[]) => Promise<unknown>;
  onDuplicateNote?: (note: NoteDocument) => Promise<unknown>;
  onFilterByTag?: (tag: string, exclusive: boolean) => void;
};

type MoveRequest = Readonly<{
  notes: readonly NoteDocument[];
  mode: 'move' | 'restore';
}>;

type ContextMenuPosition = Readonly<{
  left: number;
  top: number;
}>;

/**
 * The list keeps a local multi-selection independent from the document
 * session. One selected note still drives the editor; the selection set is
 * only for list-level Inkdrop actions such as Trash, restore and duplicate.
 */
export function NotesPanel({
  navigationSelection,
  documents,
  notebooks = [],
  selectedNoteId,
  isLoading,
  error,
  onSelectNote,
  onArchiveNote,
  onArchiveNotes,
  onMoveNote,
  onRestoreNotes,
  onDeletePermanently,
  onDuplicateNote,
  onFilterByTag,
}: NotesPanelProps) {
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedNoteIds, setSelectedNoteIds] = useState<readonly NoteId[]>([]);
  const [moveRequest, setMoveRequest] = useState<MoveRequest | null>(null);
  const [contextNoteId, setContextNoteId] = useState<NoteId | null>(null);
  const [contextMenuPosition, setContextMenuPosition] =
    useState<ContextMenuPosition | null>(null);
  const [
    isPermanentDeleteConfirmationOpen,
    setPermanentDeleteConfirmationOpen,
  ] = useState(false);
  const isTrash = navigationSelection.view.type === 'trash';
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
  const visibleNotes = useMemo(
    () =>
      shouldHideTerminalStatuses(navigationSelection, filterQuery)
        ? filteredNotes.filter(
            (note) => note.status !== 'completed' && note.status !== 'dropped',
          )
        : filteredNotes,
    [filteredNotes, filterQuery, navigationSelection],
  );
  const scopedNotesById = useMemo(
    () => new Map(scopedDocuments.map((note) => [note.id, note])),
    [scopedDocuments],
  );

  const selection = useMemo(() => {
    const localSelection = selectedNoteIds
      .map((noteId) => scopedNotesById.get(noteId))
      .filter((note): note is NoteDocument => note !== undefined);

    if (localSelection.length > 0) {
      return localSelection;
    }

    if (selectedNoteId === null) {
      return [];
    }

    const selected = scopedNotesById.get(selectedNoteId);

    return selected === undefined ? [] : [selected];
  }, [scopedNotesById, selectedNoteId, selectedNoteIds]);
  const contextNote =
    contextNoteId === null
      ? null
      : (scopedNotesById.get(contextNoteId) ?? null);
  const closeContextMenu = useCallback(() => {
    setContextNoteId(null);
    setContextMenuPosition(null);
  }, []);

  const selectNote = (noteId: string, isAdditive: boolean): void => {
    const typedNoteId = noteId as NoteId;

    setSelectedNoteIds((current) => {
      if (!isAdditive) {
        return [typedNoteId];
      }

      return current.includes(typedNoteId)
        ? current.filter((selectedId) => selectedId !== typedNoteId)
        : [...current, typedNoteId];
    });
    onSelectNote(typedNoteId);
  };

  const archiveNotes = useCallback(
    async (notesToArchive: readonly NoteDocument[]) => {
      if (notesToArchive.length === 0) {
        return;
      }

      if (onArchiveNotes !== undefined) {
        await onArchiveNotes(notesToArchive);
      } else if (onArchiveNote !== undefined) {
        for (const note of notesToArchive) {
          await onArchiveNote(note);
        }
      } else {
        return;
      }

      setSelectedNoteIds([]);
      setContextNoteId(null);
    },
    [onArchiveNote, onArchiveNotes],
  );

  const duplicateNote = useCallback(
    async (note: NoteDocument): Promise<void> => {
      if (onDuplicateNote === undefined) {
        return;
      }

      await onDuplicateNote(note);
      setSelectedNoteIds([]);
      setContextNoteId(null);
      setContextMenuPosition(null);
    },
    [onDuplicateNote],
  );

  const restoreNotes = async (
    notesToRestore: readonly NoteDocument[],
    notebookId: string,
  ): Promise<void> => {
    if (onRestoreNotes === undefined) {
      return;
    }

    await onRestoreNotes(notesToRestore, notebookId);
    setSelectedNoteIds([]);
    setMoveRequest(null);
  };

  const permanentlyDeleteNotes = async (): Promise<void> => {
    if (onDeletePermanently === undefined) {
      return;
    }

    await onDeletePermanently(selection);
    setSelectedNoteIds([]);
    setContextNoteId(null);
    setPermanentDeleteConfirmationOpen(false);
  };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && contextMenuPosition !== null) {
        event.preventDefault();
        closeContextMenu();
        return;
      }

      if (
        event.defaultPrevented ||
        isEditableTarget(event.target) ||
        moveRequest !== null ||
        isPermanentDeleteConfirmationOpen
      ) {
        return;
      }

      const deletesSelection =
        event.key === 'Delete' ||
        (event.key === 'Backspace' && (event.metaKey || event.ctrlKey));

      if (deletesSelection && !isTrash) {
        event.preventDefault();
        void archiveNotes(selection);
        return;
      }

      if (
        event.key.toLocaleLowerCase() === 'd' &&
        (event.metaKey || event.ctrlKey) &&
        selection.length === 1 &&
        !isTrash
      ) {
        event.preventDefault();
        void duplicateNote(selection[0]);
      }
    };

    window.addEventListener('keydown', handleShortcut, true);

    return () => window.removeEventListener('keydown', handleShortcut, true);
  }, [
    archiveNotes,
    closeContextMenu,
    contextMenuPosition,
    duplicateNote,
    isPermanentDeleteConfirmationOpen,
    isTrash,
    moveRequest,
    selection,
  ]);

  const renderSelectionActions = () => {
    if (selection.length === 0) {
      return null;
    }

    const noteLabel = selection.length === 1 ? 'note' : 'notes';

    if (isTrash) {
      return (
        <div
          className="notes-panel__selection-actions"
          role="region"
          aria-label="Trash selection actions"
        >
          <span>{selection.length} selected</span>
          <button
            type="button"
            onClick={() =>
              setMoveRequest({ notes: selection, mode: 'restore' })
            }
          >
            Move {selection.length} {noteLabel} to notebook
          </button>
          <button
            type="button"
            className="notes-panel__destructive-action"
            onClick={() => setPermanentDeleteConfirmationOpen(true)}
          >
            Delete {selection.length} {noteLabel} permanently
          </button>
        </div>
      );
    }

    return (
      <div
        className="notes-panel__selection-actions"
        role="region"
        aria-label="Selected note actions"
      >
        <span>{selection.length} selected</span>
        <button type="button" onClick={() => void archiveNotes(selection)}>
          Move {selection.length} {noteLabel} to Trash
        </button>
      </div>
    );
  };

  return (
    <div
      className="notes-panel"
      aria-label={`${navigationSelection.label} notes`}
      data-navigation-view={navigationSelection.view.type}
    >
      <div className="notes-panel__filter">
        <NotesFilter value={filterQuery} onChange={setFilterQuery} />
        {renderSelectionActions()}
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
            notes={visibleNotes}
            selectedNoteId={selectedNoteId}
            selectedNoteIds={selection.map((note) => note.id)}
            onSelectNote={selectNote}
            onContextMenu={(noteId, event) => {
              const note = scopedNotesById.get(noteId as NoteId);

              if (note === undefined) {
                return;
              }

              setSelectedNoteIds([note.id]);
              setContextNoteId(note.id);
              setContextMenuPosition({
                left: event.clientX,
                top: event.clientY,
              });
            }}
            onArchiveNote={
              isTrash || onArchiveNote === undefined
                ? undefined
                : (noteId) => {
                    const note = scopedNotesById.get(noteId as NoteId);

                    if (note !== undefined) {
                      void archiveNotes([note]);
                    }
                  }
            }
            onMoveNote={
              isTrash || onMoveNote === undefined
                ? undefined
                : (noteId) => {
                    const note = scopedNotesById.get(noteId as NoteId);

                    if (note !== undefined) {
                      setMoveRequest({ notes: [note], mode: 'move' });
                    }
                  }
            }
            onTagClick={
              onFilterByTag === undefined
                ? undefined
                : (tag, event) => onFilterByTag(tag, event.altKey)
            }
          />
        )}
      </div>

      {contextNote !== null && (
        <>
          <button
            type="button"
            className="notes-context-menu__backdrop"
            aria-label="Close note actions"
            onClick={closeContextMenu}
          />
          <div
            className="notes-context-menu"
            role="menu"
            aria-label="Note actions"
            style={
              contextMenuPosition === null
                ? undefined
                : {
                    left: contextMenuPosition.left,
                    top: contextMenuPosition.top,
                  }
            }
          >
            {isTrash ? (
              <>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMoveRequest({ notes: [contextNote], mode: 'restore' });
                    closeContextMenu();
                  }}
                >
                  Move to notebook
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setSelectedNoteIds([contextNote.id]);
                    closeContextMenu();
                    setPermanentDeleteConfirmationOpen(true);
                  }}
                >
                  Delete permanently
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    closeContextMenu();
                    void duplicateNote(contextNote);
                  }}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    closeContextMenu();
                    void archiveNotes([contextNote]);
                  }}
                >
                  Move to Trash
                </button>
              </>
            )}
          </div>
        </>
      )}

      {moveRequest !== null && (
        <MoveNoteDialog
          notes={moveRequest.notes}
          notebooks={notebooks}
          allowCurrentDestination={moveRequest.mode === 'restore'}
          onMove={(notesToMove, notebookId) => {
            if (moveRequest.mode === 'restore') {
              return restoreNotes(notesToMove, notebookId);
            }

            if (onMoveNote === undefined || notesToMove.length !== 1) {
              return Promise.resolve();
            }

            return (async () => {
              await onMoveNote(notesToMove[0], notebookId);
              setMoveRequest(null);
            })();
          }}
          onClose={() => setMoveRequest(null)}
        />
      )}

      {isPermanentDeleteConfirmationOpen && (
        <div className="notes-confirm-dialog__backdrop">
          <section
            className="notes-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="permanent-delete-title"
          >
            <h2 id="permanent-delete-title">
              Delete {selection.length}{' '}
              {selection.length === 1 ? 'note' : 'notes'} permanently?
            </h2>
            <p>These notes cannot be restored.</p>
            <div className="notes-move-dialog__actions">
              <button
                type="button"
                onClick={() => setPermanentDeleteConfirmationOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="notes-confirm-dialog__delete"
                onClick={() => void permanentlyDeleteNotes()}
              >
                Delete permanently
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

const isEditableTarget = (target: EventTarget | null): boolean =>
  target instanceof Element &&
  target.closest(
    'input, textarea, select, [contenteditable="true"], .cm-editor',
  ) !== null;

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
      const { notebookId } = selection.view;
      const tagIds = normalizedTagIds(selection.view);
      const notebookIds =
        notebookId === undefined
          ? null
          : descendantNotebookIds(notebooks, notebookId);

      return documents.filter(
        (document) =>
          tagIds.every((tagId) => document.tags.includes(tagId)) &&
          (notebookIds === null || notebookIds.has(document.notebookId)),
      );
    }
    case 'trash':
      return documents;
    case 'templates':
      return [];
  }
};

const normalizedTagIds = (
  view: Extract<NavigationSelection['view'], { type: 'tag' }>,
): readonly string[] =>
  view.tagIds ?? (view.tagId === undefined ? [] : [view.tagId]);

const shouldHideTerminalStatuses = (
  selection: NavigationSelection,
  query: string,
): boolean => {
  if (query.trim().length > 0) {
    return false;
  }

  return (
    selection.view.type === 'all-notes' ||
    selection.view.type === 'inbox' ||
    selection.view.type === 'notebook' ||
    selection.view.type === 'project' ||
    selection.view.type === 'tag'
  );
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
