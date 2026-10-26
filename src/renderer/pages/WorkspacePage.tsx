import { useCallback, useEffect, useRef, useState } from 'react';

import { EditorPanel } from '../features/editor/components/EditorPanel';
import { NavigationPanel } from '../features/navigation/components/NavigationPanel';
import { navigationDestinations } from '../features/navigation/data/navigation.data';
import type { NavigationSelection } from '../features/navigation/model/navigation.types';
import { selectionForTags } from '../features/navigation/model/navigation.selections';
import { NotesPanel } from '../features/notes/components/NotesPanel';
import { useOrganizationCommands } from '../features/organization/hooks/useOrganizationCommands';
import { useDefaultNotebookPreference } from '../features/organization/hooks/useDefaultNotebookPreference';
import {
  canNavigateBack,
  canNavigateForward,
  emptyNoteNavigationHistory,
  recordNoteNavigation,
  resolveNavigateBack,
  resolveNavigateForward,
  type NoteNavigationHistory,
} from '../features/organization/model/noteNavigationHistory';
import { readNoteCommandRequest } from '../features/organization/model/noteCommandRequest';
import {
  organizationCommandIds,
  type OrganizationCommand,
} from '../features/organization/model/organizationCommands';
import { resolveNoteDestinationNotebookId } from '../features/notes/model/noteDestinationPolicy';
import { PreviewPanel } from '../features/preview/components/PreviewPanel';
import { useWorkspaceViewCommands } from '../features/workspace/hooks/useWorkspaceViewCommands';
import { WorkspaceLayout } from '../layouts/WorkspaceLayout';
import { useDocumentWorkspace } from '../platform/documents/useDocumentWorkspace';
import { useWorkspaceThemes } from '../platform/themes/useWorkspaceThemes';
import type { WorkspaceViewMode } from '../types/workspace';
import type {
  NoteDocument,
  NoteId,
} from '../../shared/documents/document.types';
import type { KeymapTarget } from '../platform/keymaps/keymap.types';

type PreviewDrafts = ReadonlyMap<NoteId, string>;

type ScrollSyncTarget = Readonly<{
  documentId: NoteId;
  origin: 'editor' | 'preview';
  sourceLine: number;
}>;

export function WorkspacePage() {
  const documentWorkspace = useDocumentWorkspace(window.inknote.documents);
  const workspaceThemes = useWorkspaceThemes();
  const defaultNotebookPreference = useDefaultNotebookPreference();
  const [isNavigationVisible, setIsNavigationVisible] = useState(true);
  const [isWorkspaceExpanded, setIsWorkspaceExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<WorkspaceViewMode>('split');
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [navigationSelection, setNavigationSelection] =
    useState<NavigationSelection>(navigationDestinations.allNotes);
  const [previewDrafts, setPreviewDrafts] = useState<PreviewDrafts>(
    () => new Map(),
  );
  const [scrollSyncTarget, setScrollSyncTarget] =
    useState<ScrollSyncTarget | null>(null);
  const [noteHistory, setNoteHistory] = useState<NoteNavigationHistory>(
    emptyNoteNavigationHistory,
  );
  const noteHistoryRef = useRef(noteHistory);
  const { dispatchViewCommand } = useWorkspaceViewCommands({
    setViewMode,
  });

  const shouldShowTrafficLights = isNavigationVisible && !isWorkspaceExpanded;
  const selectedDocument = documentWorkspace.session.document;
  const isTrashSelected = navigationSelection.view.type === 'trash';
  const previewBody =
    selectedDocument === null
      ? undefined
      : (previewDrafts.get(selectedDocument.id) ?? selectedDocument.body);

  const setCurrentNoteHistory = useCallback(
    (nextHistory: NoteNavigationHistory): void => {
      noteHistoryRef.current = nextHistory;
      setNoteHistory(nextHistory);
    },
    [],
  );

  const openNote = useCallback(
    async (noteId: NoteId): Promise<void> => {
      const document = await documentWorkspace.open(noteId);
      setCurrentNoteHistory(
        recordNoteNavigation(noteHistoryRef.current, document.id),
      );
    },
    [documentWorkspace, setCurrentNoteHistory],
  );

  const navigateNoteHistory = useCallback(
    async (direction: 'back' | 'forward'): Promise<void> => {
      const availableNoteIds = new Set<NoteId>(
        documentWorkspace.documents.map((document) => document.id),
      );
      const resolution =
        direction === 'back'
          ? resolveNavigateBack(noteHistoryRef.current, availableNoteIds)
          : resolveNavigateForward(noteHistoryRef.current, availableNoteIds);

      if (resolution.noteId === null) {
        return;
      }

      await documentWorkspace.open(resolution.noteId);
      setCurrentNoteHistory(resolution.history);
    },
    [documentWorkspace, setCurrentNoteHistory],
  );

  const handleBodyDraftChange = useCallback(
    (documentId: NoteId, body: string): void => {
      setPreviewDrafts((current) => {
        const currentDraft = current.get(documentId);

        if (currentDraft === body) {
          return current;
        }

        const next = new Map(current);
        next.set(documentId, body);

        return next;
      });
    },
    [],
  );

  const handleBodyDraftPersisted = useCallback(
    (documentId: NoteId, body: string): void => {
      setPreviewDrafts((current) => {
        const currentDraft = current.get(documentId);

        if (currentDraft !== body) {
          return current;
        }

        const next = new Map(current);
        next.delete(documentId);

        return next;
      });
    },
    [],
  );

  const synchronizeSourceLine = useCallback(
    (origin: ScrollSyncTarget['origin'], sourceLine: number): void => {
      if (selectedDocument === null) {
        return;
      }

      setScrollSyncTarget((current) =>
        current?.documentId === selectedDocument.id &&
        current.origin === origin &&
        current.sourceLine === sourceLine
          ? current
          : { documentId: selectedDocument.id, origin, sourceLine },
      );
    },
    [selectedDocument],
  );

  const activeScrollSyncTarget =
    scrollSyncTarget !== null &&
    scrollSyncTarget.documentId === selectedDocument?.id
      ? scrollSyncTarget
      : null;
  const synchronizedSourceLine = activeScrollSyncTarget?.sourceLine;

  useEffect(() => {
    void window.inknote.windowControls
      .setTrafficLightsVisible(shouldShowTrafficLights)
      .catch((error: unknown) => {
        console.error('Failed to update traffic lights visibility', error);
      });
  }, [shouldShowTrafficLights]);

  const createNote = useCallback(async (): Promise<void> => {
    const notebookId = resolveNoteDestinationNotebookId({
      selection: navigationSelection,
      defaultNotebookId: defaultNotebookPreference.defaultNotebookId,
    });
    const document = await documentWorkspace.create('Untitled', '', {
      notebookId,
    });
    setCurrentNoteHistory(
      recordNoteNavigation(noteHistoryRef.current, document.id),
    );
  }, [
    defaultNotebookPreference.defaultNotebookId,
    documentWorkspace,
    navigationSelection,
    setCurrentNoteHistory,
  ]);
  const getOrganizationKeymapTargets = useCallback(
    (event: KeyboardEvent): readonly KeymapTarget[] => [
      {
        matches: (context: string): number | null => {
          if (context === 'workspace.global') {
            return 1;
          }

          if (
            context === 'notes.history' &&
            !isEditableKeyTarget(event.target) &&
            (canNavigateBack(noteHistoryRef.current) ||
              canNavigateForward(noteHistoryRef.current))
          ) {
            return 1;
          }

          return null;
        },
      },
    ],
    [],
  );
  const { dispatchOrganizationCommand, dispatchOrganizationCommandWithResult } =
    useOrganizationCommands({
      onCommand: async (command, invocation) => {
        if (command === organizationCommandIds.createNote) {
          return createNote();
        }
        if (command === organizationCommandIds.goBack) {
          return navigateNoteHistory('back');
        }
        if (command === organizationCommandIds.goForward) {
          return navigateNoteHistory('forward');
        }

        const request = readNoteCommandRequest(invocation.detail);

        if (request === null) {
          return undefined;
        }

        if (command === organizationCommandIds.archiveNotes) {
          const notes = resolveRequestedNotes(
            documentWorkspace.documents,
            request.noteIds,
          );

          return notes === null
            ? failedBatchResult(request.noteIds)
            : documentWorkspace.archiveMany(notes);
        }

        if (command === organizationCommandIds.moveNotes) {
          const notes = resolveRequestedNotes(
            documentWorkspace.documents,
            request.noteIds,
          );

          return notes === null ||
            !isKnownNotebook(
              request.destinationNotebookId,
              documentWorkspace.notebooks,
            )
            ? failedBatchResult(request.noteIds)
            : documentWorkspace.moveMany(notes, request.destinationNotebookId);
        }

        if (command === organizationCommandIds.restoreNotes) {
          const notes = resolveRequestedNotes(
            documentWorkspace.archivedDocuments,
            request.noteIds,
          );

          if (
            notes === null ||
            !isKnownNotebook(
              request.destinationNotebookId,
              documentWorkspace.notebooks,
            )
          ) {
            return failedBatchResult(request.noteIds);
          }

          const result = await documentWorkspace.restoreMany(
            notes,
            request.destinationNotebookId,
          );
          let nextHistory = noteHistoryRef.current;

          for (const noteId of result.completedNoteIds) {
            nextHistory = recordNoteNavigation(nextHistory, noteId);
          }

          setCurrentNoteHistory(nextHistory);
          return result;
        }

        if (command === organizationCommandIds.deleteNotesPermanently) {
          const notes = resolveRequestedNotes(
            documentWorkspace.archivedDocuments,
            request.noteIds,
          );

          if (notes !== null) {
            await documentWorkspace.deletePermanently(notes);
          }
          return undefined;
        }

        if (command === organizationCommandIds.duplicateNote) {
          const [note] =
            resolveRequestedNotes(
              documentWorkspace.documents,
              request.noteIds,
            ) ?? [];

          if (note === undefined || request.noteIds.length !== 1) {
            return undefined;
          }

          const duplicate = await documentWorkspace.duplicate(
            note,
            resolveNoteDestinationNotebookId({
              selection: navigationSelection,
              defaultNotebookId: defaultNotebookPreference.defaultNotebookId,
            }),
          );
          setCurrentNoteHistory(
            recordNoteNavigation(noteHistoryRef.current, duplicate.id),
          );
          return duplicate;
        }

        if (command === organizationCommandIds.toggleNotePinned) {
          const [note] =
            resolveRequestedNotes(
              documentWorkspace.documents,
              request.noteIds,
            ) ?? [];

          if (note === undefined || request.noteIds.length !== 1) {
            return undefined;
          }

          return documentWorkspace.setPinned(note, !note.pinned);
        }

        return undefined;
      },
      getKeymapTargets: getOrganizationKeymapTargets,
    });
  const executeNoteCommand = useCallback(
    async (
      command: OrganizationCommand,
      request: unknown,
      source: 'api' | 'keymap' | 'menu' | 'context-menu',
    ): Promise<unknown> => {
      const outcome = await dispatchOrganizationCommandWithResult(
        command,
        source,
        request,
      );

      if (!outcome.dispatched) {
        throw new Error('The requested note command is unavailable.');
      }

      return outcome.value;
    },
    [dispatchOrganizationCommandWithResult],
  );
  const dispatchCreateNote = useCallback((): void => {
    void dispatchOrganizationCommand(
      organizationCommandIds.createNote,
      'menu',
    ).catch((error: unknown) => {
      console.error(
        'Failed to create note through organization commands',
        error,
      );
    });
  }, [dispatchOrganizationCommand]);

  const filterByTag = useCallback((tag: string, exclusive: boolean): void => {
    setNavigationSelection((current) => {
      const currentTags =
        current.view.type === 'tag'
          ? (current.view.tagIds ??
            (current.view.tagId === undefined ? [] : [current.view.tagId]))
          : [];
      const tagIds = exclusive ? [tag] : [...new Set([...currentTags, tag])];
      const notebookId = notebookIdForTagFilter(current);

      return selectionForTags(tagIds, notebookId);
    });
  }, []);

  const deleteNotebook = useCallback(
    async (notebookId: string): Promise<void> => {
      await documentWorkspace.deleteNotebook(notebookId);

      if (notebookId === defaultNotebookPreference.defaultNotebookId) {
        await defaultNotebookPreference.setDefaultNotebook('inbox');
      }
    },
    [defaultNotebookPreference, documentWorkspace],
  );

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === '/' && !event.shiftKey) {
        event.preventDefault();
        setIsNavigationVisible((current) => !current);
        return;
      }

      if (key === 'd' && event.shiftKey) {
        event.preventDefault();
        setIsWorkspaceExpanded((current) => !current);
        return;
      }

      if (key === ',' && !event.shiftKey) {
        event.preventDefault();
        setIsPreferencesOpen(true);
      }
    };

    window.addEventListener('keydown', handleShortcut, true);

    return () => window.removeEventListener('keydown', handleShortcut, true);
  }, []);

  return (
    <WorkspaceLayout
      navigationSelection={navigationSelection}
      isNavigationVisible={isNavigationVisible}
      isWorkspaceExpanded={isWorkspaceExpanded}
      viewMode={viewMode}
      theme={workspaceThemes.themeAppearance}
      themeId={workspaceThemes.themeId}
      themes={workspaceThemes.themes}
      externalThemeCss={workspaceThemes.externalCss}
      acrylic={workspaceThemes.acrylic}
      isThemeCatalogLoading={workspaceThemes.isCatalogLoading}
      themeError={workspaceThemes.error}
      notebooks={documentWorkspace.notebooks}
      defaultNotebookId={defaultNotebookPreference.defaultNotebookId}
      isDefaultNotebookLoading={defaultNotebookPreference.isLoading}
      defaultNotebookError={defaultNotebookPreference.error}
      isPreferencesOpen={isPreferencesOpen}
      onViewCommand={(command) => {
        void dispatchViewCommand(command, 'menu');
      }}
      onThemeChange={workspaceThemes.selectTheme}
      onInstallTheme={workspaceThemes.installTheme}
      onRemoveTheme={workspaceThemes.removeTheme}
      onAcrylicChange={workspaceThemes.setAcrylicEnabled}
      onDefaultNotebookChange={defaultNotebookPreference.setDefaultNotebook}
      onOpenPreferences={() => setIsPreferencesOpen(true)}
      onClosePreferences={() => setIsPreferencesOpen(false)}
      onCreateNote={dispatchCreateNote}
      onToggleNavigation={() => setIsNavigationVisible((current) => !current)}
      onToggleWorkspaceExpanded={() =>
        setIsWorkspaceExpanded((current) => !current)
      }
      canNavigateBack={canNavigateBack(noteHistory)}
      canNavigateForward={canNavigateForward(noteHistory)}
      onNavigateBack={() => {
        void navigateNoteHistory('back');
      }}
      onNavigateForward={() => {
        void navigateNoteHistory('forward');
      }}
      navigation={
        <NavigationPanel
          documents={documentWorkspace.documents}
          notebooks={documentWorkspace.notebooks}
          selection={navigationSelection}
          onSelectionChange={setNavigationSelection}
          onCreateNotebook={documentWorkspace.createNotebook}
          onDeleteNotebook={deleteNotebook}
        />
      }
      notes={
        <NotesPanel
          navigationSelection={navigationSelection}
          documents={
            isTrashSelected
              ? documentWorkspace.archivedDocuments
              : documentWorkspace.documents
          }
          notebooks={documentWorkspace.notebooks}
          selectedNoteId={documentWorkspace.session.selectedDocumentId}
          isLoading={documentWorkspace.isListLoading}
          error={
            documentWorkspace.lastError ?? documentWorkspace.session.lastError
          }
          onSelectNote={(id) => {
            void openNote(id).catch(() => undefined);
          }}
          onExecuteOrganizationCommand={executeNoteCommand}
          onFilterByTag={filterByTag}
        />
      }
      editor={
        <EditorPanel
          document={documentWorkspace.session.document}
          referenceDocuments={documentWorkspace.documents}
          notebooks={documentWorkspace.notebooks}
          isLoading={documentWorkspace.session.isLoading}
          error={
            documentWorkspace.lastError ?? documentWorkspace.session.lastError
          }
          onSaveDocument={documentWorkspace.apply}
          onArchiveDocument={documentWorkspace.archive}
          onRestoreDocument={documentWorkspace.restore}
          onBodyDraftChange={handleBodyDraftChange}
          onBodyDraftPersisted={handleBodyDraftPersisted}
          onSourceLineChange={(sourceLine) =>
            synchronizeSourceLine('editor', sourceLine)
          }
          sourceLineToReveal={
            activeScrollSyncTarget?.origin === 'preview'
              ? synchronizedSourceLine
              : undefined
          }
        />
      }
      preview={
        <PreviewPanel
          document={selectedDocument}
          notebooks={documentWorkspace.notebooks}
          isPreviewOnly={viewMode === 'preview'}
          referenceDocuments={documentWorkspace.documents}
          body={previewBody}
          isLoading={documentWorkspace.session.isLoading}
          error={
            documentWorkspace.lastError ?? documentWorkspace.session.lastError
          }
          onSourceLineChange={(sourceLine) =>
            synchronizeSourceLine('preview', sourceLine)
          }
          sourceLineToReveal={
            activeScrollSyncTarget?.origin === 'editor'
              ? synchronizedSourceLine
              : undefined
          }
          onOpenReference={(documentId) => {
            void openNote(documentId).catch(() => undefined);
          }}
        />
      }
    />
  );
}

const isEditableKeyTarget = (target: EventTarget | null): boolean =>
  target instanceof Element &&
  target.closest(
    'input, textarea, select, [contenteditable="true"], .cm-editor',
  ) !== null;

const resolveRequestedNotes = (
  documents: readonly NoteDocument[],
  noteIds: readonly NoteId[],
): readonly NoteDocument[] | null => {
  const documentsById = new Map(
    documents.map((document) => [document.id, document]),
  );
  const requested = noteIds.map((noteId) => documentsById.get(noteId));

  return requested.some((document) => document === undefined)
    ? null
    : (requested as readonly NoteDocument[]);
};

const isKnownNotebook = (
  notebookId: string | undefined,
  notebooks: readonly { id: string }[],
): notebookId is string =>
  notebookId !== undefined &&
  notebooks.some((notebook) => notebook.id === notebookId);

const failedBatchResult = (noteIds: readonly NoteId[]) =>
  Object.freeze({
    completedNoteIds: Object.freeze([]),
    remainingNoteIds: Object.freeze([...noteIds]),
    error: new Error('The selected notes are no longer available.'),
  });

const notebookIdForTagFilter = (
  selection: NavigationSelection,
): string | undefined => {
  switch (selection.view.type) {
    case 'inbox':
      return 'inbox';
    case 'notebook':
      return selection.view.notebookId;
    case 'project':
      return selection.view.projectId;
    case 'tag':
      return selection.view.notebookId;
    case 'all-notes':
    case 'templates':
    case 'status':
    case 'trash':
      return undefined;
  }
};
