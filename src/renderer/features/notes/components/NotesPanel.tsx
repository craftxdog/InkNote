import { SidebarIcon } from '../../../components/icons/SidebarIcon';

type NotesPanelProps = {
  isNavigationVisible: boolean;
  onToggleNavigation: () => void;
};

export const NotesPanel = ({
  isNavigationVisible,
  onToggleNavigation,
}: NotesPanelProps) => {
  return (
    <>
      <div className="panel">
        <header className="panel-header notes-header">
          <button
            className="toolbar-button"
            type="button"
            onClick={onToggleNavigation}
            aria-label={
              isNavigationVisible
                ? 'Hide navigation sidebar'
                : 'Show navigation sidebar'
            }
            aria-pressed={!isNavigationVisible}
            title={isNavigationVisible ? 'Hide sidebar' : 'Show sidebar'}
          >
            <SidebarIcon />
          </button>
          <span className="panel-title notes-header__title">All notes</span>
          <div className="notes-header__actions">
            {/* Aquí agregaremos después Create Note */}
          </div>
        </header>
        <div className="panel-content">
          <div className="placeholder">
            <strong className="text-lg font-semibold text-zinc-900">
              Notes
            </strong>
            <span> Search and note explore</span>
          </div>
        </div>
      </div>
    </>
  );
};
