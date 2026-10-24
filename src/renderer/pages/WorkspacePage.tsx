import { useCallback, useEffect, useState } from 'react';

import { EditorPanel } from '../features/editor/components/EditorPanel';
import { NavigationPanel } from '../features/navigation/components/NavigationPanel';
import { navigationDestinations } from '../features/navigation/data/navigation.data';
import type { NavigationSelection } from '../features/navigation/model/navigation.types';
import { NotesPanel } from '../features/notes/components/NotesPanel';
import { PreviewPanel } from '../features/preview/components/PreviewPanel';
import { WorkspaceLayout } from '../layouts/WorkspaceLayout';
import { useDocumentWorkspace } from '../platform/documents/useDocumentWorkspace';
import type { WorkspaceTheme, WorkspaceViewMode } from '../types/workspace';
import type { NoteId } from '../../shared/documents/document.types';

type PreviewDrafts = ReadonlyMap<NoteId, string>;

type ScrollSyncTarget = Readonly<{
  documentId: NoteId;
  origin: 'editor' | 'preview';
  sourceLine: number;
}>;

const workspaceThemeStorageKey = 'inknote.workspace-theme';

const getInitialTheme = (): WorkspaceTheme => {
  try {
    return window.localStorage.getItem(workspaceThemeStorageKey) === 'dark'
      ? 'dark'
      : 'light';
  } catch {
    return 'light';
  }
};

export function WorkspacePage() {
  const documentWorkspace = useDocumentWorkspace(window.inknote.documents);
  const [isNavigationVisible, setIsNavigationVisible] = useState(true);
  const [isWorkspaceExpanded, setIsWorkspaceExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<WorkspaceViewMode>('split');
  const [theme, setTheme] = useState<WorkspaceTheme>(getInitialTheme);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [navigationSelection, setNavigationSelection] =
    useState<NavigationSelection>(navigationDestinations.allNotes);
  const [previewDrafts, setPreviewDrafts] = useState<PreviewDrafts>(
    () => new Map(),
  );
  const [scrollSyncTarget, setScrollSyncTarget] =
    useState<ScrollSyncTarget | null>(null);

  const shouldShowTrafficLights = isNavigationVisible && !isWorkspaceExpanded;
  const selectedDocument = documentWorkspace.session.document;
  const isTrashSelected = navigationSelection.view.type === 'trash';
  const currentNotebookId = notebookIdForSelection(navigationSelection);
  const previewBody =
    selectedDocument === null
      ? undefined
      : (previewDrafts.get(selectedDocument.id) ?? selectedDocument.body);

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

  useEffect(() => {
    try {
      window.localStorage.setItem(workspaceThemeStorageKey, theme);
    } catch {
      // Appearance preference is optional: do not make local storage a
      // prerequisite for opening a notebook.
    }
  }, [theme]);

  const createNote = useCallback(() => {
    void documentWorkspace.create().catch(() => undefined);
  }, [documentWorkspace]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === 'n' && !event.shiftKey) {
        event.preventDefault();
        createNote();
        return;
      }

      if (key === 'e' && !event.shiftKey) {
        event.preventDefault();
        setViewMode((current) =>
          current === 'preview' ? 'editor' : 'preview',
        );
        return;
      }

      if (key === 'p' && !event.shiftKey) {
        event.preventDefault();
        setViewMode('split');
        return;
      }

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
  }, [createNote]);

  return (
    <WorkspaceLayout
      navigationSelection={navigationSelection}
      isNavigationVisible={isNavigationVisible}
      isWorkspaceExpanded={isWorkspaceExpanded}
      viewMode={viewMode}
      theme={theme}
      isPreferencesOpen={isPreferencesOpen}
      onViewModeChange={setViewMode}
      onThemeChange={setTheme}
      onOpenPreferences={() => setIsPreferencesOpen(true)}
      onClosePreferences={() => setIsPreferencesOpen(false)}
      onCreateNote={createNote}
      onToggleNavigation={() => setIsNavigationVisible((current) => !current)}
      onToggleWorkspaceExpanded={() =>
        setIsWorkspaceExpanded((current) => !current)
      }
      navigation={
        <NavigationPanel
          documents={documentWorkspace.documents}
          notebooks={documentWorkspace.notebooks}
          selection={navigationSelection}
          onSelectionChange={setNavigationSelection}
          onCreateNotebook={documentWorkspace.createNotebook}
          onDeleteNotebook={documentWorkspace.deleteNotebook}
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
            void documentWorkspace.open(id).catch(() => undefined);
          }}
          onArchiveNotes={documentWorkspace.archiveMany}
          onMoveNote={documentWorkspace.move}
          onRestoreNotes={documentWorkspace.restoreMany}
          onDeletePermanently={documentWorkspace.deletePermanently}
          onDuplicateNote={(document) =>
            documentWorkspace.duplicate(
              document,
              currentNotebookId ?? document.notebookId,
            )
          }
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
            void documentWorkspace.open(documentId).catch(() => undefined);
          }}
        />
      }
    />
  );
}

const notebookIdForSelection = (
  selection: NavigationSelection,
): string | null => {
  switch (selection.view.type) {
    case 'inbox':
      return 'inbox';
    case 'notebook':
      return selection.view.notebookId;
    case 'project':
      return selection.view.projectId;
    case 'status':
    case 'tag':
      return selection.view.notebookId ?? null;
    case 'all-notes':
    case 'templates':
    case 'trash':
      return null;
  }
};
