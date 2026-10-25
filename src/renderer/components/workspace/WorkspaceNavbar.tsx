import {
  BackIcon,
  CollapseIcon,
  EditModeIcon,
  ExpandIcon,
  ForwardIcon,
  MoreIcon,
  NewNoteIcon,
  PreviewIcon,
  SettingsIcon,
  SidebarIcon,
  SplitViewIcon,
} from '../icons/ToolbarIcons';

import type { WorkspaceViewMode } from '../../types/workspace';
import { NavigationContextIcon } from '../../features/navigation/components/NavigationContextIcon';
import type { NavigationSelection } from '../../features/navigation/model/navigation.types';
import {
  workspaceViewCommandIds,
  type WorkspaceViewCommand,
} from '../../features/workspace/model/viewCommands';

type WorkspaceNavbarProps = {
  isNavigationVisible: boolean;
  isWorkspaceExpanded: boolean;
  navigationSelection: NavigationSelection;

  viewMode: WorkspaceViewMode;

  onViewCommand: (command: WorkspaceViewCommand) => void;

  onCreateNote: () => void;

  onOpenPreferences: () => void;

  onToggleNavigation: () => void;
  onToggleWorkspaceExpanded: () => void;
};

export const WorkspaceNavbar = ({
  isNavigationVisible,
  isWorkspaceExpanded,
  navigationSelection,
  viewMode,
  onViewCommand,
  onCreateNote,
  onOpenPreferences,
  onToggleNavigation,
  onToggleWorkspaceExpanded,
}: WorkspaceNavbarProps) => {
  return (
    <header className="workspace-navbar">
      {/* ===================================================
          Navigation
      =================================================== */}

      <div className="navbar-zone navbar-zone--navigation">
        <button
          type="button"
          className="navbar-button navbar-settings"
          aria-label="Settings"
          title="Settings (⌘/Ctrl+,)"
          onClick={onOpenPreferences}
        >
          <SettingsIcon />
        </button>
      </div>

      {/* ===================================================
          Notes
      =================================================== */}

      <div className="navbar-zone navbar-zone--notes">
        <button
          type="button"
          className="navbar-button"
          onClick={onToggleNavigation}
          aria-label={
            isNavigationVisible
              ? 'Hide navigation sidebar'
              : 'Show navigation sidebar'
          }
          title={`${isNavigationVisible ? 'Hide' : 'Show'} sidebar (⌘/Ctrl+/)`}
        >
          <SidebarIcon />
        </button>

        <div className="navbar-context-title">
          {navigationSelection.icon.type !== 'all-notes' && (
            <span className="navbar-context-title__icon">
              <NavigationContextIcon selection={navigationSelection} />
            </span>
          )}

          <h1 className="navbar-title">{navigationSelection.label}</h1>
        </div>

        <button
          type="button"
          className="navbar-button"
          onClick={onCreateNote}
          aria-label="Create note"
          title="Create note (⌘/Ctrl+N)"
        >
          <NewNoteIcon />
        </button>
      </div>

      {/* ===================================================
          Document workspace
      =================================================== */}

      <div className="navbar-zone navbar-zone--document">
        {/* Left document controls */}

        <div className="navbar-actions">
          <button
            type="button"
            className={[
              'navbar-button',
              isWorkspaceExpanded ? 'navbar-button--active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={onToggleWorkspaceExpanded}
            aria-label={
              isWorkspaceExpanded
                ? 'Exit distraction-free mode'
                : 'Enter distraction-free mode'
            }
            aria-pressed={isWorkspaceExpanded}
            title={`${isWorkspaceExpanded ? 'Exit' : 'Enter'} distraction-free mode (⌘/Ctrl+⇧D)`}
          >
            {isWorkspaceExpanded ? <CollapseIcon /> : <ExpandIcon />}
          </button>

          <button
            type="button"
            className="navbar-button"
            aria-label="Back"
            title="Back"
          >
            <BackIcon />
          </button>

          <button
            type="button"
            className="navbar-button"
            aria-label="Forward"
            title="Forward"
          >
            <ForwardIcon />
          </button>
        </div>

        {/* Center view selector */}

        <div className="view-switcher" role="group" aria-label="Document view">
          <button
            type="button"
            className={[
              'view-switcher__button',
              viewMode === 'editor' ? 'view-switcher__button--active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onViewCommand(workspaceViewCommandIds.showEditor)}
            aria-label="Editor only"
            aria-pressed={viewMode === 'editor'}
            title="Editor only"
          >
            <EditModeIcon />
          </button>

          <button
            type="button"
            className={[
              'view-switcher__button',
              viewMode === 'split' ? 'view-switcher__button--active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() =>
              onViewCommand(workspaceViewCommandIds.showSideBySide)
            }
            aria-label="Split view"
            aria-pressed={viewMode === 'split'}
            title="Split view (⌘/Ctrl+P or ⌘/Ctrl+Shift+P)"
          >
            <SplitViewIcon />
          </button>

          <button
            type="button"
            className={[
              'view-switcher__button',
              viewMode === 'preview' ? 'view-switcher__button--active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onViewCommand(workspaceViewCommandIds.showPreview)}
            aria-label="Preview only"
            aria-pressed={viewMode === 'preview'}
            title="Preview only (⌘/Ctrl+E)"
          >
            <PreviewIcon />
          </button>
        </div>

        {/* Right document controls */}

        <button
          type="button"
          className="navbar-button navbar-more"
          aria-label="More options"
          title="More options"
        >
          <MoreIcon />
        </button>
      </div>
    </header>
  );
};
