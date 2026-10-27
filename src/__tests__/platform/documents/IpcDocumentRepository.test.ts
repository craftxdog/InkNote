/** @jest-environment node */

import { IpcDocumentRepository } from '../../../renderer/platform/documents/IpcDocumentRepository';
import type { DocumentApi } from '../../../shared/bridge';
import type { DocumentIpcResult } from '../../../shared/documents/document.ipc';
import {
  INITIAL_DOCUMENT_REVISION,
  createCreateDocumentMutation,
  createGeneratedTagId,
  createMutationId,
  createNoteId,
  createRevision,
  createTagId,
  type Notebook,
  type NoteDocument,
} from '../../../shared/documents/document.types';
import { DocumentDomainError } from '../../../shared/documents/document.errors';

const noteId = createNoteId('note-1');

const createMutation = () =>
  createCreateDocumentMutation({
    id: createMutationId('mutation-create'),
    documentId: noteId,
    baseRevision: INITIAL_DOCUMENT_REVISION,
    source: 'editor',
    title: 'First note',
    body: 'first line',
    occurredAt: '2026-10-21T12:00:00.000Z',
  });

const createDocument = (id: string): NoteDocument =>
  Object.freeze({
    id: createNoteId(id),
    title: 'First note',
    body: 'first line',
    notebookId: 'inbox',
    status: 'active',
    tags: [],
    createdAt: '2026-10-21T12:00:00.000Z',
    updatedAt: '2026-10-21T12:00:00.000Z',
    revision: createRevision('local-1'),
    deletedAt: null,
  });

const unusedNotebookApi = {
  listArchived: async () => ({ ok: true as const, value: [] }),
  listNotebooks: async () => ({ ok: true as const, value: [] }),
  listTags: async () => ({ ok: true as const, value: [] }),
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
  updateNotebook: async () => {
    throw new Error('not used');
  },
  deleteNotebook: async () => {
    throw new Error('not used');
  },
  deletePermanently: async () => {
    throw new Error('not used');
  },
};

describe('IpcDocumentRepository', () => {
  it('maps a serializable missing document response to null', async () => {
    const api: DocumentApi = {
      get: async () => ({ ok: true, value: null }),
      listActive: async () => ({ ok: true, value: [] }),
      ...unusedNotebookApi,
      apply: async () => {
        throw new Error('not used');
      },
    };
    const repository = new IpcDocumentRepository(api);

    await expect(repository.get(noteId)).resolves.toBeNull();
  });

  it('reconstructs a domain error instead of relying on IPC Error prototypes', async () => {
    const api: DocumentApi = {
      get: async () => ({ ok: true, value: null }),
      listActive: async () => ({ ok: true, value: [] }),
      ...unusedNotebookApi,
      apply: async () => ({
        ok: false,
        error: {
          code: 'REVISION_CONFLICT',
          message: 'Document changed before this edit was saved.',
        },
      }),
    };
    const repository = new IpcDocumentRepository(api);

    await expect(repository.apply(createMutation())).rejects.toBeInstanceOf(
      DocumentDomainError,
    );
    await expect(repository.apply(createMutation())).rejects.toMatchObject({
      code: 'REVISION_CONFLICT',
    });
  });

  it('rejects a malformed successful payload instead of trusting it as a document', async () => {
    const malformedResponse = {
      ok: true,
      value: { id: 'note-1', body: 'incomplete' },
    } as unknown as DocumentIpcResult<NoteDocument | null>;
    const api: DocumentApi = {
      get: async () => malformedResponse,
      listActive: async () => ({ ok: true, value: [] }),
      ...unusedNotebookApi,
      apply: async () => {
        throw new Error('not used');
      },
    };
    const repository = new IpcDocumentRepository(api);

    await expect(repository.get(noteId)).rejects.toMatchObject({
      code: 'INVALID_IPC_RESPONSE',
    });
  });

  it('rejects a response document whose identity differs from the request', async () => {
    const api: DocumentApi = {
      get: async () => ({ ok: true, value: createDocument('another-note') }),
      listActive: async () => ({ ok: true, value: [] }),
      ...unusedNotebookApi,
      apply: async () => ({ ok: true, value: createDocument('another-note') }),
    };
    const repository = new IpcDocumentRepository(api);

    await expect(repository.get(noteId)).rejects.toMatchObject({
      code: 'INVALID_IPC_RESPONSE',
    });
    await expect(repository.apply(createMutation())).rejects.toMatchObject({
      code: 'INVALID_IPC_RESPONSE',
    });
  });

  it('validates a notebook deletion result from the preload boundary', async () => {
    const api: DocumentApi = {
      get: async () => ({ ok: true, value: null }),
      listActive: async () => ({ ok: true, value: [] }),
      ...unusedNotebookApi,
      deleteNotebook: async () => ({
        ok: true,
        value: {
          deletedNotebookId: 'work',
          archivedNoteIds: [noteId],
          reparentedNotebookIds: ['projects'],
        },
      }),
      apply: async () => {
        throw new Error('not used');
      },
    };
    const repository = new IpcDocumentRepository(api);

    await expect(
      repository.deleteNotebook({
        id: 'work',
        occurredAt: '2026-10-21T12:00:00.000Z',
      }),
    ).resolves.toEqual({
      deletedNotebookId: 'work',
      archivedNoteIds: [noteId],
      reparentedNotebookIds: ['projects'],
    });
  });

  it('revalidates an accepted notebook update from the preload boundary', async () => {
    const expected = {
      id: 'work',
      name: 'Client work',
      parentId: null,
      icon: 'briefcase',
      createdAt: '2026-10-26T12:00:00.000Z',
      updatedAt: '2026-10-26T12:01:00.000Z',
    } satisfies Notebook;
    const updateNotebook = jest.fn().mockResolvedValue({
      ok: true,
      value: expected,
    });
    const api = {
      get: async () => ({ ok: true as const, value: null }),
      listActive: async () => ({ ok: true as const, value: [] }),
      ...unusedNotebookApi,
      updateNotebook,
      apply: async () => {
        throw new Error('not used');
      },
    } as DocumentApi;
    const repository = new IpcDocumentRepository(api);
    const input = {
      id: 'work',
      name: 'Client work',
      parentId: null,
      icon: 'briefcase' as const,
      occurredAt: '2026-10-26T12:01:00.000Z',
    };

    await expect(repository.updateNotebook(input)).resolves.toEqual(expected);
    expect(updateNotebook).toHaveBeenCalledWith(input);
  });

  it('validates a permanent deletion result from the preload boundary', async () => {
    const api: DocumentApi = {
      get: async () => ({ ok: true, value: null }),
      listActive: async () => ({ ok: true, value: [] }),
      ...unusedNotebookApi,
      deletePermanently: async () => ({
        ok: true,
        value: { deletedNoteIds: [noteId] },
      }),
      apply: async () => {
        throw new Error('not used');
      },
    };
    const repository = new IpcDocumentRepository(api);

    await expect(
      repository.deletePermanently({ noteIds: [noteId] }),
    ).resolves.toEqual({ deletedNoteIds: [noteId] });
  });

  it('reconstructs immutable tag summaries from the preload boundary', async () => {
    const listTags = jest.fn().mockResolvedValue({
      ok: true,
      value: [
        {
          id: createTagId('tag:backend'),
          name: 'Backend',
          color: 'blue',
          count: 2,
          createdAt: '2026-10-21T12:00:00.000Z',
          updatedAt: '2026-10-21T12:00:00.000Z',
        },
      ],
    });
    const api = {
      get: async () => ({ ok: true as const, value: null }),
      listActive: async () => ({ ok: true as const, value: [] }),
      ...unusedNotebookApi,
      listTags,
      apply: async () => {
        throw new Error('not used');
      },
    } as DocumentApi;
    const repository = new IpcDocumentRepository(api);

    await expect(repository.listTags()).resolves.toEqual([
      expect.objectContaining({
        id: 'tag:backend',
        name: 'Backend',
        color: 'blue',
        count: 2,
      }),
    ]);
    expect(Object.isFrozen(await repository.listTags())).toBe(true);
  });

  it('revalidates tag lifecycle writes from the preload boundary', async () => {
    const createTag = jest.fn().mockResolvedValue({
      ok: true,
      value: {
        id: createGeneratedTagId('catalogue'),
        name: 'catalogue',
        color: 'teal',
        count: 0,
        createdAt: '2026-10-26T12:00:00.000Z',
        updatedAt: '2026-10-26T12:00:00.000Z',
      },
    });
    const updateTag = jest.fn().mockResolvedValue({
      ok: true,
      value: {
        id: createGeneratedTagId('catalogue'),
        name: 'team catalogue',
        color: 'purple',
        count: 1,
        createdAt: '2026-10-26T12:00:00.000Z',
        updatedAt: '2026-10-26T12:01:00.000Z',
      },
    });
    const deleteTag = jest.fn().mockResolvedValue({
      ok: true,
      value: {
        deletedTagId: createGeneratedTagId('catalogue'),
        affectedNoteIds: [noteId],
      },
    });
    const api = {
      get: async () => ({ ok: true as const, value: null }),
      listActive: async () => ({ ok: true as const, value: [] }),
      ...unusedNotebookApi,
      createTag,
      updateTag,
      deleteTag,
      apply: async () => {
        throw new Error('not used');
      },
    } as DocumentApi;
    const repository = new IpcDocumentRepository(api);
    const createInput = {
      id: createGeneratedTagId('catalogue'),
      name: 'catalogue',
      color: 'teal' as const,
      occurredAt: '2026-10-26T12:00:00.000Z',
    };

    await expect(repository.createTag(createInput)).resolves.toMatchObject({
      id: 'tag:catalogue',
      color: 'teal',
    });
    await expect(
      repository.updateTag({
        ...createInput,
        name: 'team catalogue',
        color: 'purple',
        occurredAt: '2026-10-26T12:01:00.000Z',
      }),
    ).resolves.toMatchObject({ name: 'team catalogue', count: 1 });
    await expect(
      repository.deleteTag({
        id: createInput.id,
        occurredAt: '2026-10-26T12:02:00.000Z',
      }),
    ).resolves.toEqual({
      deletedTagId: createInput.id,
      affectedNoteIds: [noteId],
    });
    expect(createTag).toHaveBeenCalledWith(createInput);
    expect(updateTag).toHaveBeenCalledWith({
      ...createInput,
      name: 'team catalogue',
      color: 'purple',
      occurredAt: '2026-10-26T12:01:00.000Z',
    });
  });

  it('rejects malformed tag summaries from the preload boundary', async () => {
    const api = {
      get: async () => ({ ok: true as const, value: null }),
      listActive: async () => ({ ok: true as const, value: [] }),
      ...unusedNotebookApi,
      listTags: async () => ({
        ok: true as const,
        value: [{ id: 'tag:backend', color: 'unknown' }],
      }),
      apply: async () => {
        throw new Error('not used');
      },
    } as unknown as DocumentApi;
    const repository = new IpcDocumentRepository(api);

    await expect(repository.listTags()).rejects.toMatchObject({
      code: 'INVALID_IPC_RESPONSE',
    });
  });
});
