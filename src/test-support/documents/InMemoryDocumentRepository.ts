import {
  createDocumentNotFoundError,
  createInvalidMutationError,
  createRevisionConflictError,
} from '../../renderer/platform/documents/document.errors';
import type { DocumentRepository } from '../../renderer/platform/documents/document.repository';
import {
  INITIAL_DOCUMENT_REVISION,
  createRevision,
  validateDocumentMutation,
  type CreateDocumentMutation,
  type DocumentMutation,
  type NoteDocument,
  type NoteId,
} from '../../renderer/platform/documents/document.types';

/**
 * Test-only implementation of the document repository port.
 *
 * It deliberately models revision conflicts but not durable mutation-id
 * idempotency; that behavior belongs to the SQLite/outbox implementation.
 */
export class InMemoryDocumentRepository implements DocumentRepository {
  private readonly documents = new Map<NoteId, NoteDocument>();

  private revisionSequence = 0;

  async get(id: NoteId): Promise<NoteDocument | null> {
    const document = this.documents.get(id);

    return document === undefined ? null : freezeDocument(document);
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
      case 'archive':
        return freezeDocument({ ...revised, deletedAt: mutation.occurredAt });
      case 'restore':
        return freezeDocument({ ...revised, deletedAt: null });
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
