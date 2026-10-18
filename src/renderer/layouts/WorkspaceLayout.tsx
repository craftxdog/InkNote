import type { ReactNode } from 'react';

import { WorkspaceNavbar } from '../components/workspace/WorkspaceNavbar';

import type { NavigationSelection } from '../features/navigation/model/navigation.types';

import type { WorkspaceViewMode } from '../types/workspace';

type WorkspaceLayoutProps = {
  navigationSelection: NavigationSelection;

  viewMode: WorkspaceViewMode;

  onViewModeChange: (mode: WorkspaceViewMode) => void;

  isNavigationVisible: boolean;

  isWorkspaceExpanded: boolean;

  onToggleNavigation: () => void;

  onToggleWorkspaceExpanded: () => void;

  navigation: ReactNode;

  notes: ReactNode;

  editor: ReactNode;

  preview: ReactNode;
};

export function WorkspaceLayout({
  navigationSelection,
  viewMode,
  onViewModeChange,
  isNavigationVisible,
  isWorkspaceExpanded,
  onToggleNavigation,
  onToggleWorkspaceExpanded,
  navigation,
  notes,
  editor,
  preview,
}: WorkspaceLayoutProps) {
  const className = [
    'workspace-shell',

    !isNavigationVisible ? 'workspace-shell--navigation-hidden' : '',

    isWorkspaceExpanded ? 'workspace-shell--expanded' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className} data-view-mode={viewMode}>
      <WorkspaceNavbar
        navigationSelection={navigationSelection}
        isNavigationVisible={isNavigationVisible}
        isWorkspaceExpanded={isWorkspaceExpanded}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        onToggleNavigation={onToggleNavigation}
        onToggleWorkspaceExpanded={onToggleWorkspaceExpanded}
      />

      <main className="workspace-grid">
        <aside
          className="workspace__navigation"
          aria-hidden={!isNavigationVisible || isWorkspaceExpanded}
        >
          {navigation}
        </aside>

        <section className="workspace__notes" aria-hidden={isWorkspaceExpanded}>
          {notes}
        </section>

        <section
          className="workspace__editor"
          aria-hidden={viewMode === 'preview'}
        >
          {editor}
        </section>

        <section
          className="workspace__preview"
          aria-hidden={viewMode === 'editor'}
        >
          {preview}
        </section>
      </main>
    </div>
  );
}
