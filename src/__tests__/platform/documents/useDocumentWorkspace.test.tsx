import '@testing-library/jest-dom';
import { act, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';

import { useDocumentWorkspace } from '../../../renderer/platform/documents/useDocumentWorkspace';
import type {
  DocumentWorkspaceActions,
  DocumentWorkspaceState,
} from '../../../renderer/platform/documents/useDocumentWorkspace';
import type { DocumentApi } from '../../../shared/bridge';
import type { Notebook } from '../../../shared/documents/document.types';

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
