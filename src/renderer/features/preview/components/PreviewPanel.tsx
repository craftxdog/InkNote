import { useRef } from 'react';

import type {
  NoteDocument,
  NoteId,
} from '../../../../shared/documents/document.types';

import { MarkdownPreview } from './MarkdownPreview';

import '../styles/preview.css';

type PreviewPanelProps = {
  document: NoteDocument | null;
  referenceDocuments?: readonly NoteDocument[];
  body?: string;
  isLoading: boolean;
  error: unknown;
  onOpenReference?: (documentId: NoteId) => void;
  onSourceLineChange?: (sourceLine: number) => void;
  sourceLineToReveal?: number;
};

export const PreviewPanel = ({
  document,
  referenceDocuments = [],
  body,
  isLoading,
  error,
  onOpenReference,
  onSourceLineChange,
  sourceLineToReveal,
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
      <div
        className="preview-panel__header"
        aria-label={error === null ? undefined : 'Preview may be stale'}
      />
      <div
        ref={previewScrollRef}
        className="panel-content preview-panel__content"
      >
        <MarkdownPreview
          markdown={body ?? document.body}
          referenceDocuments={referenceDocuments}
          onOpenReference={onOpenReference}
          onSourceLineChange={onSourceLineChange}
          sourceLineToReveal={sourceLineToReveal}
          scrollContainerRef={previewScrollRef}
        />
      </div>
    </div>
  );
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
