import type { CSSProperties } from 'react';

import { navigationDestinations } from '../data/navigation.data';

import { navigationWorkspaces } from '../data/navigation.workspace.mock';
import { getNavigationWorkspaceId } from '../model/navigation.helpers';

import type {
  NavigationSelection,
  NavigationWorkspaceId,
} from '../model/navigation.types';

import { ChevronIcon, SearchIcon } from './NavigationIcons';

import { NavigationContextIcon } from './NavigationContextIcon';

import { NavigationHeader } from './NavigationSectionHeader';

import { NavigationRow } from './NavigationRow';

import { NavigationWorkspaceHeader } from './NavigationWorkspaceHeader';

type NavigationWorkspaceViewProps = {
  workspaceId: NavigationWorkspaceId;

  selection: NavigationSelection;

  expandedStatus: boolean;

  expandedTags: boolean;

  onToggleStatus: () => void;

  onToggleTags: () => void;

  onSelectionChange: (selection: NavigationSelection) => void;

  onExitWorkspace: () => void;

  onWorkspaceChange: (workspaceId: NavigationWorkspaceId) => void;
};

export function NavigationWorkspaceView({
  workspaceId,
  selection,
  expandedStatus,
  expandedTags,
  onToggleStatus,
  onToggleTags,
  onSelectionChange,
  onExitWorkspace,
  onWorkspaceChange,
}: NavigationWorkspaceViewProps) {
  const workspace = navigationWorkspaces[workspaceId];

  return (
    <>
      <NavigationWorkspaceHeader
        breadcrumbs={workspace.breadcrumbs}
        onExitWorkspace={onExitWorkspace}
        onWorkspaceChange={onWorkspaceChange}
      />

      <NavigationRow
        label="All Notes"
        icon={
          <NavigationContextIcon selection={navigationDestinations.allNotes} />
        }
        count={workspace.allNotesCount}
        selected={selection.id === navigationDestinations.allNotes.id}
        onClick={() => onSelectionChange(navigationDestinations.allNotes)}
      />

      {workspace.children.length > 0 && (
        <>
          <NavigationHeader title="Notebooks" />

          {workspace.children.map((child) => {
            const childWorkspaceId = getNavigationWorkspaceId(child);

            return (
              <NavigationRow
                key={child.id}
                label={child.label}
                icon={<NavigationContextIcon selection={child} />}
                depth={1}
                selected={selection.id === child.id}
                onClick={() => onSelectionChange(child)}
                action={
                  childWorkspaceId
                    ? {
                        label: 'Detail',

                        title: 'Switch to workspace view',

                        onClick: () => onWorkspaceChange(childWorkspaceId),
                      }
                    : undefined
                }
              />
            );
          })}
        </>
      )}

      <NavigationHeader
        title="Status"
        actions={
          <button
            type="button"
            className={[
              'navigation-icon-button',
              'navigation-section-toggle',

              expandedStatus ? 'navigation-section-toggle--expanded' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={onToggleStatus}
            aria-expanded={expandedStatus}
            aria-label="Toggle status"
          >
            <ChevronIcon />
          </button>
        }
      />

      {expandedStatus &&
        workspace.statuses.map((item) => (
          <NavigationRow
            key={item.destination.id}
            label={item.destination.label}
            icon={<NavigationContextIcon selection={item.destination} />}
            count={item.count}
            depth={1}
            selected={selection.id === item.destination.id}
            onClick={() => onSelectionChange(item.destination)}
          />
        ))}

      <NavigationHeader
        title="Tags"
        actions={
          <>
            <button
              type="button"
              className="navigation-icon-button"
              aria-label="Search tags"
              title="Search tags"
            >
              <SearchIcon />
            </button>

            <button
              type="button"
              className={[
                'navigation-icon-button',
                'navigation-section-toggle',

                expandedTags ? 'navigation-section-toggle--expanded' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={onToggleTags}
              aria-expanded={expandedTags}
              aria-label="Toggle tags"
            >
              <ChevronIcon />
            </button>
          </>
        }
      />

      {expandedTags &&
        workspace.tags.map((item) => {
          const icon = item.destination.icon;

          const color = icon.type === 'tag' ? icon.color : '#808080';

          return (
            <NavigationRow
              key={item.destination.id}
              label={item.destination.label}
              icon={
                <span
                  className="navigation-tag-dot"
                  style={
                    {
                      '--tag-color': color,
                    } as CSSProperties
                  }
                />
              }
              count={item.count}
              depth={1}
              selected={selection.id === item.destination.id}
              onClick={() => onSelectionChange(item.destination)}
            />
          );
        })}
    </>
  );
}
