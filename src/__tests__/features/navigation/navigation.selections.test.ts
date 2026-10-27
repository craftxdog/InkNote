import {
  selectionForCatalogueTag,
  selectionForNotebook,
} from '../../../renderer/features/navigation/model/navigation.selections';
import { createTagId } from '../../../shared/documents/document.types';

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

describe('selectionForCatalogueTag', () => {
  it('uses the durable tag ID for selection identity while retaining its name filter', () => {
    expect(
      selectionForCatalogueTag({
        id: createTagId('tag:team'),
        name: 'team',
        color: 'purple',
        count: 0,
        createdAt: '2026-10-26T12:00:00.000Z',
        updatedAt: '2026-10-26T12:00:00.000Z',
      }),
    ).toEqual({
      id: 'tag:team',
      label: 'team',
      view: {
        type: 'tag',
        catalogueTagId: 'tag:team',
        tagIds: ['team'],
      },
      icon: { type: 'tag', color: '#8b6df4' },
    });
  });
});
