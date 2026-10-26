import { useCallback, useEffect, useState } from 'react';

import { EditorPanel } from '../features/editor/components/EditorPanel';
import { NavigationPanel } from '../features/navigation/components/NavigationPanel';
import { navigationDestinations } from '../features/navigation/data/navigation.data';
import type { NavigationSelection } from '../features/navigation/model/navigation.types';
import { selectionForTags } from '../features/navigation/model/navigation.selections';
import { NotesPanel } from '../features/notes/components/NotesPanel';
import { useOrganizationCommands } from '../features/organization/hooks/useOrganizationCommands';
import { organizationCommandIds } from '../features/organization/model/organizationCommands';
import { PreviewPanel } from '../features/preview/components/PreviewPanel';
import { useWorkspaceViewCommands } from '../features/workspace/hooks/useWorkspaceViewCommands';
import { WorkspaceLayout } from '../layouts/WorkspaceLayout';
import { useDocumentWorkspace } from '../platform/documents/useDocumentWorkspace';
import { useWorkspaceThemes } from '../platform/themes/useWorkspaceThemes';
import type { WorkspaceViewMode } from '../types/workspace';
import type { NoteId } from '../../shared/documents/document.types';

type PreviewDrafts = ReadonlyMap<NoteId, string>;

type ScrollSyncTarget = Readonly<{
  documentId: NoteId;
  origin: 'editor' | 'preview';
  sourceLine: number;
}>;

export function WorkspacePage() {
  const documentWorkspace = useDocumentWorkspace(window.inknote.documents);
  const workspaceThemes = useWorkspaceThemes();
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
  const { dispatchViewCommand } = useWorkspaceViewCommands({
    setViewMode,
  });

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

  const createNote = useCallback(async (): Promise<void> => {
    await documentWorkspace.create();
  }, [documentWorkspace]);
  const { dispatchOrganizationCommand } = useOrganizationCommands({
    onCreateNote: createNote,
  });
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
      isPreferencesOpen={isPreferencesOpen}
      onViewCommand={(command) => {
        void dispatchViewCommand(command, 'menu');
      }}
      onThemeChange={workspaceThemes.selectTheme}
      onInstallTheme={workspaceThemes.installTheme}
      onRemoveTheme={workspaceThemes.removeTheme}
      onAcrylicChange={workspaceThemes.setAcrylicEnabled}
      onOpenPreferences={() => setIsPreferencesOpen(true)}
      onClosePreferences={() => setIsPreferencesOpen(false)}
      onCreateNote={dispatchCreateNote}
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
