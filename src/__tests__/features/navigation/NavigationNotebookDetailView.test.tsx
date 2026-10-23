import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { NavigationNotebookDetailView } from '../../../renderer/features/navigation/components/NavigationNotebookDetailView';
import { selectionForNotebookDetail } from '../../../renderer/features/navigation/model/navigation.selections';
import {
  createNoteId,
  createRevision,
  type Notebook,
  type NoteDocument,
} from '../../../shared/documents/document.types';

const work: Notebook = {
  id: 'work',
  name: 'Work',
  parentId: null,
  icon: 'briefcase',
  createdAt: '2026-10-22T12:00:00.000Z',
  updatedAt: '2026-10-22T12:00:00.000Z',
};

const projects: Notebook = {
  id: 'projects',
  name: 'Projects',
  parentId: 'work',
  icon: 'rocket',
  createdAt: '2026-10-22T12:00:00.000Z',
  updatedAt: '2026-10-22T12:00:00.000Z',
};

const documents: readonly NoteDocument[] = [
  {
    id: createNoteId('project-note'),
    title: 'Project plan',
    body: '',
    notebookId: 'projects',
    status: 'active',
    tags: [],
    createdAt: '2026-10-22T12:00:00.000Z',
    updatedAt: '2026-10-22T12:00:00.000Z',
    revision: createRevision('local-1'),
    deletedAt: null,
  },
];

describe('NavigationNotebookDetailView', () => {
  it('creates a persisted child notebook and exposes the existing hierarchy', async () => {
    const onCreateNotebook = jest.fn().mockResolvedValue({
      id: 'commands',
      name: 'Commands',
      parentId: 'work',
      icon: 'terminal',
      createdAt: '2026-10-22T12:01:00.000Z',
      updatedAt: '2026-10-22T12:01:00.000Z',
    } satisfies Notebook);
    const onOpenNotebookDetail = jest.fn();

    render(
      <NavigationNotebookDetailView
        notebook={work}
        notebooks={[work, projects]}
        documents={documents}
        selection={selectionForNotebookDetail(work)}
        expandedSections={{ work: true, status: true, tags: true }}
        onSelectionChange={jest.fn()}
        onToggleSection={jest.fn()}
        onCreateNotebook={onCreateNotebook}
        onOpenNotebookDetail={onOpenNotebookDetail}
        onExit={jest.fn()}
      />,
    );

    expect(screen.getByText('Projects')).toBeVisible();
    expect(screen.getByRole('button', { name: /^Projects/ })).toHaveTextContent(
      '1',
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Show details for Projects' }),
    );
    expect(onOpenNotebookDetail).toHaveBeenCalledWith(projects);

    fireEvent.click(screen.getByRole('button', { name: 'Add subnotebook' }));
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
        screen.getByRole('textbox', { name: 'New subnotebook in Work' }),
      );
    });

    expect(onCreateNotebook).toHaveBeenCalledWith(
      'Commands',
      'work',
      'terminal',
    );
  });
});
