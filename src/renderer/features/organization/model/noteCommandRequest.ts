import type { NoteId } from '../../../../shared/documents/document.types';

export type NoteCommandRequest = Readonly<{
  noteIds: readonly NoteId[];
  destinationNotebookId?: string;
}>;

export const createNoteCommandRequest = (
  noteIds: readonly NoteId[],
  destinationNotebookId?: string,
): NoteCommandRequest =>
  Object.freeze({
    noteIds: Object.freeze([...new Set(noteIds)]),
    ...(destinationNotebookId === undefined ? {} : { destinationNotebookId }),
  });

export const readNoteCommandRequest = (
  value: unknown,
): NoteCommandRequest | null => {
  if (!isRecord(value) || !Array.isArray(value.noteIds)) {
    return null;
  }

  if (
    value.noteIds.length === 0 ||
    !value.noteIds.every(
      (noteId): noteId is string =>
        typeof noteId === 'string' && noteId.trim().length > 0,
    )
  ) {
    return null;
  }

  if (
    value.destinationNotebookId !== undefined &&
    (typeof value.destinationNotebookId !== 'string' ||
      value.destinationNotebookId.trim().length === 0)
  ) {
    return null;
  }

  return createNoteCommandRequest(
    value.noteIds.map((noteId) => noteId as NoteId),
    value.destinationNotebookId,
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
