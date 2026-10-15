import type { CSSProperties } from 'react';
import {
  navigationCounts,
  statusItems,
  tagItems,
} from '../data/navigation.mock';

import { useNavigationState } from '../hooks/useNavigationState';

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

export const NavigationPanel = () => {
  const { isSelectedItem, isExpandedSections, selectItem, toggleSection } =
    useNavigationState();

  return (
    <>
      <div className="navigation-panel">
        <div className="navigation-panel__scroll">
          {/* Primary */}

          <NavigationRow
            label="All Notes"
            icon={<NotesIcon />}
            count={navigationCounts.allNotes}
            selected={isSelectedItem === 'all-notes'}
            onClick={() => selectItem('all-notes')}
          />

          <NavigationRow
            label="Note Templates"
            icon={<TemplateIcon />}
            selected={isSelectedItem === 'note-templates'}
            onClick={() => selectItem('note-templates')}
          />

          {/* Notebooks */}

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
            label="Inbox"
            icon={<InboxIcon />}
            depth={1}
            selected={isSelectedItem === 'inbox'}
            onClick={() => selectItem('inbox')}
          />

          <NavigationRow
            label="Work"
            prefix={
              <span
                className={[
                  'navigation-chevron',
                  isExpandedSections.work ? 'navigation-chevron--expanded' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <ChevronIcon />
              </span>
            }
            icon={<BriefcaseIcon />}
            selected={isSelectedItem === 'work'}
            onClick={() => {
              selectItem('work');
              toggleSection('work');
            }}
          />

          {isExpandedSections.work && (
            <NavigationRow
              label="Projects"
              icon={<RocketIcon />}
              depth={2}
              selected={isSelectedItem === 'projects'}
              onClick={() => selectItem('projects')}
            />
          )}

          {/* Status */}

          <NavigationHeader
            title="Status"
            actions={
              <button
                type="button"
                className={[
                  'navigation-icon-button',
                  'navigation-section-toggle',
                  isExpandedSections.status
                    ? 'navigation-section-toggle--expanded'
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => toggleSection('status')}
                aria-expanded={isExpandedSections.status}
                aria-label="Toggle status"
              >
                <ChevronIcon />
              </button>
            }
          />

          {isExpandedSections.status &&
            statusItems.map((item) => (
              <NavigationRow
                key={item.id}
                label={item.label}
                icon={
                  <span
                    className={`navigation-status navigation-status--${item.status}`}
                  />
                }
                count={item.count}
                depth={1}
                selected={isSelectedItem === item.id}
                onClick={() => selectItem(item.id)}
              />
            ))}

          {/* Tags */}

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
                    isExpandedSections.tags
                      ? 'navigation-section-toggle--expanded'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => toggleSection('tags')}
                  aria-expanded={isExpandedSections.tags}
                  aria-label="Toggle tags"
                >
                  <ChevronIcon />
                </button>
              </>
            }
          />

          {isExpandedSections.tags &&
            tagItems.map((tag) => (
              <NavigationRow
                key={tag.id}
                label={tag.label}
                icon={
                  <span
                    className="navigation-tag-dot"
                    style={
                      {
                        '--tag-color': tag.color,
                      } as CSSProperties
                    }
                  />
                }
                count={tag.count}
                depth={1}
                selected={isSelectedItem === tag.id}
                onClick={() => selectItem(tag.id)}
              />
            ))}

          {/* Trash */}

          <NavigationRow
            label="Trash"
            icon={<TrashIcon />}
            selected={isSelectedItem === 'trash'}
            onClick={() => selectItem('trash')}
          />
        </div>
      </div>
    </>
  );
};
