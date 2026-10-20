/** @jest-environment node */

import {
  DocumentSession,
  type DocumentSessionSnapshot,
} from '../../../renderer/platform/documents/DocumentSession';
import type { DocumentRepository } from '../../../renderer/platform/documents/document.repository';
import {
  INITIAL_DOCUMENT_REVISION,
  createCreateDocumentMutation,
  createMutationId,
  createNoteId,
  createReplaceBodyMutation,
  createRevision,
  createUpdateTitleMutation,
  type NoteDocument,
  type NoteId,
  type Revision,
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
    body: 'first line',
    occurredAt: '2026-10-20T12:00:00.000Z',
  });

const createDocument = (
  id: NoteId,
  revision: Revision,
  title: string,
): NoteDocument =>
  Object.freeze({
    id,
    title,
    body: '',
    createdAt: '2026-10-20T12:00:00.000Z',
    updatedAt: '2026-10-20T12:00:00.000Z',
    revision,
    deletedAt: null,
  });

const createDeferred = <T>() => {
  let resolveDeferred: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    resolveDeferred = resolve;
  });

  return { promise, resolve: resolveDeferred };
};

describe('DocumentSession', () => {
  it('publishes an immutable snapshot after opening a document', async () => {
    const repository = new InMemoryDocumentRepository();
    const created = await repository.apply(createMutation());
    const session = new DocumentSession(repository);
    const snapshots: DocumentSessionSnapshot[] = [];

    session.subscribe((snapshot) => snapshots.push(snapshot));

    const opened = await session.open(noteId);
    const snapshot = session.getSnapshot();

    expect(opened).toEqual(created);
    expect(snapshot).toEqual({ document: created, lastError: null });
    expect(snapshots).toEqual([snapshot]);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.document)).toBe(true);
  });

  it('preserves the current document and publishes a typed error when applying a stale mutation', async () => {
    const repository = new InMemoryDocumentRepository();
    await repository.apply(createMutation());
    const session = new DocumentSession(repository);
    const opened = await session.open(noteId);
    const snapshots: DocumentSessionSnapshot[] = [];

    session.subscribe((snapshot) => snapshots.push(snapshot));

    await expect(
      session.apply(
        createReplaceBodyMutation({
          id: createMutationId('mutation-stale'),
          documentId: noteId,
          baseRevision: INITIAL_DOCUMENT_REVISION,
          source: 'editor',
          body: 'must not replace',
          occurredAt: '2026-10-20T12:01:00.000Z',
        }),
      ),
    ).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });

    const snapshot = session.getSnapshot();

    expect(snapshot.document).toEqual(opened);
    expect(snapshot.lastError).toMatchObject({ code: 'REVISION_CONFLICT' });
    expect(Object.isFrozen(snapshot.lastError)).toBe(true);
    expect(snapshots).toEqual([snapshot]);
  });

  it('clears a previously opened document when the next open target is missing', async () => {
    const repository = new InMemoryDocumentRepository();
    await repository.apply(createMutation());
    const session = new DocumentSession(repository);

    await session.open(noteId);

    await expect(
      session.open(createNoteId('missing-note')),
    ).rejects.toMatchObject({
      code: 'DOCUMENT_NOT_FOUND',
    });

    expect(session.getSnapshot()).toMatchObject({
      document: null,
      lastError: { code: 'DOCUMENT_NOT_FOUND' },
    });
  });

  it('does not notify a listener after it unsubscribes', async () => {
    const repository = new InMemoryDocumentRepository();
    await repository.apply(createMutation());
    const session = new DocumentSession(repository);
    const listener = jest.fn();
    const subscription = session.subscribe(listener);

    const opened = await session.open(noteId);

    subscription.unsubscribe();
    await session.apply(
      createUpdateTitleMutation({
        id: createMutationId('mutation-title'),
        documentId: noteId,
        baseRevision: opened.revision,
        source: 'editor',
        title: 'Updated title',
        occurredAt: '2026-10-20T12:01:00.000Z',
      }),
    );

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps the most recent open target when responses resolve out of order', async () => {
    const firstNoteId = createNoteId('note-first');
    const secondNoteId = createNoteId('note-second');
    const firstDocument = createDocument(
      firstNoteId,
      createRevision('revision-first'),
      'First',
    );
    const secondDocument = createDocument(
      secondNoteId,
      createRevision('revision-second'),
      'Second',
    );
    const firstRequest = createDeferred<NoteDocument | null>();
    const secondRequest = createDeferred<NoteDocument | null>();
    const repository: DocumentRepository = {
      get: (id) =>
        id === firstNoteId ? firstRequest.promise : secondRequest.promise,
      apply: async () => {
        throw new Error('apply is not used by this test');
      },
    };
    const session = new DocumentSession(repository);

    const firstOpen = session.open(firstNoteId);
    const secondOpen = session.open(secondNoteId);

    secondRequest.resolve(secondDocument);
    await expect(secondOpen).resolves.toEqual(secondDocument);
    firstRequest.resolve(firstDocument);
    await expect(firstOpen).resolves.toEqual(firstDocument);

    expect(session.getSnapshot()).toEqual({
      document: secondDocument,
      lastError: null,
    });
  });

  it('does not attach a late open error to a newer selected document', async () => {
    const firstNoteId = createNoteId('note-first');
    const secondNoteId = createNoteId('note-second');
    const secondDocument = createDocument(
      secondNoteId,
      createRevision('revision-second'),
      'Second',
    );
    const firstRequest = createDeferred<NoteDocument | null>();
    const secondRequest = createDeferred<NoteDocument | null>();
    const repository: DocumentRepository = {
      get: (id) =>
        id === firstNoteId ? firstRequest.promise : secondRequest.promise,
      apply: async () => {
        throw new Error('apply is not used by this test');
      },
    };
    const session = new DocumentSession(repository);

    const firstOpen = session.open(firstNoteId);
    const secondOpen = session.open(secondNoteId);

    secondRequest.resolve(secondDocument);
    await expect(secondOpen).resolves.toEqual(secondDocument);
    firstRequest.resolve(null);
    await expect(firstOpen).rejects.toMatchObject({
      code: 'DOCUMENT_NOT_FOUND',
    });

    expect(session.getSnapshot()).toEqual({
      document: secondDocument,
      lastError: null,
    });
  });

  it('does not replace the active document with a background mutation', async () => {
    const repository = new InMemoryDocumentRepository();
    const backgroundNoteId = createNoteId('note-background');
    const activeDocument = await repository.apply(createMutation());
    const backgroundDocument = await repository.apply(
      createCreateDocumentMutation({
        id: createMutationId('mutation-background-create'),
        documentId: backgroundNoteId,
        baseRevision: INITIAL_DOCUMENT_REVISION,
        source: 'system',
        title: 'Background note',
        body: '',
        occurredAt: '2026-10-20T12:00:00.000Z',
      }),
    );
    const session = new DocumentSession(repository);

    await session.open(noteId);
    const applied = await session.apply(
      createUpdateTitleMutation({
        id: createMutationId('mutation-background-title'),
        documentId: backgroundNoteId,
        baseRevision: backgroundDocument.revision,
        source: 'system',
        title: 'Updated in background',
        occurredAt: '2026-10-20T12:01:00.000Z',
      }),
    );

    expect(applied.title).toBe('Updated in background');
    expect(session.getSnapshot()).toEqual({
      document: activeDocument,
      lastError: null,
    });
  });

  it('isolates listener failures from accepted document operations', async () => {
    const repository = new InMemoryDocumentRepository();
    await repository.apply(createMutation());
    const onListenerError = jest.fn();
    const session = new DocumentSession(repository, { onListenerError });
    const brokenListener = jest.fn(() => {
      throw new Error('listener failed');
    });
    const healthyListener = jest.fn();

    session.subscribe(brokenListener);
    session.subscribe(healthyListener);

    await expect(session.open(noteId)).resolves.toMatchObject({ id: noteId });

    expect(onListenerError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'listener failed' }),
    );
    expect(healthyListener).toHaveBeenCalledTimes(1);
    expect(session.getSnapshot()).toMatchObject({
      document: { id: noteId },
      lastError: null,
    });
  });
});
