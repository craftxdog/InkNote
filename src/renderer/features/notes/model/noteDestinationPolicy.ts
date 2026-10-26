import type { NavigationSelection } from '../../navigation/model/navigation.types';

type NoteDestinationPolicyInput = Readonly<{
  selection: NavigationSelection;
  defaultNotebookId: string;
}>;

/**
 * Resolves the notebook for a newly created or duplicated note without
 * copying transient tag/status filters into its durable metadata.
 */
export const resolveNoteDestinationNotebookId = ({
  selection,
  defaultNotebookId,
}: NoteDestinationPolicyInput): string => {
  switch (selection.view.type) {
    case 'inbox':
      return 'inbox';
    case 'notebook':
      return selection.view.notebookId;
    case 'project':
      return selection.view.projectId;
    case 'status':
    case 'tag':
      return selection.view.notebookId ?? defaultNotebookId;
    case 'all-notes':
    case 'templates':
    case 'trash':
      return defaultNotebookId;
  }
};
