import { useState } from 'react';

import { useNavigationState } from '../hooks/useNavigationState';

import { navigationDestinations } from '../data/navigation.data';

import type {
  Notebook,
  NotebookIconName,
  NoteDocument,
} from '../../../../shared/documents/document.types';

import type { NavigationSelection } from '../model/navigation.types';
import {
  selectionForNotebook,
  selectionForNotebookDetail,
} from '../model/navigation.selections';

import { NavigationLibraryView } from './NavigationLibraryView';
import { NavigationNotebookDetailView } from './NavigationNotebookDetailView';

import '../styles/navigation.css';

export type NavigationPanelProps = {
  documents: readonly NoteDocument[];

  notebooks: readonly Notebook[];

  selection: NavigationSelection;

  onSelectionChange: (selection: NavigationSelection) => void;

  onCreateNotebook: (
    name: string,
    parentId?: string | null,
    icon?: NotebookIconName,
  ) => Promise<Notebook>;

  onDeleteNotebook: (notebookId: string) => Promise<void>;
};

export function NavigationPanel({
  documents,
  notebooks,
  selection,
  onSelectionChange,
  onCreateNotebook,
  onDeleteNotebook,
}: NavigationPanelProps) {
  const { expandedSections, toggleSection } = useNavigationState();
  const [detailNotebookId, setDetailNotebookId] = useState<string | null>(null);
  const detailNotebook =
    detailNotebookId === null
      ? null
      : (notebooks.find((notebook) => notebook.id === detailNotebookId) ??
        null);

  return (
    <nav className="navigation-panel" aria-label="Notebook library">
      <div className="navigation-panel__scroll">
        {detailNotebook === null ? (
          <NavigationLibraryView
            selection={selection}
            documents={documents}
            notebooks={notebooks}
            expandedSections={expandedSections}
            onSelectionChange={onSelectionChange}
            onToggleSection={toggleSection}
            onCreateNotebook={onCreateNotebook}
            onDeleteNotebook={async (notebook) => {
              await onDeleteNotebook(notebook.id);
              const parent =
                notebook.parentId === null || notebook.parentId === undefined
                  ? undefined
                  : notebooks.find(
                      (candidate) => candidate.id === notebook.parentId,
                    );

              onSelectionChange(
                parent === undefined
                  ? navigationDestinations.allNotes
                  : selectionForNotebook(parent),
              );
            }}
            onOpenNotebookDetail={(notebook) => {
              setDetailNotebookId(notebook.id);
              onSelectionChange(selectionForNotebookDetail(notebook));
            }}
          />
        ) : (
          <NavigationNotebookDetailView
            notebook={detailNotebook}
            notebooks={notebooks}
            documents={documents}
            selection={selection}
            expandedSections={expandedSections}
            onSelectionChange={onSelectionChange}
            onToggleSection={toggleSection}
            onOpenNotebookDetail={(childNotebook) => {
              setDetailNotebookId(childNotebook.id);
              onSelectionChange(selectionForNotebookDetail(childNotebook));
            }}
            onExit={() => {
              setDetailNotebookId(null);
              onSelectionChange(selectionForNotebook(detailNotebook));
            }}
          />
        )}
      </div>
    </nav>
  );
}
