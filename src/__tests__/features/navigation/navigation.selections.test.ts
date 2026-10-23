import { selectionForNotebook } from '../../../renderer/features/navigation/model/navigation.selections';

describe('selectionForNotebook', () => {
  it('carries the notebook icon into the active navigation context', () => {
    const selection = selectionForNotebook({
      id: 'linux',
      name: 'Linux',
      icon: 'code',
      parentId: null,
      createdAt: '2026-10-22T00:00:00.000Z',
      updatedAt: '2026-10-22T00:00:00.000Z',
    });

    expect(selection.icon).toEqual({
      type: 'notebook',
      notebookIcon: 'code',
    });
  });
});
