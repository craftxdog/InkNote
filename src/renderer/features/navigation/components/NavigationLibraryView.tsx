import type { CSSProperties } from 'react';

import {
  navigationCounts,
  navigationDestinations,
  statusItems,
  tagItems,
} from '../data/navigation.data';

import type {
  NavigationSectionId,
  NavigationSectionsState,
  NavigationSelection,
  NavigationWorkspaceId,
} from '../model/navigation.types';

import {
  BriefcaseIcon,
  ChevronIcon,
  InboxIcon,
  NotesIcon,
  PlusIcon,
  RocketIcon,
  SearchIcon,
  TemplateIcon,
  TrashIcon,
} from './NavigationIcons';

import { NavigationHeader } from './NavigationSectionHeader';
import { NavigationRow } from './NavigationRow';

type NavigationLibraryViewProps = {
  selection: NavigationSelection;

  expandedSections: NavigationSectionsState;

  onSelectionChange: (selection: NavigationSelection) => void;

  onToggleSection: (section: NavigationSectionId) => void;

  onEnterWorkspace: (workspaceId: NavigationWorkspaceId) => void;
};

export function NavigationLibraryView({
  selection,
  expandedSections,
  onSelectionChange,
  onToggleSection,
  onEnterWorkspace,
}: NavigationLibraryViewProps) {
  const isSelected = (id: string) => selection.id === id;

  return (
    <>
      {/* ===================================================
          Primary destinations
      =================================================== */}

      <NavigationRow
        label={navigationDestinations.allNotes.label}
        icon={<NotesIcon />}
        count={navigationCounts.allNotes}
        selected={isSelected(navigationDestinations.allNotes.id)}
        onClick={() => onSelectionChange(navigationDestinations.allNotes)}
      />

      <NavigationRow
        label={navigationDestinations.templates.label}
        icon={<TemplateIcon />}
        selected={isSelected(navigationDestinations.templates.id)}
        onClick={() => onSelectionChange(navigationDestinations.templates)}
      />

      {/* ===================================================
          Notebooks
      =================================================== */}

      <NavigationHeader
        title="Notebooks"
        actions={
          <>
            <button
              type="button"
              className="navigation-icon-button"
              aria-label="Search notebooks"
              title="Search notebooks"
            >
              <SearchIcon />
            </button>

            <button
              type="button"
              className="navigation-icon-button"
              aria-label="Create notebook"
              title="Create notebook"
            >
              <PlusIcon />
            </button>
          </>
        }
      />

      {/* Inbox */}

      <NavigationRow
        label={navigationDestinations.inbox.label}
        icon={<InboxIcon />}
        depth={1}
        selected={isSelected(navigationDestinations.inbox.id)}
        onClick={() => onSelectionChange(navigationDestinations.inbox)}
        action={{
          label: 'Detail',
          title: 'Switch to workspace view',

          onClick: () => onEnterWorkspace('inbox'),
        }}
      />

      {/* Work */}

      <NavigationRow
        label={navigationDestinations.work.label}
        prefix={
          <span
            className={[
              'navigation-chevron',

              expandedSections.work ? 'navigation-chevron--expanded' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <ChevronIcon />
          </span>
        }
        icon={<BriefcaseIcon />}
        selected={isSelected(navigationDestinations.work.id)}
        onClick={() => {
          onSelectionChange(navigationDestinations.work);

          onToggleSection('work');
        }}
        action={{
          label: 'Detail',
          title: 'Switch to workspace view',

          onClick: () => onEnterWorkspace('work'),
        }}
      />

      {/* Projects */}

      {expandedSections.work && (
        <NavigationRow
          label={navigationDestinations.projects.label}
          icon={<RocketIcon />}
          depth={2}
          selected={isSelected(navigationDestinations.projects.id)}
          onClick={() => onSelectionChange(navigationDestinations.projects)}
          action={{
            label: 'Detail',
            title: 'Switch to workspace view',

            onClick: () => onEnterWorkspace('projects'),
          }}
        />
      )}

      {/* ===================================================
          Status
      =================================================== */}

      <NavigationHeader
        title="Status"
        actions={
          <button
            type="button"
            className={[
              'navigation-icon-button',
              'navigation-section-toggle',

              expandedSections.status
                ? 'navigation-section-toggle--expanded'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onToggleSection('status')}
            aria-expanded={expandedSections.status}
            aria-label="Toggle status"
            title="Toggle status"
          >
            <ChevronIcon />
          </button>
        }
      />

      {expandedSections.status &&
        statusItems.map((item) => (
          <NavigationRow
            key={item.destination.id}
            label={item.destination.label}
            icon={
              <span
                className={[
                  'navigation-status',
                  `navigation-status--${item.status}`,
                ].join(' ')}
              />
            }
            count={item.count}
            depth={1}
            selected={isSelected(item.destination.id)}
            onClick={() => onSelectionChange(item.destination)}
          />
        ))}

      {/* ===================================================
          Tags
      =================================================== */}

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

                expandedSections.tags
                  ? 'navigation-section-toggle--expanded'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onToggleSection('tags')}
              aria-expanded={expandedSections.tags}
              aria-label="Toggle tags"
              title="Toggle tags"
            >
              <ChevronIcon />
            </button>
          </>
        }
      />

      {expandedSections.tags &&
        tagItems.map((item) => (
          <NavigationRow
            key={item.destination.id}
            label={item.destination.label}
            icon={
              <span
                className="navigation-tag-dot"
                style={
                  {
                    '--tag-color': item.color,
                  } as CSSProperties
                }
              />
            }
            count={item.count}
            depth={1}
            selected={isSelected(item.destination.id)}
            onClick={() => onSelectionChange(item.destination)}
          />
        ))}

      {/* ===================================================
          Trash
      =================================================== */}

      <NavigationRow
        label={navigationDestinations.trash.label}
        icon={<TrashIcon />}
        selected={isSelected(navigationDestinations.trash.id)}
        onClick={() => onSelectionChange(navigationDestinations.trash)}
      />
    </>
  );
}
