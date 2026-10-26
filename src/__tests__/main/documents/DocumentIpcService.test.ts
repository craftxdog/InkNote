/** @jest-environment node */

import { DocumentIpcService } from '../../../main/documents/DocumentIpcService';
import {
  INITIAL_DOCUMENT_REVISION,
  createArchiveMutation,
  createCreateDocumentMutation,
  createMutationId,
  createNoteId,
} from '../../../shared/documents/document.types';
import { InMemoryDocumentRepository } from '../../../test-support/documents/InMemoryDocumentRepository';

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

describe('DocumentIpcService', () => {
  it('returns a serializable null result when a document does not exist', async () => {
    const service = new DocumentIpcService(new InMemoryDocumentRepository());

    await expect(service.get('missing-note')).resolves.toEqual({
      ok: true,
      value: null,
    });
  });

  it('validates a renderer mutation before passing it to the repository', async () => {
    const service = new DocumentIpcService(new InMemoryDocumentRepository());

    const invalid = await service.apply({
      id: 'mutation-invalid',
      documentId: 'note-1',
      baseRevision: 'initial',
      source: 'unknown',
      kind: 'replace-body',
      body: 'body',
      occurredAt: '2026-10-21T12:00:00.000Z',
    });

    expect(invalid).toEqual({
      ok: false,
      error: {
        code: 'INVALID_MUTATION',
        message: 'Mutation source is not supported.',
      },
    });
  });

  it('returns a canonical document projection after an accepted mutation', async () => {
    const service = new DocumentIpcService(new InMemoryDocumentRepository());

    await expect(service.apply(createMutation())).resolves.toEqual({
      ok: true,
      value: {
        id: noteId,
        title: 'First note',
        body: 'first line',
        notebookId: 'inbox',
        status: 'none',
        tags: [],
        doctype: 'markdown',
        pinned: false,
        numOfTasks: 0,
        numOfCheckedTasks: 0,
        createdAt: '2026-10-21T12:00:00.000Z',
        updatedAt: '2026-10-21T12:00:00.000Z',
        revision: 'local-1',
        deletedAt: null,
      },
    });
  });

  it('returns validated immutable tag summaries', async () => {
    const repository = new InMemoryDocumentRepository();
    const service = new DocumentIpcService(repository);

    await repository.apply(
      createCreateDocumentMutation({
        ...createMutation(),
        tags: ['Work'],
      }),
    );

    await expect(service.listTags()).resolves.toEqual({
      ok: true,
      value: [
        expect.objectContaining({
          id: expect.stringMatching(/^tag:/),
          name: 'work',
          color: 'default',
          count: 1,
        }),
      ],
    });
  });

  it('validates a complete notebook update before forwarding it to the repository', async () => {
    const repository = new InMemoryDocumentRepository();
    const service = new DocumentIpcService(repository);

    await repository.createNotebook({
      id: 'work',
      name: 'Work',
      occurredAt: '2026-10-26T12:00:00.000Z',
    });

    await expect(
      service.updateNotebook({
        id: 'work',
        name: '  Client work  ',
        parentId: null,
        icon: 'briefcase',
        occurredAt: '2026-10-26T12:01:00.000Z',
      }),
    ).resolves.toEqual({
      ok: true,
      value: {
        id: 'work',
        name: 'Client work',
        parentId: null,
        icon: 'briefcase',
        createdAt: '2026-10-26T12:00:00.000Z',
        updatedAt: '2026-10-26T12:01:00.000Z',
      },
    });
    await expect(
      service.updateNotebook({
        id: 'work',
        name: 'Client work',
        parentId: null,
        icon: null,
        occurredAt: '2026-10-26T12:02:00.000Z',
      }),
    ).resolves.toEqual({
      ok: true,
      value: {
        id: 'work',
        name: 'Client work',
        parentId: null,
        createdAt: '2026-10-26T12:00:00.000Z',
        updatedAt: '2026-10-26T12:02:00.000Z',
      },
    });
    await expect(
      service.updateNotebook({
        id: 'work',
        name: '',
        parentId: null,
        icon: null,
        occurredAt: '2026-10-26T12:02:00.000Z',
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'INVALID_MUTATION' },
    });
  });

  it('does not forward malformed tag repository values across IPC', async () => {
    const service = new DocumentIpcService({
      listTags: async () => [
        {
          id: 'tag-malformed',
          name: 'Malformed',
          color: 'not-a-color',
          count: 0,
          createdAt: '2026-10-21T12:00:00.000Z',
          updatedAt: '2026-10-21T12:00:00.000Z',
        },
      ],
    } as unknown as ConstructorParameters<typeof DocumentIpcService>[0]);

    await expect(service.listTags()).resolves.toEqual({
      ok: false,
      error: {
        code: 'INVALID_MUTATION',
        message: 'Tag color is not supported.',
      },
    });
  });

  it('only allows permanently deleting a note after it has been moved to Trash', async () => {
    const repository = new InMemoryDocumentRepository();
    const service = new DocumentIpcService(repository);
    const created = await repository.apply(createMutation());

    const archived = await service.apply(
      createArchiveMutation({
        id: createMutationId('mutation-archive'),
        documentId: noteId,
        baseRevision: created.revision,
        source: 'command',
        occurredAt: '2026-10-21T12:01:00.000Z',
      }),
    );

    expect(archived).toMatchObject({ ok: true });
    await expect(
      service.deletePermanently({ noteIds: [noteId] }),
    ).resolves.toEqual({ ok: true, value: { deletedNoteIds: [noteId] } });
    await expect(service.get(noteId)).resolves.toEqual({
      ok: true,
      value: null,
    });

    await expect(service.deletePermanently({ noteIds: [] })).resolves.toEqual({
      ok: false,
      error: {
        code: 'INVALID_MUTATION',
        message: 'Permanent note deletion requires at least one note ID.',
      },
    });
  });
});
