import type {
  NavigationSelection,
  NavigationWorkspaceId,
} from '../model/navigation.types';

import { getNavigationWorkspaceId } from '../model/navigation.helpers';

import { NavigationContextIcon } from './NavigationContextIcon';
import { ChevronIcon, LibraryIcon } from './NavigationIcons';

type NavigationWorkspaceHeaderProps = {
  breadcrumbs: NavigationSelection[];

  onExitWorkspace: () => void;

  onWorkspaceChange: (workspaceId: NavigationWorkspaceId) => void;
};

export function NavigationWorkspaceHeader({
  breadcrumbs,
  onExitWorkspace,
  onWorkspaceChange,
}: NavigationWorkspaceHeaderProps) {
  const currentSelection = breadcrumbs.at(-1);

  if (!currentSelection) {
    return null;
  }

  const isNestedWorkspace = breadcrumbs.length > 1;

  const ancestors = isNestedWorkspace ? breadcrumbs.slice(0, -1) : [];

  return (
    <header
      className={[
        'navigation-workspace-header',
        isNestedWorkspace ? 'navigation-workspace-header--nested' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="navigation-workspace-header__trail">
        <button
          type="button"
          className="navigation-workspace-header__library"
          onClick={onExitWorkspace}
          title="Switch to library view"
          aria-label="Switch to library view"
        >
          <LibraryIcon />
        </button>

        {isNestedWorkspace ? (
          <>
            {ancestors.map((selection) => {
              const workspaceId = getNavigationWorkspaceId(selection);

              return (
                <div
                  key={selection.id}
                  className="navigation-workspace-header__segment"
                >
                  <span
                    className="navigation-workspace-header__chevron"
                    aria-hidden="true"
                  >
                    <ChevronIcon />
                  </span>

                  <button
                    type="button"
                    className="navigation-workspace-header__context"
                    disabled={workspaceId === null}
                    onClick={() => {
                      if (workspaceId !== null) {
                        onWorkspaceChange(workspaceId);
                      }
                    }}
                  >
                    <span className="navigation-workspace-header__context-icon">
                      <NavigationContextIcon selection={selection} />
                    </span>

                    <span className="navigation-workspace-header__context-label">
                      {selection.label}
                    </span>
                  </button>
                </div>
              );
            })}

            <span
              className="navigation-workspace-header__chevron"
              aria-hidden="true"
            >
              <ChevronIcon />
            </span>
          </>
        ) : (
          <>
            <span
              className="navigation-workspace-header__chevron"
              aria-hidden="true"
            >
              <ChevronIcon />
            </span>

            <div className="navigation-workspace-header__context navigation-workspace-header__context--current">
              <span className="navigation-workspace-header__context-icon">
                <NavigationContextIcon selection={currentSelection} />
              </span>

              <span className="navigation-workspace-header__context-label">
                {currentSelection.label}
              </span>
            </div>
          </>
        )}
      </div>

      {isNestedWorkspace ? (
        <div className="navigation-workspace-header__current">
          <span className="navigation-workspace-header__current-icon">
            <NavigationContextIcon selection={currentSelection} />
          </span>

          <span className="navigation-workspace-header__current-label">
            {currentSelection.label}
          </span>
        </div>
      ) : null}
    </header>
  );
}
