import { useNavigationState } from '../hooks/useNavigationState';

import type {
  NavigationScope,
  NavigationSelection,
  NavigationWorkspaceId,
} from '../model/navigation.types';

import { NavigationLibraryView } from './NavigationLibraryView';
import { NavigationWorkspaceView } from './NavigationWorkspaceView';

import '../styles/navigation.css';

export type NavigationPanelProps = {
  scope: NavigationScope;

  selection: NavigationSelection;

  onSelectionChange: (selection: NavigationSelection) => void;

  onEnterWorkspace: (workspaceId: NavigationWorkspaceId) => void;

  onExitWorkspace: () => void;

  onWorkspaceChange: (workspaceId: NavigationWorkspaceId) => void;
};

export function NavigationPanel({
  scope,
  selection,
  onSelectionChange,
  onEnterWorkspace,
  onExitWorkspace,
  onWorkspaceChange,
}: NavigationPanelProps) {
  const { expandedSections, toggleSection } = useNavigationState();

  return (
    <div className="navigation-panel">
      <div className="navigation-panel__scroll">
        {scope.type === 'library' ? (
          <NavigationLibraryView
            selection={selection}
            expandedSections={expandedSections}
            onSelectionChange={onSelectionChange}
            onToggleSection={toggleSection}
            onEnterWorkspace={onEnterWorkspace}
          />
        ) : (
          <NavigationWorkspaceView
            workspaceId={scope.workspaceId}
            selection={selection}
            expandedStatus={expandedSections.status}
            expandedTags={expandedSections.tags}
            onToggleStatus={() => toggleSection('status')}
            onToggleTags={() => toggleSection('tags')}
            onSelectionChange={onSelectionChange}
            onExitWorkspace={onExitWorkspace}
            onWorkspaceChange={onWorkspaceChange}
          />
        )}
      </div>
    </div>
  );
}
