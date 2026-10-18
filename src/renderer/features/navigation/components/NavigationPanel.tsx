import type { CSSProperties } from 'react';
import {
  navigationCounts,
  navigationDestinations,
  statusItems,
  tagItems,
} from '../data/navigation.data';

import { useNavigationState } from '../hooks/useNavigationState';

import { NavigationSelection } from '../model/navigation.types';
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

import { NavigationRow } from './NavigationRow';
import { NavigationHeader } from './NavigationSectionHeader';

import '../styles/navigation.css';

export type NavigationPanelProps = {
  selection: NavigationSelection;
  onSelectionChange: (selection: NavigationSelection) => void;
};

export const NavigationPanel = ({
  selection,
  onSelectionChange,
}: NavigationPanelProps) => {
  const { expandedSections, toggleSection } = useNavigationState();

  /**
   * Una única comparación para todos los elementos.
   *
   * Elimina por completo el viejo isSelectedItem.
   */
  const isSelected = (id: string): boolean => {
    return selection.id === id;
  };

  return (
    <>
      <div className="navigation-panel">
        <div className="navigation-panel__scroll">
          {/* Primary */}

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

          {/* =================================================
            Notebooks
        ================================================= */}

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

          <NavigationRow
            label={navigationDestinations.inbox.label}
            icon={<InboxIcon />}
            depth={1}
            selected={isSelected(navigationDestinations.inbox.id)}
            onClick={() => onSelectionChange(navigationDestinations.inbox)}
          />

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

              toggleSection('work');
            }}
          />

          {expandedSections.work && (
            <NavigationRow
              label={navigationDestinations.projects.label}
              icon={<RocketIcon />}
              depth={2}
              selected={isSelected(navigationDestinations.projects.id)}
              onClick={() => onSelectionChange(navigationDestinations.projects)}
            />
          )}

          {/* =================================================
            Status
        ================================================= */}

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
                onClick={() => toggleSection('status')}
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

          {/* =================================================
            Tags
        ================================================= */}

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
                  onClick={() => toggleSection('tags')}
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

          <NavigationRow
            label={navigationDestinations.trash.label}
            icon={<TrashIcon />}
            selected={isSelected(navigationDestinations.trash.id)}
            onClick={() => onSelectionChange(navigationDestinations.trash)}
          />
        </div>
      </div>
    </>
  );
};
