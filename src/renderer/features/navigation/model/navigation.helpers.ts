import type {
  NavigationSelection,
  NavigationWorkspaceId,
} from './navigation.types';

export function getNavigationWorkspaceId(
  selection: NavigationSelection,
): NavigationWorkspaceId | null {
  switch (selection.id) {
    case 'inbox':
      return 'inbox';

    case 'work':
      return 'work';

    case 'projects':
      return 'projects';

    default:
      return null;
  }
}
