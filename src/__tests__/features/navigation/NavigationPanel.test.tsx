import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { NavigationPanel } from '../../../renderer/features/navigation/components/NavigationPanel';
import { navigationDestinations } from '../../../renderer/features/navigation/data/navigation.data';
import { organizationCommandIds } from '../../../renderer/features/organization/model/organizationCommands';
import {
  createNoteId,
  createRevision,
  createTagId,
  type Notebook,
  type NoteDocument,
  type TagSummary,
} from '../../../shared/documents/document.types';
import { selectionForCatalogueTag } from '../../../renderer/features/navigation/model/navigation.selections';

const documents: readonly NoteDocument[] = [
  {
    id: createNoteId('work-active'),
    title: 'Plan the launch',
    body: '',
    notebookId: 'work',
    status: 'active',
    tags: ['project', 'work'],
    createdAt: '2026-10-21T12:00:00.000Z',
    updatedAt: '2026-10-21T12:00:00.000Z',
    revision: createRevision('local-work'),
    deletedAt: null,
  },
  {
    id: createNoteId('inbox-completed'),
    title: 'Archive receipt',
    body: '',
    notebookId: 'inbox',
    status: 'completed',
    tags: ['personal'],
    createdAt: '2026-10-21T12:00:00.000Z',
    updatedAt: '2026-10-21T12:01:00.000Z',
    revision: createRevision('local-inbox'),
    deletedAt: null,
  },
];

const notebooks: readonly Notebook[] = [
  {
    id: 'inbox',
    name: 'Inbox',
    createdAt: '2026-10-21T12:00:00.000Z',
    updatedAt: '2026-10-21T12:00:00.000Z',
  },
  {
    id: 'work',
    name: 'Work',
    createdAt: '2026-10-21T12:00:00.000Z',
    updatedAt: '2026-10-21T12:00:00.000Z',
  },
];

const catalogue: TagSummary = {
  id: createTagId('tag:catalogue'),
  name: 'catalogue',
  color: 'teal',
  count: 1,
  createdAt: '2026-10-26T12:00:00.000Z',
  updatedAt: '2026-10-26T12:00:00.000Z',
};

describe('NavigationPanel', () => {
  it('routes root notebook creation through the notebook header', async () => {
    const createdNotebook = {
      id: 'roadmap',
      name: 'Roadmap',
      parentId: null,
      icon: 'rocket',
      createdAt: '2026-10-26T12:00:00.000Z',
      updatedAt: '2026-10-26T12:00:00.000Z',
    } satisfies Notebook;
    const onExecuteNotebookCommand = jest
      .fn()
      .mockResolvedValue(createdNotebook);
    const onSelectionChange = jest.fn();

    render(
      <NavigationPanel
        documents={documents}
        notebooks={notebooks}
        tags={[]}
        selection={navigationDestinations.allNotes}
        onSelectionChange={onSelectionChange}
        onExecuteNotebookCommand={onExecuteNotebookCommand}
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'Create tag' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create notebook' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Notebook name' }), {
      target: { value: 'Roadmap' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Notebook icon' }), {
      target: { value: 'rocket' },
    });

    await act(async () => {
      fireEvent.submit(screen.getByRole('dialog', { name: 'New notebook' }));
    });

    expect(onExecuteNotebookCommand).toHaveBeenCalledWith(
      organizationCommandIds.createNotebook,
      { kind: 'create', name: 'Roadmap', parentId: null, icon: 'rocket' },
      'menu',
    );
    expect(onSelectionChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'notebook-roadmap' }),
    );
  });

  it('routes a tag edit through commands and reconciles the active tag selection', async () => {
    const updated = {
      ...catalogue,
      name: 'team catalogue',
      color: 'purple',
      updatedAt: '2026-10-26T12:01:00.000Z',
    } satisfies TagSummary;
    const onSelectionChange = jest.fn();
    const onExecuteTagCommand = jest.fn().mockResolvedValue(updated);

    render(
      <NavigationPanel
        documents={documents}
        notebooks={notebooks}
        tags={[catalogue]}
        selection={selectionForCatalogueTag(catalogue)}
        onSelectionChange={onSelectionChange}
        onExecuteNotebookCommand={jest.fn()}
        onExecuteTagCommand={onExecuteTagCommand}
      />,
    );

    fireEvent.contextMenu(screen.getByRole('button', { name: /^catalogue/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit Tag…' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Tag name' }), {
      target: { value: 'Team catalogue' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Tag color' }), {
      target: { value: 'purple' },
    });

    await act(async () => {
      fireEvent.submit(
        screen.getByRole('dialog', { name: 'Edit catalogue tag' }),
      );
    });

    expect(onExecuteTagCommand).toHaveBeenCalledWith(
      organizationCommandIds.updateTag,
      {
        kind: 'update',
        tagId: catalogue.id,
        name: 'Team catalogue',
        color: 'purple',
      },
      'context-menu',
    );
    expect(onSelectionChange).toHaveBeenCalledWith(
      selectionForCatalogueTag(updated),
    );
  });

  it('describes deletion, dispatches only after confirmation, and falls back from a deleted tag', async () => {
    const onSelectionChange = jest.fn();
    const onExecuteTagCommand = jest.fn().mockResolvedValue(undefined);
    const confirm = jest.spyOn(globalThis, 'confirm').mockReturnValue(true);

    try {
      render(
        <NavigationPanel
          documents={documents}
          notebooks={notebooks}
          tags={[catalogue]}
          selection={selectionForCatalogueTag(catalogue)}
          onSelectionChange={onSelectionChange}
          onExecuteNotebookCommand={jest.fn()}
          onExecuteTagCommand={onExecuteTagCommand}
        />,
      );

      fireEvent.contextMenu(screen.getByRole('button', { name: /^catalogue/ }));
      await act(async () => {
        fireEvent.click(screen.getByRole('menuitem', { name: 'Delete Tag…' }));
      });

      expect(confirm).toHaveBeenCalledWith(
        expect.stringContaining(
          'every associated note, including archived notes',
        ),
      );
      expect(onExecuteTagCommand).toHaveBeenCalledWith(
        organizationCommandIds.deleteTag,
        { kind: 'delete', tagId: catalogue.id },
        'context-menu',
      );
      expect(onSelectionChange).toHaveBeenCalledWith(
        navigationDestinations.allNotes,
      );
    } finally {
      confirm.mockRestore();
    }
  });

  it('does not dispatch a deletion command when the confirmation is cancelled', async () => {
    const onExecuteTagCommand = jest.fn();
    const confirm = jest.spyOn(globalThis, 'confirm').mockReturnValue(false);

    try {
      render(
        <NavigationPanel
          documents={documents}
          notebooks={notebooks}
          tags={[catalogue]}
          selection={selectionForCatalogueTag(catalogue)}
          onSelectionChange={jest.fn()}
          onExecuteNotebookCommand={jest.fn()}
          onExecuteTagCommand={onExecuteTagCommand}
        />,
      );

      fireEvent.contextMenu(screen.getByRole('button', { name: /^catalogue/ }));
      await act(async () => {
        fireEvent.click(screen.getByRole('menuitem', { name: 'Delete Tag…' }));
      });

      expect(onExecuteTagCommand).not.toHaveBeenCalled();
    } finally {
      confirm.mockRestore();
    }
  });

  it('opens a focused notebook detail view with scoped counts and filters', async () => {
    const onSelectionChange = jest.fn();
    const onExecuteNotebookCommand = jest.fn().mockResolvedValue(notebooks[1]);

    render(
      <NavigationPanel
        documents={documents}
        notebooks={notebooks}
        selection={navigationDestinations.allNotes}
        onSelectionChange={onSelectionChange}
        onExecuteNotebookCommand={onExecuteNotebookCommand}
      />,
    );

    const detailsButton = screen.getByRole('button', {
      name: 'Show details for Work',
    });

    expect(detailsButton).toHaveAttribute('tabindex', '-1');

    fireEvent.click(detailsButton);

    expect(onExecuteNotebookCommand).toHaveBeenCalledWith(
      organizationCommandIds.openNotebook,
      { kind: 'open', notebookId: 'work' },
      'menu',
    );

    await screen.findByRole('button', { name: 'Back to notebook library' });

    expect(
      screen.getByRole('button', { name: 'Back to notebook library' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Show details for Work' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Work' })).toBeVisible();
    expect(
      screen.getByRole('button', { name: /^All Notes/ }),
    ).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: /^Active/ })).toHaveTextContent(
      '1',
    );
    expect(
      screen.getByRole('button', { name: /^Completed/ }),
    ).toHaveTextContent('0');
    expect(screen.getByRole('button', { name: /^project/ })).toHaveTextContent(
      '1',
    );

    fireEvent.click(screen.getByRole('button', { name: /^Active/ }));

    expect(onSelectionChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: 'notebook-work-status-active',
        view: { type: 'status', status: 'active', notebookId: 'work' },
      }),
    );
  });

  it('routes a notebook edit from the navigation UI through the command runtime', async () => {
    const onExecuteNotebookCommand = jest.fn().mockResolvedValue({
      ...notebooks[1],
      name: 'Focused work',
    } satisfies Notebook);
    const onSelectionChange = jest.fn();

    render(
      <NavigationPanel
        documents={documents}
        notebooks={notebooks}
        selection={navigationDestinations.allNotes}
        onSelectionChange={onSelectionChange}
        onExecuteNotebookCommand={onExecuteNotebookCommand}
      />,
    );

    fireEvent.contextMenu(screen.getByRole('button', { name: /^Work/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit Notebook…' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Notebook name' }), {
      target: { value: 'Focused work' },
    });

    await act(async () => {
      fireEvent.submit(
        screen.getByRole('dialog', { name: 'Edit Work notebook' }),
      );
    });

    expect(onExecuteNotebookCommand).toHaveBeenCalledWith(
      organizationCommandIds.updateNotebook,
      {
        kind: 'update',
        notebookId: 'work',
        name: 'Focused work',
        parentId: null,
        icon: null,
      },
      'context-menu',
    );
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it('keeps menu provenance when editing from a notebook detail view', async () => {
    const onExecuteNotebookCommand = jest
      .fn()
      .mockImplementation(async (command) =>
        command === organizationCommandIds.openNotebook
          ? notebooks[1]
          : ({ ...notebooks[1], name: 'Renamed work' } satisfies Notebook),
      );

    render(
      <NavigationPanel
        documents={documents}
        notebooks={notebooks}
        selection={navigationDestinations.allNotes}
        onSelectionChange={jest.fn()}
        onExecuteNotebookCommand={onExecuteNotebookCommand}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Show details for Work' }),
    );
    await screen.findByRole('button', { name: 'Edit Work notebook' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit Work notebook' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Notebook name' }), {
      target: { value: 'Renamed work' },
    });

    await act(async () => {
      fireEvent.submit(
        screen.getByRole('dialog', { name: 'Edit Work notebook' }),
      );
    });

    expect(onExecuteNotebookCommand).toHaveBeenLastCalledWith(
      organizationCommandIds.updateNotebook,
      {
        kind: 'update',
        notebookId: 'work',
        name: 'Renamed work',
        parentId: null,
        icon: null,
      },
      'menu',
    );
  });
});
