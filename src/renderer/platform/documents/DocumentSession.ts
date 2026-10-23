import {
  DocumentDomainError,
  createDocumentNotFoundError,
} from '../../../shared/documents/document.errors';
import type { DocumentRepository } from '../../../shared/documents/document.repository';
import type {
  DocumentMutation,
  NoteDocument,
  NoteId,
} from '../../../shared/documents/document.types';

export type DocumentSessionSnapshot = Readonly<{
  selectedDocumentId: NoteId | null;
  document: NoteDocument | null;
  lastError: DocumentDomainError | null;
  isLoading: boolean;
}>;

export type DocumentSubscription = Readonly<{
  unsubscribe(): void;
}>;

export type DocumentSessionOptions = Readonly<{
  onListenerError?: (error: unknown) => void;
}>;

type DocumentSessionListener = (snapshot: DocumentSessionSnapshot) => void;

/**
 * Holds the currently active document for editor and preview consumers.
 *
 * Persistence, revision checks, and durable synchronization stay behind the
 * repository port; this class only publishes repository-accepted snapshots.
 */
export class DocumentSession {
  private readonly listeners = new Set<DocumentSessionListener>();

  private selectedDocumentId: NoteId | null = null;

  private selectionGeneration = 0;

  private readonly acceptedMutationEpochs = new Map<NoteId, number>();

  private snapshot: DocumentSessionSnapshot = createSnapshot(
    null,
    null,
    null,
    false,
  );

  constructor(
    private readonly repository: DocumentRepository,
    private readonly options: DocumentSessionOptions = {},
  ) {}

  getSnapshot(): DocumentSessionSnapshot {
    return this.snapshot;
  }

  subscribe(listener: DocumentSessionListener): DocumentSubscription {
    this.listeners.add(listener);

    let isSubscribed = true;

    return Object.freeze({
      unsubscribe: () => {
        if (!isSubscribed) {
          return;
        }

        isSubscribed = false;
        this.listeners.delete(listener);
      },
    });
  }

  async open(id: NoteId): Promise<NoteDocument> {
    const selectionGeneration = this.selectDocument(id);
    const mutationEpoch = this.getAcceptedMutationEpoch(id);

    try {
      const document = await this.repository.get(id);

      if (document === null) {
        throw createDocumentNotFoundError(id);
      }

      if (this.isCurrentSelection(id, selectionGeneration)) {
        if (this.getAcceptedMutationEpoch(id) === mutationEpoch) {
          const snapshot = createSnapshot(id, document, null, false);

          this.publish(snapshot);

          return snapshot.document ?? document;
        }

        const acceptedDocument = this.getCurrentSelectedDocument(id);

        if (acceptedDocument !== null) {
          return acceptedDocument;
        }
      }

      return document;
    } catch (error) {
      if (
        this.isCurrentSelection(id, selectionGeneration) &&
        this.getAcceptedMutationEpoch(id) === mutationEpoch
      ) {
        this.publishDomainError(id, null, error);
      }

      throw error;
    }
  }

  async apply(mutation: DocumentMutation): Promise<NoteDocument> {
    try {
      const document = await this.repository.apply(mutation);
      this.incrementAcceptedMutationEpoch(mutation.documentId);

      if (this.selectedDocumentId === mutation.documentId) {
        const snapshot = createSnapshot(
          mutation.documentId,
          document,
          null,
          false,
        );

        this.publish(snapshot);

        return snapshot.document ?? document;
      }

      return document;
    } catch (error) {
      if (this.selectedDocumentId === mutation.documentId) {
        this.publishDomainError(
          mutation.documentId,
          this.snapshot.document,
          error,
        );
      }

      throw error;
    }
  }

  clear(): void {
    this.selectedDocumentId = null;
    this.selectionGeneration += 1;
    this.publish(createSnapshot(null, null, null, false));
  }

  private selectDocument(id: NoteId): number {
    this.selectedDocumentId = id;
    this.selectionGeneration += 1;

    const retainedDocument = this.getCurrentSelectedDocument(id);

    this.publish(createSnapshot(id, retainedDocument, null, true));

    return this.selectionGeneration;
  }

  private isCurrentSelection(id: NoteId, selectionGeneration: number): boolean {
    return (
      this.selectedDocumentId === id &&
      this.selectionGeneration === selectionGeneration
    );
  }

  private getAcceptedMutationEpoch(id: NoteId): number {
    return this.acceptedMutationEpochs.get(id) ?? 0;
  }

  private incrementAcceptedMutationEpoch(id: NoteId): void {
    this.acceptedMutationEpochs.set(id, this.getAcceptedMutationEpoch(id) + 1);
  }

  private getCurrentSelectedDocument(id: NoteId): NoteDocument | null {
    return this.snapshot.document?.id === id ? this.snapshot.document : null;
  }

  private publish(snapshot: DocumentSessionSnapshot): void {
    this.snapshot = snapshot;

    for (const listener of [...this.listeners]) {
      if (!this.listeners.has(listener)) {
        continue;
      }

      try {
        listener(snapshot);
      } catch (error) {
        this.reportListenerError(error);
      }
    }
  }

  private publishDomainError(
    selectedDocumentId: NoteId,
    document: NoteDocument | null,
    error: unknown,
  ): void {
    if (error instanceof DocumentDomainError) {
      this.publish(createSnapshot(selectedDocumentId, document, error, false));
    }
  }

  private reportListenerError(error: unknown): void {
    try {
      this.options.onListenerError?.(error);
    } catch {
      // Listener-error reporting cannot change an accepted document operation.
    }
  }
}

const createSnapshot = (
  selectedDocumentId: NoteId | null,
  document: NoteDocument | null,
  lastError: DocumentDomainError | null,
  isLoading: boolean,
): DocumentSessionSnapshot =>
  Object.freeze({
    selectedDocumentId,
    document: document === null ? null : Object.freeze({ ...document }),
    lastError,
    isLoading,
  });
