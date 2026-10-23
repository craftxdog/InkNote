import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';

import {
  createMutationId,
  createReplaceBodyMutation,
  createUpdateOrganizationMutation,
  createUpdateTagsMutation,
  createUpdateTitleMutation,
  type DocumentMutation,
  type Notebook,
  type NoteStatus,
  type NoteDocument,
  type NoteId,
} from '../../../../shared/documents/document.types';
import { colorForTag } from '../../notes/model/notePresentation';

import { MarkdownEditor } from './MarkdownEditor';

import '../styles/editor.css';

type EditorPanelProps = {
  document: NoteDocument | null;
  referenceDocuments?: readonly NoteDocument[];
  notebooks: readonly Notebook[];
  isLoading: boolean;
  error: unknown;
  onSaveDocument: (mutation: DocumentMutation) => Promise<NoteDocument>;
  onArchiveDocument?: (document: NoteDocument) => Promise<unknown>;
  onRestoreDocument?: (document: NoteDocument) => Promise<unknown>;
  onBodyDraftChange?: (documentId: NoteId, body: string) => void;
  onBodyDraftPersisted?: (documentId: NoteId, body: string) => void;
  onSourceLineChange?: (sourceLine: number) => void;
  sourceLineToReveal?: number;
};
const SAVE_DEBOUNCE_MS = 350;

type PendingBodySave = Readonly<{
  document: NoteDocument;
  body: string;
}>;

type PendingTitleSave = Readonly<{
  document: NoteDocument;
  title: string;
}>;

type PendingTagsSave = Readonly<{
  document: NoteDocument;
  tags: readonly string[];
}>;

type PendingOrganizationSave = Readonly<{
  document: NoteDocument;
  notebookId: string;
  status: NoteStatus;
}>;

type PendingSave =
  | PendingBodySave
  | PendingTitleSave
  | PendingTagsSave
  | PendingOrganizationSave;

type LocalDraft = Readonly<{
  documentId: NoteId;
  body: string;
}>;

type SaveError = Readonly<{
  documentId: NoteId;
  error: unknown;
}>;

type LocalTagsDraft = Readonly<{
  documentId: NoteId;
  tags: readonly string[];
}>;

type LocalOrganizationDraft = Readonly<{
  documentId: NoteId;
  notebookId: string;
  status: NoteStatus;
}>;

export const EditorPanel = ({
  document,
  referenceDocuments = [],
  notebooks,
  isLoading,
  error,
  onSaveDocument,
  onArchiveDocument,
  onRestoreDocument,
  onBodyDraftChange,
  onBodyDraftPersisted,
  onSourceLineChange,
  sourceLineToReveal,
}: EditorPanelProps) => {
  const knownDocuments = useRef(new Map<NoteId, NoteDocument>());
  const saveTimer = useRef<ReturnType<typeof globalThis.setTimeout> | null>(
    null,
  );
  const saveQueue = useRef(Promise.resolve());
  const isMounted = useRef(false);
  const [saveError, setSaveError] = useState<SaveError | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState<LocalDraft | null>(null);
  const [titleDraft, setTitleDraft] = useState<Readonly<{
    documentId: NoteId;
    title: string;
  }> | null>(null);
  const [tagsDraft, setTagsDraft] = useState<LocalTagsDraft | null>(null);
  const [organizationDraft, setOrganizationDraft] =
    useState<LocalOrganizationDraft | null>(null);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (document !== null) {
      knownDocuments.current.set(document.id, document);
    }
  }, [document]);

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;

      if (saveTimer.current !== null) {
        globalThis.clearTimeout(saveTimer.current);
      }
    };
  }, []);

  const enqueueSave = useCallback(
    (pendingSave: PendingSave): void => {
      const operation = async (): Promise<void> => {
        const current =
          knownDocuments.current.get(pendingSave.document.id) ??
          pendingSave.document;

        const mutation = createMutation(current, pendingSave);

        if (mutation === null) {
          return;
        }

        if (isMounted.current) {
          setIsSaving(true);
        }

        try {
          const saved = await onSaveDocument(mutation);

          knownDocuments.current.set(saved.id, saved);

          if (isMounted.current) {
            if ('body' in pendingSave) {
              setDraft((currentDraft) =>
                currentDraft?.documentId === saved.id &&
                currentDraft.body === pendingSave.body
                  ? null
                  : currentDraft,
              );
              onBodyDraftPersisted?.(saved.id, saved.body);
            } else if ('title' in pendingSave) {
              setTitleDraft((currentDraft) =>
                currentDraft?.documentId === saved.id &&
                currentDraft.title === pendingSave.title
                  ? null
                  : currentDraft,
              );
            }
            setSaveError(null);
          }
        } catch (nextError) {
          if (isMounted.current) {
            setSaveError({
              documentId: pendingSave.document.id,
              error: nextError,
            });
          }
        } finally {
          if (isMounted.current) {
            setIsSaving(false);
          }
        }
      };

      const nextSave = saveQueue.current.then(operation, operation);

      saveQueue.current = nextSave.then(
        () => undefined,
        () => undefined,
      );
    },
    [onBodyDraftPersisted, onSaveDocument],
  );

  const handleChange = useCallback(
    (body: string): void => {
      if (document === null) {
        return;
      }

      setDraft({ documentId: document.id, body });
      onBodyDraftChange?.(document.id, body);

      if (saveTimer.current !== null) {
        globalThis.clearTimeout(saveTimer.current);
      }

      const pendingSave = { document, body };

      saveTimer.current = globalThis.setTimeout(() => {
        saveTimer.current = null;
        enqueueSave(pendingSave);
      }, SAVE_DEBOUNCE_MS);
    },
    [document, enqueueSave, onBodyDraftChange],
  );

  const handleTitleChange = useCallback(
    (title: string): void => {
      if (document === null) {
        return;
      }

      setTitleDraft({ documentId: document.id, title });
    },
    [document],
  );

  const commitTitle = useCallback((): void => {
    if (document === null || titleDraft?.documentId !== document.id) {
      return;
    }

    const title = titleDraft.title.trim();

    if (title.length === 0) {
      setTitleDraft(null);
      return;
    }

    enqueueSave({ document, title });
  }, [document, enqueueSave, titleDraft]);

  const addTag = useCallback(
    (event: FormEvent<HTMLFormElement>): void => {
      event.preventDefault();

      const tagsToAdd = normalizeTagInput(tagInput);

      if (document === null || tagsToAdd.length === 0) {
        return;
      }

      const currentTags =
        tagsDraft?.documentId === document.id ? tagsDraft.tags : document.tags;
      const knownTags = new Set(
        currentTags.map((currentTag) => currentTag.toLocaleLowerCase()),
      );
      const newTags = tagsToAdd.filter((tag) => !knownTags.has(tag));

      if (newTags.length === 0) {
        setTagInput('');
        return;
      }

      const tags = [...currentTags, ...newTags];

      setTagsDraft({ documentId: document.id, tags });
      enqueueSave({ document, tags });
      setTagInput('');
    },
    [document, enqueueSave, tagInput, tagsDraft],
  );

  const removeTag = useCallback(
    (tag: string): void => {
      if (document === null) {
        return;
      }

      const currentTags =
        tagsDraft?.documentId === document.id ? tagsDraft.tags : document.tags;
      const tags = currentTags.filter((currentTag) => currentTag !== tag);

      setTagsDraft({ documentId: document.id, tags });
      enqueueSave({ document, tags });
    },
    [document, enqueueSave, tagsDraft],
  );

  const saveOrganization = useCallback(
    (
      next: Partial<Pick<PendingOrganizationSave, 'notebookId' | 'status'>>,
    ): void => {
      if (document === null) {
        return;
      }

      const currentOrganization =
        organizationDraft?.documentId === document.id
          ? organizationDraft
          : document;
      const organization = {
        notebookId: next.notebookId ?? currentOrganization.notebookId,
        status: next.status ?? currentOrganization.status,
      };

      setOrganizationDraft({ documentId: document.id, ...organization });
      enqueueSave({
        document,
        ...organization,
      });
    },
    [document, enqueueSave, organizationDraft],
  );

  if (isLoading) {
    return <PanelStatus message="Loading document…" />;
  }

  if (document === null) {
    return <PanelStatus message="Select or create a note to start writing." />;
  }

  if (document.deletedAt !== null) {
    return (
      <div className="panel editor-panel">
        <div className="panel-content editor-panel__archived-state">
          <strong>This note is in Trash</strong>
          <span>Restore it to edit it again.</span>
          {onRestoreDocument !== undefined && (
            <button
              type="button"
              onClick={() => void onRestoreDocument(document)}
            >
              Restore note
            </button>
          )}
        </div>
      </div>
    );
  }

  const draftBody =
    draft?.documentId === document.id ? draft.body : document.body;
  const activeSaveError =
    saveError?.documentId === document.id ? saveError.error : null;
  const draftTitle =
    titleDraft?.documentId === document.id ? titleDraft.title : document.title;
  const visibleTags =
    tagsDraft?.documentId === document.id ? tagsDraft.tags : document.tags;
  const visibleOrganization =
    organizationDraft?.documentId === document.id
      ? organizationDraft
      : document;
  return (
    <div className="panel editor-panel">
      <div className="editor-panel__header">
        <input
          className="editor-panel__title"
          aria-label="Note title"
          value={draftTitle}
          placeholder="Untitled note"
          onChange={(event) => handleTitleChange(event.target.value)}
          onBlur={commitTitle}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur();
            }

            if (event.key === 'Escape') {
              setTitleDraft(null);
              event.currentTarget.blur();
            }
          }}
        />
        <span className="editor-panel__save-status">
          {activeSaveError !== null || error !== null ? (
            <output>Changes could not be saved</output>
          ) : isSaving ? (
            <output>Saving…</output>
          ) : (
            'Vim enabled'
          )}
        </span>
        {onArchiveDocument !== undefined && (
          <button
            type="button"
            className="editor-panel__archive-button"
            aria-label="Move note to Trash"
            title="Move note to Trash"
            onClick={() => void onArchiveDocument(document)}
          >
            Trash
          </button>
        )}
      </div>
      <div className="editor-panel__metadata" aria-label="Note organization">
        <nav className="editor-panel__breadcrumbs" aria-label="Note location">
          <span>All Notes</span>
          <span aria-hidden="true">›</span>
        </nav>
        <label className="editor-panel__metadata-select editor-panel__metadata-select--notebook">
          <span className="sr-only">Notebook</span>
          <select
            aria-label="Notebook"
            value={visibleOrganization.notebookId}
            onChange={(event) =>
              saveOrganization({ notebookId: event.target.value })
            }
          >
            {notebooks.map((notebook) => (
              <option key={notebook.id} value={notebook.id}>
                {notebook.name}
              </option>
            ))}
          </select>
        </label>
        <label
          className={`editor-panel__metadata-select editor-panel__metadata-select--${visibleOrganization.status}`}
        >
          <span className="sr-only">Status</span>
          <select
            aria-label="Status"
            value={visibleOrganization.status}
            onChange={(event) =>
              saveOrganization({ status: event.target.value as NoteStatus })
            }
          >
            <option value="active">Active</option>
            <option value="on-hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="dropped">Dropped</option>
          </select>
        </label>
        <div className="editor-panel__tags" aria-label="Tags">
          {visibleTags.map((tag) => (
            <span
              key={tag}
              className={[
                'editor-panel__tag',
                `editor-panel__tag--${colorForTag(tag)}`,
              ].join(' ')}
            >
              {tag}
              <button
                type="button"
                aria-label={`Remove tag ${tag}`}
                onClick={() => removeTag(tag)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <form onSubmit={addTag} className="editor-panel__tag-form">
          <input
            aria-label="Add tag"
            value={tagInput}
            onChange={(event) => setTagInput(event.target.value)}
            placeholder="Add tag…"
          />
        </form>
      </div>
      <div className="panel-content editor-panel__content">
        <MarkdownEditor
          key={document.id}
          value={draftBody}
          referenceDocuments={referenceDocuments}
          onChange={handleChange}
          onSourceLineChange={onSourceLineChange}
          sourceLineToReveal={sourceLineToReveal}
        />
      </div>
    </div>
  );
};

const PanelStatus = ({ message }: Readonly<{ message: string }>) => (
  <div className="panel editor-panel">
    <div className="panel-content">
      <div className="placeholder">
        <strong>Markdown Editor</strong>
        <span>{message}</span>
      </div>
    </div>
  </div>
);

const createRuntimeMutationId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `mutation-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const normalizeTagInput = (input: string): readonly string[] => [
  ...new Set(
    input
      .split(',')
      .map((tag) => tag.trim().replace(/^#+/, '').toLocaleLowerCase())
      .filter(Boolean),
  ),
];

const createMutation = (
  current: NoteDocument,
  pendingSave: PendingSave,
): DocumentMutation | null => {
  const base = {
    id: createMutationId(createRuntimeMutationId()),
    documentId: current.id,
    baseRevision: current.revision,
    source: 'editor' as const,
    occurredAt: new Date().toISOString(),
  };

  if ('body' in pendingSave) {
    return current.body === pendingSave.body
      ? null
      : createReplaceBodyMutation({ ...base, body: pendingSave.body });
  }

  if ('title' in pendingSave) {
    return current.title === pendingSave.title
      ? null
      : createUpdateTitleMutation({ ...base, title: pendingSave.title });
  }

  if ('tags' in pendingSave) {
    return current.tags.join('\u0000') === pendingSave.tags.join('\u0000')
      ? null
      : createUpdateTagsMutation({ ...base, tags: pendingSave.tags });
  }

  return current.notebookId === pendingSave.notebookId &&
    current.status === pendingSave.status
    ? null
    : createUpdateOrganizationMutation({
        ...base,
        notebookId: pendingSave.notebookId,
        status: pendingSave.status,
      });
};
