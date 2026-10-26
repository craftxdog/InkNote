/** @jest-environment node */

import {
  INITIAL_DOCUMENT_REVISION,
  createArchiveMutation,
  createCreateDocumentMutation,
  createGeneratedNotebookId,
  createGeneratedNoteId,
  createGeneratedTagId,
  createMutationId,
  createNoteId,
  createReplaceBodyMutation,
  createRevision,
  createRestoreMutation,
  createUpdatePinnedMutation,
  createUpdateTagsMutation,
  validateUpdateNotebookInput,
  validateTagSummary,
  createUpdateTitleMutation,
  validatePermanentlyDeleteNotesInput,
  validateNoteDocument,
  type NoteId,
} from '../../../shared/documents/document.types';
import { DocumentDomainError } from '../../../shared/documents/document.errors';

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

  it('generates Inkdrop-compatible prefixes while accepting legacy IDs', () => {
    expect(createGeneratedNoteId('018')).toBe('note:018');
    expect(createGeneratedNotebookId('019')).toBe('book:019');
    expect(createGeneratedTagId('020')).toBe('tag:020');
    expect(createNoteId('legacy-note-id')).toBe('legacy-note-id');
  });

  it('validates an immutable full notebook update for legacy and generated IDs', () => {
    const legacyUpdate = validateUpdateNotebookInput({
      id: 'legacy-workspace',
      name: '  Renamed workspace  ',
      parentId: null,
      icon: null,
      occurredAt: '2026-10-26T12:00:00.000Z',
    });
    const generatedUpdate = validateUpdateNotebookInput({
      id: 'book:projects',
      name: 'Projects',
      parentId: 'legacy-workspace',
      icon: 'rocket',
      occurredAt: '2026-10-26T12:01:00.000Z',
    });

    expect(legacyUpdate).toEqual({
      id: 'legacy-workspace',
      name: 'Renamed workspace',
      parentId: null,
      icon: null,
      occurredAt: '2026-10-26T12:00:00.000Z',
    });
    expect(Object.isFrozen(legacyUpdate)).toBe(true);
    expect(generatedUpdate).toMatchObject({
      id: 'book:projects',
      parentId: 'legacy-workspace',
      icon: 'rocket',
    });
  });

  it('rejects unsafe or incomplete notebook updates at the shared boundary', () => {
    const validInput = {
      id: 'work',
      name: 'Work',
      parentId: null,
      icon: null,
      occurredAt: '2026-10-26T12:00:00.000Z',
    };

    expectInvalidMutation(() =>
      validateUpdateNotebookInput({ ...validInput, id: 'inbox' }),
    );
    expectInvalidMutation(() =>
      validateUpdateNotebookInput({ ...validInput, name: '   ' }),
    );
    expectInvalidMutation(() =>
      validateUpdateNotebookInput({ ...validInput, parentId: 'work' }),
    );
    expectInvalidMutation(() =>
      validateUpdateNotebookInput({ ...validInput, icon: 'sparkle' }),
    );
    expectInvalidMutation(() => {
      const { icon: _icon, ...withoutIcon } = validInput;

      return validateUpdateNotebookInput(withoutIcon);
    });
  });

  it('validates immutable tag summaries at the shared boundary', () => {
    const tag = validateTagSummary({
      id: 'tag:018',
      name: 'Research',
      color: 'teal',
      count: 2,
      createdAt: '2026-10-25T12:00:00.000Z',
      updatedAt: '2026-10-25T12:01:00.000Z',
    });

    expect(tag).toEqual({
      id: 'tag:018',
      name: 'Research',
      color: 'teal',
      count: 2,
      createdAt: '2026-10-25T12:00:00.000Z',
      updatedAt: '2026-10-25T12:01:00.000Z',
    });
    expect(Object.isFrozen(tag)).toBe(true);

    expectInvalidMutation(() => validateTagSummary({ ...tag, color: 'cyan' }));
    expectInvalidMutation(() => validateTagSummary({ ...tag, count: -1 }));
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

  it('creates the document mutation kinds including explicit pin updates', () => {
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
    expect(createUpdatePinnedMutation({ ...common, pinned: true })).toEqual({
      ...common,
      kind: 'update-pinned',
      pinned: true,
    });
    expect(createArchiveMutation(common)).toMatchObject({ kind: 'archive' });
    expect(
      createRestoreMutation({ ...common, notebookId: 'work' }),
    ).toMatchObject({ kind: 'restore', notebookId: 'work' });
  });

  it('normalizes tags into a unique local-first mutation', () => {
    const mutation = createUpdateTagsMutation({
      id: createMutationId('mutation-tags'),
      documentId: createNoteId('note-1'),
      baseRevision: createRevision('revision-1'),
      source: 'editor',
      tags: [' Work ', 'work', 'Investigación', ''],
      occurredAt: '2026-10-21T12:00:00.000Z',
    });

    expect(mutation).toMatchObject({
      kind: 'update-tags',
      tags: ['work', 'investigación'],
    });
    expect(Object.isFrozen(mutation.tags)).toBe(true);
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

  it('rejects a permanent deletion with a non-string note ID', () => {
    expect.hasAssertions();

    expectInvalidMutation(() =>
      validatePermanentlyDeleteNotesInput({ noteIds: ['note-1', 42] }),
    );
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

  it('rebuilds a canonical immutable document projection from a plain DTO', () => {
    const document = validateNoteDocument({
      id: 'note-1',
      title: 'Title',
      body: 'Body',
      notebookId: 'inbox',
      status: 'active',
      tags: [],
      createdAt: '2026-10-21T12:00:00.000Z',
      updatedAt: '2026-10-21T12:01:00.000Z',
      deletedAt: null,
      revision: 'local-2',
    });

    expect(document).toEqual({
      id: 'note-1',
      title: 'Title',
      body: 'Body',
      notebookId: 'inbox',
      status: 'active',
      tags: [],
      createdAt: '2026-10-21T12:00:00.000Z',
      updatedAt: '2026-10-21T12:01:00.000Z',
      deletedAt: null,
      revision: 'local-2',
      doctype: 'markdown',
      pinned: false,
      numOfTasks: 0,
      numOfCheckedTasks: 0,
    });
    expect(Object.isFrozen(document)).toBe(true);
  });

  it('rejects a pin update that is not boolean', () => {
    expect.hasAssertions();

    expectInvalidMutation(() =>
      createUpdatePinnedMutation({
        id: createMutationId('mutation-pin'),
        documentId: createNoteId('note-1'),
        baseRevision: createRevision('revision-1'),
        source: 'editor',
        pinned: 'true' as unknown as boolean,
        occurredAt: '2026-10-21T12:00:00.000Z',
      }),
    );
  });

  it('rejects malformed document projections at a runtime boundary', () => {
    expect.hasAssertions();

    expectInvalidMutation(() =>
      validateNoteDocument({
        id: 'note-1',
        title: 'Title',
        body: 'Body',
        createdAt: '2026-10-21T12:00:00.000Z',
        updatedAt: '2026-10-21T12:01:00.000Z',
        deletedAt: 42,
        revision: 'local-2',
      }),
    );
  });
});
