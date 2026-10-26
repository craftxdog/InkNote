import {
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';

import {
  NOTE_STATUSES,
  type Notebook,
  type NotebookIconName,
  type NoteDocument,
} from '../../../../shared/documents/document.types';
import { colorForTag, tagColorHex } from '../../notes/model/notePresentation';

import { navigationDestinations } from '../data/navigation.data';

import type {
  NavigationSectionId,
  NavigationSectionsState,
  NavigationSelection,
} from '../model/navigation.types';
import {
  selectionForNotebook,
  selectionForStatus,
  selectionForTag,
  STATUS_LABELS,
} from '../model/navigation.selections';
import { NOTEBOOK_ICON_OPTIONS } from '../model/notebookIconOptions';
import { buildNotebookTreeRows } from '../model/notebookTree';

import {
  ChevronIcon,
  NotesIcon,
  PlusIcon,
  SearchIcon,
  TemplateIcon,
  TrashIcon,
} from './NavigationIcons';

import { NavigationHeader } from './NavigationSectionHeader';
import { NavigationNotebookIcon } from './NavigationNotebookIcon';
import { NavigationRow } from './NavigationRow';

type NavigationLibraryViewProps = {
  selection: NavigationSelection;
  documents: readonly NoteDocument[];
  notebooks: readonly Notebook[];
  expandedSections: NavigationSectionsState;
  onSelectionChange: (selection: NavigationSelection) => void;
  onToggleSection: (section: NavigationSectionId) => void;
  onCreateNotebook: (
    name: string,
    parentId?: string | null,
    icon?: NotebookIconName,
  ) => Promise<Notebook>;
  onDeleteNotebook?: (notebook: Notebook) => Promise<void>;
  onOpenNotebookDetail?: (notebook: Notebook) => void;
};

/**
 * The sidebar is a projection of persisted note metadata. It intentionally
 * does not retain mock counters: every visible count derives from the same
 * local documents that the notes list renders.
 */
export function NavigationLibraryView({
  selection,
  documents,
  notebooks,
  expandedSections,
  onSelectionChange,
  onToggleSection,
  onCreateNotebook,
  onDeleteNotebook,
  onOpenNotebookDetail,
}: NavigationLibraryViewProps) {
  const [notebookQuery, setNotebookQuery] = useState('');
  const [collapsedNotebookIds, setCollapsedNotebookIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [tagQuery, setTagQuery] = useState('');
  const [isNotebookSearchVisible, setIsNotebookSearchVisible] = useState(false);
  const [isTagSearchVisible, setIsTagSearchVisible] = useState(false);
  const [isCreatingNotebook, setIsCreatingNotebook] = useState(false);
  const [newNotebookName, setNewNotebookName] = useState('');
  const [newNotebookIcon, setNewNotebookIcon] = useState<
    NotebookIconName | undefined
  >(undefined);
  const [createError, setCreateError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<Readonly<{
    notebook: Notebook;
    x: number;
    y: number;
  }> | null>(null);
  const [subnotebookParent, setSubnotebookParent] = useState<Notebook | null>(
    null,
  );
  const [subnotebookName, setSubnotebookName] = useState('');
  const [subnotebookIcon, setSubnotebookIcon] = useState<
    NotebookIconName | undefined
  >(undefined);
  const [subnotebookError, setSubnotebookError] = useState<string | null>(null);

  const isSelected = (id: string) => selection.id === id;
  const noteCountByNotebook = useMemo(
    () => countBy(documents, (document) => document.notebookId),
    [documents],
  );
  const noteCountByStatus = useMemo(
    () => countBy(documents, (document) => document.status),
    [documents],
  );
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const document of documents) {
      for (const tag of document.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [documents]);
  const notebookRows = useMemo(
    () => buildNotebookTreeRows(notebooks, noteCountByNotebook, notebookQuery),
    [notebooks, noteCountByNotebook, notebookQuery],
  );
  const visibleNotebookRows = useMemo(() => {
    if (notebookQuery.trim().length > 0) {
      return notebookRows;
    }

    const visible: (typeof notebookRows)[number][] = [];
    let collapsedDepth: number | null = null;

    for (const row of notebookRows) {
      if (collapsedDepth !== null && row.depth > collapsedDepth) {
        continue;
      }

      if (collapsedDepth !== null && row.depth <= collapsedDepth) {
        collapsedDepth = null;
      }

      visible.push(row);

      if (row.hasChildren && collapsedNotebookIds.has(row.notebook.id)) {
        collapsedDepth = row.depth;
      }
    }

    return Object.freeze(visible);
  }, [collapsedNotebookIds, notebookQuery, notebookRows]);
  const visibleTags = tagCounts.filter((tag) =>
    includesNormalized(tag.name, tagQuery),
  );

  const submitNotebook = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (newNotebookName.trim().length === 0) {
      return;
    }

    try {
      const notebook = await onCreateNotebook(
        newNotebookName,
        null,
        newNotebookIcon,
      );

      setNewNotebookName('');
      setNewNotebookIcon(undefined);
      setIsCreatingNotebook(false);
      setCreateError(null);
      onSelectionChange(selectionForNotebook(notebook));
    } catch {
      setCreateError('The notebook could not be created.');
    }
  };

  const closeSubnotebookDialog = (): void => {
    setSubnotebookParent(null);
    setSubnotebookName('');
    setSubnotebookIcon(undefined);
    setSubnotebookError(null);
  };

  const submitSubnotebook = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (subnotebookParent === null || subnotebookName.trim().length === 0) {
      return;
    }

    try {
      const notebook = await onCreateNotebook(
        subnotebookName,
        subnotebookParent.id,
        subnotebookIcon,
      );

      closeSubnotebookDialog();
      onSelectionChange(selectionForNotebook(notebook));
    } catch {
      setSubnotebookError('The subnotebook could not be created.');
    }
  };

  const openNotebookContextMenu = (
    event: MouseEvent<HTMLButtonElement>,
    notebook: Notebook,
  ): void => {
    event.preventDefault();
    setContextMenu({ notebook, x: event.clientX, y: event.clientY });
  };

  const openKeyboardContextMenu = (
    event: KeyboardEvent<HTMLButtonElement>,
    notebook: Notebook,
  ): void => {
    if (
      event.key !== 'ContextMenu' &&
      !(event.shiftKey && event.key === 'F10')
    ) {
      return;
    }

    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    setContextMenu({
      notebook,
      x: bounds.left + Math.min(bounds.width / 2, 96),
      y: bounds.bottom,
    });
  };

  const deleteNotebook = async (notebook: Notebook): Promise<void> => {
    setContextMenu(null);

    if (onDeleteNotebook === undefined) {
      return;
    }

    const confirmed = globalThis.confirm(
      `Delete “${notebook.name}”? Its direct notes will move to Trash. Subnotebooks will remain and move up one level.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await onDeleteNotebook(notebook);
    } catch {
      setCreateError('The notebook could not be deleted.');
    }
  };

  return (
    <>
      <NavigationRow
        label={navigationDestinations.allNotes.label}
        icon={<NotesIcon />}
        count={documents.length}
        selected={isSelected(navigationDestinations.allNotes.id)}
        onClick={() => onSelectionChange(navigationDestinations.allNotes)}
      />

      <NavigationRow
        label={navigationDestinations.templates.label}
        icon={<TemplateIcon />}
        selected={isSelected(navigationDestinations.templates.id)}
        onClick={() => onSelectionChange(navigationDestinations.templates)}
      />

      <NavigationHeader
        title="Notebooks"
        actions={
          <>
            <button
              type="button"
              className="navigation-icon-button"
              aria-label="Search notebooks"
              title="Search notebooks"
              aria-pressed={isNotebookSearchVisible}
              onClick={() => setIsNotebookSearchVisible((current) => !current)}
            >
              <SearchIcon />
            </button>
            <button
              type="button"
              className="navigation-icon-button"
              aria-label="Create notebook"
              title="Create notebook"
              aria-pressed={isCreatingNotebook}
              onClick={() => {
                setCreateError(null);
                setIsCreatingNotebook((current) => !current);
              }}
            >
              <PlusIcon />
            </button>
          </>
        }
      />

      {isNotebookSearchVisible && (
        <div className="navigation-inline-control">
          <input
            aria-label="Filter notebooks"
            value={notebookQuery}
            onChange={(event) => setNotebookQuery(event.target.value)}
            placeholder="Filter notebooks"
          />
        </div>
      )}

      {isCreatingNotebook && (
        <form className="navigation-inline-control" onSubmit={submitNotebook}>
          <input
            aria-label="New notebook name"
            value={newNotebookName}
            onChange={(event) => setNewNotebookName(event.target.value)}
            placeholder="Notebook name"
          />
          <select
            aria-label="Notebook icon"
            value={newNotebookIcon ?? 'auto'}
            onChange={(event) =>
              setNewNotebookIcon(
                event.target.value === 'auto'
                  ? undefined
                  : (event.target.value as NotebookIconName),
              )
            }
          >
            <option value="auto">Auto icon</option>
            {NOTEBOOK_ICON_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </form>
      )}

      {createError !== null && (
        <p className="navigation-inline-error" role="alert">
          {createError}
        </p>
      )}

      {visibleNotebookRows.map(
        ({ notebook, depth, noteCount, hasChildren }) => {
          const isExpanded =
            notebookQuery.trim().length > 0 ||
            !collapsedNotebookIds.has(notebook.id);
          const notebookSelection = selectionForNotebook(notebook, {
            includeDescendants: hasChildren && !isExpanded,
          });

          return (
            <NavigationRow
              key={notebook.id}
              label={notebook.name}
              icon={<NavigationNotebookIcon notebook={notebook} />}
              count={noteCount}
              depth={depth + 1}
              selected={isSelected(notebookSelection.id)}
              onClick={() => onSelectionChange(notebookSelection)}
              onContextMenu={(event) =>
                openNotebookContextMenu(event, notebook)
              }
              onKeyDown={(event) => {
                openKeyboardContextMenu(event, notebook);

                if (event.defaultPrevented) {
                  return;
                }

                if (
                  event.key === 'Enter' &&
                  onOpenNotebookDetail !== undefined
                ) {
                  event.preventDefault();
                  onOpenNotebookDetail(notebook);
                }
              }}
              toggle={
                hasChildren
                  ? {
                      expanded: isExpanded,
                      title: `${isExpanded ? 'Collapse' : 'Expand'} ${notebook.name}`,
                      icon: <ChevronIcon />,
                      onClick: () => {
                        setCollapsedNotebookIds((current) => {
                          const next = new Set(current);

                          if (next.has(notebook.id)) {
                            next.delete(notebook.id);
                          } else {
                            next.add(notebook.id);
                          }

                          return next;
                        });
                      },
                    }
                  : undefined
              }
              action={
                onOpenNotebookDetail === undefined
                  ? undefined
                  : {
                      label: 'Detail',
                      title: `Show details for ${notebook.name}`,
                      onClick: () => onOpenNotebookDetail(notebook),
                    }
              }
            />
          );
        },
      )}

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
          >
            <ChevronIcon />
          </button>
        }
      />

      {expandedSections.status &&
        NOTE_STATUSES.map((status) => {
          const statusSelection = selectionForStatus(status);

          return (
            <NavigationRow
              key={status}
              label={STATUS_LABELS[status]}
              icon={
                <span
                  className={[
                    'navigation-status',
                    `navigation-status--${status}`,
                  ].join(' ')}
                />
              }
              count={noteCountByStatus.get(status) ?? 0}
              depth={1}
              selected={isSelected(statusSelection.id)}
              onClick={() => onSelectionChange(statusSelection)}
            />
          );
        })}

      <NavigationHeader
        title="Tags"
        actions={
          <>
            <button
              type="button"
              className="navigation-icon-button"
              aria-label="Search tags"
              title="Search tags"
              aria-pressed={isTagSearchVisible}
              onClick={() => setIsTagSearchVisible((current) => !current)}
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
            >
              <ChevronIcon />
            </button>
          </>
        }
      />

      {isTagSearchVisible && (
        <div className="navigation-inline-control">
          <input
            aria-label="Filter tags"
            value={tagQuery}
            onChange={(event) => setTagQuery(event.target.value)}
            placeholder="Filter tags"
          />
        </div>
      )}

      {expandedSections.tags &&
        visibleTags.map((tag) => {
          const tagColor = colorForTag(tag.name);
          const tagSelection = selectionForTag(tag.name);

          return (
            <NavigationRow
              key={tag.name}
              label={tag.name}
              icon={
                <span
                  className="navigation-tag-dot"
                  style={
                    {
                      '--tag-color': tagColorHex[tagColor],
                    } as CSSProperties
                  }
                />
              }
              count={tag.count}
              depth={1}
              selected={isSelected(tagSelection.id)}
              onClick={() => onSelectionChange(tagSelection)}
            />
          );
        })}

      <NavigationRow
        label={navigationDestinations.trash.label}
        icon={<TrashIcon />}
        selected={isSelected(navigationDestinations.trash.id)}
        onClick={() => onSelectionChange(navigationDestinations.trash)}
      />

      {contextMenu !== null && (
        <>
          <button
            type="button"
            className="navigation-context-menu__backdrop"
            aria-label="Close notebook menu"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="navigation-context-menu"
            role="menu"
            aria-label={`${contextMenu.notebook.name} notebook actions`}
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setSubnotebookError(null);
                setSubnotebookParent(contextMenu.notebook);
                setContextMenu(null);
              }}
            >
              New Sub Notebook…
            </button>
            {onOpenNotebookDetail !== undefined && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onOpenNotebookDetail(contextMenu.notebook);
                  setContextMenu(null);
                }}
              >
                Open Detail
              </button>
            )}
            {contextMenu.notebook.id !== 'inbox' &&
              onDeleteNotebook !== undefined && (
                <button
                  type="button"
                  role="menuitem"
                  className="navigation-context-menu__delete"
                  onClick={() => void deleteNotebook(contextMenu.notebook)}
                >
                  Delete Notebook…
                </button>
              )}
          </div>
        </>
      )}

      {subnotebookParent !== null && (
        <div className="navigation-dialog-backdrop" role="presentation">
          <button
            type="button"
            className="navigation-dialog__dismiss"
            aria-label="Cancel creating subnotebook"
            onClick={closeSubnotebookDialog}
          />
          <form
            className="navigation-dialog"
            aria-label={`Create subnotebook in ${subnotebookParent.name}`}
            onSubmit={submitSubnotebook}
          >
            <h2>New subnotebook in {subnotebookParent.name}</h2>
            <label>
              Name
              <input
                aria-label={`New subnotebook in ${subnotebookParent.name}`}
                value={subnotebookName}
                onChange={(event) => setSubnotebookName(event.target.value)}
                placeholder="Subnotebook name"
              />
            </label>
            <label>
              Icon
              <select
                aria-label={`Icon for new subnotebook in ${subnotebookParent.name}`}
                value={subnotebookIcon ?? 'auto'}
                onChange={(event) =>
                  setSubnotebookIcon(
                    event.target.value === 'auto'
                      ? undefined
                      : (event.target.value as NotebookIconName),
                  )
                }
              >
                <option value="auto">Auto icon</option>
                {NOTEBOOK_ICON_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {subnotebookError !== null && (
              <p className="navigation-inline-error" role="alert">
                {subnotebookError}
              </p>
            )}
            <div className="navigation-dialog__actions">
              <button type="button" onClick={closeSubnotebookDialog}>
                Cancel
              </button>
              <button type="submit">Create</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

const countBy = <T,>(
  values: readonly T[],
  getKey: (value: T) => string,
): Map<string, number> => {
  const counts = new Map<string, number>();

  for (const value of values) {
    const key = getKey(value);

    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
};

const includesNormalized = (value: string, query: string): boolean =>
  value.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
