import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';

import { NavigationPanel } from '../../../renderer/features/navigation/components/NavigationPanel';
import { navigationDestinations } from '../../../renderer/features/navigation/data/navigation.data';
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
  it('opens a focused notebook detail view with scoped counts and filters', () => {
    const onSelectionChange = jest.fn();

    render(
      <NavigationPanel
        documents={documents}
        notebooks={notebooks}
        selection={navigationDestinations.allNotes}
        onSelectionChange={onSelectionChange}
        onCreateNotebook={jest.fn()}
        onDeleteNotebook={jest.fn()}
      />,
    );

    const detailsButton = screen.getByRole('button', {
      name: 'Show details for Work',
    });

    expect(detailsButton).toHaveAttribute('tabindex', '-1');

    fireEvent.click(detailsButton);

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
});
