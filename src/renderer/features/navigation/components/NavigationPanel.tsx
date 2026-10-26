import { useState } from 'react';

import { useNavigationState } from '../hooks/useNavigationState';

import type {
  Notebook,
  NoteDocument,
} from '../../../../shared/documents/document.types';
import {
  createOpenNotebookCommandRequest,
  createUpdateNotebookCommandRequest,
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
import {
  NotebookEditorDialog,
  type NotebookEditorValues,
} from './NotebookEditorDialog';
import { NavigationNotebookDetailView } from './NavigationNotebookDetailView';

import '../styles/navigation.css';

type NotebookCommandSource = 'menu' | 'context-menu';

type NotebookEditRequest = Readonly<{
  notebook: Notebook;
  source: NotebookCommandSource;
}>;

export type NavigationPanelProps = {
  documents: readonly NoteDocument[];

  notebooks: readonly Notebook[];

  selection: NavigationSelection;

  onSelectionChange: (selection: NavigationSelection) => void;

  onExecuteNotebookCommand: (
    command: OrganizationCommand,
    request: NotebookCommandRequest,
    source: NotebookCommandSource,
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
  const [editingNotebook, setEditingNotebook] =
    useState<NotebookEditRequest | null>(null);
  const detailNotebook =
    detailNotebookId === null
      ? null
      : (notebooks.find((notebook) => notebook.id === detailNotebookId) ??
        null);
  const openNotebookDetail = async (
    notebook: Notebook,
    source: NotebookCommandSource,
  ): Promise<void> => {
    const result = await onExecuteNotebookCommand(
      organizationCommandIds.openNotebook,
      createOpenNotebookCommandRequest(notebook.id),
      source,
    );

    if (!isNotebook(result)) {
      throw new Error('The notebook command did not open a notebook.');
    }

    setDetailNotebookId(result.id);
    onSelectionChange(selectionForNotebookDetail(result));
  };
  const updateNotebook = async (
    values: NotebookEditorValues,
  ): Promise<void> => {
    if (editingNotebook === null) {
      throw new Error('No notebook is selected for editing.');
    }

    const result = await onExecuteNotebookCommand(
      organizationCommandIds.updateNotebook,
      createUpdateNotebookCommandRequest({
        notebookId: editingNotebook.notebook.id,
        ...values,
      }),
      editingNotebook.source,
    );

    if (!isNotebook(result)) {
      throw new Error('The notebook command did not update a notebook.');
    }

    if (detailNotebookId === result.id) {
      onSelectionChange(selectionForNotebookDetail(result));
      return;
    }

    if (
      selection.view.type === 'notebook' &&
      selection.view.notebookId === result.id
    ) {
      onSelectionChange(
        selectionForNotebook(result, {
          includeDescendants: selection.view.includeDescendants,
        }),
      );
    }
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
            onEditNotebook={(notebook) =>
              setEditingNotebook({ notebook, source: 'context-menu' })
            }
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
              void openNotebookDetail(childNotebook, 'menu').catch(
                () => undefined,
              );
            }}
            onEditNotebook={(notebook) =>
              setEditingNotebook({ notebook, source: 'menu' })
            }
            onExit={() => {
              setDetailNotebookId(null);
              onSelectionChange(selectionForNotebook(detailNotebook));
            }}
          />
        )}
        {editingNotebook !== null && (
          <NotebookEditorDialog
            notebook={editingNotebook.notebook}
            notebooks={notebooks}
            onCancel={() => setEditingNotebook(null)}
            onSave={updateNotebook}
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
