import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../renderer/App';
import {
  createNoteId,
  createRevision,
  type NoteDocument,
} from '../shared/documents/document.types';

jest.mock('../renderer/features/editor/components/MarkdownEditor', () => ({
  MarkdownEditor: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (nextValue: string) => void;
  }) => (
    <textarea
      className="cm-editor"
      aria-label="Markdown editor"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

jest.mock('../renderer/features/preview/components/MarkdownPreview', () => ({
  MarkdownPreview: ({ markdown }: { markdown: string }) => (
    <output aria-label="Rendered Markdown preview">{markdown}</output>
  ),
}));

describe('App', () => {
  const setTrafficLightsVisible = jest.fn().mockResolvedValue(true);

  beforeEach(() => {
    Object.defineProperty(window, 'inknote', {
      configurable: true,
      value: {
        windowControls: { setTrafficLightsVisible },
        documents: {
          get: jest.fn().mockResolvedValue({ ok: true, value: null }),
          apply: jest.fn(),
          listActive: jest.fn().mockResolvedValue({ ok: true, value: [] }),
          listArchived: jest.fn().mockResolvedValue({ ok: true, value: [] }),
          listNotebooks: jest.fn().mockResolvedValue({ ok: true, value: [] }),
          createNotebook: jest.fn(),
        },
      },
    });
    setTrafficLightsVisible.mockClear();
  });

  it('renders the workspace and synchronizes the traffic lights', () => {
    render(<App />);

    expect(screen.getByRole('button', { name: /^All Notes/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByText('Markdown Editor')).toBeInTheDocument();
    expect(screen.getByText('Markdown Preview')).toBeInTheDocument();
    expect(setTrafficLightsVisible).toHaveBeenCalledWith(true);
  });

  it('creates and opens a local note with the documented new-note shortcut', async () => {
    const createDocument = (id: string): NoteDocument =>
      Object.freeze({
        id: createNoteId(id),
        title: 'Untitled',
        body: '',
        notebookId: 'inbox',
        status: 'active',
        tags: [],
        createdAt: '2026-10-21T12:00:00.000Z',
        updatedAt: '2026-10-21T12:00:00.000Z',
        revision: createRevision('local-1'),
        deletedAt: null,
      });
    let createdDocument: NoteDocument | null = null;
    const apply = jest.fn().mockImplementation(async (mutation) => {
      createdDocument = createDocument(mutation.documentId);

      return {
        ok: true,
        value: createdDocument,
      };
    });
    const get = jest.fn().mockImplementation(async (id) => ({
      ok: true,
      value: createdDocument ?? createDocument(id),
    }));

    Object.defineProperty(window, 'inknote', {
      configurable: true,
      value: {
        windowControls: { setTrafficLightsVisible },
        documents: {
          get,
          apply,
          listActive: jest.fn().mockResolvedValue({ ok: true, value: [] }),
          listArchived: jest.fn().mockResolvedValue({ ok: true, value: [] }),
          listNotebooks: jest.fn().mockResolvedValue({ ok: true, value: [] }),
          createNotebook: jest.fn(),
        },
      },
    });

    render(<App />);

    fireEvent.keyDown(window, { key: 'n', ctrlKey: true });

    await waitFor(() => expect(apply).toHaveBeenCalledTimes(1));

    expect(apply).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'create',
        title: 'Untitled',
        body: '',
      }),
    );
    const documentId = apply.mock.calls[0][0].documentId;

    await waitFor(() => expect(get).toHaveBeenCalledWith(documentId));
    expect(screen.getByLabelText('Markdown editor')).toBeInTheDocument();
  });

  it('switches workspace layouts with the documented shortcuts', () => {
    const { container } = render(<App />);

    expect(
      screen.getByRole('button', { name: 'Enter distraction-free mode' }),
    ).toBeInTheDocument();

    fireEvent.keyDown(window, { key: '/', ctrlKey: true });
    expect(
      screen.getByRole('button', { name: 'Show navigation sidebar' }),
    ).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'p', ctrlKey: true });
    expect(screen.getByRole('button', { name: 'Split view' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.keyDown(window, { key: 'e', ctrlKey: true });
    expect(
      screen.getByRole('button', { name: 'Preview only' }),
    ).toHaveAttribute('aria-pressed', 'true');

    fireEvent.keyDown(window, { key: 'd', ctrlKey: true, shiftKey: true });
    expect(container.querySelector('.workspace-shell')).toHaveClass(
      'workspace-shell--expanded',
    );
    expect(
      screen.getByRole('button', { name: 'Exit distraction-free mode' }),
    ).toBeInTheDocument();
  });

  it('leaves Ctrl-based Vim controls to the focused Markdown editor', () => {
    render(<App />);
    const vimEditor = document.createElement('div');
    vimEditor.className = 'cm-editor';
    document.body.append(vimEditor);

    fireEvent.keyDown(vimEditor, {
      key: 'e',
      ctrlKey: true,
    });

    vimEditor.remove();

    expect(screen.getByRole('button', { name: 'Split view' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('opens preferences and applies the selected theme', () => {
    const { container } = render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(
      screen.getByRole('dialog', { name: 'Preferences' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Dark theme' }));
    expect(container.querySelector('.workspace-shell')).toHaveAttribute(
      'data-theme',
      'dark',
    );
  });

  it('configures local backups and announces a completed Markdown export', async () => {
    const getInfo = jest.fn().mockResolvedValue({
      ok: true,
      value: {
        dataDirectory: '/private/inknote',
        backupDirectory: null,
      },
    });
    const chooseDirectory = jest.fn(async (purpose: string) => ({
      ok: true,
      value: `/private/${purpose}`,
    }));
    const configureBackup = jest.fn().mockResolvedValue({
      ok: true,
      value: {
        backupDirectory: '/private/backup',
        backupFile: '/private/backup/data/inknote.sqlite',
      },
    });
    const exportMarkdown = jest.fn().mockResolvedValue({
      ok: true,
      value: { directory: '/private/export', exportedNotes: 2 },
    });

    Object.defineProperty(window, 'inknote', {
      configurable: true,
      value: {
        windowControls: { setTrafficLightsVisible },
        documents: {
          get: jest.fn().mockResolvedValue({ ok: true, value: null }),
          apply: jest.fn(),
          listActive: jest.fn().mockResolvedValue({ ok: true, value: [] }),
          listArchived: jest.fn().mockResolvedValue({ ok: true, value: [] }),
          listNotebooks: jest.fn().mockResolvedValue({ ok: true, value: [] }),
          createNotebook: jest.fn(),
        },
        data: {
          getInfo,
          chooseDirectory,
          configureBackup,
          restoreBackup: jest.fn(),
          exportMarkdown,
        },
      },
    });

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    await waitFor(() => expect(getInfo).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByText('/private/inknote')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Configure backup…' }));
    await waitFor(() =>
      expect(configureBackup).toHaveBeenCalledWith('/private/backup'),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Export Markdown…' }));
    await waitFor(() =>
      expect(exportMarkdown).toHaveBeenCalledWith('/private/export'),
    );
    expect(
      await screen.findByText(
        'Finished exporting 2 notes. Directory: /private/export',
      ),
    ).toBeInTheDocument();
    expect(chooseDirectory).toHaveBeenCalledWith('backup');
    expect(chooseDirectory).toHaveBeenCalledWith('export');
  });

  it('updates the preview from the editor draft before its debounced save', async () => {
    const document = Object.freeze({
      id: createNoteId('note-live-preview'),
      title: 'Live preview',
      body: '# Original',
      notebookId: 'inbox',
      status: 'active' as const,
      tags: [],
      createdAt: '2026-10-21T12:00:00.000Z',
      updatedAt: '2026-10-21T12:00:00.000Z',
      revision: createRevision('live-preview-1'),
      deletedAt: null,
    });
    const apply = jest.fn().mockImplementation(async (mutation) => ({
      ok: true,
      value: Object.freeze({
        ...document,
        body: mutation.kind === 'replace-body' ? mutation.body : document.body,
        revision: createRevision('live-preview-2'),
      }),
    }));

    Object.defineProperty(window, 'inknote', {
      configurable: true,
      value: {
        windowControls: { setTrafficLightsVisible },
        documents: {
          get: jest.fn().mockResolvedValue({ ok: true, value: document }),
          apply,
          listActive: jest.fn().mockResolvedValue({
            ok: true,
            value: [document],
          }),
          listArchived: jest.fn().mockResolvedValue({ ok: true, value: [] }),
          listNotebooks: jest.fn().mockResolvedValue({ ok: true, value: [] }),
          createNotebook: jest.fn(),
        },
      },
    });

    render(<App />);

    const editor = await screen.findByRole('textbox', {
      name: 'Markdown editor',
    });
    expect(
      screen.getByLabelText('Rendered Markdown preview'),
    ).toHaveTextContent('# Original');

    fireEvent.change(editor, { target: { value: '# Updated immediately' } });

    expect(
      screen.getByLabelText('Rendered Markdown preview'),
    ).toHaveTextContent('# Updated immediately');
    expect(apply).not.toHaveBeenCalled();

    await waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
    expect(
      screen.getByLabelText('Rendered Markdown preview'),
    ).toHaveTextContent('# Updated immediately');
  });
});
