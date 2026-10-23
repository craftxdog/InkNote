/** @jest-environment node */

import {
  DocumentSession,
  type DocumentSessionSnapshot,
} from '../../../renderer/platform/documents/DocumentSession';
import type { DocumentRepository } from '../../../shared/documents/document.repository';
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
    notebookId: 'inbox',
    status: 'active',
    tags: [],
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
    expect(snapshot).toEqual({
      selectedDocumentId: noteId,
      document: created,
      lastError: null,
      isLoading: false,
    });
    expect(snapshots).toEqual([
      {
        selectedDocumentId: noteId,
        document: null,
        lastError: null,
        isLoading: true,
      },
      snapshot,
    ]);
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
    expect(snapshot.selectedDocumentId).toBe(noteId);
    expect(snapshot.isLoading).toBe(false);
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
      selectedDocumentId: 'missing-note',
      document: null,
      lastError: { code: 'DOCUMENT_NOT_FOUND' },
      isLoading: false,
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

    expect(listener).toHaveBeenCalledTimes(2);
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
      selectedDocumentId: secondNoteId,
      document: secondDocument,
      lastError: null,
      isLoading: false,
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
      selectedDocumentId: secondNoteId,
      document: secondDocument,
      lastError: null,
      isLoading: false,
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
      selectedDocumentId: noteId,
      document: activeDocument,
      lastError: null,
      isLoading: false,
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
    expect(healthyListener).toHaveBeenCalledTimes(2);
    expect(session.getSnapshot()).toMatchObject({
      selectedDocumentId: noteId,
      document: { id: noteId },
      lastError: null,
      isLoading: false,
    });
  });

  it('publishes a loading selection without retaining a different note', () => {
    const requestedNoteId = createNoteId('note-requested');
    const request = createDeferred<NoteDocument | null>();
    const repository: DocumentRepository = {
      get: () => request.promise,
      apply: async () => {
        throw new Error('apply is not used by this test');
      },
    };
    const session = new DocumentSession(repository);

    void session.open(requestedNoteId);

    expect(session.getSnapshot()).toEqual({
      selectedDocumentId: requestedNoteId,
      document: null,
      lastError: null,
      isLoading: true,
    });
  });

  it('does not let a stale reopen overwrite an accepted same-note mutation', async () => {
    const initial = createDocument(
      noteId,
      createRevision('revision-initial'),
      'Initial title',
    );
    const updated = createDocument(
      noteId,
      createRevision('revision-updated'),
      'Updated title',
    );
    const reopenRequest = createDeferred<NoteDocument | null>();
    const applyRequest = createDeferred<NoteDocument>();
    let getCalls = 0;
    const repository: DocumentRepository = {
      get: async () => {
        getCalls += 1;

        return getCalls === 1 ? initial : reopenRequest.promise;
      },
      apply: () => applyRequest.promise,
    };
    const session = new DocumentSession(repository);

    await session.open(noteId);
    const reopen = session.open(noteId);
    const mutation = session.apply(
      createUpdateTitleMutation({
        id: createMutationId('mutation-racing-open'),
        documentId: noteId,
        baseRevision: initial.revision,
        source: 'editor',
        title: updated.title,
        occurredAt: '2026-10-20T12:01:00.000Z',
      }),
    );

    applyRequest.resolve(updated);
    await expect(mutation).resolves.toEqual(updated);
    reopenRequest.resolve(initial);
    await expect(reopen).resolves.toEqual(updated);

    expect(session.getSnapshot()).toEqual({
      selectedDocumentId: noteId,
      document: updated,
      lastError: null,
      isLoading: false,
    });
  });
});
