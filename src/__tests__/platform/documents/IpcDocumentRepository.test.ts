/** @jest-environment node */

import { IpcDocumentRepository } from '../../../renderer/platform/documents/IpcDocumentRepository';
import type { DocumentApi } from '../../../shared/bridge';
import type { DocumentIpcResult } from '../../../shared/documents/document.ipc';
import {
  INITIAL_DOCUMENT_REVISION,
  createCreateDocumentMutation,
  createMutationId,
  createNoteId,
  createRevision,
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
  createNotebook: async () => {
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
});
