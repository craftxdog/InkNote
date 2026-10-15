import type { ReactNode } from 'react';

import type { WorkspaceViewMode } from '../types/workspace';
import { WorkspaceNavbar } from '../components/workspace/WorkspaceNavbar';

type WorkspaceLayoutProps = {
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

export const WorkspaceLayout = ({
  isNavigationVisible,
  isWorkspaceExpanded,
  viewMode,
  onViewModeChange,
  onToggleNavigation,
  onToggleWorkspaceExpanded,
  navigation,
  notes,
  editor,
  preview,
}: WorkspaceLayoutProps) => {
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

        <section className="workspace__editor">{editor}</section>

        <section
          className="workspace__preview"
          aria-hidden={viewMode === 'editor'}
        >
          {preview}
        </section>
      </main>
    </div>
  );
};
