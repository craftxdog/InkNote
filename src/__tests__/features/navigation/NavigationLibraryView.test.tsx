import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { NavigationLibraryView } from '../../../renderer/features/navigation/components/NavigationLibraryView';
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

const documents: readonly NoteDocument[] = [
  {
    id: createNoteId('note-1'),
    title: 'Work note',
    body: '',
    notebookId: 'work',
    status: 'active',
    tags: ['project', 'work'],
    createdAt: '2026-10-21T12:00:00.000Z',
    updatedAt: '2026-10-21T12:00:00.000Z',
    revision: createRevision('local-1'),
    deletedAt: null,
  },
  {
    id: createNoteId('note-2'),
    title: 'Inbox note',
    body: '',
    notebookId: 'inbox',
    status: 'completed',
    tags: ['project'],
    createdAt: '2026-10-21T12:00:00.000Z',
    updatedAt: '2026-10-21T12:01:00.000Z',
    revision: createRevision('local-2'),
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

const projects: Notebook = {
  id: 'projects',
  name: 'Projects',
  parentId: 'work',
  icon: 'rocket',
  createdAt: '2026-10-21T12:00:00.000Z',
  updatedAt: '2026-10-21T12:00:00.000Z',
};

const catalogueTags: readonly TagSummary[] = [
  {
    id: createTagId('tag:project'),
    name: 'project',
    color: 'purple',
    count: 2,
    createdAt: '2026-10-21T12:00:00.000Z',
    updatedAt: '2026-10-21T12:00:00.000Z',
  },
  {
    id: createTagId('tag:work'),
    name: 'work',
    color: 'teal',
    count: 1,
    createdAt: '2026-10-21T12:00:00.000Z',
    updatedAt: '2026-10-21T12:00:00.000Z',
  },
  {
    id: createTagId('tag:zero-count'),
    name: 'zero count',
    color: 'brown',
    count: 0,
    createdAt: '2026-10-21T12:00:00.000Z',
    updatedAt: '2026-10-21T12:00:00.000Z',
  },
];

describe('NavigationLibraryView', () => {
  it('renders durable tag summaries, including zero-count rows', () => {
    const onSelectionChange = jest.fn();

    render(
      <NavigationLibraryView
        selection={navigationDestinations.allNotes}
        documents={documents}
        notebooks={notebooks}
        tags={catalogueTags}
        expandedSections={{ work: true, status: true, tags: true }}
        onSelectionChange={onSelectionChange}
        onToggleSection={jest.fn()}
        onExecuteNotebookCommand={jest.fn()}
        onOpenNotebookDetail={jest.fn().mockResolvedValue(undefined)}
        onEditNotebook={jest.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: /^All Notes/ }),
    ).toHaveTextContent('2');
    expect(screen.getByRole('button', { name: /^Work$/ })).toHaveTextContent(
      'Work',
    );
    expect(screen.getByRole('button', { name: /^project/ })).toHaveTextContent(
      '2',
    );
    expect(screen.getByRole('button', { name: /^work/ })).toHaveTextContent(
      '1',
    );
    const zeroCountTag = screen.getByRole('button', {
      name: /^zero count/,
    });
    expect(zeroCountTag).toHaveTextContent('0');
    expect(zeroCountTag.querySelector('.navigation-tag-dot')).toHaveStyle(
      '--tag-color: #9a6b4f',
    );

    fireEvent.click(zeroCountTag);
    expect(onSelectionChange).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'tag:zero-count',
        label: 'zero count',
        view: expect.objectContaining({
          type: 'tag',
          catalogueTagId: 'tag:zero-count',
          tagIds: ['zero count'],
        }),
      }),
    );
  });

  it('exposes the plus action only for notebook creation', () => {
    render(
      <NavigationLibraryView
        selection={navigationDestinations.allNotes}
        documents={documents}
        notebooks={notebooks}
        expandedSections={{ work: true, status: true, tags: true }}
        onSelectionChange={jest.fn()}
        onToggleSection={jest.fn()}
        onExecuteNotebookCommand={jest.fn()}
        onOpenNotebookDetail={jest.fn().mockResolvedValue(undefined)}
        onEditNotebook={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Search notebooks' }));
    expect(
      screen.getByRole('textbox', { name: 'Filter notebooks' }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Search tags' }));
    expect(screen.getByRole('textbox', { name: 'Filter tags' })).toBeVisible();

    expect(
      screen.getByRole('button', { name: 'Create notebook' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Create tag' }),
    ).not.toBeInTheDocument();
  });

  it('collapses and expands arbitrary persisted notebook branches', () => {
    render(
      <NavigationLibraryView
        selection={navigationDestinations.allNotes}
        documents={documents}
        notebooks={[...notebooks, projects]}
        expandedSections={{ work: true, status: true, tags: true }}
        onSelectionChange={jest.fn()}
        onToggleSection={jest.fn()}
        onExecuteNotebookCommand={jest.fn()}
        onOpenNotebookDetail={jest.fn().mockResolvedValue(undefined)}
        onEditNotebook={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /^Projects/ })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse Work' }));
    expect(
      screen.queryByRole('button', { name: /^Projects/ }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Expand Work' }));
    expect(screen.getByRole('button', { name: /^Projects/ })).toBeVisible();
  });

  it('creates a subnotebook from the parent context menu', async () => {
    const onExecuteNotebookCommand = jest.fn().mockResolvedValue({
      id: 'commands',
      name: 'Commands',
      parentId: 'work',
      icon: 'terminal',
      createdAt: '2026-10-21T12:00:00.000Z',
      updatedAt: '2026-10-21T12:00:00.000Z',
    } satisfies Notebook);

    render(
      <NavigationLibraryView
        selection={navigationDestinations.allNotes}
        documents={documents}
        notebooks={notebooks}
        expandedSections={{ work: true, status: true, tags: true }}
        onSelectionChange={jest.fn()}
        onToggleSection={jest.fn()}
        onExecuteNotebookCommand={onExecuteNotebookCommand}
        onOpenNotebookDetail={jest.fn().mockResolvedValue(undefined)}
        onEditNotebook={jest.fn()}
      />,
    );

    fireEvent.contextMenu(screen.getByRole('button', { name: /^Work/ }), {
      clientX: 48,
      clientY: 48,
    });
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'New Sub Notebook…' }),
    );
    fireEvent.change(
      screen.getByRole('textbox', { name: 'New subnotebook in Work' }),
      { target: { value: 'Commands' } },
    );
    fireEvent.change(
      screen.getByRole('combobox', {
        name: 'Icon for new subnotebook in Work',
      }),
      { target: { value: 'terminal' } },
    );

    await act(async () => {
      fireEvent.submit(
        screen.getByRole('form', { name: 'Create subnotebook in Work' }),
      );
    });

    expect(onExecuteNotebookCommand).toHaveBeenCalledWith(
      organizationCommandIds.createNotebook,
      {
        kind: 'create',
        name: 'Commands',
        parentId: 'work',
        icon: 'terminal',
      },
      'context-menu',
    );
  });

  it('offers deletion in a notebook context menu without exposing it for Inbox', async () => {
    const onExecuteNotebookCommand = jest.fn().mockResolvedValue(undefined);
    const confirm = jest.spyOn(globalThis, 'confirm').mockReturnValue(true);

    render(
      <NavigationLibraryView
        selection={navigationDestinations.allNotes}
        documents={documents}
        notebooks={notebooks}
        expandedSections={{ work: true, status: true, tags: true }}
        onSelectionChange={jest.fn()}
        onToggleSection={jest.fn()}
        onExecuteNotebookCommand={onExecuteNotebookCommand}
        onOpenNotebookDetail={jest.fn().mockResolvedValue(undefined)}
        onEditNotebook={jest.fn()}
      />,
    );

    fireEvent.contextMenu(screen.getByRole('button', { name: /^Inbox/ }));
    expect(
      screen.queryByRole('menuitem', { name: 'Delete Notebook…' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'Edit Notebook…' }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Close notebook menu' }),
    );

    fireEvent.contextMenu(screen.getByRole('button', { name: /^Work/ }));
    await act(async () => {
      fireEvent.click(
        screen.getByRole('menuitem', { name: 'Delete Notebook…' }),
      );
    });

    expect(onExecuteNotebookCommand).toHaveBeenCalledWith(
      organizationCommandIds.deleteNotebook,
      { kind: 'delete', notebookId: 'work' },
      'context-menu',
    );
    confirm.mockRestore();
  });

  it('delegates notebook edits to its parent navigation surface', () => {
    const onExecuteNotebookCommand = jest.fn().mockResolvedValue({
      ...notebooks[1],
      name: 'Focused work',
      parentId: null,
    } satisfies Notebook);
    const onEditNotebook = jest.fn();

    render(
      <NavigationLibraryView
        selection={navigationDestinations.allNotes}
        documents={documents}
        notebooks={notebooks}
        expandedSections={{ work: true, status: true, tags: true }}
        onSelectionChange={jest.fn()}
        onToggleSection={jest.fn()}
        onExecuteNotebookCommand={onExecuteNotebookCommand}
        onOpenNotebookDetail={jest.fn().mockResolvedValue(undefined)}
        onEditNotebook={onEditNotebook}
      />,
    );

    fireEvent.contextMenu(screen.getByRole('button', { name: /^Work/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit Notebook…' }));

    expect(onEditNotebook).toHaveBeenCalledWith(notebooks[1]);
    expect(onExecuteNotebookCommand).not.toHaveBeenCalled();
  });
});
