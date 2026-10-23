import type { DocumentMutation, NoteDocument, NoteId } from './document.types';

/**
 * Boundary between document state and its durable local implementation.
 *
 * A future SQLite-backed repository must persist the accepted document and its
 * durable sync-outbox entry atomically before resolving `apply`.
 */
export interface DocumentRepository {
  get(id: NoteId): Promise<NoteDocument | null>;
  apply(mutation: DocumentMutation): Promise<NoteDocument>;
}
