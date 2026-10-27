import '@testing-library/jest-dom';
import { act, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';

import { useDocumentWorkspace } from '../../../renderer/platform/documents/useDocumentWorkspace';
import type {
  DocumentWorkspaceActions,
  DocumentWorkspaceState,
} from '../../../renderer/platform/documents/useDocumentWorkspace';
import type { DocumentApi } from '../../../shared/bridge';
import {
  createNoteId,
  createRevision,
  createTagId,
  type Notebook,
  type NoteDocument,
} from '../../../shared/documents/document.types';

type Workspace = DocumentWorkspaceState & DocumentWorkspaceActions;

const requireWorkspace = (workspace: Workspace | null): Workspace => {
  if (workspace === null) {
    throw new Error('Workspace did not initialize.');
  }

  return workspace;
};

const inbox: Notebook = {
  id: 'inbox',
  name: 'Inbox',
  parentId: null,
  createdAt: '2026-10-26T12:00:00.000Z',
  updatedAt: '2026-10-26T12:00:00.000Z',
};

const work: Notebook = {
  id: 'work',
  name: 'Work',
  parentId: null,
  icon: 'briefcase',
  createdAt: '2026-10-26T12:00:00.000Z',
  updatedAt: '2026-10-26T12:00:00.000Z',
};

const personal: Notebook = {
  id: 'personal',
  name: 'Personal',
  parentId: null,
  createdAt: '2026-10-26T12:00:00.000Z',
  updatedAt: '2026-10-26T12:00:00.000Z',
};

const createDocumentApi = (
  notebooks: readonly Notebook[],
  updateNotebook: DocumentApi['updateNotebook'],
  overrides: Partial<DocumentApi> = {},
): DocumentApi => ({
  get: async () => ({ ok: true, value: null }),
  apply: async () => {
    throw new Error('not used');
  },
  listActive: async () => ({ ok: true, value: [] }),
  listArchived: async () => ({ ok: true, value: [] }),
  listNotebooks: async () => ({ ok: true, value: notebooks }),
  listTags: async () => ({ ok: true, value: [] }),
  createTag: async () => {
    throw new Error('not used');
  },
  updateTag: async () => {
    throw new Error('not used');
  },
  deleteTag: async () => {
    throw new Error('not used');
  },
  createNotebook: async () => {
    throw new Error('not used');
  },
  updateNotebook,
  deleteNotebook: async () => {
    throw new Error('not used');
  },
  deletePermanently: async () => {
    throw new Error('not used');
  },
  ...overrides,
});

function WorkspaceProbe({
  api,
  onWorkspace,
}: Readonly<{
  api: DocumentApi;
  onWorkspace: (workspace: Workspace) => void;
}>) {
  const workspace = useDocumentWorkspace(api);

  useEffect(() => {
    onWorkspace(workspace);
  }, [onWorkspace, workspace]);

  return (
    <output data-testid="workspace-notebooks">
      {workspace.notebooks.map((notebook) =>
        [notebook.id, notebook.name, notebook.icon ?? 'none'].join(':'),
      )}
    </output>
  );
}

describe('useDocumentWorkspace notebook updates', () => {
  it('replaces the accepted notebook projection without reordering its peers', async () => {
    const updated: Notebook = {
      ...work,
      name: 'Client work',
      icon: undefined,
      updatedAt: '2026-10-26T12:01:00.000Z',
    };
    const updateNotebook = jest.fn().mockResolvedValue({
      ok: true,
      value: updated,
    });
    let workspace: Workspace | null = null;

    render(
      <WorkspaceProbe
        api={createDocumentApi([inbox, work, personal], updateNotebook)}
        onWorkspace={(nextWorkspace) => {
          workspace = nextWorkspace;
        }}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('workspace-notebooks')).toHaveTextContent(
        'inbox:Inbox:nonework:Work:briefcasepersonal:Personal:none',
      ),
    );
    const activeWorkspace = requireWorkspace(workspace);

    await act(async () => {
      await activeWorkspace.updateNotebook({
        id: 'work',
        name: 'Client work',
        parentId: null,
        icon: null,
      });
    });

    expect(updateNotebook).toHaveBeenCalledWith({
      id: 'work',
      name: 'Client work',
      parentId: null,
      icon: null,
      occurredAt: expect.any(String),
    });
    expect(screen.getByTestId('workspace-notebooks')).toHaveTextContent(
      'inbox:Inbox:nonework:Client work:nonepersonal:Personal:none',
    );
  });

  it('preserves the visible notebook projection when an update fails', async () => {
    const failure = new Error('disk unavailable');
    const updateNotebook = jest.fn().mockRejectedValue(failure);
    let workspace: Workspace | null = null;

    render(
      <WorkspaceProbe
        api={createDocumentApi([inbox, work], updateNotebook)}
        onWorkspace={(nextWorkspace) => {
          workspace = nextWorkspace;
        }}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('workspace-notebooks')).toHaveTextContent(
        'inbox:Inbox:nonework:Work:briefcase',
      ),
    );
    const activeWorkspace = requireWorkspace(workspace);

    await act(async () => {
      await expect(
        activeWorkspace.updateNotebook({
          id: 'work',
          name: 'Client work',
          parentId: null,
          icon: null,
        }),
      ).rejects.toBe(failure);
    });

    await waitFor(() =>
      expect(screen.getByTestId('workspace-notebooks')).toHaveTextContent(
        'inbox:Inbox:nonework:Work:briefcase',
      ),
    );
    await waitFor(() =>
      expect(requireWorkspace(workspace).lastError).toBe(failure),
    );
  });
});

describe('useDocumentWorkspace tag lifecycle', () => {
  it('refreshes the catalogue, note lists, and selected note after a tag rename', async () => {
    const note: NoteDocument = {
      id: createNoteId('note-1'),
      title: 'Architecture',
      body: 'Body',
      notebookId: 'inbox',
      status: 'none',
      tags: ['catalogue'],
      createdAt: '2026-10-26T12:00:00.000Z',
      updatedAt: '2026-10-26T12:00:00.000Z',
      revision: createRevision('local-1'),
      deletedAt: null,
    };
    const renamed = {
      ...note,
      tags: ['team catalogue'],
      updatedAt: '2026-10-26T12:01:00.000Z',
      revision: createRevision('local-2'),
    };
    const untagged = {
      ...renamed,
      tags: [],
      updatedAt: '2026-10-26T12:02:00.000Z',
      revision: createRevision('local-3'),
    };
    const listActive = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, value: [note] })
      .mockResolvedValueOnce({ ok: true, value: [renamed] })
      .mockResolvedValueOnce({ ok: true, value: [untagged] });
    const listTags = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        value: [
          {
            id: createTagId('tag:catalogue'),
            name: 'catalogue',
            color: 'teal',
            count: 1,
            createdAt: note.createdAt,
            updatedAt: note.updatedAt,
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        value: [
          {
            id: createTagId('tag:catalogue'),
            name: 'team catalogue',
            color: 'purple',
            count: 1,
            createdAt: note.createdAt,
            updatedAt: renamed.updatedAt,
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        value: [],
      });
    const get = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, value: note })
      .mockResolvedValueOnce({ ok: true, value: renamed })
      .mockResolvedValueOnce({ ok: true, value: untagged });
    const updateTag = jest.fn().mockResolvedValue({
      ok: true,
      value: {
        id: createTagId('tag:catalogue'),
        name: 'team catalogue',
        color: 'purple',
        count: 1,
        createdAt: note.createdAt,
        updatedAt: renamed.updatedAt,
      },
    });
    const deleteTag = jest.fn().mockResolvedValue({
      ok: true,
      value: {
        deletedTagId: createTagId('tag:catalogue'),
        affectedNoteIds: [note.id],
      },
    });
    let workspace: Workspace | null = null;

    render(
      <WorkspaceProbe
        api={createDocumentApi(
          [inbox],
          async () => {
            throw new Error('not used');
          },
          {
            get,
            listActive,
            listArchived: async () => ({ ok: true, value: [] }),
            listTags,
            updateTag,
            deleteTag,
          },
        )}
        onWorkspace={(nextWorkspace) => {
          workspace = nextWorkspace;
        }}
      />,
    );

    await waitFor(() =>
      expect(requireWorkspace(workspace).session.document?.tags).toEqual([
        'catalogue',
      ]),
    );
    const activeWorkspace = requireWorkspace(workspace);

    await act(async () => {
      await activeWorkspace.updateTag({
        id: createTagId('tag:catalogue'),
        name: 'team catalogue',
        color: 'purple',
      });
    });

    await waitFor(() =>
      expect(requireWorkspace(workspace).tags).toEqual([
        expect.objectContaining({ name: 'team catalogue', count: 1 }),
      ]),
    );
    expect(requireWorkspace(workspace).documents[0]?.tags).toEqual([
      'team catalogue',
    ]);
    expect(requireWorkspace(workspace).session.document?.tags).toEqual([
      'team catalogue',
    ]);
    expect(updateTag).toHaveBeenCalledWith({
      id: 'tag:catalogue',
      name: 'team catalogue',
      color: 'purple',
      occurredAt: expect.any(String),
    });

    await act(async () => {
      await activeWorkspace.deleteTag(createTagId('tag:catalogue'));
    });

    await waitFor(() => expect(requireWorkspace(workspace).tags).toEqual([]));
    expect(requireWorkspace(workspace).documents[0]?.tags).toEqual([]);
    expect(requireWorkspace(workspace).session.document?.tags).toEqual([]);
    expect(deleteTag).toHaveBeenCalledWith({
      id: 'tag:catalogue',
      occurredAt: expect.any(String),
    });
  });

  it('preserves tags and the selected note when a tag request fails', async () => {
    const note: NoteDocument = {
      id: createNoteId('note-1'),
      title: 'Architecture',
      body: 'Body',
      notebookId: 'inbox',
      status: 'none',
      tags: ['catalogue'],
      createdAt: '2026-10-26T12:00:00.000Z',
      updatedAt: '2026-10-26T12:00:00.000Z',
      revision: createRevision('local-1'),
      deletedAt: null,
    };
    const failure = new Error('tag is already in use');
    let workspace: Workspace | null = null;

    render(
      <WorkspaceProbe
        api={createDocumentApi(
          [inbox],
          async () => {
            throw new Error('not used');
          },
          {
            get: async () => ({ ok: true, value: note }),
            listActive: async () => ({ ok: true, value: [note] }),
            listArchived: async () => ({ ok: true, value: [] }),
            listTags: async () => ({
              ok: true,
              value: [
                {
                  id: createTagId('tag:catalogue'),
                  name: 'catalogue',
                  color: 'teal',
                  count: 1,
                  createdAt: note.createdAt,
                  updatedAt: note.updatedAt,
                },
              ],
            }),
            updateTag: async () => {
              throw failure;
            },
          },
        )}
        onWorkspace={(nextWorkspace) => {
          workspace = nextWorkspace;
        }}
      />,
    );

    await waitFor(() =>
      expect(requireWorkspace(workspace).session.document?.tags).toEqual([
        'catalogue',
      ]),
    );
    const activeWorkspace = requireWorkspace(workspace);

    await act(async () => {
      await expect(
        activeWorkspace.updateTag({
          id: createTagId('tag:catalogue'),
          name: 'team catalogue',
          color: 'purple',
        }),
      ).rejects.toBe(failure);
    });

    expect(requireWorkspace(workspace).tags).toEqual([
      expect.objectContaining({ name: 'catalogue', count: 1 }),
    ]);
    expect(requireWorkspace(workspace).documents[0]?.tags).toEqual([
      'catalogue',
    ]);
    expect(requireWorkspace(workspace).session.document?.tags).toEqual([
      'catalogue',
    ]);
    expect(requireWorkspace(workspace).lastError).toBe(failure);
  });
});
