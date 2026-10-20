/** @jest-environment node */

import {
  INITIAL_DOCUMENT_REVISION,
  createArchiveMutation,
  createCreateDocumentMutation,
  createMutationId,
  createNoteId,
  createReplaceBodyMutation,
  createRevision,
  createRestoreMutation,
  createUpdateTitleMutation,
  type NoteId,
} from '../../../renderer/platform/documents/document.types';
import { DocumentDomainError } from '../../../renderer/platform/documents/document.errors';

const getThrownError = (operation: () => void): unknown => {
  try {
    operation();
  } catch (error) {
    return error;
  }

  throw new Error('Expected the operation to throw.');
};

const expectInvalidMutation = (operation: () => void): void => {
  const error = getThrownError(operation);

  expect(error).toBeInstanceOf(DocumentDomainError);
  expect(error).toMatchObject({ code: 'INVALID_MUTATION' });
};

describe('document primitives', () => {
  it('creates opaque identifiers without changing their values', () => {
    const noteId: NoteId = createNoteId('note-1');

    expect(noteId).toBe('note-1');
    expect(createRevision('revision-1')).toBe('revision-1');
    expect(createMutationId('mutation-1')).toBe('mutation-1');
  });

  it('normalizes Markdown line endings when it creates a body mutation', () => {
    const mutation = createReplaceBodyMutation({
      id: createMutationId('mutation-1'),
      documentId: createNoteId('note-1'),
      baseRevision: createRevision('revision-1'),
      source: 'editor',
      body: 'first line\r\nsecond line\rthird line\n',
      occurredAt: '2026-10-20T12:00:00.000Z',
    });

    expect(mutation).toEqual({
      id: 'mutation-1',
      documentId: 'note-1',
      baseRevision: 'revision-1',
      source: 'editor',
      kind: 'replace-body',
      body: 'first line\nsecond line\nthird line\n',
      occurredAt: '2026-10-20T12:00:00.000Z',
    });
    expect(Object.isFrozen(mutation)).toBe(true);
  });

  it('creates the five discriminated document mutation kinds', () => {
    const common = {
      id: createMutationId('mutation-1'),
      documentId: createNoteId('note-1'),
      baseRevision: INITIAL_DOCUMENT_REVISION,
      source: 'system' as const,
      occurredAt: '2026-10-20T12:00:00.000Z',
    };

    expect(
      createCreateDocumentMutation({
        ...common,
        title: 'My note',
        body: 'first\r\nsecond',
      }),
    ).toMatchObject({
      kind: 'create',
      title: 'My note',
      body: 'first\nsecond',
    });
    expect(
      createUpdateTitleMutation({ ...common, title: 'Renamed' }),
    ).toMatchObject({
      kind: 'update-title',
      title: 'Renamed',
    });
    expect(createArchiveMutation(common)).toMatchObject({ kind: 'archive' });
    expect(createRestoreMutation(common)).toMatchObject({ kind: 'restore' });
  });

  it('requires the initial revision when it creates a document', () => {
    expect.hasAssertions();

    expectInvalidMutation(() =>
      createCreateDocumentMutation({
        id: createMutationId('mutation-create'),
        documentId: createNoteId('note-1'),
        baseRevision: createRevision('revision-1'),
        source: 'editor',
        title: 'My note',
        body: 'Body',
        occurredAt: '2026-10-20T12:00:00.000Z',
      }),
    );
  });

  it('uses a stable domain error code when an identifier is blank', () => {
    expect.hasAssertions();

    expectInvalidMutation(() => createNoteId('   '));
  });

  it('rejects a non-string Markdown body with a stable domain error code', () => {
    expect.hasAssertions();

    expectInvalidMutation(() =>
      createReplaceBodyMutation({
        id: createMutationId('mutation-1'),
        documentId: createNoteId('note-1'),
        baseRevision: createRevision('revision-1'),
        source: 'editor',
        body: 42 as unknown as string,
        occurredAt: '2026-10-20T12:00:00.000Z',
      }),
    );
  });

  it('rejects malformed common mutation fields with a stable domain error code', () => {
    expect.hasAssertions();

    expectInvalidMutation(() =>
      createUpdateTitleMutation({
        id: createMutationId('mutation-1'),
        documentId: createNoteId('note-1'),
        baseRevision: createRevision('revision-1'),
        source: 'invalid-source' as 'editor',
        title: 'Title',
        occurredAt: '2026-10-20T12:00:00.000Z',
      }),
    );
  });
});
