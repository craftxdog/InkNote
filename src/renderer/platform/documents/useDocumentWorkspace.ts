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
  createMutationId,
  createRestoreMutation,
  createUpdateOrganizationMutation,
  type DocumentMutation,
  type Notebook,
  type NotebookIconName,
  type NoteDocument,
  type NoteId,
  type NoteStatusValue,
} from '../../../shared/documents/document.types';
import {
  DocumentSession,
  type DocumentSessionSnapshot,
} from './DocumentSession';
import { IpcDocumentRepository } from './IpcDocumentRepository';

export type DocumentWorkspaceState = Readonly<{
  documents: readonly NoteDocument[];
  archivedDocuments: readonly NoteDocument[];
  notebooks: readonly Notebook[];
  session: DocumentSessionSnapshot;
  isListLoading: boolean;
  lastError: unknown;
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
  deleteNotebook(notebookId: string): Promise<void>;
  move(document: NoteDocument, notebookId: string): Promise<NoteDocument>;
  archive(document: NoteDocument): Promise<NoteDocument>;
  archiveMany(documents: readonly NoteDocument[]): Promise<void>;
  restore(document: NoteDocument, notebookId?: string): Promise<NoteDocument>;
  restoreMany(
    documents: readonly NoteDocument[],
    notebookId: string,
  ): Promise<void>;
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
  const [isListLoading, setIsListLoading] = useState(true);
  const [lastError, setLastError] = useState<unknown>(null);

  const upsertDocument = useCallback(
    (
      setCollection: Dispatch<SetStateAction<readonly NoteDocument[]>>,
      document: NoteDocument,
    ): void => {
      setCollection((current) => {
        const withoutDocument = current.filter(
          (item) => item.id !== document.id,
        );

        return Object.freeze(
          [document, ...withoutDocument].sort((left, right) => {
            const byUpdatedAt = right.updatedAt.localeCompare(left.updatedAt);

            return byUpdatedAt === 0
              ? left.id.localeCompare(right.id)
              : byUpdatedAt;
          }),
        );
      });
    },
    [],
  );

  const refresh = useCallback(async (): Promise<void> => {
    setIsListLoading(true);

    try {
      const [nextDocuments, nextArchivedDocuments, nextNotebooks] =
        await Promise.all([
          repository.listActive(),
          repository.listArchived(),
          repository.listNotebooks(),
        ]);

      setDocuments(nextDocuments);
      setArchivedDocuments(nextArchivedDocuments);
      setNotebooks(nextNotebooks);
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
          upsertDocument(setDocuments, document);
          setArchivedDocuments((current) =>
            Object.freeze(current.filter((item) => item.id !== document.id)),
          );
        } else {
          upsertDocument(setArchivedDocuments, document);
          setDocuments((current) =>
            Object.freeze(current.filter((item) => item.id !== document.id)),
          );
        }
        setLastError(null);

        return document;
      } catch (error) {
        setLastError(error);
        throw error;
      }
    },
    [session, upsertDocument],
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
    async (notes: readonly NoteDocument[]): Promise<void> => {
      for (const note of notes) {
        await archive(note);
      }
    },
    [archive],
  );

  const restoreMany = useCallback(
    async (
      notes: readonly NoteDocument[],
      notebookId: string,
    ): Promise<void> => {
      for (const note of notes) {
        await restore(note, notebookId);
      }
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
    session: sessionSnapshot,
    isListLoading,
    lastError,
    refresh,
    open,
    apply,
    create,
    createNotebook,
    deleteNotebook,
    move,
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
