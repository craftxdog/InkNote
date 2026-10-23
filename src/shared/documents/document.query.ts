import type {
  CreateNotebookInput,
  DeleteNotebookInput,
  DeleteNotebookResult,
  Notebook,
  NoteDocument,
} from './document.types';

/**
 * Read-only document queries needed by the renderer workspace. This stays
 * separate from DocumentRepository so list/query growth can evolve with FTS,
 * notebooks, and pagination without expanding the write port.
 */
export interface DocumentQueryRepository {
  listActive(): Promise<readonly NoteDocument[]>;
  listArchived(): Promise<readonly NoteDocument[]>;
  listNotebooks(): Promise<readonly Notebook[]>;
}

/**
 * Small, explicit write port for notebook taxonomy. Notes retain the CRDT as
 * their authority; notebook names are local relational metadata until sync is
 * introduced for this collection.
 */
export interface NotebookRepository {
  createNotebook(input: CreateNotebookInput): Promise<Notebook>;
  deleteNotebook(input: DeleteNotebookInput): Promise<DeleteNotebookResult>;
}
