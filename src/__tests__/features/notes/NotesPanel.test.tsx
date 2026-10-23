import {
  filterDocumentsForNavigation,
  toNoteSummary,
  NotesPanel,
} from '../../../renderer/features/notes/components/NotesPanel';
import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
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

describe('NotesPanel note lifecycle actions', () => {
  const allNotesSelection: NavigationSelection = {
    id: 'all-notes',
    label: 'All Notes',
    view: { type: 'all-notes' },
    icon: { type: 'all-notes' },
  };

  const trashSelection: NavigationSelection = {
    id: 'trash',
    label: 'Trash',
    view: { type: 'trash' },
    icon: { type: 'trash' },
  };

  const notebooks: readonly Notebook[] = [
    {
      id: 'inbox',
      name: 'Inbox',
      parentId: null,
      createdAt: '2026-10-21T12:00:00.000Z',
      updatedAt: '2026-10-21T12:00:00.000Z',
    },
    {
      id: 'work',
      name: 'Work',
      parentId: null,
      createdAt: '2026-10-21T12:00:00.000Z',
      updatedAt: '2026-10-21T12:00:00.000Z',
    },
  ];

  it('selects multiple notes and moves the exact selection to Trash with Command+Delete', async () => {
    const onArchiveNotes = jest.fn().mockResolvedValue(undefined);

    render(
      <NotesPanel
        navigationSelection={allNotesSelection}
        documents={documents}
        notebooks={notebooks}
        selectedNoteId={null}
        isLoading={false}
        error={null}
        onSelectNote={jest.fn()}
        onArchiveNotes={onArchiveNotes}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Project work/i }));
    fireEvent.click(screen.getByRole('button', { name: /Personal inbox/i }), {
      metaKey: true,
    });

    expect(screen.getByText('2 selected')).toBeVisible();

    fireEvent.keyDown(window, { key: 'Delete', metaKey: true });

    await waitFor(() => expect(onArchiveNotes).toHaveBeenCalledWith(documents));
  });

  it('moves the selected note to Trash with Command+Backspace on macOS', async () => {
    const onArchiveNotes = jest.fn().mockResolvedValue(undefined);

    render(
      <NotesPanel
        navigationSelection={allNotesSelection}
        documents={documents}
        notebooks={notebooks}
        selectedNoteId={documents[0].id}
        isLoading={false}
        error={null}
        onSelectNote={jest.fn()}
        onArchiveNotes={onArchiveNotes}
      />,
    );

    fireEvent.keyDown(window, { key: 'Backspace', metaKey: true });

    await waitFor(() =>
      expect(onArchiveNotes).toHaveBeenCalledWith([documents[0]]),
    );
  });

  it('duplicates the selected active note with Command+D', async () => {
    const onDuplicateNote = jest.fn().mockResolvedValue(undefined);

    render(
      <NotesPanel
        navigationSelection={allNotesSelection}
        documents={documents}
        notebooks={notebooks}
        selectedNoteId={documents[0].id}
        isLoading={false}
        error={null}
        onSelectNote={jest.fn()}
        onDuplicateNote={onDuplicateNote}
      />,
    );

    fireEvent.keyDown(window, { key: 'd', metaKey: true });

    await waitFor(() =>
      expect(onDuplicateNote).toHaveBeenCalledWith(documents[0]),
    );
  });

  it('restores a trash selection into the chosen notebook and requires confirmation before permanent deletion', async () => {
    const trashedDocuments = documents.map((document) => ({
      ...document,
      deletedAt: '2026-10-21T13:00:00.000Z',
    }));
    const onRestoreNotes = jest.fn().mockResolvedValue(undefined);
    const onDeletePermanently = jest.fn().mockResolvedValue(undefined);

    render(
      <NotesPanel
        navigationSelection={trashSelection}
        documents={trashedDocuments}
        notebooks={notebooks}
        selectedNoteId={null}
        isLoading={false}
        error={null}
        onSelectNote={jest.fn()}
        onRestoreNotes={onRestoreNotes}
        onDeletePermanently={onDeletePermanently}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Project work/i }));
    fireEvent.click(screen.getByRole('button', { name: /Personal inbox/i }), {
      ctrlKey: true,
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Move 2 notes to notebook' }),
    );
    fireEvent.change(
      screen.getByRole('listbox', { name: 'Destination notebook' }),
      {
        target: { value: 'work' },
      },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Move' }));

    await waitFor(() =>
      expect(onRestoreNotes).toHaveBeenCalledWith(trashedDocuments, 'work'),
    );

    fireEvent.click(screen.getByRole('button', { name: /Project work/i }));
    fireEvent.click(screen.getByRole('button', { name: /Personal inbox/i }), {
      ctrlKey: true,
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Delete 2 notes permanently' }),
    );
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'cannot be restored',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));

    await waitFor(() =>
      expect(onDeletePermanently).toHaveBeenCalledWith(trashedDocuments),
    );
  });

  it('duplicates the selected active note from its context menu', async () => {
    const onDuplicateNote = jest.fn().mockResolvedValue(undefined);

    render(
      <NotesPanel
        navigationSelection={allNotesSelection}
        documents={documents}
        notebooks={notebooks}
        selectedNoteId={documents[0].id}
        isLoading={false}
        error={null}
        onSelectNote={jest.fn()}
        onDuplicateNote={onDuplicateNote}
      />,
    );

    fireEvent.contextMenu(
      screen.getByRole('button', { name: /Project work/i }),
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));

    await waitFor(() =>
      expect(onDuplicateNote).toHaveBeenCalledWith(documents[0]),
    );
  });
});
