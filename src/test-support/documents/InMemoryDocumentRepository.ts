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
  TagRepository,
} from '../../shared/documents/document.query';

import {
  INITIAL_DOCUMENT_REVISION,
  INBOX_NOTEBOOK_ID,
  createNotebook,
  createGeneratedTagId,
  validateCreateTagInput,
  validateDeleteTagInput,
  validateDeleteTagResult,
  validateUpdateTagInput,
  validateUpdateNotebookInput,
  type CreateTagInput,
  type DeleteTagInput,
  type DeleteTagResult,
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
  type TagSummary,
  type TagId,
  type UpdateTagInput,
  type UpdateNotebookInput,
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
    NotebookRepository,
    TagRepository
{
  private readonly documents = new Map<NoteId, NoteDocument>();

  private readonly tags = new Map<TagId, TagSummary>();

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

  async listTags(): Promise<readonly TagSummary[]> {
    const catalogue = this.getTagCatalogue();
    const activeTags = new Map<string, number>();

    for (const document of this.documents.values()) {
      if (document.deletedAt !== null) {
        continue;
      }

      for (const tag of document.tags) {
        activeTags.set(tag, (activeTags.get(tag) ?? 0) + 1);
      }
    }

    return Object.freeze(
      [...catalogue.values()]
        .sort((left, right) => {
          const byName = left.name.localeCompare(right.name);

          return byName === 0 ? left.id.localeCompare(right.id) : byName;
        })
        .map((tag) =>
          Object.freeze({
            ...tag,
            count: activeTags.get(tag.name) ?? 0,
          }),
        ),
    );
  }

  async createTag(input: CreateTagInput): Promise<TagSummary> {
    const tag = validateCreateTagInput(input);
    const catalogue = this.getTagCatalogue();

    if (catalogue.has(tag.id)) {
      throw createInvalidMutationError('A tag with this ID already exists.');
    }

    if (this.findTagByName(catalogue, tag.name) !== undefined) {
      throw createInvalidMutationError('A tag with this name already exists.');
    }

    const created = Object.freeze({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      count: 0,
      createdAt: tag.occurredAt,
      updatedAt: tag.occurredAt,
    });

    this.tags.set(created.id, created);

    return Object.freeze({ ...created });
  }

  async updateTag(input: UpdateTagInput): Promise<TagSummary> {
    const update = validateUpdateTagInput(input);
    const catalogue = this.getTagCatalogue();
    const tag = catalogue.get(update.id);

    if (tag === undefined) {
      throw createInvalidMutationError(`Tag "${update.id}" does not exist.`);
    }

    const duplicate = this.findTagByName(catalogue, update.name);

    if (duplicate !== undefined && duplicate.id !== tag.id) {
      throw createInvalidMutationError('A tag with this name already exists.');
    }

    const updated = Object.freeze({
      ...tag,
      name: update.name,
      color: update.color,
      updatedAt: update.occurredAt,
    });

    this.tags.set(updated.id, updated);

    if (updated.name !== tag.name) {
      this.replaceTagAcrossDocuments(tag.name, updated.name, update.occurredAt);
    }

    return Object.freeze({ ...updated });
  }

  async deleteTag(input: DeleteTagInput): Promise<DeleteTagResult> {
    const deletion = validateDeleteTagInput(input);
    const tag = this.getTagCatalogue().get(deletion.id);

    if (tag === undefined) {
      throw createInvalidMutationError(`Tag "${deletion.id}" does not exist.`);
    }

    const affectedNoteIds = this.removeTagAcrossDocuments(
      tag.name,
      deletion.occurredAt,
    );
    this.tags.delete(tag.id);

    return validateDeleteTagResult({
      deletedTagId: tag.id,
      affectedNoteIds,
    });
  }

  private getTagCatalogue(): Map<TagId, TagSummary> {
    const catalogue = new Map(this.tags);

    for (const document of this.documents.values()) {
      for (const rawName of document.tags) {
        const name = normalizeTagName(rawName);

        if (this.findTagByName(catalogue, name) !== undefined) {
          continue;
        }

        catalogue.set(
          createGeneratedTagId(name),
          Object.freeze({
            id: createGeneratedTagId(name),
            name,
            color: 'default',
            count: 0,
            createdAt: '1970-01-01T00:00:00.000Z',
            updatedAt: '1970-01-01T00:00:00.000Z',
          }),
        );
      }
    }

    return catalogue;
  }

  private findTagByName(
    catalogue: ReadonlyMap<TagId, TagSummary>,
    name: string,
  ): TagSummary | undefined {
    return [...catalogue.values()].find((tag) => tag.name === name);
  }

  private replaceTagAcrossDocuments(
    previousName: string,
    nextName: string,
    occurredAt: string,
  ): void {
    for (const document of this.documents.values()) {
      if (!document.tags.includes(previousName)) {
        continue;
      }

      this.documents.set(
        document.id,
        freezeDocument({
          ...document,
          tags: Object.freeze([
            ...new Set(
              document.tags.map((tag) =>
                tag === previousName ? nextName : tag,
              ),
            ),
          ]),
          updatedAt: occurredAt,
          revision: this.nextRevision(),
        }),
      );
    }
  }

  private removeTagAcrossDocuments(name: string, occurredAt: string): NoteId[] {
    const affectedNoteIds: NoteId[] = [];

    for (const document of this.documents.values()) {
      if (!document.tags.includes(name)) {
        continue;
      }

      this.documents.set(
        document.id,
        freezeDocument({
          ...document,
          tags: Object.freeze(document.tags.filter((tag) => tag !== name)),
          updatedAt: occurredAt,
          revision: this.nextRevision(),
        }),
      );
      affectedNoteIds.push(document.id);
    }

    return affectedNoteIds.sort((left, right) => left.localeCompare(right));
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

  async updateNotebook(input: UpdateNotebookInput): Promise<Notebook> {
    const update = validateUpdateNotebookInput(input);
    const notebook = this.notebooks.get(update.id);

    if (notebook === undefined) {
      throw createInvalidMutationError(
        `Notebook "${update.id}" does not exist.`,
      );
    }

    this.assertValidNotebookParent(update.id, update.parentId);

    const updated = Object.freeze({
      id: notebook.id,
      name: update.name,
      parentId: update.parentId,
      createdAt: notebook.createdAt,
      ...(update.icon === null ? {} : { icon: update.icon }),
      updatedAt: update.occurredAt,
    });

    this.notebooks.set(updated.id, updated);

    return Object.freeze({ ...updated });
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

  private assertValidNotebookParent(
    notebookId: string,
    parentId: string | null,
  ): void {
    let currentParentId = parentId;
    const visitedParentIds = new Set<string>();

    while (currentParentId !== null) {
      if (currentParentId === notebookId) {
        throw createInvalidMutationError(
          'A notebook cannot be placed under itself or one of its descendants.',
        );
      }

      if (visitedParentIds.has(currentParentId)) {
        throw createInvalidMutationError(
          'The notebook hierarchy contains a cycle.',
        );
      }

      visitedParentIds.add(currentParentId);

      const parent = this.notebooks.get(currentParentId);

      if (parent === undefined) {
        throw createInvalidMutationError(
          `Notebook parent "${currentParentId}" does not exist.`,
        );
      }

      currentParentId = parent.parentId ?? null;
    }
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
      doctype: 'markdown',
      pinned: false,
      numOfTasks: 0,
      numOfCheckedTasks: 0,
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
      case 'update-pinned':
        return freezeDocument({ ...revised, pinned: mutation.pinned });
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

const normalizeTagName = (value: string): string =>
  value.trim().toLocaleLowerCase();

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
