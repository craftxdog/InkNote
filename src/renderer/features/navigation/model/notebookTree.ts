import type { Notebook } from '../../../../shared/documents/document.types';

export type NotebookTreeRow = Readonly<{
  notebook: Notebook;
  depth: number;
  /** Notes directly belonging to this notebook. */
  noteCount: number;
  hasChildren: boolean;
}>;

/**
 * Builds a resilient, deterministic sidebar tree from persisted parent IDs.
 * Orphaned notebooks stay reachable at the root instead of disappearing.
 */
export const buildNotebookTreeRows = (
  notebooks: readonly Notebook[],
  directNoteCounts: ReadonlyMap<string, number>,
  query: string,
): readonly NotebookTreeRow[] => {
  const byId = new Map(notebooks.map((notebook) => [notebook.id, notebook]));
  const matchingIds = matchingNotebookIds(notebooks, byId, query);
  const childrenByParent = new Map<string | null, Notebook[]>();

  for (const notebook of notebooks) {
    if (!matchingIds.has(notebook.id)) {
      continue;
    }

    const parentId = notebook.parentId ?? null;
    const parent =
      parentId !== null && matchingIds.has(parentId) && byId.has(parentId)
        ? parentId
        : null;
    const siblings = childrenByParent.get(parent) ?? [];

    siblings.push(notebook);
    childrenByParent.set(parent, siblings);
  }

  for (const siblings of childrenByParent.values()) {
    siblings.sort(compareNotebooks);
  }

  const rows: NotebookTreeRow[] = [];
  const append = (notebook: Notebook, depth: number): void => {
    const children = childrenByParent.get(notebook.id) ?? [];

    rows.push(
      Object.freeze({
        notebook,
        depth,
        noteCount: directNoteCounts.get(notebook.id) ?? 0,
        hasChildren: children.length > 0,
      }),
    );

    for (const child of children) {
      append(child, depth + 1);
    }
  };

  for (const root of childrenByParent.get(null) ?? []) {
    append(root, 0);
  }

  return Object.freeze(rows);
};

export const descendantNotebookIds = (
  notebooks: readonly Notebook[],
  rootId: string,
): ReadonlySet<string> => {
  const childrenByParent = new Map<string, string[]>();

  for (const notebook of notebooks) {
    const parentId = notebook.parentId ?? null;

    if (parentId === null) {
      continue;
    }

    const children = childrenByParent.get(parentId) ?? [];
    children.push(notebook.id);
    childrenByParent.set(parentId, children);
  }

  const ids = new Set<string>();
  const visit = (id: string): void => {
    if (ids.has(id)) {
      return;
    }

    ids.add(id);
    for (const childId of childrenByParent.get(id) ?? []) {
      visit(childId);
    }
  };

  visit(rootId);

  return ids;
};

/** Returns a safe root-to-leaf trail for the focused notebook. */
export const notebookBreadcrumbs = (
  notebooks: readonly Notebook[],
  notebookId: string,
): readonly Notebook[] => {
  const byId = new Map(notebooks.map((notebook) => [notebook.id, notebook]));
  const trail: Notebook[] = [];
  const visited = new Set<string>();
  let current = byId.get(notebookId);

  while (current !== undefined && !visited.has(current.id)) {
    trail.unshift(current);
    visited.add(current.id);
    current =
      current.parentId === undefined || current.parentId === null
        ? undefined
        : byId.get(current.parentId);
  }

  return Object.freeze(trail);
};

const matchingNotebookIds = (
  notebooks: readonly Notebook[],
  byId: ReadonlyMap<string, Notebook>,
  query: string,
): ReadonlySet<string> => {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  if (normalizedQuery.length === 0) {
    return new Set(notebooks.map((notebook) => notebook.id));
  }

  const included = new Set<string>();

  for (const notebook of notebooks) {
    if (!notebook.name.toLocaleLowerCase().includes(normalizedQuery)) {
      continue;
    }

    let current: Notebook | undefined = notebook;

    while (current !== undefined && !included.has(current.id)) {
      included.add(current.id);
      current =
        current.parentId === undefined || current.parentId === null
          ? undefined
          : byId.get(current.parentId);
    }
  }

  return included;
};

const compareNotebooks = (left: Notebook, right: Notebook): number => {
  if (left.id === 'inbox') {
    return -1;
  }

  if (right.id === 'inbox') {
    return 1;
  }

  return left.name.localeCompare(right.name);
};
