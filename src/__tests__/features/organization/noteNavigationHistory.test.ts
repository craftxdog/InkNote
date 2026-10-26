import {
  canNavigateBack,
  canNavigateForward,
  emptyNoteNavigationHistory,
  recordNoteNavigation,
  resolveNavigateBack,
  resolveNavigateForward,
} from '../../../renderer/features/organization/model/noteNavigationHistory';
import { createNoteId } from '../../../shared/documents/document.types';

describe('note navigation history', () => {
  const first = createNoteId('first');
  const second = createNoteId('second');
  const third = createNoteId('third');

  it('records note opens and replaces forward history after branching', () => {
    const initial = emptyNoteNavigationHistory();
    const withFirst = recordNoteNavigation(initial, first);
    const withSecond = recordNoteNavigation(withFirst, second);
    const back = resolveNavigateBack(withSecond, new Set([first, second]));
    const branched = recordNoteNavigation(back.history, third);

    expect(branched).toEqual({ entries: [first, third], cursor: 1 });
    expect(canNavigateBack(branched)).toBe(true);
    expect(canNavigateForward(branched)).toBe(false);
  });

  it('skips notes that have disappeared while navigating', () => {
    const history = recordNoteNavigation(
      recordNoteNavigation(
        recordNoteNavigation(emptyNoteNavigationHistory(), first),
        second,
      ),
      third,
    );

    const back = resolveNavigateBack(history, new Set([first, third]));
    const forward = resolveNavigateForward(
      back.history,
      new Set([first, third]),
    );

    expect(back.noteId).toBe(first);
    expect(back.history.cursor).toBe(0);
    expect(forward.noteId).toBe(third);
    expect(forward.history.cursor).toBe(2);
  });

  it('does not move when no surviving note exists in the requested direction', () => {
    const history = recordNoteNavigation(
      recordNoteNavigation(emptyNoteNavigationHistory(), first),
      second,
    );

    expect(resolveNavigateBack(history, new Set([second]))).toEqual({
      history,
      noteId: null,
    });
  });
});
