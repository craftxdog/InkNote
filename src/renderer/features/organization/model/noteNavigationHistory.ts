import type { NoteId } from '../../../../shared/documents/document.types';

export type NoteNavigationHistory = Readonly<{
  entries: readonly NoteId[];
  cursor: number;
}>;

export type NoteNavigationResolution = Readonly<{
  history: NoteNavigationHistory;
  noteId: NoteId | null;
}>;

export const emptyNoteNavigationHistory = (): NoteNavigationHistory =>
  Object.freeze({ entries: Object.freeze([]), cursor: -1 });

export const recordNoteNavigation = (
  history: NoteNavigationHistory,
  noteId: NoteId,
): NoteNavigationHistory => {
  if (history.entries[history.cursor] === noteId) {
    return history;
  }

  return createHistory([
    ...history.entries.slice(0, history.cursor + 1),
    noteId,
  ]);
};

export const canNavigateBack = (history: NoteNavigationHistory): boolean =>
  history.cursor > 0;

export const canNavigateForward = (history: NoteNavigationHistory): boolean =>
  history.cursor >= 0 && history.cursor < history.entries.length - 1;

export const resolveNavigateBack = (
  history: NoteNavigationHistory,
  availableNoteIds: ReadonlySet<NoteId>,
): NoteNavigationResolution => resolveNavigation(history, availableNoteIds, -1);

export const resolveNavigateForward = (
  history: NoteNavigationHistory,
  availableNoteIds: ReadonlySet<NoteId>,
): NoteNavigationResolution => resolveNavigation(history, availableNoteIds, 1);

const resolveNavigation = (
  history: NoteNavigationHistory,
  availableNoteIds: ReadonlySet<NoteId>,
  direction: -1 | 1,
): NoteNavigationResolution => {
  for (
    let cursor = history.cursor + direction;
    cursor >= 0 && cursor < history.entries.length;
    cursor += direction
  ) {
    const noteId = history.entries[cursor];

    if (availableNoteIds.has(noteId)) {
      return Object.freeze({
        history: Object.freeze({ entries: history.entries, cursor }),
        noteId,
      });
    }
  }

  return Object.freeze({ history, noteId: null });
};

const createHistory = (entries: readonly NoteId[]): NoteNavigationHistory =>
  Object.freeze({
    entries: Object.freeze([...entries]),
    cursor: entries.length - 1,
  });
