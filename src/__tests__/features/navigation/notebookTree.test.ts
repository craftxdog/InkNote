import type { Notebook } from '../../../shared/documents/document.types';
import {
  eligibleNotebookParents,
  buildNotebookTreeRows,
  descendantNotebookIds,
  notebookBreadcrumbs,
} from '../../../renderer/features/navigation/model/notebookTree';

const notebooks: readonly Notebook[] = [
  {
    id: 'inbox',
    name: 'Inbox',
    parentId: null,
    createdAt: '2026-10-21T12:00:00.000Z',
    updatedAt: '2026-10-21T12:00:00.000Z',
  },
  {
    id: 'work',
    name: 'Work',
    parentId: null,
    createdAt: '2026-10-21T12:00:00.000Z',
    updatedAt: '2026-10-21T12:00:00.000Z',
  },
  {
    id: 'projects',
    name: 'Projects',
    parentId: 'work',
    createdAt: '2026-10-21T12:00:00.000Z',
    updatedAt: '2026-10-21T12:00:00.000Z',
  },
];

describe('notebook tree', () => {
  it('renders persisted children beneath their parent with direct note counts', () => {
    const rows = buildNotebookTreeRows(
      notebooks,
      new Map([
        ['work', 1],
        ['projects', 2],
      ]),
      '',
    );

    expect(
      rows.map(({ notebook, depth, noteCount }) => ({
        id: notebook.id,
        depth,
        noteCount,
      })),
    ).toEqual([
      { id: 'inbox', depth: 0, noteCount: 0 },
      { id: 'work', depth: 0, noteCount: 1 },
      { id: 'projects', depth: 1, noteCount: 2 },
    ]);
  });

  it('includes children in a focused notebook result', () => {
    expect([...descendantNotebookIds(notebooks, 'work')]).toEqual([
      'work',
      'projects',
    ]);
  });

  it('builds a root-to-leaf breadcrumb for any dynamic notebook depth', () => {
    expect(
      notebookBreadcrumbs(notebooks, 'projects').map((notebook) => notebook.id),
    ).toEqual(['work', 'projects']);
  });

  it('excludes a notebook and all of its descendants from eligible parents', () => {
    expect(
      eligibleNotebookParents(notebooks, 'work').map((notebook) => notebook.id),
    ).toEqual(['inbox']);
  });
});
