import { useCallback, useEffect, useMemo, useState } from 'react';

import type { NavigationSelection } from '../../navigation/model/navigation.types';
import { descendantNotebookIds } from '../../navigation/model/notebookTree';

import type {
  NoteDocument,
  NoteId,
  Notebook,
} from '../../../../shared/documents/document.types';
import { summarizeMarkdownTaskProgress } from '../../../../shared/documents/taskProgress';
import {
  runNoteBatchOperation,
  type NoteBatchOperationResult,
} from '../../../platform/documents/noteBatchOperation';
import type { CommandInvocationSource } from '../../../platform/commands/command.types';
import {
  createNoteCommandRequest,
  type NoteCommandRequest,
} from '../../organization/model/noteCommandRequest';
import {
  organizationCommandIds,
  type OrganizationCommand,
} from '../../organization/model/organizationCommands';

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
  onArchiveNotes?: (
    notes: readonly NoteDocument[],
  ) => Promise<NoteBatchOperationResult>;
  onMoveNote?: (note: NoteDocument, notebookId: string) => Promise<unknown>;
  onMoveNotes?: (
    notes: readonly NoteDocument[],
    notebookId: string,
  ) => Promise<NoteBatchOperationResult>;
  onRestoreNotes?: (
    notes: readonly NoteDocument[],
    notebookId: string,
  ) => Promise<NoteBatchOperationResult>;
  onDeletePermanently?: (notes: readonly NoteDocument[]) => Promise<unknown>;
  onDuplicateNote?: (note: NoteDocument) => Promise<unknown>;
  onSetPinned?: (note: NoteDocument, pinned: boolean) => Promise<unknown>;
  onExecuteOrganizationCommand?: (
    command: OrganizationCommand,
    request: NoteCommandRequest,
    source: CommandInvocationSource,
  ) => Promise<unknown>;
  onFilterByTag?: (tag: string, exclusive: boolean) => void;
};

type MoveRequest = Readonly<{
  notes: readonly NoteDocument[];
  mode: 'move' | 'restore';
  source: CommandInvocationSource;
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
  onMoveNotes,
  onRestoreNotes,
  onDeletePermanently,
  onDuplicateNote,
  onSetPinned,
  onExecuteOrganizationCommand,
  onFilterByTag,
}: NotesPanelProps) {
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedNoteIds, setSelectedNoteIds] = useState<readonly NoteId[]>([]);
  const [moveRequest, setMoveRequest] = useState<MoveRequest | null>(null);
  const [contextNoteId, setContextNoteId] = useState<NoteId | null>(null);
  const [contextMenuPosition, setContextMenuPosition] =
    useState<ContextMenuPosition | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
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
    async (
      notesToArchive: readonly NoteDocument[],
      source: CommandInvocationSource = 'menu',
    ): Promise<NoteBatchOperationResult> => {
      if (notesToArchive.length === 0) {
        return emptyBatchResult;
      }

      let result: NoteBatchOperationResult;

      if (onExecuteOrganizationCommand !== undefined) {
        result = normalizeBatchResult(
          await onExecuteOrganizationCommand(
            organizationCommandIds.archiveNotes,
            createNoteCommandRequest(notesToArchive.map((note) => note.id)),
            source,
          ),
          notesToArchive,
        );
      } else if (onArchiveNotes !== undefined) {
        result = normalizeBatchResult(
          await onArchiveNotes(notesToArchive),
          notesToArchive,
        );
      } else if (onArchiveNote !== undefined) {
        const notesById = new Map(
          notesToArchive.map((note) => [note.id, note]),
        );
        result = await runNoteBatchOperation(
          notesToArchive.map((note) => note.id),
          async (noteId) => {
            const note = notesById.get(noteId);

            if (note === undefined) {
              throw new Error('The selected note is no longer available.');
            }

            await onArchiveNote(note);
          },
        );
      } else {
        return emptyBatchResult;
      }

      setSelectedNoteIds(result.remainingNoteIds);
      setContextNoteId(null);
      setActionError(messageForBatchResult(result, 'move to Trash'));
      return result;
    },
    [onArchiveNote, onArchiveNotes, onExecuteOrganizationCommand],
  );

  const duplicateNote = useCallback(
    async (
      note: NoteDocument,
      source: CommandInvocationSource = 'menu',
    ): Promise<void> => {
      if (onExecuteOrganizationCommand !== undefined) {
        await onExecuteOrganizationCommand(
          organizationCommandIds.duplicateNote,
          createNoteCommandRequest([note.id]),
          source,
        );
      } else if (onDuplicateNote !== undefined) {
        await onDuplicateNote(note);
      } else {
        return;
      }

      setSelectedNoteIds([]);
      setContextNoteId(null);
      setContextMenuPosition(null);
    },
    [onDuplicateNote, onExecuteOrganizationCommand],
  );

  const restoreNotes = async (
    notesToRestore: readonly NoteDocument[],
    notebookId: string,
    source: CommandInvocationSource,
  ): Promise<NoteBatchOperationResult> => {
    const result =
      onExecuteOrganizationCommand !== undefined
        ? normalizeBatchResult(
            await onExecuteOrganizationCommand(
              organizationCommandIds.restoreNotes,
              createNoteCommandRequest(
                notesToRestore.map((note) => note.id),
                notebookId,
              ),
              source,
            ),
            notesToRestore,
          )
        : onRestoreNotes === undefined
          ? emptyBatchResult
          : normalizeBatchResult(
              await onRestoreNotes(notesToRestore, notebookId),
              notesToRestore,
            );
    setSelectedNoteIds(result.remainingNoteIds);
    if (result.error !== null) {
      setMoveRequest((current) =>
        current === null
          ? current
          : {
              ...current,
              notes: remainingNotesForBatch(notesToRestore, result),
            },
      );
    }
    setActionError(messageForBatchResult(result, 'restore'));
    return result;
  };

  const moveNotes = async (
    notesToMove: readonly NoteDocument[],
    notebookId: string,
    source: CommandInvocationSource,
  ): Promise<NoteBatchOperationResult> => {
    let result: NoteBatchOperationResult;

    if (onExecuteOrganizationCommand !== undefined) {
      result = normalizeBatchResult(
        await onExecuteOrganizationCommand(
          organizationCommandIds.moveNotes,
          createNoteCommandRequest(
            notesToMove.map((note) => note.id),
            notebookId,
          ),
          source,
        ),
        notesToMove,
      );
    } else if (onMoveNotes !== undefined) {
      result = normalizeBatchResult(
        await onMoveNotes(notesToMove, notebookId),
        notesToMove,
      );
    } else if (onMoveNote !== undefined) {
      const notesById = new Map(notesToMove.map((note) => [note.id, note]));
      result = await runNoteBatchOperation(
        notesToMove.map((note) => note.id),
        async (noteId) => {
          const note = notesById.get(noteId);

          if (note === undefined) {
            throw new Error('The selected note is no longer available.');
          }

          await onMoveNote(note, notebookId);
        },
      );
    } else {
      return emptyBatchResult;
    }

    setSelectedNoteIds(result.remainingNoteIds);
    if (result.error !== null) {
      setMoveRequest((current) =>
        current === null
          ? current
          : {
              ...current,
              notes: remainingNotesForBatch(notesToMove, result),
            },
      );
    }
    setActionError(null);
    return result;
  };

  const togglePinned = async (note: NoteDocument): Promise<void> => {
    try {
      if (onExecuteOrganizationCommand !== undefined) {
        await onExecuteOrganizationCommand(
          organizationCommandIds.toggleNotePinned,
          createNoteCommandRequest([note.id]),
          'context-menu',
        );
      } else if (onSetPinned !== undefined) {
        await onSetPinned(note, !note.pinned);
      } else {
        return;
      }

      setActionError(null);
    } catch {
      setActionError('The note pin could not be updated.');
    }
  };

  const permanentlyDeleteNotes = async (): Promise<void> => {
    if (onExecuteOrganizationCommand !== undefined) {
      await onExecuteOrganizationCommand(
        organizationCommandIds.deleteNotesPermanently,
        createNoteCommandRequest(selection.map((note) => note.id)),
        'menu',
      );
    } else if (onDeletePermanently !== undefined) {
      await onDeletePermanently(selection);
    } else {
      return;
    }

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
        void archiveNotes(selection, 'keymap');
        return;
      }

      if (
        event.key.toLocaleLowerCase() === 'd' &&
        (event.metaKey || event.ctrlKey) &&
        selection.length === 1 &&
        !isTrash
      ) {
        event.preventDefault();
        void duplicateNote(selection[0], 'keymap');
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
              setMoveRequest({
                notes: selection,
                mode: 'restore',
                source: 'menu',
              })
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
        <button
          type="button"
          onClick={() =>
            setMoveRequest({ notes: selection, mode: 'move', source: 'menu' })
          }
        >
          Move {selection.length} {noteLabel} to notebook
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
        {actionError === null ? null : (
          <p className="notes-panel__action-error" role="alert">
            {actionError}
          </p>
        )}
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
                      void archiveNotes([note], 'menu');
                    }
                  }
            }
            onMoveNote={
              isTrash ||
              (onExecuteOrganizationCommand === undefined &&
                onMoveNote === undefined &&
                onMoveNotes === undefined)
                ? undefined
                : (noteId) => {
                    const note = scopedNotesById.get(noteId as NoteId);

                    if (note !== undefined) {
                      setMoveRequest({
                        notes: [note],
                        mode: 'move',
                        source: 'keymap',
                      });
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
                    setMoveRequest({
                      notes: [contextNote],
                      mode: 'restore',
                      source: 'context-menu',
                    });
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
                    void duplicateNote(contextNote, 'context-menu');
                  }}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMoveRequest({
                      notes: [contextNote],
                      mode: 'move',
                      source: 'context-menu',
                    });
                    closeContextMenu();
                  }}
                >
                  Move to notebook
                </button>
                {onSetPinned === undefined &&
                onExecuteOrganizationCommand === undefined ? null : (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      closeContextMenu();
                      void togglePinned(contextNote);
                    }}
                  >
                    {contextNote.pinned ? 'Unpin note' : 'Pin note'}
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    closeContextMenu();
                    void archiveNotes([contextNote], 'context-menu');
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
              return restoreNotes(notesToMove, notebookId, moveRequest.source);
            }

            return moveNotes(notesToMove, notebookId, moveRequest.source);
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

const emptyBatchResult: NoteBatchOperationResult = Object.freeze({
  completedNoteIds: Object.freeze([]),
  remainingNoteIds: Object.freeze([]),
  error: null,
});

const normalizeBatchResult = (
  candidate: unknown,
  notes: readonly NoteDocument[],
): NoteBatchOperationResult => {
  if (
    typeof candidate === 'object' &&
    candidate !== null &&
    Array.isArray(
      (candidate as Readonly<Partial<NoteBatchOperationResult>>)
        .completedNoteIds,
    ) &&
    Array.isArray(
      (candidate as Readonly<Partial<NoteBatchOperationResult>>)
        .remainingNoteIds,
    )
  ) {
    return candidate as NoteBatchOperationResult;
  }

  return Object.freeze({
    completedNoteIds: Object.freeze(notes.map((note) => note.id)),
    remainingNoteIds: Object.freeze([]),
    error: null,
  });
};

const messageForBatchResult = (
  result: NoteBatchOperationResult,
  action: string,
): string | null => {
  if (result.error === null) {
    return null;
  }

  if (result.completedNoteIds.length === 0) {
    return `Could not ${action} the selected notes.`;
  }

  return `${result.completedNoteIds.length} ${result.completedNoteIds.length === 1 ? 'note was' : 'notes were'} processed. ${result.remainingNoteIds.length} remain.`;
};

const remainingNotesForBatch = (
  notes: readonly NoteDocument[],
  result: NoteBatchOperationResult,
): readonly NoteDocument[] => {
  const remainingIds = new Set(result.remainingNoteIds);

  return notes.filter((note) => remainingIds.has(note.id));
};

const isEditableTarget = (target: EventTarget | null): boolean =>
  target instanceof Element &&
  target.closest(
    'input, textarea, select, [contenteditable="true"], .cm-editor',
  ) !== null;

export const toNoteSummary = (document: NoteDocument): NoteSummary => {
  const taskProgress = summarizeMarkdownTaskProgress(document.body);

  return {
    id: document.id,
    title: document.title || 'Untitled',
    excerpt: excerptFromMarkdown(document.body) || 'Empty note',
    updatedLabel: formatUpdatedAt(document.updatedAt),
    pinned: document.pinned,
    status: document.status,
    ...(taskProgress.total === 0
      ? {}
      : {
          completedTasks: taskProgress.checked,
          totalTasks: taskProgress.total,
        }),
    tags: document.tags.map((tag) => ({
      id: tag,
      label: tag,
      color: colorForTag(tag),
    })),
  };
};

const FENCED_CODE = /^\s*(`{3,}|~{3,})/;

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
