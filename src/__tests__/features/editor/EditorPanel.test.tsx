import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { EditorPanel } from '../../../renderer/features/editor/components/EditorPanel';
import {
  createNoteId,
  createRevision,
  type NoteDocument,
  type NoteId,
  type Revision,
} from '../../../shared/documents/document.types';

jest.mock(
  '../../../renderer/features/editor/components/MarkdownEditor',
  () => ({
    MarkdownEditor: ({
      value,
      onChange,
    }: {
      value: string;
      onChange: (nextValue: string) => void;
    }) => (
      <textarea
        aria-label="Markdown editor"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    ),
  }),
);

const firstNoteId = createNoteId('note-first');
const secondNoteId = createNoteId('note-second');

const createDocument = (
  id: NoteId,
  revision: Revision,
  body: string,
): NoteDocument =>
  Object.freeze({
    id,
    title: id === firstNoteId ? 'First' : 'Second',
    body,
    notebookId: 'inbox',
    status: 'active',
    tags: [],
    createdAt: '2026-10-21T12:00:00.000Z',
    updatedAt: '2026-10-21T12:00:00.000Z',
    revision,
    deletedAt: null,
  });

const createDeferred = <T,>() => {
  let resolveDeferred: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    resolveDeferred = resolve;
  });

  return { promise, resolve: resolveDeferred };
};

describe('EditorPanel', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows a ready-to-write status instead of Vim mode', () => {
    const document = createDocument(
      firstNoteId,
      createRevision('revision-first'),
      'First body',
    );

    render(
      <EditorPanel
        document={document}
        notebooks={[]}
        isLoading={false}
        error={null}
        onSaveDocument={jest.fn()}
      />,
    );

    expect(screen.getByText('Ready to write')).toBeVisible();
    expect(screen.queryByText('Vim enabled')).not.toBeInTheDocument();
  });

  it('moves an active note to Trash through the explicit document action', () => {
    const document = createDocument(
      firstNoteId,
      createRevision('revision-first'),
      'First body',
    );
    const onArchiveDocument = jest.fn().mockResolvedValue(undefined);

    render(
      <EditorPanel
        document={document}
        notebooks={[]}
        isLoading={false}
        error={null}
        onSaveDocument={jest.fn()}
        onArchiveDocument={onArchiveDocument}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Move note to Trash' }));

    expect(onArchiveDocument).toHaveBeenCalledWith(document);
  });

  it('makes an archived note read-only and offers restoration', () => {
    const archived = Object.freeze({
      ...createDocument(
        firstNoteId,
        createRevision('revision-archived'),
        'First body',
      ),
      deletedAt: '2026-10-22T12:00:00.000Z',
    });
    const onRestoreDocument = jest.fn().mockResolvedValue(undefined);

    render(
      <EditorPanel
        document={archived}
        notebooks={[]}
        isLoading={false}
        error={null}
        onSaveDocument={jest.fn()}
        onRestoreDocument={onRestoreDocument}
      />,
    );

    expect(screen.getByText('This note is in Trash')).toBeVisible();
    expect(
      screen.queryByRole('textbox', { name: 'Markdown editor' }),
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Restore note' }));

    expect(onRestoreDocument).toHaveBeenCalledWith(archived);
  });

  it('persists a pending edit for its original note after selection changes', async () => {
    const firstDocument = createDocument(
      firstNoteId,
      createRevision('revision-first'),
      'First body',
    );
    const secondDocument = createDocument(
      secondNoteId,
      createRevision('revision-second'),
      'Second body',
    );
    const onSaveDocument = jest.fn(async (mutation) =>
      createDocument(
        mutation.documentId,
        createRevision('revision-after-save'),
        mutation.kind === 'replace-body' ? mutation.body : 'First body',
      ),
    );
    const rendered = render(
      <EditorPanel
        document={firstDocument}
        notebooks={[]}
        isLoading={false}
        error={null}
        onSaveDocument={onSaveDocument}
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Markdown editor' }), {
      target: { value: 'First body, edited' },
    });
    rendered.rerender(
      <EditorPanel
        document={secondDocument}
        notebooks={[]}
        isLoading={false}
        error={null}
        onSaveDocument={onSaveDocument}
      />,
    );

    await act(async () => {
      await jest.advanceTimersByTimeAsync(350);
    });

    await waitFor(() => expect(onSaveDocument).toHaveBeenCalledTimes(1));

    expect(onSaveDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: firstNoteId,
        baseRevision: createRevision('revision-first'),
        body: 'First body, edited',
      }),
    );
    expect(
      screen.getByRole('textbox', { name: 'Markdown editor' }),
    ).toHaveValue('Second body');
  });

  it('uses the accepted revision for a later queued edit', async () => {
    const firstDocument = createDocument(
      firstNoteId,
      createRevision('revision-first'),
      'First body',
    );
    const firstSave = createDeferred<NoteDocument>();
    const onSaveDocument = jest
      .fn()
      .mockImplementationOnce(() => firstSave.promise)
      .mockImplementationOnce(async (mutation) =>
        createDocument(
          mutation.documentId,
          createRevision('revision-third'),
          mutation.kind === 'replace-body' ? mutation.body : 'First body',
        ),
      );

    render(
      <EditorPanel
        document={firstDocument}
        notebooks={[]}
        isLoading={false}
        error={null}
        onSaveDocument={onSaveDocument}
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Markdown editor' }), {
      target: { value: 'First change' },
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(350);
    });

    fireEvent.change(screen.getByRole('textbox', { name: 'Markdown editor' }), {
      target: { value: 'Second change' },
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(350);
    });

    expect(onSaveDocument).toHaveBeenCalledTimes(1);

    await act(async () => {
      firstSave.resolve(
        createDocument(
          firstNoteId,
          createRevision('revision-second'),
          'First change',
        ),
      );
      await firstSave.promise;
    });

    await waitFor(() => expect(onSaveDocument).toHaveBeenCalledTimes(2));

    expect(onSaveDocument).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        documentId: firstNoteId,
        baseRevision: createRevision('revision-second'),
        body: 'Second change',
      }),
    );
  });

  it('saves an edited note title from the document header', async () => {
    const document = createDocument(
      firstNoteId,
      createRevision('revision-first'),
      'First body',
    );

    const onSaveDocument = jest.fn(async (mutation) =>
      createDocument(
        mutation.documentId,
        createRevision('revision-title'),
        mutation.kind === 'update-title' ? mutation.title : document.body,
      ),
    );

    render(
      <EditorPanel
        document={document}
        notebooks={[]}
        isLoading={false}
        error={null}
        onSaveDocument={onSaveDocument}
      />,
    );

    const title = screen.getByRole('textbox', { name: 'Note title' });

    fireEvent.change(title, { target: { value: 'Renamed' } });
    fireEvent.blur(title);

    await waitFor(() => expect(onSaveDocument).toHaveBeenCalledTimes(1));
    expect(onSaveDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'update-title',
        documentId: firstNoteId,
        baseRevision: createRevision('revision-first'),
        title: 'Renamed',
      }),
    );
  });

  it('persists a tag added from note metadata', async () => {
    const document = createDocument(
      firstNoteId,
      createRevision('revision-first'),
      'First body',
    );
    const onSaveDocument = jest.fn(async (mutation) =>
      Object.freeze({
        ...document,
        revision: createRevision('revision-tags'),
        tags: mutation.kind === 'update-tags' ? mutation.tags : [],
      }),
    );

    render(
      <EditorPanel
        document={document}
        notebooks={[]}
        isLoading={false}
        error={null}
        onSaveDocument={onSaveDocument}
      />,
    );

    const tagInput = screen.getByLabelText('Add tag');

    fireEvent.change(tagInput, { target: { value: 'Work' } });
    fireEvent.submit(tagInput);

    await waitFor(() => expect(onSaveDocument).toHaveBeenCalledTimes(1));
    expect(onSaveDocument).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'update-tags', tags: ['work'] }),
    );
  });

  it('offers existing tags as suggestions while adding a tag', () => {
    const note = Object.freeze({
      ...createDocument(
        firstNoteId,
        createRevision('revision-first'),
        'First body',
      ),
      tags: ['project'],
    });
    const referenceDocument = Object.freeze({
      ...createDocument(
        secondNoteId,
        createRevision('revision-second'),
        'Second body',
      ),
      tags: ['release'],
    });

    render(
      <EditorPanel
        document={note}
        referenceDocuments={[note, referenceDocument]}
        notebooks={[]}
        isLoading={false}
        error={null}
        onSaveDocument={jest.fn()}
      />,
    );

    expect(screen.getByLabelText('Add tag')).toHaveAttribute(
      'list',
      'editor-tag-suggestions',
    );
    expect(
      globalThis.document.querySelector(
        'datalist#editor-tag-suggestions option[value="release"]',
      ),
    ).toBeInTheDocument();
  });

  it('sets statuses from the documented shortcut, including None', async () => {
    const document = createDocument(
      firstNoteId,
      createRevision('revision-first'),
      'First body',
    );
    const onSaveDocument = jest.fn(async (mutation) =>
      Object.freeze({
        ...document,
        revision: createRevision('revision-status'),
        status:
          mutation.kind === 'update-organization'
            ? mutation.status
            : document.status,
      }),
    );

    render(
      <EditorPanel
        document={document}
        notebooks={[]}
        isLoading={false}
        error={null}
        onSaveDocument={onSaveDocument}
      />,
    );

    fireEvent.keyDown(window, { key: '4', metaKey: true, ctrlKey: true });

    await waitFor(() =>
      expect(onSaveDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'update-organization',
          status: 'completed',
        }),
      ),
    );

    fireEvent.keyDown(window, { key: '1', metaKey: true, ctrlKey: true });

    await waitFor(() =>
      expect(onSaveDocument).toHaveBeenLastCalledWith(
        expect.objectContaining({
          kind: 'update-organization',
          status: 'none',
        }),
      ),
    );
  });

  it('adds normalized comma-separated tags from the full-width tag field without a submit button', async () => {
    const document = createDocument(
      firstNoteId,
      createRevision('revision-first'),
      'First body',
    );
    const onSaveDocument = jest.fn(async (mutation) =>
      Object.freeze({
        ...document,
        revision: createRevision('revision-tags'),
        tags: mutation.kind === 'update-tags' ? mutation.tags : [],
      }),
    );

    render(
      <EditorPanel
        document={document}
        notebooks={[]}
        isLoading={false}
        error={null}
        onSaveDocument={onSaveDocument}
      />,
    );

    const tagInput = screen.getByLabelText('Add tag');

    fireEvent.change(tagInput, { target: { value: '#Work, red, work' } });
    fireEvent.submit(tagInput);

    await waitFor(() => expect(onSaveDocument).toHaveBeenCalledTimes(1));
    expect(onSaveDocument).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'update-tags', tags: ['work', 'red'] }),
    );
    expect(screen.getByText('work')).toBeInTheDocument();
    expect(screen.getByText('red')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add tags' }),
    ).not.toBeInTheDocument();
  });

  it('preserves tags added while an earlier tag mutation is still saving', async () => {
    const document = createDocument(
      firstNoteId,
      createRevision('revision-first'),
      'First body',
    );
    const firstSave = createDeferred<NoteDocument>();
    const secondSave = createDeferred<NoteDocument>();
    const onSaveDocument = jest
      .fn()
      .mockImplementationOnce(() => firstSave.promise)
      .mockImplementationOnce(() => secondSave.promise);

    render(
      <EditorPanel
        document={document}
        notebooks={[]}
        isLoading={false}
        error={null}
        onSaveDocument={onSaveDocument}
      />,
    );

    const tagInput = screen.getByLabelText('Add tag');

    fireEvent.change(tagInput, { target: { value: 'work' } });
    fireEvent.submit(tagInput);
    await waitFor(() => expect(onSaveDocument).toHaveBeenCalledTimes(1));

    fireEvent.change(tagInput, { target: { value: 'project' } });
    fireEvent.submit(tagInput);

    expect(screen.getByText('work')).toBeInTheDocument();
    expect(screen.getByText('project')).toBeInTheDocument();

    await act(async () => {
      firstSave.resolve(
        Object.freeze({
          ...document,
          revision: createRevision('revision-second'),
          tags: ['work'],
        }),
      );
      await firstSave.promise;
    });

    await waitFor(() => expect(onSaveDocument).toHaveBeenCalledTimes(2));
    expect(onSaveDocument).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        baseRevision: createRevision('revision-second'),
        kind: 'update-tags',
        tags: ['work', 'project'],
      }),
    );

    await act(async () => {
      secondSave.resolve(
        Object.freeze({
          ...document,
          revision: createRevision('revision-third'),
          tags: ['work', 'project'],
        }),
      );
      await secondSave.promise;
    });

    expect(screen.getByText('work')).toBeInTheDocument();
    expect(screen.getByText('project')).toBeInTheDocument();
  });

  it('keeps rapid notebook and status choices together while saves are queued', async () => {
    const document = createDocument(
      firstNoteId,
      createRevision('revision-first'),
      'First body',
    );
    const notebooks = [
      {
        id: 'inbox',
        name: 'Inbox',
        createdAt: '2026-10-21T12:00:00.000Z',
        updatedAt: '2026-10-21T12:00:00.000Z',
      },
      {
        id: 'projects',
        name: 'Projects',
        createdAt: '2026-10-21T12:00:00.000Z',
        updatedAt: '2026-10-21T12:00:00.000Z',
      },
    ];
    const firstSave = createDeferred<NoteDocument>();
    const secondSave = createDeferred<NoteDocument>();
    const onSaveDocument = jest
      .fn()
      .mockImplementationOnce(() => firstSave.promise)
      .mockImplementationOnce(() => secondSave.promise);

    render(
      <EditorPanel
        document={document}
        notebooks={notebooks}
        isLoading={false}
        error={null}
        onSaveDocument={onSaveDocument}
      />,
    );

    const notebook = screen.getByRole('combobox', { name: 'Notebook' });
    const status = screen.getByRole('combobox', { name: 'Status' });

    fireEvent.change(status, { target: { value: 'on-hold' } });
    expect(status).toHaveValue('on-hold');
    await waitFor(() => expect(onSaveDocument).toHaveBeenCalledTimes(1));

    fireEvent.change(notebook, { target: { value: 'projects' } });
    expect(notebook).toHaveValue('projects');

    await act(async () => {
      firstSave.resolve(
        Object.freeze({
          ...document,
          revision: createRevision('revision-second'),
          status: 'on-hold',
        }),
      );
      await firstSave.promise;
    });

    await waitFor(() => expect(onSaveDocument).toHaveBeenCalledTimes(2));
    expect(onSaveDocument).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        kind: 'update-organization',
        baseRevision: createRevision('revision-second'),
        notebookId: 'projects',
        status: 'on-hold',
      }),
    );

    await act(async () => {
      secondSave.resolve(
        Object.freeze({
          ...document,
          revision: createRevision('revision-third'),
          notebookId: 'projects',
          status: 'on-hold',
        }),
      );
      await secondSave.promise;
    });

    expect(notebook).toHaveValue('projects');
    expect(status).toHaveValue('on-hold');
  });
});
