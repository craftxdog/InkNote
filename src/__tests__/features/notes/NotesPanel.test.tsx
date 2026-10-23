import {
  filterDocumentsForNavigation,
  toNoteSummary,
  NotesPanel,
} from '../../../renderer/features/notes/components/NotesPanel';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { NavigationSelection } from '../../../renderer/features/navigation/model/navigation.types';
import {
  createNoteId,
  createRevision,
  type Notebook,
  type NoteDocument,
} from '../../../shared/documents/document.types';

const documents: readonly NoteDocument[] = [
  {
    id: createNoteId('note-1'),
    title: 'Project work',
    body: '',
    notebookId: 'work',
    status: 'active',
    tags: ['project'],
    createdAt: '2026-10-21T12:00:00.000Z',
    updatedAt: '2026-10-21T12:00:00.000Z',
    revision: createRevision('local-1'),
    deletedAt: null,
  },
  {
    id: createNoteId('note-2'),
    title: 'Personal inbox',
    body: '',
    notebookId: 'inbox',
    status: 'completed',
    tags: ['personal'],
    createdAt: '2026-10-21T12:00:00.000Z',
    updatedAt: '2026-10-21T12:00:00.000Z',
    revision: createRevision('local-2'),
    deletedAt: null,
  },
];

const tagSelection: NavigationSelection = {
  id: 'tag-project',
  label: 'project',
  view: { type: 'tag', tagId: 'project' },
  icon: { type: 'tag', color: '#58a6ff' },
};

describe('filterDocumentsForNavigation', () => {
  it('keeps the notes list consistent with the selected tag', () => {
    expect(filterDocumentsForNavigation(documents, tagSelection)).toEqual([
      documents[0],
    ]);
  });

  it('keeps focused status and tag views inside their notebook', () => {
    const documentsWithSharedMetadata: readonly NoteDocument[] = [
      ...documents,
      {
        id: createNoteId('note-3'),
        title: 'Inbox project',
        body: '',
        notebookId: 'inbox',
        status: 'active',
        tags: ['project'],
        createdAt: '2026-10-21T12:00:00.000Z',
        updatedAt: '2026-10-21T12:00:00.000Z',
        revision: createRevision('local-3'),
        deletedAt: null,
      },
    ];
    const activeInWork: NavigationSelection = {
      id: 'notebook-work-status-active',
      label: 'Active',
      view: { type: 'status', status: 'active', notebookId: 'work' },
      icon: { type: 'status', status: 'active' },
    };
    const projectInWork: NavigationSelection = {
      id: 'notebook-work-tag-project',
      label: 'project',
      view: { type: 'tag', tagId: 'project', notebookId: 'work' },
      icon: { type: 'tag', color: '#58a6ff' },
    };

    expect(
      filterDocumentsForNavigation(documentsWithSharedMetadata, activeInWork),
    ).toEqual([documents[0]]);
    expect(
      filterDocumentsForNavigation(documentsWithSharedMetadata, projectInWork),
    ).toEqual([documents[0]]);
  });

  it('shows direct notes while a notebook is expanded and descendants when collapsed', () => {
    const projects: Notebook = {
      id: 'projects',
      name: 'Projects',
      parentId: 'work',
      createdAt: '2026-10-21T12:00:00.000Z',
      updatedAt: '2026-10-21T12:00:00.000Z',
    };
    const projectNote: NoteDocument = {
      ...documents[0],
      id: createNoteId('note-project'),
      notebookId: 'projects',
    };
    const expandedWork: NavigationSelection = {
      id: 'notebook-work',
      label: 'Work',
      view: { type: 'notebook', notebookId: 'work' },
      icon: { type: 'notebook' },
    };
    const collapsedWork: NavigationSelection = {
      ...expandedWork,
      view: {
        type: 'notebook',
        notebookId: 'work',
        includeDescendants: true,
      },
    };
    const work: Notebook = {
      id: 'work',
      name: 'Work',
      parentId: null,
      createdAt: '2026-10-21T12:00:00.000Z',
      updatedAt: '2026-10-21T12:00:00.000Z',
    };

    expect(
      filterDocumentsForNavigation([documents[0], projectNote], expandedWork, [
        work,
        projects,
      ]),
    ).toEqual([documents[0]]);
    expect(
      filterDocumentsForNavigation([documents[0], projectNote], collapsedWork, [
        work,
        projects,
      ]),
    ).toEqual([documents[0], projectNote]);
  });
});

describe('toNoteSummary', () => {
  it('derives checklist progress while ignoring task-looking code samples', () => {
    const summary = toNoteSummary({
      ...documents[0],
      body: [
        '# Release checklist',
        '- [x] Design the note list',
        '- [ ] Polish the Markdown viewer',
        '```md',
        '- [x] This is documentation, not a task',
        '```',
      ].join('\n'),
    });

    expect(summary).toEqual(
      expect.objectContaining({
        completedTasks: 1,
        totalTasks: 2,
        excerpt: 'Release checklist',
        status: 'active',
      }),
    );
  });
});

describe('NotesPanel move shortcut', () => {
  it('opens the notebook picker with m and moves with j/k and Enter', async () => {
    const work: Notebook = {
      id: 'work',
      name: 'Work',
      parentId: null,
      createdAt: '2026-10-21T12:00:00.000Z',
      updatedAt: '2026-10-21T12:00:00.000Z',
    };
    const projects: Notebook = {
      id: 'projects',
      name: 'Projects',
      parentId: 'work',
      createdAt: '2026-10-21T12:00:00.000Z',
      updatedAt: '2026-10-21T12:00:00.000Z',
    };
    const onMoveNote = jest.fn().mockResolvedValue(undefined);

    render(
      <NotesPanel
        navigationSelection={{
          id: 'all-notes',
          label: 'All Notes',
          view: { type: 'all-notes' },
          icon: { type: 'all-notes' },
        }}
        documents={documents}
        notebooks={[
          {
            id: 'inbox',
            name: 'Inbox',
            parentId: null,
            createdAt: '2026-10-21T12:00:00.000Z',
            updatedAt: '2026-10-21T12:00:00.000Z',
          },
          work,
          projects,
        ]}
        selectedNoteId={documents[0].id}
        isLoading={false}
        error={null}
        onSelectNote={jest.fn()}
        onMoveNote={onMoveNote}
      />,
    );

    fireEvent.keyDown(screen.getByRole('button', { name: /Project work/ }), {
      key: 'm',
    });

    const picker = screen.getByRole('listbox', {
      name: 'Destination notebook',
    });
    expect(picker).toHaveValue('work');

    await act(async () => {
      fireEvent.keyDown(picker, { key: 'j' });
    });
    expect(picker).toHaveValue('projects');
    await act(async () => {
      fireEvent.keyDown(picker, { key: 'Enter' });
    });

    expect(onMoveNote).toHaveBeenCalledWith(documents[0], 'projects');
  });
});
