import type { DocumentApi } from '../../../shared/bridge';
import { DocumentTransportError } from '../../../shared/documents/document.errors';
import { unwrapDocumentIpcResult } from '../../../shared/documents/document.ipc';
import type {
  DocumentQueryRepository,
  NotebookRepository,
  TagRepository,
} from '../../../shared/documents/document.query';
import type {
  DocumentDeletionRepository,
  DocumentRepository,
} from '../../../shared/documents/document.repository';
import {
  createNoteId,
  validateDeleteTagResult,
  validateNoteDocument,
  validateNotebook,
  validateTagSummary,
  type CreateTagInput,
  type DeleteTagInput,
  type DeleteTagResult,
  type CreateNotebookInput,
  type DeleteNotebookInput,
  type DeleteNotebookResult,
  type DocumentMutation,
  type PermanentlyDeleteNotesInput,
  type PermanentlyDeleteNotesResult,
  type NoteDocument,
  type NoteId,
  type Notebook,
  type TagSummary,
  type UpdateTagInput,
  type UpdateNotebookInput,
} from '../../../shared/documents/document.types';

/**
 * Renderer-side repository adapter. It knows only the narrow preload API and
 * reconstructs canonical values after Electron has structured-cloned them.
 */
export class IpcDocumentRepository
  implements
    DocumentRepository,
    DocumentDeletionRepository,
    DocumentQueryRepository,
    NotebookRepository,
    TagRepository
{
  constructor(private readonly api: DocumentApi) {}

  async get(id: NoteId): Promise<NoteDocument | null> {
    const result = await this.api.get(id);
    const document = unwrapDocumentIpcResult(result, (value) =>
      value === null ? null : validateNoteDocument(value),
    );

    if (document !== null) {
      assertResponseDocumentId(id, document);
    }

    return document;
  }

  async listActive(): Promise<readonly NoteDocument[]> {
    const result = await this.api.listActive();

    return unwrapDocumentIpcResult(result, (value) => {
      if (!Array.isArray(value)) {
        throw new DocumentTransportError(
          'INVALID_IPC_RESPONSE',
          'The document list response must contain an array.',
        );
      }

      return Object.freeze(value.map(validateNoteDocument));
    });
  }

  async listArchived(): Promise<readonly NoteDocument[]> {
    const result = await this.api.listArchived();

    return unwrapDocumentIpcResult(result, (value) => {
      if (!Array.isArray(value)) {
        throw new DocumentTransportError(
          'INVALID_IPC_RESPONSE',
          'The archived document list response must contain an array.',
        );
      }

      return Object.freeze(value.map(validateNoteDocument));
    });
  }

  async listNotebooks() {
    const result = await this.api.listNotebooks();

    return unwrapDocumentIpcResult(result, (value) => {
      if (!Array.isArray(value)) {
        throw new DocumentTransportError(
          'INVALID_IPC_RESPONSE',
          'The notebook list response must contain an array.',
        );
      }

      return Object.freeze(value.map(validateNotebook));
    });
  }

  async listTags(): Promise<readonly TagSummary[]> {
    const result = await this.api.listTags();

    return unwrapDocumentIpcResult(result, (value) => {
      if (!Array.isArray(value)) {
        throw new DocumentTransportError(
          'INVALID_IPC_RESPONSE',
          'The tag list response must contain an array.',
        );
      }

      return Object.freeze(value.map(validateTagSummary));
    });
  }

  async createTag(input: CreateTagInput): Promise<TagSummary> {
    const result = await this.api.createTag(input);

    return unwrapDocumentIpcResult(result, validateTagSummary);
  }

  async updateTag(input: UpdateTagInput): Promise<TagSummary> {
    const result = await this.api.updateTag(input);

    return unwrapDocumentIpcResult(result, validateTagSummary);
  }

  async deleteTag(input: DeleteTagInput): Promise<DeleteTagResult> {
    const result = await this.api.deleteTag(input);

    return unwrapDocumentIpcResult(result, validateDeleteTagResult);
  }

  async createNotebook(input: CreateNotebookInput) {
    const result = await this.api.createNotebook(input);

    return unwrapDocumentIpcResult(result, validateNotebook);
  }

  async updateNotebook(input: UpdateNotebookInput): Promise<Notebook> {
    const result = await this.api.updateNotebook(input);

    return unwrapDocumentIpcResult(result, validateNotebook);
  }

  async deleteNotebook(
    input: DeleteNotebookInput,
  ): Promise<DeleteNotebookResult> {
    const result = await this.api.deleteNotebook(input);

    return unwrapDocumentIpcResult(result, validateNotebookDeletionResult);
  }

  async deletePermanently(
    input: PermanentlyDeleteNotesInput,
  ): Promise<PermanentlyDeleteNotesResult> {
    const result = await this.api.deletePermanently(input);

    return unwrapDocumentIpcResult(result, validatePermanentDeletionResult);
  }

  async apply(mutation: DocumentMutation): Promise<NoteDocument> {
    const result = await this.api.apply(mutation);
    const document = unwrapDocumentIpcResult(result, validateNoteDocument);

    assertResponseDocumentId(mutation.documentId, document);

    return document;
  }
}

const assertResponseDocumentId = (
  expectedId: NoteId,
  document: NoteDocument,
): void => {
  if (document.id !== expectedId) {
    throw new DocumentTransportError(
      'INVALID_IPC_RESPONSE',
      'The document response did not match the requested document.',
    );
  }
};

const validateNotebookDeletionResult = (
  value: unknown,
): DeleteNotebookResult => {
  if (typeof value !== 'object' || value === null) {
    throw new DocumentTransportError(
      'INVALID_IPC_RESPONSE',
      'The notebook deletion response must contain an object.',
    );
  }

  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate.deletedNotebookId !== 'string' ||
    candidate.deletedNotebookId.trim().length === 0 ||
    !Array.isArray(candidate.archivedNoteIds) ||
    candidate.archivedNoteIds.some(
      (id) => typeof id !== 'string' || id.trim().length === 0,
    ) ||
    !Array.isArray(candidate.reparentedNotebookIds) ||
    candidate.reparentedNotebookIds.some(
      (id) => typeof id !== 'string' || id.trim().length === 0,
    )
  ) {
    throw new DocumentTransportError(
      'INVALID_IPC_RESPONSE',
      'The notebook deletion response has an invalid shape.',
    );
  }

  return Object.freeze({
    deletedNotebookId: candidate.deletedNotebookId,
    archivedNoteIds: Object.freeze(candidate.archivedNoteIds),
    reparentedNotebookIds: Object.freeze(candidate.reparentedNotebookIds),
  });
};

const validatePermanentDeletionResult = (
  value: unknown,
): PermanentlyDeleteNotesResult => {
  if (typeof value !== 'object' || value === null) {
    throw new DocumentTransportError(
      'INVALID_IPC_RESPONSE',
      'The permanent deletion response has an invalid shape.',
    );
  }

  const candidate = value as Record<string, unknown>;
  const deletedNoteIds = candidate.deletedNoteIds;

  if (
    !Array.isArray(deletedNoteIds) ||
    deletedNoteIds.some(
      (id) => typeof id !== 'string' || id.trim().length === 0,
    )
  ) {
    throw new DocumentTransportError(
      'INVALID_IPC_RESPONSE',
      'The permanent deletion response has an invalid shape.',
    );
  }

  return Object.freeze({
    deletedNoteIds: Object.freeze(
      (deletedNoteIds as string[]).map((noteId) => createNoteId(noteId)),
    ),
  });
};
