import '@testing-library/jest-dom';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
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

  it('switches workspace layouts with the documented shortcuts', async () => {
    const { container } = render(<App />);

    expect(
      screen.getByRole('button', { name: 'Enter distraction-free mode' }),
    ).toBeInTheDocument();

    fireEvent.keyDown(window, { key: '/', ctrlKey: true });
    expect(
      screen.getByRole('button', { name: 'Show navigation sidebar' }),
    ).toBeInTheDocument();

    await waitFor(() => {
      fireEvent.keyDown(window, { key: 'p', ctrlKey: true });
      expect(
        screen.getByRole('button', { name: 'Split view' }),
      ).toHaveAttribute('aria-pressed', 'true');
    });

    await waitFor(() => {
      fireEvent.keyDown(window, { key: 'e', ctrlKey: true });
      expect(
        screen.getByRole('button', { name: 'Preview only' }),
      ).toHaveAttribute('aria-pressed', 'true');
    });

    fireEvent.keyDown(window, { key: 'd', ctrlKey: true, shiftKey: true });
    expect(container.querySelector('.workspace-shell')).toHaveClass(
      'workspace-shell--expanded',
    );
    expect(
      screen.getByRole('button', { name: 'Exit distraction-free mode' }),
    ).toBeInTheDocument();
  });

  it('keeps workspace shortcuts available while the Markdown editor has focus', async () => {
    render(<App />);
    const editor = document.createElement('div');
    editor.className = 'cm-editor';
    document.body.append(editor);

    await waitFor(() => {
      fireEvent.keyDown(editor, {
        key: 'e',
        ctrlKey: true,
      });
      expect(
        screen.getByRole('button', { name: 'Preview only' }),
      ).toHaveAttribute('aria-pressed', 'true');
    });

    editor.remove();
  });

  it('uses view commands for the view selector buttons', async () => {
    render(<App />);

    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Preview only' }));
      expect(
        screen.getByRole('button', { name: 'Preview only' }),
      ).toHaveAttribute('aria-pressed', 'true');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Split view' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Split view' }),
      ).toHaveAttribute('aria-pressed', 'true'),
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

  it('selects an installed theme and applies its acrylic state without executing package code', async () => {
    const list = jest.fn().mockResolvedValue({
      ok: true,
      value: [
        {
          id: 'external:aurora-dark',
          kind: 'external',
          name: 'aurora-dark',
          version: '1.0.0',
          themeAppearance: 'dark',
          styleSheets: ['styles/ui.css'],
        },
      ],
    });
    const setAcrylicEnabled = jest.fn().mockResolvedValue({
      ok: true,
      value: {
        acrylicEnabled: true,
        acrylicSupported: true,
        platform: 'darwin',
      },
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
        themes: {
          list,
          choosePackageDirectory: jest.fn(),
          install: jest.fn(),
          load: jest.fn().mockResolvedValue({
            ok: true,
            value: {
              theme: {
                id: 'external:aurora-dark',
                kind: 'external',
                name: 'aurora-dark',
                version: '1.0.0',
                themeAppearance: 'dark',
                styleSheets: ['styles/ui.css'],
              },
              css: '@layer theme.ui { :root { --page-background: #101010; } }',
            },
          }),
          remove: jest.fn(),
          getAppearance: jest.fn().mockResolvedValue({
            ok: true,
            value: {
              acrylicEnabled: false,
              acrylicSupported: true,
              platform: 'darwin',
            },
          }),
          setAcrylicEnabled,
        },
      },
    });

    const { container } = render(<App />);
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Use aurora-dark theme' }),
    );

    await waitFor(() =>
      expect(container.querySelector('.workspace-shell')).toHaveAttribute(
        'data-theme',
        'dark',
      ),
    );
    const externalThemeStyle = container.querySelector(
      'style[data-inknote-external-theme="true"]',
    );
    expect(externalThemeStyle).toHaveTextContent('@layer inknote.external');
    expect(externalThemeStyle).toHaveTextContent('--page-background: #101010');

    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'Enable acrylic window background',
      }),
    );
    await waitFor(() => expect(setAcrylicEnabled).toHaveBeenCalledWith(true));
    await waitFor(() =>
      expect(document.body).toHaveClass('acrylic-window', 'platform-darwin'),
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

  it('keeps note identity visible only in preview-only mode', async () => {
    const document = Object.freeze({
      id: createNoteId('note-preview-identity'),
      title: 'Preview design',
      body: '# Document body',
      notebookId: 'engineering',
      status: 'on-hold' as const,
      tags: ['api', 'design'],
      createdAt: '2026-10-21T12:00:00.000Z',
      updatedAt: '2026-10-21T12:00:00.000Z',
      revision: createRevision('preview-identity-1'),
      deletedAt: null,
    });
    const notebook = Object.freeze({
      id: 'engineering',
      name: 'Engineering',
      createdAt: '2026-10-21T12:00:00.000Z',
      updatedAt: '2026-10-21T12:00:00.000Z',
    });

    Object.defineProperty(window, 'inknote', {
      configurable: true,
      value: {
        windowControls: { setTrafficLightsVisible },
        documents: {
          get: jest.fn().mockResolvedValue({ ok: true, value: document }),
          apply: jest.fn(),
          listActive: jest.fn().mockResolvedValue({
            ok: true,
            value: [document],
          }),
          listArchived: jest.fn().mockResolvedValue({ ok: true, value: [] }),
          listNotebooks: jest.fn().mockResolvedValue({
            ok: true,
            value: [notebook],
          }),
          createNotebook: jest.fn(),
        },
      },
    });

    const { container } = render(<App />);
    await screen.findByRole('textbox', { name: 'Markdown editor' });

    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Preview only' }));
      expect(container.querySelector('.workspace-shell')).toHaveAttribute(
        'data-view-mode',
        'preview',
      );
    });

    const identity = screen.getByLabelText('Preview note details');
    expect(
      within(identity).getByRole('heading', { name: 'Preview design' }),
    ).toBeInTheDocument();
    expect(within(identity).getByText('Engineering')).toBeInTheDocument();
    expect(within(identity).getByText('On Hold')).toBeInTheDocument();
    const tags = within(identity).getByLabelText('Tags');
    expect(within(tags).getByText('api')).toBeInTheDocument();
    expect(within(tags).getByText('design')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Split view' }));
    await waitFor(() =>
      expect(
        screen.queryByLabelText('Preview note details'),
      ).not.toBeInTheDocument(),
    );
  });
});
