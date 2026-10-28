import { Fragment, useMemo, useState, type CSSProperties } from 'react';

import {
  NOTE_STATUSES,
  type Notebook,
  type NoteDocument,
  type NoteStatus,
} from '../../../../shared/documents/document.types';
import { colorForTag, tagColorHex } from '../../notes/model/notePresentation';

import type {
  NavigationSectionId,
  NavigationSectionsState,
  NavigationSelection,
} from '../model/navigation.types';
import {
  selectionForNotebookDetail,
  selectionForNotebook,
  selectionForNotebookStatus,
  selectionForNotebookTag,
  STATUS_LABELS,
} from '../model/navigation.selections';
import {
  buildNotebookTreeRows,
  descendantNotebookIds,
  notebookBreadcrumbs,
} from '../model/notebookTree';

import {
  ChevronIcon,
  LibraryIcon,
  NotesIcon,
  SearchIcon,
} from './NavigationIcons';
import { NavigationHeader } from './NavigationSectionHeader';
import { NavigationNotebookIcon } from './NavigationNotebookIcon';
import { NavigationRow } from './NavigationRow';

type NavigationNotebookDetailViewProps = {
  notebook: Notebook;
  notebooks: readonly Notebook[];
  documents: readonly NoteDocument[];
  selection: NavigationSelection;
  expandedSections: NavigationSectionsState;
  onSelectionChange: (selection: NavigationSelection) => void;
  onToggleSection: (section: NavigationSectionId) => void;
  onOpenNotebookDetail: (notebook: Notebook) => void;
  onEditNotebook?: (notebook: Notebook) => void;
  onExit: () => void;
};

/**
 * A focused projection of one persisted notebook. Counts and destinations
 * deliberately derive from the scoped documents, so this view remains useful
 * as the local store changes instead of relying on a sample workspace tree.
 */
export function NavigationNotebookDetailView({
  notebook,
  notebooks,
  documents,
  selection,
  expandedSections,
  onSelectionChange,
  onToggleSection,
  onOpenNotebookDetail,
  onEditNotebook,
  onExit,
}: NavigationNotebookDetailViewProps) {
  const [tagQuery, setTagQuery] = useState('');
  const [isTagSearchVisible, setIsTagSearchVisible] = useState(false);
  const scopedNotebookIds = useMemo(
    () => descendantNotebookIds(notebooks, notebook.id),
    [notebooks, notebook.id],
  );
  const scopedDocuments = useMemo(
    () =>
      documents.filter((document) =>
        scopedNotebookIds.has(document.notebookId),
      ),
    [documents, scopedNotebookIds],
  );
  const breadcrumbs = useMemo(
    () => notebookBreadcrumbs(notebooks, notebook.id),
    [notebooks, notebook.id],
  );
  const ancestorBreadcrumbs = breadcrumbs.slice(0, -1);
  const childNotebookRows = useMemo(() => {
    const descendants = descendantNotebookIds(notebooks, notebook.id);
    const childNotebooks = notebooks.filter(
      (candidate) =>
        candidate.id !== notebook.id && descendants.has(candidate.id),
    );
    const directNoteCounts = countBy(
      documents,
      (document) => document.notebookId,
    );

    return buildNotebookTreeRows(childNotebooks, directNoteCounts, '');
  }, [documents, notebook.id, notebooks]);
  const countsByStatus = useMemo(
    () => countBy(scopedDocuments, (document) => document.status),
    [scopedDocuments],
  );
  const tags = useMemo(
    () => tagsForDocuments(scopedDocuments, tagQuery),
    [scopedDocuments, tagQuery],
  );
  const allNotesSelection = selectionForNotebookDetail(notebook);
  const isSelected = (id: string) => selection.id === id;

  return (
    <section
      className="navigation-notebook-detail"
      aria-label={`${notebook.name} notebook details`}
    >
      <header className="navigation-notebook-detail__header">
        <div
          className="navigation-notebook-detail__breadcrumb"
          aria-label="Notebook breadcrumb"
        >
          <button
            type="button"
            className="navigation-notebook-detail__back"
            aria-label="Back to notebook library"
            title="Back to notebook library"
            onClick={onExit}
          >
            <LibraryIcon />
          </button>

          {ancestorBreadcrumbs.map((ancestor) => (
            <Fragment key={ancestor.id}>
              <span
                aria-hidden="true"
                className="navigation-notebook-detail__separator"
              >
                <ChevronIcon />
              </span>
              <button
                type="button"
                className="navigation-notebook-detail__breadcrumb-link"
                aria-label={`Open ${ancestor.name} notebook detail`}
                onClick={() => onOpenNotebookDetail(ancestor)}
              >
                <NavigationNotebookIcon notebook={ancestor} />
                <span>{ancestor.name}</span>
              </button>
            </Fragment>
          ))}

          <span
            aria-hidden="true"
            className="navigation-notebook-detail__separator"
          >
            <ChevronIcon />
          </span>

          {ancestorBreadcrumbs.length === 0 ? (
            <h2 className="navigation-notebook-detail__root-title">
              <NavigationNotebookIcon notebook={notebook} />
              <span>{notebook.name}</span>
            </h2>
          ) : null}
        </div>

        {ancestorBreadcrumbs.length > 0 ? (
          <h2 className="navigation-notebook-detail__title">
            <NavigationNotebookIcon notebook={notebook} />
            <span>{notebook.name}</span>
          </h2>
        ) : null}

        {notebook.id !== 'inbox' && onEditNotebook !== undefined && (
          <button
            type="button"
            className="navigation-notebook-detail__edit"
            aria-label={`Edit ${notebook.name} notebook`}
            onClick={() => onEditNotebook(notebook)}
          >
            Edit
          </button>
        )}
      </header>

      <NavigationRow
        label="All Notes"
        icon={<NotesIcon />}
        count={scopedDocuments.length}
        selected={isSelected(allNotesSelection.id)}
        onClick={() => onSelectionChange(allNotesSelection)}
      />

      {childNotebookRows.length > 0 && <NavigationHeader title="Notebooks" />}

      {childNotebookRows.map(({ notebook: child, depth, noteCount }) => {
        const childSelection = selectionForNotebook(child);

        return (
          <NavigationRow
            key={child.id}
            label={child.name}
            icon={<NavigationNotebookIcon notebook={child} />}
            count={noteCount}
            depth={depth + 1}
            selected={isSelected(childSelection.id)}
            onClick={() => onSelectionChange(childSelection)}
            action={{
              label: 'Detail',
              title: `Show details for ${child.name}`,
              onClick: () => onOpenNotebookDetail(child),
            }}
          />
        );
      })}

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
          const statusSelection = selectionForNotebookStatus(
            notebook.id,
            status,
          );

          return (
            <NavigationRow
              key={status}
              label={STATUS_LABELS[status]}
              icon={<StatusIcon status={status} />}
              count={countsByStatus.get(status) ?? 0}
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
            aria-label="Filter notebook tags"
            value={tagQuery}
            onChange={(event) => setTagQuery(event.target.value)}
            placeholder="Filter tags"
          />
        </div>
      )}

      {expandedSections.tags &&
        tags.map((tag) => {
          const tagSelection = selectionForNotebookTag(notebook.id, tag.name);
          const tagColor = colorForTag(tag.name);

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
    </section>
  );
}

function StatusIcon({ status }: { status: NoteStatus }) {
  return (
    <span
      className={['navigation-status', `navigation-status--${status}`].join(
        ' ',
      )}
    />
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

const tagsForDocuments = (
  documents: readonly NoteDocument[],
  query: string,
): readonly { name: string; count: number }[] => {
  const counts = new Map<string, number>();

  for (const document of documents) {
    for (const tag of document.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  const normalizedQuery = query.trim().toLocaleLowerCase();

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .filter((tag) => tag.name.toLocaleLowerCase().includes(normalizedQuery))
    .sort((left, right) => left.name.localeCompare(right.name));
};
