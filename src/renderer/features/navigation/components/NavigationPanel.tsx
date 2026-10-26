import { useState } from 'react';

import { useNavigationState } from '../hooks/useNavigationState';

import type {
  Notebook,
  NoteDocument,
} from '../../../../shared/documents/document.types';
import {
  createOpenNotebookCommandRequest,
  type NotebookCommandRequest,
} from '../../organization/model/notebookCommandRequest';
import {
  organizationCommandIds,
  type OrganizationCommand,
} from '../../organization/model/organizationCommands';

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

  onExecuteNotebookCommand: (
    command: OrganizationCommand,
    request: NotebookCommandRequest,
    source: 'menu' | 'context-menu',
  ) => Promise<unknown>;
};

export function NavigationPanel({
  documents,
  notebooks,
  selection,
  onSelectionChange,
  onExecuteNotebookCommand,
}: NavigationPanelProps) {
  const { expandedSections, toggleSection } = useNavigationState();
  const [detailNotebookId, setDetailNotebookId] = useState<string | null>(null);
  const detailNotebook =
    detailNotebookId === null
      ? null
      : (notebooks.find((notebook) => notebook.id === detailNotebookId) ??
        null);
  const openNotebookDetail = async (notebook: Notebook): Promise<void> => {
    const result = await onExecuteNotebookCommand(
      organizationCommandIds.openNotebook,
      createOpenNotebookCommandRequest(notebook.id),
      'menu',
    );

    if (!isNotebook(result)) {
      throw new Error('The notebook command did not open a notebook.');
    }

    setDetailNotebookId(result.id);
    onSelectionChange(selectionForNotebookDetail(result));
  };

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
            onExecuteNotebookCommand={onExecuteNotebookCommand}
            onOpenNotebookDetail={openNotebookDetail}
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
              void openNotebookDetail(childNotebook).catch(() => undefined);
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

const isNotebook = (value: unknown): value is Notebook =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Notebook).id === 'string' &&
  typeof (value as Notebook).name === 'string';
