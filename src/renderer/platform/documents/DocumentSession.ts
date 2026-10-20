import {
  DocumentDomainError,
  createDocumentNotFoundError,
} from './document.errors';
import type { DocumentRepository } from './document.repository';
import type { DocumentMutation, NoteDocument, NoteId } from './document.types';

export type DocumentSessionSnapshot = Readonly<{
  document: NoteDocument | null;
  lastError: DocumentDomainError | null;
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

  private snapshot: DocumentSessionSnapshot = createSnapshot(null, null);

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

    try {
      const document = await this.repository.get(id);

      if (document === null) {
        throw createDocumentNotFoundError(id);
      }

      const snapshot = createSnapshot(document, null);

      if (this.isCurrentSelection(id, selectionGeneration)) {
        this.publish(snapshot);
      }

      return snapshot.document ?? document;
    } catch (error) {
      if (this.isCurrentSelection(id, selectionGeneration)) {
        this.publishDomainError(null, error);
      }

      throw error;
    }
  }

  async apply(mutation: DocumentMutation): Promise<NoteDocument> {
    const selectionGeneration = this.selectionGeneration;

    try {
      const document = await this.repository.apply(mutation);
      const snapshot = createSnapshot(document, null);

      if (this.isCurrentSelection(mutation.documentId, selectionGeneration)) {
        this.publish(snapshot);
      }

      return snapshot.document ?? document;
    } catch (error) {
      if (this.isCurrentSelection(mutation.documentId, selectionGeneration)) {
        this.publishDomainError(this.snapshot.document, error);
      }

      throw error;
    }
  }

  private selectDocument(id: NoteId): number {
    this.selectedDocumentId = id;
    this.selectionGeneration += 1;

    return this.selectionGeneration;
  }

  private isCurrentSelection(id: NoteId, selectionGeneration: number): boolean {
    return (
      this.selectedDocumentId === id &&
      this.selectionGeneration === selectionGeneration
    );
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
    document: NoteDocument | null,
    error: unknown,
  ): void {
    if (error instanceof DocumentDomainError) {
      this.publish(createSnapshot(document, error));
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
  document: NoteDocument | null,
  lastError: DocumentDomainError | null,
): DocumentSessionSnapshot =>
  Object.freeze({
    document: document === null ? null : Object.freeze({ ...document }),
    lastError,
  });
