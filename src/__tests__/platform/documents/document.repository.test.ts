/** @jest-environment node */

import {
  INITIAL_DOCUMENT_REVISION,
  createArchiveMutation,
  createCreateDocumentMutation,
  createMutationId,
  createNoteId,
  createReplaceBodyMutation,
  createRestoreMutation,
  createUpdateTitleMutation,
  type DocumentMutation,
} from '../../../renderer/platform/documents/document.types';
import { InMemoryDocumentRepository } from '../../../test-support/documents/InMemoryDocumentRepository';

const noteId = createNoteId('note-1');

const createMutation = () =>
  createCreateDocumentMutation({
    id: createMutationId('mutation-create'),
    documentId: noteId,
    baseRevision: INITIAL_DOCUMENT_REVISION,
    source: 'editor',
    title: 'First note',
    body: 'first line\r\nsecond line',
    occurredAt: '2026-10-20T12:00:00.000Z',
  });

describe('InMemoryDocumentRepository', () => {
  it('creates an immutable canonical document snapshot', async () => {
    const repository = new InMemoryDocumentRepository();

    const document = await repository.apply(createMutation());

    expect(document).toMatchObject({
      id: noteId,
      title: 'First note',
      body: 'first line\nsecond line',
      createdAt: '2026-10-20T12:00:00.000Z',
      updatedAt: '2026-10-20T12:00:00.000Z',
      deletedAt: null,
    });
    expect(document.revision).not.toBe(INITIAL_DOCUMENT_REVISION);
    expect(Object.isFrozen(document)).toBe(true);

    const fetched = await repository.get(noteId);

    expect(fetched).toEqual(document);
    expect(fetched).not.toBe(document);
    expect(Object.isFrozen(fetched)).toBe(true);
  });

  it('applies title, body, archive, and restore mutations in revision order', async () => {
    const repository = new InMemoryDocumentRepository();
    const created = await repository.apply(createMutation());

    const renamed = await repository.apply(
      createUpdateTitleMutation({
        id: createMutationId('mutation-title'),
        documentId: noteId,
        baseRevision: created.revision,
        source: 'editor',
        title: 'Renamed note',
        occurredAt: '2026-10-20T12:01:00.000Z',
      }),
    );
    const replacedBody = await repository.apply(
      createReplaceBodyMutation({
        id: createMutationId('mutation-body'),
        documentId: noteId,
        baseRevision: renamed.revision,
        source: 'editor',
        body: 'updated body',
        occurredAt: '2026-10-20T12:02:00.000Z',
      }),
    );
    const archived = await repository.apply(
      createArchiveMutation({
        id: createMutationId('mutation-archive'),
        documentId: noteId,
        baseRevision: replacedBody.revision,
        source: 'command',
        occurredAt: '2026-10-20T12:03:00.000Z',
      }),
    );
    const restored = await repository.apply(
      createRestoreMutation({
        id: createMutationId('mutation-restore'),
        documentId: noteId,
        baseRevision: archived.revision,
        source: 'command',
        occurredAt: '2026-10-20T12:04:00.000Z',
      }),
    );

    expect(renamed).toMatchObject({
      title: 'Renamed note',
      body: 'first line\nsecond line',
      createdAt: created.createdAt,
      updatedAt: '2026-10-20T12:01:00.000Z',
      deletedAt: null,
    });
    expect(replacedBody).toMatchObject({
      title: 'Renamed note',
      body: 'updated body',
      updatedAt: '2026-10-20T12:02:00.000Z',
    });
    expect(archived).toMatchObject({
      deletedAt: '2026-10-20T12:03:00.000Z',
      updatedAt: '2026-10-20T12:03:00.000Z',
    });
    expect(restored).toMatchObject({
      deletedAt: null,
      updatedAt: '2026-10-20T12:04:00.000Z',
    });
    expect(restored.revision).not.toBe(created.revision);
    expect(Object.isFrozen(restored)).toBe(true);
  });

  it('rejects a stale base revision without overwriting the current document', async () => {
    const repository = new InMemoryDocumentRepository();
    const created = await repository.apply(createMutation());
    const updated = await repository.apply(
      createUpdateTitleMutation({
        id: createMutationId('mutation-title'),
        documentId: noteId,
        baseRevision: created.revision,
        source: 'editor',
        title: 'Current title',
        occurredAt: '2026-10-20T12:01:00.000Z',
      }),
    );

    await expect(
      repository.apply(
        createReplaceBodyMutation({
          id: createMutationId('mutation-stale'),
          documentId: noteId,
          baseRevision: created.revision,
          source: 'editor',
          body: 'must not replace the current body',
          occurredAt: '2026-10-20T12:02:00.000Z',
        }),
      ),
    ).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });
    await expect(repository.get(noteId)).resolves.toEqual(updated);
  });

  it('rejects mutations for missing documents with a stable error code', async () => {
    const repository = new InMemoryDocumentRepository();
    const missingNoteId = createNoteId('missing-note');

    await expect(repository.get(missingNoteId)).resolves.toBeNull();

    await expect(
      repository.apply(
        createUpdateTitleMutation({
          id: createMutationId('mutation-missing'),
          documentId: missingNoteId,
          baseRevision: INITIAL_DOCUMENT_REVISION,
          source: 'editor',
          title: 'No document exists',
          occurredAt: '2026-10-20T12:00:00.000Z',
        }),
      ),
    ).rejects.toMatchObject({ code: 'DOCUMENT_NOT_FOUND' });
  });

  it('rejects a second creation for the same document as a revision conflict', async () => {
    const repository = new InMemoryDocumentRepository();

    await repository.apply(createMutation());

    await expect(
      repository.apply(
        createCreateDocumentMutation({
          ...createMutation(),
          id: createMutationId('mutation-duplicate-create'),
        }),
      ),
    ).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });
  });

  it('rejects malformed runtime mutations without changing the document', async () => {
    const repository = new InMemoryDocumentRepository();
    const created = await repository.apply(createMutation());
    const malformedMutation = {
      id: createMutationId('mutation-malformed'),
      documentId: noteId,
      baseRevision: created.revision,
      source: 'editor',
      kind: 'replace-body',
      body: 42,
      occurredAt: '2026-10-20T12:01:00.000Z',
    } as unknown as DocumentMutation;

    await expect(repository.apply(malformedMutation)).rejects.toMatchObject({
      code: 'INVALID_MUTATION',
    });
    await expect(repository.get(noteId)).resolves.toEqual(created);
  });

  it('requires a document to be restored before it can be edited', async () => {
    const repository = new InMemoryDocumentRepository();
    const created = await repository.apply(createMutation());
    const archived = await repository.apply(
      createArchiveMutation({
        id: createMutationId('mutation-archive'),
        documentId: noteId,
        baseRevision: created.revision,
        source: 'command',
        occurredAt: '2026-10-20T12:01:00.000Z',
      }),
    );

    await expect(
      repository.apply(
        createUpdateTitleMutation({
          id: createMutationId('mutation-edit-archived'),
          documentId: noteId,
          baseRevision: archived.revision,
          source: 'editor',
          title: 'Must be restored first',
          occurredAt: '2026-10-20T12:02:00.000Z',
        }),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_MUTATION' });
    await expect(repository.get(noteId)).resolves.toEqual(archived);
  });
});
