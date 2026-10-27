import { useRef } from 'react';

import type {
  Notebook,
  NoteDocument,
  NoteId,
  NoteStatusValue,
} from '../../../../shared/documents/document.types';
import { INBOX_NOTEBOOK_ID } from '../../../../shared/documents/document.types';

import type { SourceScrollPosition } from '../../markdown/model/scrollSynchronization';

import { MarkdownPreview } from './MarkdownPreview';

import '../styles/preview.css';

type PreviewPanelProps = {
  document: NoteDocument | null;
  notebooks?: readonly Notebook[];
  isPreviewOnly?: boolean;
  referenceDocuments?: readonly NoteDocument[];
  body?: string;
  isLoading: boolean;
  error: unknown;
  onOpenReference?: (documentId: NoteId) => void;
  onSourceLineChange?: (position: SourceScrollPosition) => void;
  sourceScrollPositionToReveal?: SourceScrollPosition;
};

export const PreviewPanel = ({
  document,
  notebooks = [],
  isPreviewOnly = false,
  referenceDocuments = [],
  body,
  isLoading,
  error,
  onOpenReference,
  onSourceLineChange,
  sourceScrollPositionToReveal,
}: PreviewPanelProps) => {
  const previewScrollRef = useRef<HTMLDivElement>(null);

  if (isLoading) {
    return <PanelStatus message="Loading preview…" />;
  }

  if (document === null) {
    return <PanelStatus message="Select or create a note to preview it." />;
  }

  return (
    <div className="panel preview-panel">
      <header
        className={[
          'preview-panel__header',
          isPreviewOnly ? 'preview-panel__header--identity' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-label={
          isPreviewOnly
            ? 'Preview note details'
            : error === null
              ? undefined
              : 'Preview may be stale'
        }
      >
        {isPreviewOnly && (
          <PreviewNoteIdentity document={document} notebooks={notebooks} />
        )}
        {error === null ? null : (
          <output className="preview-panel__stale-status">
            Preview may be stale
          </output>
        )}
      </header>
      <div
        ref={previewScrollRef}
        className="panel-content preview-panel__content"
      >
        <MarkdownPreview
          markdown={body ?? document.body}
          referenceDocuments={referenceDocuments}
          onOpenReference={onOpenReference}
          onSourceLineChange={onSourceLineChange}
          sourceScrollPositionToReveal={sourceScrollPositionToReveal}
          scrollContainerRef={previewScrollRef}
        />
      </div>
    </div>
  );
};

const PreviewNoteIdentity = ({
  document,
  notebooks,
}: Readonly<{
  document: NoteDocument;
  notebooks: readonly Notebook[];
}>) => {
  const notebookName =
    notebooks.find((notebook) => notebook.id === document.notebookId)?.name ??
    (document.notebookId === INBOX_NOTEBOOK_ID ? 'Inbox' : document.notebookId);
  const title = document.title.trim() || 'Untitled note';

  return (
    <div className="preview-panel__identity">
      <h2 className="preview-panel__identity-title">{title}</h2>
      <dl className="preview-panel__identity-metadata">
        <div>
          <dt>Notebook</dt>
          <dd>{notebookName}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{statusLabelFor(document.status)}</dd>
        </div>
      </dl>
      {document.tags.length === 0 ? null : (
        <ul className="preview-panel__identity-tags" aria-label="Tags">
          {document.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

const statusLabelFor = (status: NoteStatusValue): string => {
  switch (status) {
    case 'none':
      return 'No status';
    case 'active':
      return 'Active';
    case 'on-hold':
      return 'On Hold';
    case 'completed':
      return 'Completed';
    case 'dropped':
      return 'Dropped';
  }
};

const PanelStatus = ({ message }: Readonly<{ message: string }>) => (
  <div className="panel preview-panel">
    <div className="panel-content">
      <div className="placeholder">
        <strong>Markdown Preview</strong>
        <span>{message}</span>
      </div>
    </div>
  </div>
);
