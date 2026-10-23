import type {
  DocumentMutation,
  NoteDocument,
  NoteId,
  PermanentlyDeleteNotesInput,
  PermanentlyDeleteNotesResult,
} from './document.types';

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

/**
 * Explicit destructive write port. Implementations must reject active notes
 * and atomically remove the archived note with all of its durable history.
 */
export interface DocumentDeletionRepository {
  deletePermanently(
    input: PermanentlyDeleteNotesInput,
  ): Promise<PermanentlyDeleteNotesResult>;
}
