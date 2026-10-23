import {
  createDocumentNotFoundError,
  createInvalidMutationError,
  createRevisionConflictError,
} from '../../shared/documents/document.errors';

import type {
  DocumentDeletionRepository,
  DocumentRepository,
} from '../../shared/documents/document.repository';
import type {
  DocumentQueryRepository,
  NotebookRepository,
} from '../../shared/documents/document.query';

import {
  INITIAL_DOCUMENT_REVISION,
  INBOX_NOTEBOOK_ID,
  createNotebook,
  type DeleteNotebookInput,
  type DeleteNotebookResult,
  type PermanentlyDeleteNotesInput,
  type PermanentlyDeleteNotesResult,
  createRevision,
  validateDocumentMutation,
  type CreateDocumentMutation,
  type DocumentMutation,
  type CreateNotebookInput,
  type Notebook,
  type NoteDocument,
  type NoteId,
} from '../../shared/documents/document.types';

/**
 * Test-only implementation of the document repository port.
 *
 * It deliberately models revision conflicts but not durable mutation-id
 * idempotency; that behavior belongs to the SQLite/outbox implementation.
 */
export class InMemoryDocumentRepository
  implements
    DocumentRepository,
    DocumentDeletionRepository,
    DocumentQueryRepository,
    NotebookRepository
{
  private readonly documents = new Map<NoteId, NoteDocument>();

  private readonly notebooks = new Map<string, Notebook>([
    [
      INBOX_NOTEBOOK_ID,
      Object.freeze({
        id: INBOX_NOTEBOOK_ID,
        name: 'Inbox',
        parentId: null,
        createdAt: '1970-01-01T00:00:00.000Z',
        updatedAt: '1970-01-01T00:00:00.000Z',
      }),
    ],
  ]);

  private revisionSequence = 0;

  async get(id: NoteId): Promise<NoteDocument | null> {
    const document = this.documents.get(id);

    return document === undefined ? null : freezeDocument(document);
  }

  async listActive(): Promise<readonly NoteDocument[]> {
    return this.listByDeletionState(false);
  }

  async listArchived(): Promise<readonly NoteDocument[]> {
    return this.listByDeletionState(true);
  }

  private listByDeletionState(
    archived: boolean,
  ): Promise<readonly NoteDocument[]> {
    return Promise.resolve(
      Object.freeze(
        [...this.documents.values()]
          .filter((document) => (document.deletedAt !== null) === archived)
          .sort((left, right) => {
            const byUpdatedAt = right.updatedAt.localeCompare(left.updatedAt);

            return byUpdatedAt === 0
              ? left.id.localeCompare(right.id)
              : byUpdatedAt;
          })
          .map(freezeDocument),
      ),
    );
  }

  async listNotebooks(): Promise<readonly Notebook[]> {
    return Object.freeze(
      [...this.notebooks.values()]
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((notebook) => Object.freeze({ ...notebook })),
    );
  }

  async createNotebook(input: CreateNotebookInput): Promise<Notebook> {
    const notebook = createNotebook(input);
    const parentId = notebook.parentId ?? null;

    if (this.notebooks.has(notebook.id)) {
      throw createInvalidMutationError(
        'A notebook with this ID already exists.',
      );
    }

    if (parentId !== null && !this.notebooks.has(parentId)) {
      throw createInvalidMutationError(
        `Notebook parent "${parentId}" does not exist.`,
      );
    }

    this.notebooks.set(notebook.id, notebook);

    return Object.freeze({ ...notebook });
  }

  async deleteNotebook(
    input: DeleteNotebookInput,
  ): Promise<DeleteNotebookResult> {
    if (input.id === INBOX_NOTEBOOK_ID) {
      throw createInvalidMutationError('The Inbox notebook cannot be deleted.');
    }

    const notebook = this.notebooks.get(input.id);

    if (notebook === undefined) {
      throw createInvalidMutationError(
        `Notebook "${input.id}" does not exist.`,
      );
    }

    const archivedNoteIds: NoteId[] = [];

    for (const document of this.documents.values()) {
      if (document.notebookId !== notebook.id || document.deletedAt !== null) {
        continue;
      }

      const archived = freezeDocument({
        ...document,
        updatedAt: input.occurredAt,
        deletedAt: input.occurredAt,
        revision: this.nextRevision(),
      });

      this.documents.set(archived.id, archived);
      archivedNoteIds.push(archived.id);
    }

    const reparentedNotebookIds: string[] = [];

    for (const child of this.notebooks.values()) {
      if (child.parentId !== notebook.id) {
        continue;
      }

      this.notebooks.set(
        child.id,
        Object.freeze({
          ...child,
          parentId: notebook.parentId ?? null,
          updatedAt: input.occurredAt,
        }),
      );
      reparentedNotebookIds.push(child.id);
    }

    this.notebooks.delete(notebook.id);

    return Object.freeze({
      deletedNotebookId: notebook.id,
      archivedNoteIds: Object.freeze(archivedNoteIds),
      reparentedNotebookIds: Object.freeze(reparentedNotebookIds),
    });
  }

  async deletePermanently(
    input: PermanentlyDeleteNotesInput,
  ): Promise<PermanentlyDeleteNotesResult> {
    const notes = input.noteIds.map((noteId) => {
      const note = this.documents.get(noteId);

      if (note === undefined) {
        throw createDocumentNotFoundError(noteId);
      }

      if (note.deletedAt === null) {
        throw createInvalidMutationError(
          'Only notes in Trash can be deleted permanently.',
        );
      }

      return note;
    });

    for (const note of notes) {
      this.documents.delete(note.id);
    }

    return Object.freeze({
      deletedNoteIds: Object.freeze(notes.map((note) => note.id)),
    });
  }

  async apply(mutation: DocumentMutation): Promise<NoteDocument> {
    const acceptedMutation = validateDocumentMutation(mutation);

    if (acceptedMutation.kind === 'create') {
      return this.applyCreate(acceptedMutation);
    }

    const current = this.documents.get(acceptedMutation.documentId);

    if (current === undefined) {
      throw createDocumentNotFoundError(acceptedMutation.documentId);
    }

    if (acceptedMutation.baseRevision !== current.revision) {
      throw createRevisionConflictError(
        `Document "${acceptedMutation.documentId}" has revision "${current.revision}".`,
      );
    }

    assertValidStateTransition(current, acceptedMutation);

    const document = this.applyExistingMutation(current, acceptedMutation);

    this.documents.set(document.id, document);

    return freezeDocument(document);
  }

  private applyCreate(mutation: CreateDocumentMutation): NoteDocument {
    if (this.documents.has(mutation.documentId)) {
      throw createRevisionConflictError(
        `Document "${mutation.documentId}" already exists.`,
      );
    }

    if (mutation.baseRevision !== INITIAL_DOCUMENT_REVISION) {
      throw createRevisionConflictError(
        'A new document must use the initial revision.',
      );
    }

    const document = freezeDocument({
      id: mutation.documentId,
      title: mutation.title,
      body: mutation.body,
      notebookId: mutation.notebookId,
      status: mutation.status,
      tags: Object.freeze([...mutation.tags]),
      createdAt: mutation.occurredAt,
      updatedAt: mutation.occurredAt,
      revision: this.nextRevision(),
      deletedAt: null,
    });

    this.documents.set(document.id, document);

    return freezeDocument(document);
  }

  private applyExistingMutation(
    current: NoteDocument,
    mutation: Exclude<DocumentMutation, CreateDocumentMutation>,
  ): NoteDocument {
    const revised = {
      ...current,
      updatedAt: mutation.occurredAt,
      revision: this.nextRevision(),
    };

    switch (mutation.kind) {
      case 'update-title':
        return freezeDocument({ ...revised, title: mutation.title });
      case 'replace-body':
        return freezeDocument({ ...revised, body: mutation.body });
      case 'update-tags':
        return freezeDocument({
          ...revised,
          tags: Object.freeze([...mutation.tags]),
        });
      case 'update-organization':
        return freezeDocument({
          ...revised,
          notebookId: mutation.notebookId,
          status: mutation.status,
        });
      case 'archive':
        return freezeDocument({ ...revised, deletedAt: mutation.occurredAt });
      case 'restore':
        return freezeDocument({
          ...revised,
          deletedAt: null,
          ...(mutation.notebookId === undefined
            ? {}
            : { notebookId: mutation.notebookId }),
        });
    }
  }

  private nextRevision() {
    this.revisionSequence += 1;

    return createRevision(`local-${this.revisionSequence}`);
  }
}

const freezeDocument = (document: NoteDocument): NoteDocument =>
  Object.freeze({ ...document });

const assertValidStateTransition = (
  current: NoteDocument,
  mutation: Exclude<DocumentMutation, CreateDocumentMutation>,
): void => {
  if (current.deletedAt === null && mutation.kind === 'restore') {
    throw createInvalidMutationError('An active document cannot be restored.');
  }

  if (current.deletedAt !== null && mutation.kind !== 'restore') {
    throw createInvalidMutationError(
      'An archived document must be restored before it can change.',
    );
  }
};
