import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { NavigationPanel } from '../../../renderer/features/navigation/components/NavigationPanel';
import { navigationDestinations } from '../../../renderer/features/navigation/data/navigation.data';
import { organizationCommandIds } from '../../../renderer/features/organization/model/organizationCommands';
import {
  createNoteId,
  createRevision,
  type Notebook,
  type NoteDocument,
} from '../../../shared/documents/document.types';

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

describe('NavigationPanel', () => {
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
