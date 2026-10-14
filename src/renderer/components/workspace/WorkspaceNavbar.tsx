import { SidebarIcon } from '../icons/SidebarIcon';
import {
  BackIcon,
  EditModeIcon,
  ExpandIcon,
  ForwardIcon,
  MoreIcon,
  NewNoteIcon,
  PreviewIcon,
  SettingsIcon,
  SplitViewIcon,
} from '../icons/ToolbarIcons';

type WorkspaceNavbarProp = {
  isNavigationVisible: boolean;
  onToggleNavigation: () => void;
};

export const WorkspaceNavbar = ({
  isNavigationVisible,
  onToggleNavigation,
}: WorkspaceNavbarProp) => {
  return (
    <>
      <header className="workspace-navbar">
        {/* Navigation toolbar */}
        <div className="navbar-zone navbar-zone--navigation">
          <button
            className="navbar-button navbar-settings"
            type="button"
            aria-label="Settings"
            title="Settings"
          >
            <SettingsIcon />
          </button>
        </div>
        {/* Notes toolbar */}
        <div className="navbar-zone navbar-zone--notes">
          <button
            className="navbar-button"
            type="button"
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
            className="navbar-button"
            type="button"
            aria-label="Create note"
            title="Create note"
          >
            <NewNoteIcon />
          </button>
        </div>
        {/* Editor navigation */}
        <div className="navbar-zone navbar-zone--editor">
          <div className="navbar-actions">
            <button
              className="navbar-button"
              type="button"
              aria-label="Expand editor"
              title="Expand editor"
            >
              <ExpandIcon />
            </button>
            <button
              className="navbar-button"
              type="button"
              aria-label="Back"
              title="Back"
            >
              <BackIcon />
            </button>
            <button
              className="navbar-button"
              type="button"
              aria-label="Forward"
              title="Forward"
            >
              <ForwardIcon />
            </button>
          </div>
        </div>
        {/* View controls */}
        <div className="navbar-zone navbar-zone--preview">
          <div className="view-switcher">
            <button
              type="button"
              className="view-switcher__button"
              aria-label="Editor only"
              title="Editor only"
            >
              <EditModeIcon />
            </button>

            <button
              type="button"
              className="view-switcher__button view-switcher__button--active"
              aria-label="Split view"
              title="Split view"
            >
              <SplitViewIcon />
            </button>

            <button
              type="button"
              className="view-switcher__button"
              aria-label="Preview only"
              title="Preview only"
            >
              <PreviewIcon />
            </button>
          </div>

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
    </>
  );
};
