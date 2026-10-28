import {
  runDocumentIpcOperation,
  type DocumentIpcResult,
} from '../../shared/documents/document.ipc';
import { createInvalidMutationError } from '../../shared/documents/document.errors';
import type {
  DocumentDeletionRepository,
  DocumentRepository,
} from '../../shared/documents/document.repository';
import type {
  DocumentQueryRepository,
  NotebookRepository,
  TagRepository,
} from '../../shared/documents/document.query';
import {
  createNoteId,
  validateCreateTagInput,
  validateDeleteTagInput,
  validateDeleteNotebookInput,
  validateDocumentMutation,
  validatePermanentlyDeleteNotesInput,
  validateDeleteTagResult,
  validateTagSummary,
  validateUpdateTagInput,
  validateUpdateNotebookInput,
  type DeleteTagResult,
  type DocumentMutation,
  type NoteDocument,
  type Notebook,
  type PermanentlyDeleteNotesResult,
  type TagSummary,
} from '../../shared/documents/document.types';

/**
 * Adapts untrusted IPC payloads to the typed document repository port.
 *
 * This class has no Electron dependency so it can be tested independently of
 * a window. Electron handlers only authorize the sender and delegate here.
 */
export class DocumentIpcService {
  constructor(
    private readonly repository: DocumentRepository &
      DocumentDeletionRepository &
      DocumentQueryRepository &
      NotebookRepository &
      TagRepository,
  ) {}

  async listActive(): Promise<DocumentIpcResult<readonly NoteDocument[]>> {
    return runDocumentIpcOperation(() => this.repository.listActive());
  }

  async listArchived(): Promise<DocumentIpcResult<readonly NoteDocument[]>> {
    return runDocumentIpcOperation(() => this.repository.listArchived());
  }

  async listNotebooks(): Promise<DocumentIpcResult<readonly Notebook[]>> {
    return runDocumentIpcOperation(() => this.repository.listNotebooks());
  }

  async listTags(): Promise<DocumentIpcResult<readonly TagSummary[]>> {
    return runDocumentIpcOperation(async () =>
      Object.freeze(
        (await this.repository.listTags()).map((tag) =>
          validateTagSummary(tag),
        ),
      ),
    );
  }

  async createNotebook(input: unknown): Promise<DocumentIpcResult<Notebook>> {
    return runDocumentIpcOperation(() =>
      this.repository.createNotebook(parseCreateNotebookInput(input)),
    );
  }

  async createTag(input: unknown): Promise<DocumentIpcResult<TagSummary>> {
    return runDocumentIpcOperation(async () =>
      validateTagSummary(
        await this.repository.createTag(validateCreateTagInput(input)),
      ),
    );
  }

  async updateTag(input: unknown): Promise<DocumentIpcResult<TagSummary>> {
    return runDocumentIpcOperation(async () =>
      validateTagSummary(
        await this.repository.updateTag(validateUpdateTagInput(input)),
      ),
    );
  }

  async deleteTag(input: unknown): Promise<DocumentIpcResult<DeleteTagResult>> {
    return runDocumentIpcOperation(async () =>
      validateDeleteTagResult(
        await this.repository.deleteTag(validateDeleteTagInput(input)),
      ),
    );
  }

  async updateNotebook(input: unknown): Promise<DocumentIpcResult<Notebook>> {
    return runDocumentIpcOperation(() =>
      this.repository.updateNotebook(validateUpdateNotebookInput(input)),
    );
  }

  async deleteNotebook(input: unknown) {
    return runDocumentIpcOperation(() =>
      this.repository.deleteNotebook(validateDeleteNotebookInput(input)),
    );
  }

  async deletePermanently(
    input: unknown,
  ): Promise<DocumentIpcResult<PermanentlyDeleteNotesResult>> {
    return runDocumentIpcOperation(() =>
      this.repository.deletePermanently(
        validatePermanentlyDeleteNotesInput(input),
      ),
    );
  }

  async get(id: unknown): Promise<DocumentIpcResult<NoteDocument | null>> {
    return runDocumentIpcOperation(() =>
      this.repository.get(parseNoteIdFromIpc(id)),
    );
  }

  async apply(mutation: unknown): Promise<DocumentIpcResult<NoteDocument>> {
    return runDocumentIpcOperation(() =>
      this.repository.apply(
        validateDocumentMutation(mutation as DocumentMutation),
      ),
    );
  }
}

const parseNoteIdFromIpc = (value: unknown) => {
  if (typeof value !== 'string') {
    throw createInvalidMutationError('Document ID must be a non-empty string.');
  }

  return createNoteId(value);
};

const parseCreateNotebookInput = (value: unknown) => {
  if (typeof value !== 'object' || value === null) {
    throw createInvalidMutationError('A notebook must be an object.');
  }

  return value as {
    id: string;
    name: string;
    occurredAt: string;
  };
};
