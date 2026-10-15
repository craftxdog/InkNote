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

type WorkspaceNavbarProps = {
  isNavigationVisible: boolean;
  isWorkspaceExpanded: boolean;

  viewMode: WorkspaceViewMode;

  onViewModeChange: (mode: WorkspaceViewMode) => void;

  onToggleNavigation: () => void;
  onToggleWorkspaceExpanded: () => void;
};

export const WorkspaceNavbar = ({
  isNavigationVisible,
  isWorkspaceExpanded,
  viewMode,
  onViewModeChange,
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
          title="Settings"
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
          title={isNavigationVisible ? 'Hide sidebar' : 'Show sidebar'}
        >
          <SidebarIcon />
        </button>

        <h1 className="navbar-title">All Notes</h1>

        <button
          type="button"
          className="navbar-button"
          aria-label="Create note"
          title="Create note"
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
              isWorkspaceExpanded ? 'Restore workspace' : 'Expand workspace'
            }
            aria-pressed={isWorkspaceExpanded}
            title={
              isWorkspaceExpanded ? 'Restore workspace' : 'Expand workspace'
            }
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
            onClick={() => onViewModeChange('editor')}
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
            onClick={() => onViewModeChange('split')}
            aria-label="Split view"
            aria-pressed={viewMode === 'split'}
            title="Split view"
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
            onClick={() => onViewModeChange('preview')}
            aria-label="Preview only"
            aria-pressed={viewMode === 'preview'}
            title="Preview only"
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
