import { useState } from 'react';

import { useNavigationState } from '../hooks/useNavigationState';
import { navigationDestinations } from '../data/navigation.data';

import type {
  Notebook,
  NoteDocument,
  TagSummary,
} from '../../../../shared/documents/document.types';
import {
  createCreateNotebookCommandRequest,
  createOpenNotebookCommandRequest,
  createUpdateNotebookCommandRequest,
  type NotebookCommandRequest,
} from '../../organization/model/notebookCommandRequest';
import {
  createCreateTagCommandRequest,
  createDeleteTagCommandRequest,
  createUpdateTagCommandRequest,
  type TagCommandRequest,
} from '../../organization/model/tagCommandRequest';
import {
  organizationCommandIds,
  type OrganizationCommand,
} from '../../organization/model/organizationCommands';

import type { NavigationSelection } from '../model/navigation.types';
import {
  selectionForCatalogueTag,
  selectionForNotebook,
  selectionForNotebookDetail,
} from '../model/navigation.selections';

import { NavigationLibraryView } from './NavigationLibraryView';
import {
  NotebookEditorDialog,
  type NotebookEditorValues,
} from './NotebookEditorDialog';
import { TagEditorDialog, type TagEditorValues } from './TagEditorDialog';
import { NavigationNotebookDetailView } from './NavigationNotebookDetailView';

import '../styles/navigation.css';

type NotebookCommandSource = 'menu' | 'context-menu';
type TagCommandSource = 'menu' | 'context-menu';

type NotebookEditRequest = Readonly<{
  notebook: Notebook;
  source: NotebookCommandSource;
}>;

type TagEditorRequest = Readonly<{
  tag?: TagSummary;
  source: TagCommandSource;
}>;

export type NavigationPanelProps = {
  documents: readonly NoteDocument[];

  notebooks: readonly Notebook[];

  tags?: readonly TagSummary[];

  selection: NavigationSelection;

  onSelectionChange: (selection: NavigationSelection) => void;

  onExecuteNotebookCommand: (
    command: OrganizationCommand,
    request: NotebookCommandRequest,
    source: NotebookCommandSource,
  ) => Promise<unknown>;

  onExecuteTagCommand?: (
    command: OrganizationCommand,
    request: TagCommandRequest,
    source: TagCommandSource,
  ) => Promise<unknown>;
};

export function NavigationPanel({
  documents,
  notebooks,
  tags = [],
  selection,
  onSelectionChange,
  onExecuteNotebookCommand,
  onExecuteTagCommand,
}: NavigationPanelProps) {
  const { expandedSections, toggleSection } = useNavigationState();
  const [detailNotebookId, setDetailNotebookId] = useState<string | null>(null);
  const [editingNotebook, setEditingNotebook] =
    useState<NotebookEditRequest | null>(null);
  const [isCreatingNotebook, setIsCreatingNotebook] = useState(false);
  const [tagEditor, setTagEditor] = useState<TagEditorRequest | null>(null);
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

  const createNotebook = async (
    values: NotebookEditorValues,
  ): Promise<void> => {
    const result = await onExecuteNotebookCommand(
      organizationCommandIds.createNotebook,
      createCreateNotebookCommandRequest(values),
      'menu',
    );

    if (!isNotebook(result)) {
      throw new Error('The notebook command did not create a notebook.');
    }

    onSelectionChange(selectionForNotebook(result));
  };

  const executeTag = async (
    command: OrganizationCommand,
    request: TagCommandRequest,
    source: TagCommandSource,
  ): Promise<unknown> => {
    if (onExecuteTagCommand === undefined) {
      throw new Error('Tag commands are unavailable.');
    }

    return onExecuteTagCommand(command, request, source);
  };

  const saveTag = async (values: TagEditorValues): Promise<void> => {
    if (tagEditor === null) {
      throw new Error('No tag editor is open.');
    }

    const result =
      tagEditor.tag === undefined
        ? await executeTag(
            organizationCommandIds.createTag,
            createCreateTagCommandRequest(values),
            tagEditor.source,
          )
        : await executeTag(
            organizationCommandIds.updateTag,
            createUpdateTagCommandRequest({
              tagId: tagEditor.tag.id,
              ...values,
            }),
            tagEditor.source,
          );

    if (!isTagSummary(result)) {
      throw new Error('The tag command did not save a tag.');
    }

    if (
      tagEditor.tag !== undefined &&
      selection.view.type === 'tag' &&
      selection.view.catalogueTagId === result.id
    ) {
      onSelectionChange(selectionForCatalogueTag(result));
    }
  };

  const deleteTag = async (
    tag: TagSummary,
    source: TagCommandSource,
  ): Promise<void> => {
    const confirmed = globalThis.confirm(
      `Delete “${tag.name}”? This removes the tag from every associated note, including archived notes.`,
    );

    if (!confirmed) {
      return;
    }

    await executeTag(
      organizationCommandIds.deleteTag,
      createDeleteTagCommandRequest(tag.id),
      source,
    );

    if (
      selection.view.type === 'tag' &&
      selection.view.catalogueTagId === tag.id
    ) {
      onSelectionChange(navigationDestinations.allNotes);
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
            tags={tags}
            expandedSections={expandedSections}
            onSelectionChange={onSelectionChange}
            onToggleSection={toggleSection}
            onExecuteNotebookCommand={onExecuteNotebookCommand}
            onOpenNotebookDetail={openNotebookDetail}
            onEditNotebook={(notebook) =>
              setEditingNotebook({ notebook, source: 'context-menu' })
            }
            onCreateNotebook={() => setIsCreatingNotebook(true)}
            onEditTag={(tag, source) => setTagEditor({ tag, source })}
            onDeleteTag={deleteTag}
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
        {isCreatingNotebook && (
          <NotebookEditorDialog
            notebooks={notebooks}
            onCancel={() => setIsCreatingNotebook(false)}
            onSave={createNotebook}
          />
        )}
        {tagEditor !== null && (
          <TagEditorDialog
            {...(tagEditor.tag === undefined ? {} : { tag: tagEditor.tag })}
            onCancel={() => setTagEditor(null)}
            onSave={saveTag}
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

const isTagSummary = (value: unknown): value is TagSummary =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as TagSummary).id === 'string' &&
  typeof (value as TagSummary).name === 'string' &&
  typeof (value as TagSummary).color === 'string';
