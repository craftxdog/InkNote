import type {
  Notebook,
  NoteStatus,
} from '../../../../shared/documents/document.types';
import { colorForTag, tagColorHex } from '../../notes/model/notePresentation';

import { navigationDestinations } from '../data/navigation.data';

import type { NavigationSelection } from './navigation.types';

export const STATUS_LABELS: Record<NoteStatus, string> = {
  active: 'Active',
  'on-hold': 'On Hold',
  completed: 'Completed',
  dropped: 'Dropped',
};

export const selectionForNotebook = (
  notebook: Notebook,
  options: Readonly<{ includeDescendants?: boolean }> = {},
): NavigationSelection =>
  notebook.id === 'inbox'
    ? navigationDestinations.inbox
    : {
        id: `notebook-${notebook.id}`,
        label: notebook.name,
        view: {
          type: 'notebook',
          notebookId: notebook.id,
          ...(options.includeDescendants === true
            ? { includeDescendants: true }
            : {}),
        },
        icon: {
          type: 'notebook',
          ...(notebook.icon === undefined
            ? {}
            : { notebookIcon: notebook.icon }),
        },
      };

export const selectionForNotebookDetail = (
  notebook: Notebook,
): NavigationSelection => ({
  id: `notebook-${notebook.id}-all-notes`,
  label: 'All Notes',
  view: {
    type: 'notebook',
    notebookId: notebook.id,
    includeDescendants: true,
  },
  icon: { type: 'all-notes' },
});

export const selectionForNotebookStatus = (
  notebookId: string,
  status: NoteStatus,
): NavigationSelection => ({
  id: `notebook-${notebookId}-status-${status}`,
  label: STATUS_LABELS[status],
  view: { type: 'status', status, notebookId },
  icon: { type: 'status', status },
});

export const selectionForNotebookTag = (
  notebookId: string,
  tag: string,
): NavigationSelection => selectionForTags([tag], notebookId);

export const selectionForStatus = (
  status: NoteStatus,
): NavigationSelection => ({
  id: `status-${status}`,
  label: STATUS_LABELS[status],
  view: { type: 'status', status },
  icon: { type: 'status', status },
});

export const selectionForTag = (tag: string): NavigationSelection =>
  selectionForTags([tag]);

export const selectionForTags = (
  tags: readonly string[],
  notebookId?: string,
): NavigationSelection => {
  const tagIds = [...new Set(tags)].sort((left, right) =>
    left.localeCompare(right),
  );
  const firstTag = tagIds[0] ?? '';
  const scope = notebookId === undefined ? '' : `notebook-${notebookId}-`;

  return {
    id: `${scope}tag-${tagIds.join('-')}`,
    label: tagIds.join(' + '),
    view: {
      type: 'tag',
      tagIds,
      ...(notebookId === undefined ? {} : { notebookId }),
    },
    icon: { type: 'tag', color: tagColorHex[colorForTag(firstTag)] },
  };
};
