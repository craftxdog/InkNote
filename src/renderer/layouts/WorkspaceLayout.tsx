import type { ReactNode } from 'react';

import { WorkspaceNavbar } from '../components/workspace/WorkspaceNavbar';
import { WorkspacePreferences } from '../components/workspace/WorkspacePreferences';

import type { NavigationSelection } from '../features/navigation/model/navigation.types';

import type {
  ThemeAppearanceSettings,
  ThemeDescriptor,
} from '../../shared/themes/theme.types';
import type {
  AvailableWorkspaceTheme,
  WorkspaceTheme,
  WorkspaceThemeId,
  WorkspaceViewMode,
} from '../types/workspace';
import type { WorkspaceViewCommand } from '../features/workspace/model/viewCommands';

type WorkspaceLayoutProps = {
  navigationSelection: NavigationSelection;

  viewMode: WorkspaceViewMode;

  theme: WorkspaceTheme;

  themeId: WorkspaceThemeId;

  themes: readonly AvailableWorkspaceTheme[];

  externalThemeCss: string | null;

  acrylic: ThemeAppearanceSettings;

  isThemeCatalogLoading: boolean;

  themeError: string | null;

  isPreferencesOpen: boolean;

  onViewCommand: (command: WorkspaceViewCommand) => void;

  onThemeChange: (theme: WorkspaceThemeId) => void;

  onInstallTheme: () => Promise<void>;

  onRemoveTheme: (theme: ThemeDescriptor) => Promise<void>;

  onAcrylicChange: (enabled: boolean) => Promise<void>;

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
  themeId,
  themes,
  externalThemeCss,
  acrylic,
  isThemeCatalogLoading,
  themeError,
  isPreferencesOpen,
  onViewCommand,
  onThemeChange,
  onInstallTheme,
  onRemoveTheme,
  onAcrylicChange,
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
    <div
      className={className}
      data-view-mode={viewMode}
      data-theme={theme}
      data-theme-id={themeId}
    >
      {externalThemeCss === null ? null : (
        <style data-inknote-external-theme="true">
          {wrapExternalThemeCss(externalThemeCss)}
        </style>
      )}
      <WorkspaceNavbar
        navigationSelection={navigationSelection}
        isNavigationVisible={isNavigationVisible}
        isWorkspaceExpanded={isWorkspaceExpanded}
        viewMode={viewMode}
        onViewCommand={onViewCommand}
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
        themeId={themeId}
        themes={themes}
        acrylic={acrylic}
        isThemeCatalogLoading={isThemeCatalogLoading}
        themeError={themeError}
        onThemeChange={onThemeChange}
        onInstallTheme={onInstallTheme}
        onRemoveTheme={onRemoveTheme}
        onAcrylicChange={onAcrylicChange}
        onClose={onClosePreferences}
      />
    </div>
  );
}

/**
 * Inkdrop packages conventionally use a `theme` cascade layer. Tailwind uses
 * that same global layer name, so render packages beneath an InkNote-owned
 * parent layer that is created after the application defaults. The package's
 * CSS remains otherwise unchanged, including its own nested theme layers.
 */
const wrapExternalThemeCss = (css: string): string =>
  `@layer inknote.external {\n${css}\n}`;
