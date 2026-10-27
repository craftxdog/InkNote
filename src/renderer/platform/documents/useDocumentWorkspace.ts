import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction,
} from 'react';

import type { DocumentApi } from '../../../shared/bridge';
import {
  INITIAL_DOCUMENT_REVISION,
  createArchiveMutation,
  createCreateDocumentMutation,
  createGeneratedNotebookId,
  createGeneratedNoteId,
  createGeneratedTagId,
  createMutationId,
  createRestoreMutation,
  createUpdateOrganizationMutation,
  createUpdatePinnedMutation,
  type DocumentMutation,
  type DeleteTagResult,
  type Notebook,
  type NotebookIconName,
  type NoteDocument,
  type NoteId,
  type NoteStatusValue,
  type TagColor,
  type TagId,
  type TagSummary,
  type UpdateNotebookInput,
} from '../../../shared/documents/document.types';
import {
  DocumentSession,
  type DocumentSessionSnapshot,
} from './DocumentSession';
import { IpcDocumentRepository } from './IpcDocumentRepository';
import {
  runNoteBatchOperation,
  type NoteBatchOperationResult,
} from './noteBatchOperation';

export type DocumentWorkspaceState = Readonly<{
  documents: readonly NoteDocument[];
  archivedDocuments: readonly NoteDocument[];
  notebooks: readonly Notebook[];
  tags: readonly TagSummary[];
  session: DocumentSessionSnapshot;
  isListLoading: boolean;
  lastError: unknown;
}>;

export type NotebookUpdateRequest = Readonly<
  Pick<UpdateNotebookInput, 'id' | 'name' | 'parentId' | 'icon'>
>;

export type TagCreateRequest = Readonly<{
  name: string;
  color: TagColor;
}>;

export type TagUpdateRequest = Readonly<{
  id: TagId;
  name: string;
  color: TagColor;
}>;

export type DocumentWorkspaceActions = Readonly<{
  refresh(): Promise<void>;
  open(id: NoteId): Promise<NoteDocument>;
  apply(mutation: DocumentMutation): Promise<NoteDocument>;
  create(
    title?: string,
    body?: string,
    options?: Readonly<{
      notebookId?: string;
      status?: NoteStatusValue;
      tags?: readonly string[];
    }>,
  ): Promise<NoteDocument>;
  createNotebook(
    name: string,
    parentId?: string | null,
    icon?: NotebookIconName,
  ): Promise<Notebook>;
  updateNotebook(input: NotebookUpdateRequest): Promise<Notebook>;
  deleteNotebook(notebookId: string): Promise<void>;
  createTag(input: TagCreateRequest): Promise<TagSummary>;
  updateTag(input: TagUpdateRequest): Promise<TagSummary>;
  deleteTag(tagId: TagId): Promise<DeleteTagResult>;
  move(document: NoteDocument, notebookId: string): Promise<NoteDocument>;
  moveMany(
    documents: readonly NoteDocument[],
    notebookId: string,
  ): Promise<NoteBatchOperationResult>;
  setPinned(document: NoteDocument, pinned: boolean): Promise<NoteDocument>;
  archive(document: NoteDocument): Promise<NoteDocument>;
  archiveMany(
    documents: readonly NoteDocument[],
  ): Promise<NoteBatchOperationResult>;
  restore(document: NoteDocument, notebookId?: string): Promise<NoteDocument>;
  restoreMany(
    documents: readonly NoteDocument[],
    notebookId: string,
  ): Promise<NoteBatchOperationResult>;
  deletePermanently(documents: readonly NoteDocument[]): Promise<void>;
  duplicate(document: NoteDocument, notebookId: string): Promise<NoteDocument>;
}>;

/**
 * React orchestration over the renderer document ports. It owns a single
 * selected note for the editor and preview, while all durable state continues
 * to live behind the preload-backed repository.
 */
export const useDocumentWorkspace = (
  api: DocumentApi,
): DocumentWorkspaceState & DocumentWorkspaceActions => {
  const repository = useMemo(() => new IpcDocumentRepository(api), [api]);
  const session = useMemo(() => new DocumentSession(repository), [repository]);
  const subscribe = useCallback(
    (listener: () => void) => session.subscribe(listener).unsubscribe,
    [session],
  );
  const getSnapshot = useCallback(() => session.getSnapshot(), [session]);
  const sessionSnapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot,
  );
  const [documents, setDocuments] = useState<readonly NoteDocument[]>([]);
  const [archivedDocuments, setArchivedDocuments] = useState<
    readonly NoteDocument[]
  >([]);
  const [notebooks, setNotebooks] = useState<readonly Notebook[]>([]);
  const [tags, setTags] = useState<readonly TagSummary[]>([]);
  const [isListLoading, setIsListLoading] = useState(true);
  const [lastError, setLastError] = useState<unknown>(null);

  const upsertDocument = useCallback(
    (
      setCollection: Dispatch<SetStateAction<readonly NoteDocument[]>>,
      document: NoteDocument,
      compare: (left: NoteDocument, right: NoteDocument) => number,
    ): void => {
      setCollection((current) => {
        const withoutDocument = current.filter(
          (item) => item.id !== document.id,
        );

        return Object.freeze([document, ...withoutDocument].sort(compare));
      });
    },
    [],
  );

  const refresh = useCallback(async (): Promise<void> => {
    setIsListLoading(true);

    try {
      const [nextDocuments, nextArchivedDocuments, nextNotebooks, nextTags] =
        await Promise.all([
          repository.listActive(),
          repository.listArchived(),
          repository.listNotebooks(),
          repository.listTags(),
        ]);

      setDocuments(nextDocuments);
      setArchivedDocuments(nextArchivedDocuments);
      setNotebooks(nextNotebooks);
      setTags(nextTags);
      setLastError(null);

      if (
        session.getSnapshot().selectedDocumentId === null &&
        nextDocuments[0] !== undefined
      ) {
        await session.open(nextDocuments[0].id);
      }
    } catch (error) {
      setLastError(error);
      throw error;
    } finally {
      setIsListLoading(false);
    }
  }, [repository, session]);

  const refreshAfterTagLifecycleChange =
    useCallback(async (): Promise<void> => {
      const selectedDocumentId = session.getSnapshot().selectedDocumentId;

      await refresh();

      if (selectedDocumentId !== null) {
        await session.open(selectedDocumentId);
      }
    }, [refresh, session]);

  useEffect(() => {
    const loadTimer = globalThis.setTimeout(() => {
      void refresh().catch(() => undefined);
    }, 0);

    return () => {
      globalThis.clearTimeout(loadTimer);
    };
  }, [refresh]);

  const open = useCallback(
    async (id: NoteId): Promise<NoteDocument> => {
      try {
        const document = await session.open(id);

        setLastError(null);

        return document;
      } catch (error) {
        setLastError(error);
        throw error;
      }
    },
    [session],
  );

  const apply = useCallback(
    async (mutation: DocumentMutation): Promise<NoteDocument> => {
      try {
        const document = await session.apply(mutation);

        if (document.deletedAt === null) {
          upsertDocument(setDocuments, document, compareActiveDocuments);
          setArchivedDocuments((current) =>
            Object.freeze(current.filter((item) => item.id !== document.id)),
          );
        } else {
          upsertDocument(
            setArchivedDocuments,
            document,
            compareArchivedDocuments,
          );
          setDocuments((current) =>
            Object.freeze(current.filter((item) => item.id !== document.id)),
          );
        }

        if (mutation.kind === 'update-tags') {
          const nextTags = await repository.listTags();

          setTags(nextTags);
        }

        setLastError(null);

        return document;
      } catch (error) {
        setLastError(error);
        throw error;
      }
    },
    [repository, session, upsertDocument],
  );

  const create = useCallback(
    async (
      title = 'Untitled',
      body = '',
      options: Readonly<{
        notebookId?: string;
        status?: NoteStatusValue;
        tags?: readonly string[];
      }> = {},
    ): Promise<NoteDocument> => {
      const occurredAt = new Date().toISOString();
      const documentId = createGeneratedNoteId(createRuntimeId());
      const document = await apply(
        createCreateDocumentMutation({
          id: createMutationId(createRuntimeId()),
          documentId,
          baseRevision: INITIAL_DOCUMENT_REVISION,
          source: 'editor',
          title,
          body,
          ...(options.notebookId === undefined
            ? {}
            : { notebookId: options.notebookId }),
          ...(options.status === undefined ? {} : { status: options.status }),
          ...(options.tags === undefined ? {} : { tags: options.tags }),
          occurredAt,
        }),
      );

      await open(document.id);

      return document;
    },
    [apply, open],
  );

  const createNotebook = useCallback(
    async (
      name: string,
      parentId: string | null = null,
      icon?: NotebookIconName,
    ): Promise<Notebook> => {
      const occurredAt = new Date().toISOString();
      const notebook = await repository.createNotebook({
        id: createGeneratedNotebookId(createRuntimeId()),
        name,
        parentId,
        icon,
        occurredAt,
      });

      setNotebooks((current) =>
        Object.freeze(
          [...current, notebook].sort((left, right) =>
            left.name.localeCompare(right.name),
          ),
        ),
      );
      setLastError(null);

      return notebook;
    },
    [repository],
  );

  const updateNotebook = useCallback(
    async (input: NotebookUpdateRequest): Promise<Notebook> => {
      try {
        const notebook = await repository.updateNotebook({
          ...input,
          occurredAt: new Date().toISOString(),
        });

        setNotebooks((current) =>
          Object.freeze(
            current.map((candidate) =>
              candidate.id === notebook.id ? notebook : candidate,
            ),
          ),
        );
        setLastError(null);

        return notebook;
      } catch (error) {
        setLastError(error);
        throw error;
      }
    },
    [repository],
  );

  const deleteNotebook = useCallback(
    async (notebookId: string): Promise<void> => {
      const deletion = await repository.deleteNotebook({
        id: notebookId,
        occurredAt: new Date().toISOString(),
      });
      const selectedDocumentId = session.getSnapshot().selectedDocumentId;

      if (
        selectedDocumentId !== null &&
        deletion.archivedNoteIds.includes(selectedDocumentId)
      ) {
        session.clear();
      }

      await refresh();
      setLastError(null);
    },
    [refresh, repository, session],
  );

  const createTag = useCallback(
    async (input: TagCreateRequest): Promise<TagSummary> => {
      try {
        const tag = await repository.createTag({
          id: createGeneratedTagId(createRuntimeId()),
          name: input.name,
          color: input.color,
          occurredAt: new Date().toISOString(),
        });

        await refreshAfterTagLifecycleChange();
        setLastError(null);

        return tag;
      } catch (error) {
        setLastError(error);
        throw error;
      }
    },
    [refreshAfterTagLifecycleChange, repository],
  );

  const updateTag = useCallback(
    async (input: TagUpdateRequest): Promise<TagSummary> => {
      try {
        const tag = await repository.updateTag({
          ...input,
          occurredAt: new Date().toISOString(),
        });

        await refreshAfterTagLifecycleChange();
        setLastError(null);

        return tag;
      } catch (error) {
        setLastError(error);
        throw error;
      }
    },
    [refreshAfterTagLifecycleChange, repository],
  );

  const deleteTag = useCallback(
    async (tagId: TagId): Promise<DeleteTagResult> => {
      try {
        const result = await repository.deleteTag({
          id: tagId,
          occurredAt: new Date().toISOString(),
        });

        await refreshAfterTagLifecycleChange();
        setLastError(null);

        return result;
      } catch (error) {
        setLastError(error);
        throw error;
      }
    },
    [refreshAfterTagLifecycleChange, repository],
  );

  const move = useCallback(
    async (document: NoteDocument, notebookId: string): Promise<NoteDocument> =>
      apply(
        createUpdateOrganizationMutation({
          id: createMutationId(createRuntimeId()),
          documentId: document.id,
          baseRevision: document.revision,
          source: 'command',
          notebookId,
          status: document.status,
          occurredAt: new Date().toISOString(),
        }),
      ),
    [apply],
  );

  const moveMany = useCallback(
    async (
      notes: readonly NoteDocument[],
      notebookId: string,
    ): Promise<NoteBatchOperationResult> => {
      const notesById = new Map(notes.map((note) => [note.id, note]));

      return runNoteBatchOperation(
        notes.map((note) => note.id),
        async (noteId) => {
          const note = notesById.get(noteId);

          if (note === undefined) {
            throw new Error('The selected note is no longer available.');
          }

          await move(note, notebookId);
        },
      );
    },
    [move],
  );

  const setPinned = useCallback(
    async (document: NoteDocument, pinned: boolean): Promise<NoteDocument> =>
      apply(
        createUpdatePinnedMutation({
          id: createMutationId(createRuntimeId()),
          documentId: document.id,
          baseRevision: document.revision,
          source: 'command',
          pinned,
          occurredAt: new Date().toISOString(),
        }),
      ),
    [apply],
  );

  const archive = useCallback(
    async (document: NoteDocument): Promise<NoteDocument> => {
      const archived = await apply(
        createArchiveMutation({
          id: createMutationId(createRuntimeId()),
          documentId: document.id,
          baseRevision: document.revision,
          source: 'command',
          occurredAt: new Date().toISOString(),
        }),
      );

      if (document.id === session.getSnapshot().selectedDocumentId) {
        const nextDocument = documents.find((item) => item.id !== document.id);

        if (nextDocument === undefined) {
          session.clear();
        } else {
          await open(nextDocument.id);
        }
      }

      return archived;
    },
    [apply, documents, open, session],
  );

  const restore = useCallback(
    async (
      document: NoteDocument,
      notebookId?: string,
    ): Promise<NoteDocument> => {
      const restored = await apply(
        createRestoreMutation({
          id: createMutationId(createRuntimeId()),
          documentId: document.id,
          baseRevision: document.revision,
          source: 'command',
          ...(notebookId === undefined ? {} : { notebookId }),
          occurredAt: new Date().toISOString(),
        }),
      );

      await open(restored.id);

      return restored;
    },
    [apply, open],
  );

  const archiveMany = useCallback(
    async (
      notes: readonly NoteDocument[],
    ): Promise<NoteBatchOperationResult> => {
      const notesById = new Map(notes.map((note) => [note.id, note]));

      return runNoteBatchOperation(
        notes.map((note) => note.id),
        async (noteId) => {
          const note = notesById.get(noteId);

          if (note === undefined) {
            throw new Error('The selected note is no longer available.');
          }

          await archive(note);
        },
      );
    },
    [archive],
  );

  const restoreMany = useCallback(
    async (
      notes: readonly NoteDocument[],
      notebookId: string,
    ): Promise<NoteBatchOperationResult> => {
      const notesById = new Map(notes.map((note) => [note.id, note]));

      return runNoteBatchOperation(
        notes.map((note) => note.id),
        async (noteId) => {
          const note = notesById.get(noteId);

          if (note === undefined) {
            throw new Error('The selected note is no longer available.');
          }

          await restore(note, notebookId);
        },
      );
    },
    [restore],
  );

  const deletePermanently = useCallback(
    async (notes: readonly NoteDocument[]): Promise<void> => {
      if (notes.length === 0) {
        return;
      }

      try {
        const result = await repository.deletePermanently({
          noteIds: notes.map((note) => note.id),
        });
        const deletedIds = new Set(result.deletedNoteIds);

        setDocuments((current) =>
          Object.freeze(current.filter((note) => !deletedIds.has(note.id))),
        );
        setArchivedDocuments((current) =>
          Object.freeze(current.filter((note) => !deletedIds.has(note.id))),
        );

        const selectedDocumentId = session.getSnapshot().selectedDocumentId;

        if (selectedDocumentId !== null && deletedIds.has(selectedDocumentId)) {
          session.clear();
        }

        setLastError(null);
      } catch (error) {
        setLastError(error);
        throw error;
      }
    },
    [repository, session],
  );

  const duplicate = useCallback(
    async (document: NoteDocument, notebookId: string): Promise<NoteDocument> =>
      create(document.title, document.body, {
        notebookId,
        tags: document.tags,
      }),
    [create],
  );

  return Object.freeze({
    documents,
    archivedDocuments,
    notebooks,
    tags,
    session: sessionSnapshot,
    isListLoading,
    lastError,
    refresh,
    open,
    apply,
    create,
    createNotebook,
    updateNotebook,
    deleteNotebook,
    createTag,
    updateTag,
    deleteTag,
    move,
    moveMany,
    setPinned,
    archive,
    archiveMany,
    restore,
    restoreMany,
    deletePermanently,
    duplicate,
  });
};

const createRuntimeId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const compareActiveDocuments = (
  left: NoteDocument,
  right: NoteDocument,
): number => {
  if (left.pinned !== right.pinned) {
    return left.pinned ? -1 : 1;
  }

  const byUpdatedAt = right.updatedAt.localeCompare(left.updatedAt);

  return byUpdatedAt === 0 ? left.id.localeCompare(right.id) : byUpdatedAt;
};

const compareArchivedDocuments = (
  left: NoteDocument,
  right: NoteDocument,
): number => {
  const byDeletedAt = (right.deletedAt ?? '').localeCompare(
    left.deletedAt ?? '',
  );

  return byDeletedAt === 0 ? left.id.localeCompare(right.id) : byDeletedAt;
};
