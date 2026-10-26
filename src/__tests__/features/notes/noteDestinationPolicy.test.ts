import type { NavigationSelection } from '../../../renderer/features/navigation/model/navigation.types';
import { resolveNoteDestinationNotebookId } from '../../../renderer/features/notes/model/noteDestinationPolicy';

const selection = (view: NavigationSelection['view']): NavigationSelection =>
  ({
    id: 'test-selection',
    label: 'Test',
    view,
    icon: { type: 'all-notes' },
  }) as NavigationSelection;

describe('resolveNoteDestinationNotebookId', () => {
  it('prefers an explicitly selected notebook or scoped metadata notebook', () => {
    expect(
      resolveNoteDestinationNotebookId({
        selection: selection({ type: 'notebook', notebookId: 'work' }),
        defaultNotebookId: 'inbox',
      }),
    ).toBe('work');
    expect(
      resolveNoteDestinationNotebookId({
        selection: selection({
          type: 'status',
          status: 'active',
          notebookId: 'project',
        }),
        defaultNotebookId: 'inbox',
      }),
    ).toBe('project');
  });

  it('uses the configured default from global, template, and trash views', () => {
    for (const view of [
      { type: 'all-notes' },
      { type: 'tag', tagId: 'release' },
      { type: 'templates' },
      { type: 'trash' },
    ] as const) {
      expect(
        resolveNoteDestinationNotebookId({
          selection: selection(view),
          defaultNotebookId: 'writing',
        }),
      ).toBe('writing');
    }
  });
});
