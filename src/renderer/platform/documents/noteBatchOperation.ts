import type { NoteId } from '../../../shared/documents/document.types';

export type NoteBatchOperationResult = Readonly<{
  completedNoteIds: readonly NoteId[];
  remainingNoteIds: readonly NoteId[];
  error: unknown | null;
}>;

/**
 * Runs local-document operations in a deterministic order. Each document
 * mutation has its own revision and Yjs update, so this deliberately exposes
 * partial completion instead of presenting a false cross-document transaction.
 */
export const runNoteBatchOperation = async <T extends NoteId>(
  noteIds: readonly T[],
  operation: (noteId: T) => Promise<void>,
): Promise<NoteBatchOperationResult> => {
  const normalizedIds = [...new Set(noteIds)];
  const completedNoteIds: NoteId[] = [];

  for (const [index, noteId] of normalizedIds.entries()) {
    try {
      await operation(noteId);
      completedNoteIds.push(noteId);
    } catch (error) {
      return Object.freeze({
        completedNoteIds: Object.freeze(completedNoteIds),
        remainingNoteIds: Object.freeze(normalizedIds.slice(index)),
        error,
      });
    }
  }

  return Object.freeze({
    completedNoteIds: Object.freeze(completedNoteIds),
    remainingNoteIds: Object.freeze([]),
    error: null,
  });
};
