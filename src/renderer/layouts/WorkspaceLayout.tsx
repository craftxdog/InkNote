import type { ReactNode } from 'react';

import { WorkspaceNavbar } from '../components/workspace/WorkspaceNavbar';
import { WorkspacePreferences } from '../components/workspace/WorkspacePreferences';

import type { NavigationSelection } from '../features/navigation/model/navigation.types';

import type { WorkspaceTheme, WorkspaceViewMode } from '../types/workspace';

type WorkspaceLayoutProps = {
  navigationSelection: NavigationSelection;

  viewMode: WorkspaceViewMode;

  theme: WorkspaceTheme;

  isPreferencesOpen: boolean;

  onViewModeChange: (mode: WorkspaceViewMode) => void;

  onThemeChange: (theme: WorkspaceTheme) => void;

  onOpenPreferences: () => void;

  onClosePreferences: () => void;

  onCreateNote: () => void;

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
  theme,
  isPreferencesOpen,
  onViewModeChange,
  onThemeChange,
  onOpenPreferences,
  onClosePreferences,
  onCreateNote,
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
    <div className={className} data-view-mode={viewMode} data-theme={theme}>
      <WorkspaceNavbar
        navigationSelection={navigationSelection}
        isNavigationVisible={isNavigationVisible}
        isWorkspaceExpanded={isWorkspaceExpanded}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        onCreateNote={onCreateNote}
        onOpenPreferences={onOpenPreferences}
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

      <WorkspacePreferences
        isOpen={isPreferencesOpen}
        theme={theme}
        onThemeChange={onThemeChange}
        onClose={onClosePreferences}
      />
    </div>
  );
}
