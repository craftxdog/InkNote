import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';

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
  it('keeps ancestors in the breadcrumb trail and the focused notebook on its own line', () => {
    const onOpenNotebookDetail = jest.fn();

    render(
      <NavigationNotebookDetailView
        notebook={projects}
        notebooks={[work, projects]}
        documents={documents}
        selection={selectionForNotebookDetail(projects)}
        expandedSections={{ work: true, status: true, tags: true }}
        onSelectionChange={jest.fn()}
        onToggleSection={jest.fn()}
        onOpenNotebookDetail={onOpenNotebookDetail}
        onExit={jest.fn()}
      />,
    );

    const breadcrumb = screen.getByLabelText('Notebook breadcrumb');

    expect(breadcrumb).toHaveTextContent('Work');
    expect(breadcrumb).not.toHaveTextContent('Projects');
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeVisible();

    fireEvent.click(
      screen.getByRole('button', { name: 'Open Work notebook detail' }),
    );

    expect(onOpenNotebookDetail).toHaveBeenCalledWith(work);
  });

  it('opens a child notebook detail while retaining the scoped hierarchy', () => {
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
  });
});
