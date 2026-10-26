import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import * as Y from 'yjs';

import {
  createDocumentNotFoundError,
  createInvalidMutationError,
  createRevisionConflictError,
} from '../../shared/documents/document.errors';
import type {
  DocumentQueryRepository,
  NotebookRepository,
} from '../../shared/documents/document.query';
import type {
  DocumentDeletionRepository,
  DocumentRepository,
} from '../../shared/documents/document.repository';
import {
  INITIAL_DOCUMENT_REVISION,
  INBOX_NOTEBOOK_ID,
  NOTE_STATUS_NONE,
  createArchiveMutation,
  createGeneratedTagId,
  createMutationId,
  createNotebook as validateAndCreateNotebook,
  createNoteId,
  createRevision,
  validateDocumentMutation,
  type CreateDocumentMutation,
  type DocumentMutation,
  type CreateNotebookInput,
  type DeleteNotebookInput,
  type DeleteNotebookResult,
  type PermanentlyDeleteNotesInput,
  type PermanentlyDeleteNotesResult,
  type Notebook,
  type NotebookIconName,
  type NoteDocument,
  type NoteId,
} from '../../shared/documents/document.types';

const FIRST_SCHEMA_VERSION = 1;
const ORGANIZATION_SCHEMA_VERSION = 2;
const NOTEBOOK_HIERARCHY_SCHEMA_VERSION = 3;
const NOTEBOOK_ICON_SCHEMA_VERSION = 4;
/*
 * Version 5 was used by an earlier status migration before `none` was
 * represented explicitly. Some local databases therefore record that version
 * without the `status_is_none` column this store requires. Keep the repair in
 * a new, monotonic migration instead of reusing that historical version.
 */
const NONE_STATUS_SCHEMA_VERSION = 7;
export const ORGANIZATION_TAG_ID_SCHEMA_VERSION = 8;

const PENDING_OUTBOX_STATUS = 'pending';

type NoteRow = Readonly<{
  id: string;
  title: string;
  body: string;
  notebook_id: string;
  status: string;
  status_is_none: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  projection_generation: number;
  revision: string;
}>;

type TagRow = Readonly<{
  note_id: string;
  name: string;
}>;

type LegacyTagRow = Readonly<{
  name: string;
  created_at: string;
}>;

type LegacyNoteTagRow = Readonly<{
  note_id: string;
  tag_name: string;
}>;

type NotebookRow = Readonly<{
  id: string;
  name: string;
  parent_id: string | null;
  icon: string | null;
  created_at: string;
  updated_at: string;
}>;

type SnapshotRow = Readonly<{
  snapshot_update: Buffer;
}>;

type UpdateRow = Readonly<{
  update_id: number;
  operation_id: string;
  note_id: string;
  yjs_update: Buffer;
  occurred_at: string;
}>;

type InsertResult = Readonly<{
  lastInsertRowid: number | bigint;
}>;

type CountRow = Readonly<{
  count: number;
}>;

export type PendingLocalDocumentUpdate = Readonly<{
  id: string;
  documentId: NoteId;
  update: Uint8Array;
  occurredAt: string;
}>;

export type RemoteDocumentUpdate = Readonly<{
  id: string;
  documentId: NoteId;
  update: Uint8Array;
  occurredAt: string;
}>;

/**
 * Main-process SQLite repository for the local-first document core.
 *
 * `notes` is a query projection. The durable authority for title, body, and
 * deletion metadata is the Yjs snapshot plus append-only update history. Each
 * local mutation appends exactly one update and one outbox envelope inside the
 * same SQLite transaction before the operation is acknowledged.
 */
export class LocalDocumentStore
  implements
    DocumentRepository,
    DocumentDeletionRepository,
    DocumentQueryRepository,
    NotebookRepository
{
  private readonly applyLocalTransaction: (
    mutation: DocumentMutation,
  ) => NoteDocument;

  private readonly applyRemoteTransaction: (
    update: RemoteDocumentUpdate,
  ) => NoteDocument;

  private readonly deleteNotebookTransaction: (
    input: DeleteNotebookInput,
  ) => DeleteNotebookResult;

  private readonly deletePermanentlyTransaction: (
    input: PermanentlyDeleteNotesInput,
  ) => PermanentlyDeleteNotesResult;

  constructor(private readonly database: Database.Database) {
    this.configureDatabase();
    this.migrate();
    this.applyLocalTransaction = this.database.transaction((mutation) =>
      this.applyLocalMutation(mutation),
    );
    this.applyRemoteTransaction = this.database.transaction((update) =>
      this.applyRemoteDocumentUpdate(update),
    );
    this.deleteNotebookTransaction = this.database.transaction((input) =>
      this.deleteNotebookAndArchiveDirectNotes(input),
    );
    this.deletePermanentlyTransaction = this.database.transaction((input) =>
      this.deleteArchivedNotesPermanently(input),
    );
  }

  async get(id: NoteId): Promise<NoteDocument | null> {
    return this.readDocument(id);
  }

  async listActive(): Promise<readonly NoteDocument[]> {
    const rows = this.database
      .prepare<[], NoteRow>(
        `SELECT *
         FROM notes
         WHERE deleted_at IS NULL
         ORDER BY updated_at DESC, id ASC`,
      )
      .all();

    return Object.freeze(this.documentsFromRows(rows));
  }

  async listArchived(): Promise<readonly NoteDocument[]> {
    const rows = this.database
      .prepare<[], NoteRow>(
        `SELECT *
         FROM notes
         WHERE deleted_at IS NOT NULL
         ORDER BY deleted_at DESC, id ASC`,
      )
      .all();

    return Object.freeze(this.documentsFromRows(rows));
  }

  async listNotebooks(): Promise<readonly Notebook[]> {
    const rows = this.database
      .prepare<[string], NotebookRow>(
        `SELECT id, name, parent_id, icon, created_at, updated_at
         FROM notebooks
         ORDER BY CASE WHEN id = ? THEN 0 ELSE 1 END, name COLLATE NOCASE ASC`,
      )
      .all(INBOX_NOTEBOOK_ID);

    return Object.freeze(rows.map(notebookFromRow));
  }

  async createNotebook(input: CreateNotebookInput): Promise<Notebook> {
    const notebook = validateAndCreateNotebook(input);
    const parentId = notebook.parentId ?? null;

    if (parentId !== null) {
      const parent = this.database
        .prepare<[string], Pick<NotebookRow, 'id'>>(
          'SELECT id FROM notebooks WHERE id = ?',
        )
        .get(parentId);

      if (parent === undefined) {
        throw createInvalidMutationError(
          `Notebook parent "${parentId}" does not exist.`,
        );
      }
    }

    this.database
      .prepare<[string, string, string | null, string | null, string, string]>(
        `INSERT INTO notebooks(id, name, parent_id, icon, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        notebook.id,
        notebook.name,
        parentId,
        notebook.icon ?? null,
        notebook.createdAt,
        notebook.updatedAt,
      );

    return notebook;
  }

  async deleteNotebook(
    input: DeleteNotebookInput,
  ): Promise<DeleteNotebookResult> {
    return this.deleteNotebookTransaction(input);
  }

  async deletePermanently(
    input: PermanentlyDeleteNotesInput,
  ): Promise<PermanentlyDeleteNotesResult> {
    return this.deletePermanentlyTransaction(input);
  }

  async apply(mutation: DocumentMutation): Promise<NoteDocument> {
    return this.applyLocalTransaction(mutation);
  }

  /**
   * Applies a trusted sync envelope in the main process. This is intentionally
   * not exposed to the renderer or preload. Remote updates are retained in the
   * CRDT history, but never create a new outbox envelope.
   */
  async applyRemoteUpdate(update: RemoteDocumentUpdate): Promise<NoteDocument> {
    return this.applyRemoteTransaction(validateRemoteDocumentUpdate(update));
  }

  /**
   * Returns copies of locally-produced pending updates for a future sync
   * transport. Binary payloads remain in the main process until that transport
   * is introduced; renderer code never receives this API.
   */
  getPendingLocalUpdates(
    documentId?: NoteId,
  ): readonly PendingLocalDocumentUpdate[] {
    const rows =
      documentId === undefined
        ? this.database
            .prepare<[string], UpdateRow>(
              `SELECT updates.operation_id, updates.note_id, updates.yjs_update,
                      updates.occurred_at
               FROM sync_outbox AS outbox
               INNER JOIN note_crdt_updates AS updates
                 ON updates.update_id = outbox.update_id
               WHERE outbox.status = ?
               ORDER BY outbox.created_at, outbox.envelope_id`,
            )
            .all(PENDING_OUTBOX_STATUS)
        : this.database
            .prepare<[string, string], UpdateRow>(
              `SELECT updates.operation_id, updates.note_id, updates.yjs_update,
                      updates.occurred_at
               FROM sync_outbox AS outbox
               INNER JOIN note_crdt_updates AS updates
                 ON updates.update_id = outbox.update_id
               WHERE outbox.status = ? AND updates.note_id = ?
               ORDER BY outbox.created_at, outbox.envelope_id`,
            )
            .all(PENDING_OUTBOX_STATUS, documentId);

    return rows.map((row) =>
      Object.freeze({
        id: row.operation_id,
        documentId: createNoteId(row.note_id),
        update: Uint8Array.from(row.yjs_update),
        occurredAt: row.occurred_at,
      }),
    );
  }

  close(): void {
    if (this.database.open) {
      this.database.close();
    }
  }

  async backupTo(destinationFile: string): Promise<void> {
    await this.database.backup(destinationFile);
  }

  private configureDatabase(): void {
    this.database.pragma('foreign_keys = ON');
    this.database.pragma('busy_timeout = 5000');
    this.database.pragma('journal_mode = WAL');
    this.database.pragma('synchronous = NORMAL');
  }

  private migrate(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const hasInitialSchema = this.database
      .prepare<[number], { version: number }>(
        'SELECT version FROM schema_migrations WHERE version = ?',
      )
      .get(FIRST_SCHEMA_VERSION);

    if (hasInitialSchema === undefined) {
      this.database.transaction(() => {
        this.database.exec(`
        CREATE TABLE notes (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          projection_generation INTEGER NOT NULL CHECK (projection_generation >= 1),
          revision TEXT NOT NULL
        );

        CREATE TABLE note_crdt_snapshots (
          note_id TEXT PRIMARY KEY REFERENCES notes(id) ON DELETE RESTRICT,
          snapshot_update BLOB NOT NULL,
          state_vector BLOB NOT NULL,
          snapshot_generation INTEGER NOT NULL CHECK (snapshot_generation >= 0),
          compacted_at TEXT NOT NULL
        );

        CREATE TABLE note_crdt_updates (
          update_id INTEGER PRIMARY KEY,
          operation_id TEXT NOT NULL UNIQUE,
          note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE RESTRICT,
          origin TEXT NOT NULL CHECK (origin IN ('local', 'remote')),
          yjs_update BLOB NOT NULL,
          occurred_at TEXT NOT NULL
        );

        CREATE INDEX note_crdt_updates_note_id_update_id_idx
          ON note_crdt_updates(note_id, update_id);

        CREATE TABLE sync_outbox (
          envelope_id TEXT PRIMARY KEY,
          update_id INTEGER NOT NULL UNIQUE
            REFERENCES note_crdt_updates(update_id) ON DELETE RESTRICT,
          note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE RESTRICT,
          status TEXT NOT NULL CHECK (status IN ('pending', 'sending', 'acknowledged')),
          attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
          created_at TEXT NOT NULL,
          acknowledged_at TEXT
        );

        CREATE INDEX sync_outbox_pending_idx
          ON sync_outbox(status, created_at, envelope_id);

        CREATE TABLE sync_checkpoints (
          account_id TEXT NOT NULL,
          device_id TEXT NOT NULL,
          cursor TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (account_id, device_id)
        );
        `);

        this.database
          .prepare<[number, string]>(
            'INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)',
          )
          .run(FIRST_SCHEMA_VERSION, new Date().toISOString());
      })();
    }

    const hasOrganizationSchema = this.database
      .prepare<[number], { version: number }>(
        'SELECT version FROM schema_migrations WHERE version = ?',
      )
      .get(ORGANIZATION_SCHEMA_VERSION);

    if (hasOrganizationSchema === undefined) {
      this.database.transaction(() => {
        this.database.exec(`
        CREATE TABLE notebooks (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL COLLATE NOCASE UNIQUE,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        INSERT INTO notebooks(id, name, created_at, updated_at)
        VALUES ('${INBOX_NOTEBOOK_ID}', 'Inbox', datetime('now'), datetime('now'));

        ALTER TABLE notes ADD COLUMN notebook_id TEXT;
        ALTER TABLE notes ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
          CHECK (status IN ('active', 'on-hold', 'completed', 'dropped'));

        UPDATE notes
        SET notebook_id = '${INBOX_NOTEBOOK_ID}'
        WHERE notebook_id IS NULL;

        CREATE TABLE tags (
          name TEXT PRIMARY KEY COLLATE NOCASE,
          created_at TEXT NOT NULL
        );

        CREATE TABLE note_tags (
          note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE RESTRICT,
          tag_name TEXT NOT NULL REFERENCES tags(name) ON DELETE RESTRICT,
          PRIMARY KEY (note_id, tag_name)
        );

        CREATE INDEX note_tags_tag_name_note_id_idx
          ON note_tags(tag_name, note_id);
        `);

        this.database
          .prepare<[number, string]>(
            'INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)',
          )
          .run(ORGANIZATION_SCHEMA_VERSION, new Date().toISOString());
      })();
    }

    const hasNotebookHierarchySchema = this.database
      .prepare<[number], { version: number }>(
        'SELECT version FROM schema_migrations WHERE version = ?',
      )
      .get(NOTEBOOK_HIERARCHY_SCHEMA_VERSION);

    if (hasNotebookHierarchySchema === undefined) {
      this.database.transaction(() => {
        this.database.exec(`
        ALTER TABLE notebooks ADD COLUMN parent_id TEXT;
        CREATE INDEX notebooks_parent_id_name_idx
          ON notebooks(parent_id, name COLLATE NOCASE);
      `);

        this.database
          .prepare<[number, string]>(
            'INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)',
          )
          .run(NOTEBOOK_HIERARCHY_SCHEMA_VERSION, new Date().toISOString());
      })();
    }

    const hasNotebookIconSchema = this.database
      .prepare<[number], { version: number }>(
        'SELECT version FROM schema_migrations WHERE version = ?',
      )
      .get(NOTEBOOK_ICON_SCHEMA_VERSION);

    if (hasNotebookIconSchema === undefined) {
      this.database.transaction(() => {
        this.database.exec('ALTER TABLE notebooks ADD COLUMN icon TEXT;');
        this.database
          .prepare<[number, string]>(
            'INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)',
          )
          .run(NOTEBOOK_ICON_SCHEMA_VERSION, new Date().toISOString());
      })();
    }

    const hasNoneStatusSchema = this.database
      .prepare<[number], { version: number }>(
        'SELECT version FROM schema_migrations WHERE version = ?',
      )
      .get(NONE_STATUS_SCHEMA_VERSION);
    const hasNoneStatusColumn = this.notesTableHasColumn('status_is_none');

    if (hasNoneStatusSchema === undefined || !hasNoneStatusColumn) {
      this.database.transaction(() => {
        if (!hasNoneStatusColumn) {
          this.database.exec(`
            ALTER TABLE notes ADD COLUMN status_is_none INTEGER NOT NULL DEFAULT 0
              CHECK (status_is_none IN (0, 1));
          `);
        }
        this.database
          .prepare<[number, string]>(
            `INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)
             ON CONFLICT(version) DO NOTHING`,
          )
          .run(NONE_STATUS_SCHEMA_VERSION, new Date().toISOString());
      })();
    }

    const hasTagIdSchema = this.database
      .prepare<[number], { version: number }>(
        'SELECT version FROM schema_migrations WHERE version = ?',
      )
      .get(ORGANIZATION_TAG_ID_SCHEMA_VERSION);

    if (hasTagIdSchema === undefined) {
      this.database.transaction(() => this.migrateTagsToIdentifiers())();
    }
  }

  private migrateTagsToIdentifiers(): void {
    const legacyTags = this.database
      .prepare<[], LegacyTagRow>(
        `SELECT name, created_at
         FROM tags
         ORDER BY name COLLATE NOCASE ASC`,
      )
      .all();
    const legacyLinks = this.database
      .prepare<[], LegacyNoteTagRow>(
        `SELECT note_id, tag_name
         FROM note_tags
         ORDER BY note_id ASC, tag_name COLLATE NOCASE ASC`,
      )
      .all();

    this.database.exec(`
      ALTER TABLE note_tags RENAME TO note_tags_v7;
      ALTER TABLE tags RENAME TO tags_v7;

      CREATE TABLE tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL COLLATE NOCASE UNIQUE,
        color TEXT NOT NULL DEFAULT 'default'
          CHECK (color IN (
            'default', 'red', 'orange', 'yellow', 'olive', 'green', 'teal',
            'blue', 'violet', 'purple', 'pink', 'brown', 'grey', 'black'
          )),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE note_tags (
        note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE RESTRICT,
        tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE RESTRICT,
        PRIMARY KEY (note_id, tag_id)
      );

      CREATE INDEX note_tags_tag_id_note_id_idx
        ON note_tags(tag_id, note_id);
    `);

    const insertTag = this.database.prepare<
      [string, string, string, string, string]
    >(
      `INSERT INTO tags(id, name, color, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    );
    const tagIdsByName = new Map<string, string>();

    for (const tag of legacyTags) {
      const id = createGeneratedTagId(randomUUID());

      insertTag.run(id, tag.name, 'default', tag.created_at, tag.created_at);
      tagIdsByName.set(tag.name.toLocaleLowerCase(), id);
    }

    const attachTag = this.database.prepare<[string, string]>(
      `INSERT INTO note_tags(note_id, tag_id) VALUES (?, ?)`,
    );

    for (const link of legacyLinks) {
      const tagId = tagIdsByName.get(link.tag_name.toLocaleLowerCase());

      if (tagId === undefined) {
        throw createInvalidMutationError(
          `Legacy tag association references missing tag "${link.tag_name}".`,
        );
      }

      attachTag.run(link.note_id, tagId);
    }

    const copiedTagCount = this.database
      .prepare<[], CountRow>('SELECT COUNT(*) AS count FROM tags')
      .get()?.count ?? -1;
    const copiedLinkCount = this.database
      .prepare<[], CountRow>('SELECT COUNT(*) AS count FROM note_tags')
      .get()?.count ?? -1;

    if (
      copiedTagCount !== legacyTags.length ||
      copiedLinkCount !== legacyLinks.length
    ) {
      throw createInvalidMutationError(
        'The tag migration did not preserve every tag association.',
      );
    }

    const foreignKeyViolations = this.database
      .prepare<[], Record<string, unknown>>('PRAGMA foreign_key_check')
      .all();

    if (foreignKeyViolations.length > 0) {
      throw createInvalidMutationError(
        'The tag migration produced invalid foreign-key relationships.',
      );
    }

    this.database.exec(`
      DROP TABLE note_tags_v7;
      DROP TABLE tags_v7;
    `);
    this.database
      .prepare<[number, string]>(
        'INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)',
      )
      .run(ORGANIZATION_TAG_ID_SCHEMA_VERSION, new Date().toISOString());
  }

  private notesTableHasColumn(columnName: string): boolean {
    const columns = this.database
      .prepare<[], Readonly<{ name: string }>>('PRAGMA table_info(notes)')
      .all();

    return columns.some((column) => column.name === columnName);
  }

  private applyLocalMutation(mutation: DocumentMutation): NoteDocument {
    const acceptedMutation = validateDocumentMutation(mutation);
    const duplicate = this.readUpdateByOperationId(acceptedMutation.id);

    if (duplicate !== null) {
      if (duplicate.note_id !== acceptedMutation.documentId) {
        throw createInvalidMutationError(
          'A mutation ID cannot target more than one document.',
        );
      }

      return this.readRequiredDocument(acceptedMutation.documentId);
    }

    if (acceptedMutation.kind === 'create') {
      return this.createLocalDocument(acceptedMutation);
    }

    const current = this.readDocumentWithGeneration(
      acceptedMutation.documentId,
    );

    if (current === null) {
      throw createDocumentNotFoundError(acceptedMutation.documentId);
    }

    if (acceptedMutation.baseRevision !== current.revision) {
      throw createRevisionConflictError(
        `Document "${acceptedMutation.documentId}" has revision "${current.revision}".`,
      );
    }

    assertValidStateTransition(current, acceptedMutation);

    const yDocument = this.loadYDocument(acceptedMutation.documentId);

    try {
      const update = captureYUpdate(yDocument, () =>
        applyMutationToYDocument(yDocument, acceptedMutation),
      );
      const document = projectYDocument(
        yDocument,
        acceptedMutation.documentId,
        current.projectionGeneration + 1,
      );

      this.updateProjection(document);
      this.insertUpdate({
        operationId: acceptedMutation.id,
        documentId: acceptedMutation.documentId,
        origin: 'local',
        update,
        occurredAt: acceptedMutation.occurredAt,
      });

      return toNoteDocument(document);
    } finally {
      yDocument.destroy();
    }
  }

  /**
   * Mirrors Inkdrop's `deleteBook`: notes directly associated with the
   * notebook are sent to Trash. Descendant notebooks are preserved and lifted
   * to the deleted notebook's parent so a dynamic hierarchy never becomes
   * unreachable.
   */
  private deleteNotebookAndArchiveDirectNotes(
    input: DeleteNotebookInput,
  ): DeleteNotebookResult {
    if (input.id === INBOX_NOTEBOOK_ID) {
      throw createInvalidMutationError('The Inbox notebook cannot be deleted.');
    }

    const notebook = this.database
      .prepare<[string], NotebookRow>(
        `SELECT id, name, parent_id, icon, created_at, updated_at
         FROM notebooks
         WHERE id = ?`,
      )
      .get(input.id);

    if (notebook === undefined) {
      throw createInvalidMutationError(
        `Notebook "${input.id}" does not exist.`,
      );
    }

    const activeNotes = this.database
      .prepare<[string], NoteRow>(
        `SELECT *
         FROM notes
         WHERE notebook_id = ? AND deleted_at IS NULL
         ORDER BY id ASC`,
      )
      .all(notebook.id)
      .map((row) => this.documentFromRow(row));
    const archivedNoteIds: NoteId[] = [];

    for (const note of activeNotes) {
      this.applyLocalMutation(
        createArchiveMutation({
          id: createMutationId(
            `delete-notebook:${notebook.id}:${note.id}:${input.occurredAt}`,
          ),
          documentId: note.id,
          baseRevision: note.revision,
          source: 'system',
          occurredAt: input.occurredAt,
        }),
      );
      archivedNoteIds.push(note.id);
    }

    const childRows = this.database
      .prepare<[string], Pick<NotebookRow, 'id'>>(
        'SELECT id FROM notebooks WHERE parent_id = ? ORDER BY id ASC',
      )
      .all(notebook.id);
    const reparentedNotebookIds = childRows.map((child) => child.id);

    this.database
      .prepare<[string | null, string, string]>(
        `UPDATE notebooks
         SET parent_id = ?, updated_at = ?
         WHERE parent_id = ?`,
      )
      .run(notebook.parent_id, input.occurredAt, notebook.id);
    this.database
      .prepare<[string]>('DELETE FROM notebooks WHERE id = ?')
      .run(notebook.id);

    return Object.freeze({
      deletedNotebookId: notebook.id,
      archivedNoteIds: Object.freeze(archivedNoteIds),
      reparentedNotebookIds: Object.freeze(reparentedNotebookIds),
    });
  }

  /**
   * Purges every durable record owned by archived notes. The preflight runs
   * before the first delete so a mixed active/archived selection rolls back
   * as one SQLite transaction instead of partially deleting user data.
   */
  private deleteArchivedNotesPermanently(
    input: PermanentlyDeleteNotesInput,
  ): PermanentlyDeleteNotesResult {
    const notes = input.noteIds.map((noteId) => {
      const note = this.readDocument(noteId);

      if (note === null) {
        throw createDocumentNotFoundError(noteId);
      }

      if (note.deletedAt === null) {
        throw createInvalidMutationError(
          'Only notes in Trash can be deleted permanently.',
        );
      }

      return note;
    });

    const deleteOutbox = this.database.prepare<[string]>(
      'DELETE FROM sync_outbox WHERE note_id = ?',
    );
    const deleteUpdates = this.database.prepare<[string]>(
      'DELETE FROM note_crdt_updates WHERE note_id = ?',
    );
    const deleteSnapshots = this.database.prepare<[string]>(
      'DELETE FROM note_crdt_snapshots WHERE note_id = ?',
    );
    const deleteTags = this.database.prepare<[string]>(
      'DELETE FROM note_tags WHERE note_id = ?',
    );
    const deleteNote = this.database.prepare<[string]>(
      'DELETE FROM notes WHERE id = ?',
    );

    for (const note of notes) {
      deleteOutbox.run(note.id);
      deleteUpdates.run(note.id);
      deleteSnapshots.run(note.id);
      deleteTags.run(note.id);
      deleteNote.run(note.id);
    }

    return Object.freeze({
      deletedNoteIds: Object.freeze(notes.map((note) => note.id)),
    });
  }

  private createLocalDocument(mutation: CreateDocumentMutation): NoteDocument {
    if (this.readDocument(mutation.documentId) !== null) {
      throw createRevisionConflictError(
        `Document "${mutation.documentId}" already exists.`,
      );
    }

    if (mutation.baseRevision !== INITIAL_DOCUMENT_REVISION) {
      throw createRevisionConflictError(
        'A new document must use the initial revision.',
      );
    }

    const yDocument = new Y.Doc();

    try {
      const update = captureYUpdate(yDocument, () =>
        applyMutationToYDocument(yDocument, mutation),
      );
      const document = projectYDocument(yDocument, mutation.documentId, 1);

      this.insertProjection(document);
      this.insertEmptySnapshot(mutation.documentId, mutation.occurredAt);
      this.insertUpdate({
        operationId: mutation.id,
        documentId: mutation.documentId,
        origin: 'local',
        update,
        occurredAt: mutation.occurredAt,
      });

      return toNoteDocument(document);
    } finally {
      yDocument.destroy();
    }
  }

  private applyRemoteDocumentUpdate(
    update: RemoteDocumentUpdate,
  ): NoteDocument {
    const duplicate = this.readUpdateByOperationId(update.id);

    if (duplicate !== null) {
      if (duplicate.note_id !== update.documentId) {
        throw createInvalidMutationError(
          'A replicated update ID cannot target more than one document.',
        );
      }

      return this.readRequiredDocument(update.documentId);
    }

    const existing = this.readDocumentWithGeneration(update.documentId);
    const yDocument =
      existing === null ? new Y.Doc() : this.loadYDocument(update.documentId);

    try {
      Y.applyUpdate(yDocument, update.update);

      const document = projectYDocument(
        yDocument,
        update.documentId,
        (existing?.projectionGeneration ?? 0) + 1,
      );

      if (existing === null) {
        this.insertProjection(document);
        this.insertEmptySnapshot(update.documentId, update.occurredAt);
      } else {
        this.updateProjection(document);
      }

      this.insertUpdate({
        operationId: update.id,
        documentId: update.documentId,
        origin: 'remote',
        update: update.update,
        occurredAt: update.occurredAt,
      });

      return toNoteDocument(document);
    } finally {
      yDocument.destroy();
    }
  }

  private readDocument(id: NoteId): NoteDocument | null {
    const row = this.database
      .prepare<[string], NoteRow>('SELECT * FROM notes WHERE id = ?')
      .get(id);

    return row === undefined ? null : this.documentFromRow(row);
  }

  private readDocumentWithGeneration(
    id: NoteId,
  ): (NoteDocument & Readonly<{ projectionGeneration: number }>) | null {
    const row = this.database
      .prepare<[string], NoteRow>('SELECT * FROM notes WHERE id = ?')
      .get(id);

    if (row === undefined) {
      return null;
    }

    return Object.freeze({
      ...this.documentFromRow(row),
      projectionGeneration: row.projection_generation,
    });
  }

  private readRequiredDocument(id: NoteId): NoteDocument {
    const document = this.readDocument(id);

    if (document === null) {
      throw createDocumentNotFoundError(id);
    }

    return document;
  }

  private readUpdateByOperationId(operationId: string): UpdateRow | null {
    const row = this.database
      .prepare<[string], UpdateRow>(
        `SELECT update_id, operation_id, note_id, yjs_update, occurred_at
         FROM note_crdt_updates
         WHERE operation_id = ?`,
      )
      .get(operationId);

    return row ?? null;
  }

  private loadYDocument(id: NoteId): Y.Doc {
    const snapshot = this.database
      .prepare<[string], SnapshotRow>(
        `SELECT snapshot_update
         FROM note_crdt_snapshots
         WHERE note_id = ?`,
      )
      .get(id);

    if (snapshot === undefined) {
      throw createInvalidMutationError(
        `Document "${id}" does not have a CRDT snapshot.`,
      );
    }

    const yDocument = new Y.Doc();

    try {
      Y.applyUpdate(yDocument, snapshot.snapshot_update);

      const updates = this.database
        .prepare<[string], Pick<UpdateRow, 'yjs_update'>>(
          `SELECT yjs_update
           FROM note_crdt_updates
           WHERE note_id = ?
           ORDER BY update_id`,
        )
        .all(id);

      for (const update of updates) {
        Y.applyUpdate(yDocument, update.yjs_update);
      }

      return yDocument;
    } catch (error) {
      yDocument.destroy();
      throw error;
    }
  }

  private insertProjection(document: PersistedDocumentProjection): void {
    this.ensureNotebook(document.notebookId, document.createdAt);

    this.database
      .prepare<
        [
          string,
          string,
          string,
          string,
          string,
          number,
          string,
          string,
          string | null,
          number,
          string,
        ]
      >(
        `INSERT INTO notes(
          id, title, body, notebook_id, status, status_is_none, created_at,
          updated_at, deleted_at, projection_generation, revision
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        document.id,
        document.title,
        document.body,
        document.notebookId,
        persistedStatus(document.status),
        document.status === NOTE_STATUS_NONE ? 1 : 0,
        document.createdAt,
        document.updatedAt,
        document.deletedAt,
        document.projectionGeneration,
        document.revision,
      );

    this.replaceTags(document.id, document.tags, document.createdAt);
  }

  private updateProjection(document: PersistedDocumentProjection): void {
    this.ensureNotebook(document.notebookId, document.updatedAt);

    this.database
      .prepare<
        [
          string,
          string,
          string,
          string,
          number,
          string,
          string,
          string | null,
          number,
          string,
          string,
        ]
      >(
        `UPDATE notes
         SET title = ?, body = ?, notebook_id = ?, status = ?, status_is_none = ?,
             created_at = ?, updated_at = ?, deleted_at = ?, projection_generation = ?, revision = ?
         WHERE id = ?`,
      )
      .run(
        document.title,
        document.body,
        document.notebookId,
        persistedStatus(document.status),
        document.status === NOTE_STATUS_NONE ? 1 : 0,
        document.createdAt,
        document.updatedAt,
        document.deletedAt,
        document.projectionGeneration,
        document.revision,
        document.id,
      );

    this.replaceTags(document.id, document.tags, document.updatedAt);
  }

  private ensureNotebook(id: string, occurredAt: string): void {
    const name = id === INBOX_NOTEBOOK_ID ? 'Inbox' : id;

    this.database
      .prepare<[string, string, string | null, string | null, string, string]>(
        `INSERT INTO notebooks(id, name, parent_id, icon, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO NOTHING`,
      )
      .run(id, name, null, null, occurredAt, occurredAt);
  }

  private replaceTags(
    documentId: NoteId,
    tags: readonly string[],
    occurredAt: string,
  ): void {
    this.database
      .prepare<[string]>('DELETE FROM note_tags WHERE note_id = ?')
      .run(documentId);

    const insertTag = this.database.prepare<
      [string, string, string, string, string]
    >(
      `INSERT INTO tags(id, name, color, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(name) DO NOTHING`,
    );
    const readTagId = this.database.prepare<[string], Readonly<{ id: string }>>(
      'SELECT id FROM tags WHERE name = ?',
    );
    const attachTag = this.database.prepare<[string, string]>(
      `INSERT INTO note_tags(note_id, tag_id) VALUES (?, ?)`,
    );

    for (const tag of tags) {
      insertTag.run(
        createGeneratedTagId(randomUUID()),
        tag,
        'default',
        occurredAt,
        occurredAt,
      );
      const tagRow = readTagId.get(tag);

      if (tagRow === undefined) {
        throw createInvalidMutationError(`Tag "${tag}" could not be resolved.`);
      }

      attachTag.run(documentId, tagRow.id);
    }
  }

  private documentsFromRows(rows: readonly NoteRow[]): readonly NoteDocument[] {
    if (rows.length === 0) {
      return [];
    }

    const tagRows = this.database
      .prepare(
        `SELECT note_tags.note_id, tags.name
         FROM note_tags
         INNER JOIN tags ON tags.id = note_tags.tag_id
         WHERE note_tags.note_id IN (${rows.map(() => '?').join(', ')})
         ORDER BY tags.name COLLATE NOCASE ASC`,
      )
      .all(...rows.map((row) => row.id)) as TagRow[];
    const tagsByDocumentId = new Map<string, string[]>();

    for (const tagRow of tagRows) {
      const tags = tagsByDocumentId.get(tagRow.note_id) ?? [];

      tags.push(tagRow.name);
      tagsByDocumentId.set(tagRow.note_id, tags);
    }

    return rows.map((row) =>
      documentFromRow(row, tagsByDocumentId.get(row.id) ?? []),
    );
  }

  private documentFromRow(row: NoteRow): NoteDocument {
    const tagRows = this.database
      .prepare<[string], Pick<TagRow, 'name'>>(
        `SELECT tags.name
         FROM note_tags
         INNER JOIN tags ON tags.id = note_tags.tag_id
         WHERE note_tags.note_id = ?
         ORDER BY tags.name COLLATE NOCASE ASC`,
      )
      .all(row.id);

    return documentFromRow(
      row,
      tagRows.map((tagRow) => tagRow.name),
    );
  }

  private insertEmptySnapshot(id: NoteId, occurredAt: string): void {
    const emptyDocument = new Y.Doc();

    try {
      this.database
        .prepare<[string, Buffer, Buffer, number, string]>(
          `INSERT INTO note_crdt_snapshots(
            note_id, snapshot_update, state_vector, snapshot_generation,
            compacted_at
          ) VALUES (?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          Buffer.from(Y.encodeStateAsUpdate(emptyDocument)),
          Buffer.from(Y.encodeStateVector(emptyDocument)),
          0,
          occurredAt,
        );
    } finally {
      emptyDocument.destroy();
    }
  }

  private insertUpdate(input: {
    operationId: string;
    documentId: NoteId;
    origin: 'local' | 'remote';
    update: Uint8Array;
    occurredAt: string;
  }): void {
    const result = this.database
      .prepare<[string, string, 'local' | 'remote', Buffer, string]>(
        `INSERT INTO note_crdt_updates(
          operation_id, note_id, origin, yjs_update, occurred_at
        ) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        input.operationId,
        input.documentId,
        input.origin,
        Buffer.from(input.update),
        input.occurredAt,
      ) as InsertResult;

    if (input.origin !== 'local') {
      return;
    }

    const updateId = toSafeUpdateId(result.lastInsertRowid);

    this.database
      .prepare<[string, number, string, string, string]>(
        `INSERT INTO sync_outbox(
          envelope_id, update_id, note_id, status, created_at
        ) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        input.operationId,
        updateId,
        input.documentId,
        PENDING_OUTBOX_STATUS,
        input.occurredAt,
      );
  }
}

type PersistedDocumentProjection = NoteDocument &
  Readonly<{
    projectionGeneration: number;
  }>;

const captureYUpdate = (document: Y.Doc, operation: () => void): Uint8Array => {
  const updates: Uint8Array[] = [];
  const listener = (update: Uint8Array): void => {
    updates.push(Uint8Array.from(update));
  };

  document.on('update', listener);

  try {
    operation();
  } finally {
    document.off('update', listener);
  }

  if (updates.length !== 1) {
    throw createInvalidMutationError(
      'A document mutation must produce exactly one CRDT update.',
    );
  }

  return updates[0];
};

const applyMutationToYDocument = (
  document: Y.Doc,
  mutation: DocumentMutation,
): void => {
  const title = document.getText('title');
  const body = document.getText('body');
  const metadata = document.getMap<unknown>('metadata');
  const tags = document.getArray<string>('tags');

  document.transact(() => {
    switch (mutation.kind) {
      case 'create':
        replaceYText(title, mutation.title);
        replaceYText(body, mutation.body);
        metadata.set('createdAt', mutation.occurredAt);
        metadata.set('deletedAt', null);
        metadata.set('notebookId', mutation.notebookId);
        metadata.set('status', mutation.status);
        replaceYArray(tags, mutation.tags);
        break;
      case 'update-title':
        replaceYText(title, mutation.title);
        break;
      case 'replace-body':
        replaceYText(body, mutation.body);
        break;
      case 'update-tags':
        replaceYArray(tags, mutation.tags);
        break;
      case 'update-organization':
        metadata.set('notebookId', mutation.notebookId);
        metadata.set('status', mutation.status);
        break;
      case 'archive':
        metadata.set('deletedAt', mutation.occurredAt);
        break;
      case 'restore':
        metadata.set('deletedAt', null);
        if (mutation.notebookId !== undefined) {
          metadata.set('notebookId', mutation.notebookId);
        }
        break;
    }

    metadata.set('updatedAt', mutation.occurredAt);
    metadata.set('lastOperationId', mutation.id);
  });
};

const replaceYText = (text: Y.Text, value: string): void => {
  if (text.toString() === value) {
    return;
  }

  text.delete(0, text.length);
  text.insert(0, value);
};

const replaceYArray = (
  array: Y.Array<string>,
  values: readonly string[],
): void => {
  const current = array.toArray();

  if (
    current.length === values.length &&
    current.every((value, index) => value === values[index])
  ) {
    return;
  }

  array.delete(0, array.length);
  array.insert(0, [...values]);
};

const projectYDocument = (
  document: Y.Doc,
  id: NoteId,
  projectionGeneration: number,
): PersistedDocumentProjection => {
  const metadata = document.getMap<unknown>('metadata');
  const createdAt = readRequiredTimestamp(
    metadata.get('createdAt'),
    'createdAt',
  );
  const updatedAt = readRequiredTimestamp(
    metadata.get('updatedAt'),
    'updatedAt',
  );
  const deletedAt = readDeletedAt(metadata.get('deletedAt'));

  return Object.freeze({
    id,
    title: document.getText('title').toString(),
    body: document.getText('body').toString(),
    notebookId: readNotebookId(metadata.get('notebookId')),
    status: readNoteStatus(metadata.get('status')),
    tags: Object.freeze(
      [...new Set(document.getArray<string>('tags').toArray())].sort(
        (left, right) => left.localeCompare(right),
      ),
    ),
    createdAt,
    updatedAt,
    deletedAt,
    projectionGeneration,
    revision: createRevision(`local-${projectionGeneration}`),
  });
};

const documentFromRow = (row: NoteRow, tags: readonly string[]): NoteDocument =>
  Object.freeze({
    id: createNoteId(row.id),
    title: row.title,
    body: row.body,
    notebookId: row.notebook_id,
    status: readNoteStatus(row.status, row.status_is_none),
    tags: Object.freeze([...tags]),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    revision: createRevision(row.revision),
  });

const notebookFromRow = (row: NotebookRow): Notebook =>
  Object.freeze({
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    ...(row.icon === null ? {} : { icon: row.icon as NotebookIconName }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

const toNoteDocument = (
  projection: PersistedDocumentProjection,
): NoteDocument =>
  Object.freeze({
    id: projection.id,
    title: projection.title,
    body: projection.body,
    notebookId: projection.notebookId,
    status: projection.status,
    tags: Object.freeze([...projection.tags]),
    createdAt: projection.createdAt,
    updatedAt: projection.updatedAt,
    deletedAt: projection.deletedAt,
    revision: projection.revision,
  });

const assertValidStateTransition = (
  current: NoteDocument,
  mutation: Exclude<DocumentMutation, CreateDocumentMutation>,
): void => {
  if (current.deletedAt === null && mutation.kind === 'restore') {
    throw createInvalidMutationError('An active document cannot be restored.');
  }

  if (current.deletedAt !== null && mutation.kind !== 'restore') {
    throw createInvalidMutationError(
      'An archived document must be restored before it can change.',
    );
  }
};

const validateRemoteDocumentUpdate = (
  update: RemoteDocumentUpdate,
): RemoteDocumentUpdate => {
  if (typeof update !== 'object' || update === null) {
    throw createInvalidMutationError('A replicated update must be an object.');
  }

  if (typeof update.id !== 'string' || update.id.trim().length === 0) {
    throw createInvalidMutationError(
      'A replicated update ID must be a non-empty string.',
    );
  }

  if (
    typeof update.documentId !== 'string' ||
    update.documentId.trim().length === 0
  ) {
    throw createInvalidMutationError(
      'A replicated document ID must be a non-empty string.',
    );
  }

  if (!(update.update instanceof Uint8Array) || update.update.length === 0) {
    throw createInvalidMutationError(
      'A replicated update must contain CRDT binary data.',
    );
  }

  if (
    typeof update.occurredAt !== 'string' ||
    update.occurredAt.trim().length === 0
  ) {
    throw createInvalidMutationError(
      'A replicated update timestamp must be a non-empty string.',
    );
  }

  return Object.freeze({
    id: update.id,
    documentId: createNoteId(update.documentId),
    update: Uint8Array.from(update.update),
    occurredAt: update.occurredAt,
  });
};

const readRequiredTimestamp = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw createInvalidMutationError(
      `A CRDT document must contain a non-empty ${label} timestamp.`,
    );
  }

  return value;
};

const readDeletedAt = (value: unknown): string | null => {
  if (value === null) {
    return null;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  throw createInvalidMutationError(
    'A CRDT document must contain a null or non-empty deletedAt timestamp.',
  );
};

const readNotebookId = (value: unknown): string => {
  if (value === undefined) {
    return INBOX_NOTEBOOK_ID;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  throw createInvalidMutationError(
    'A CRDT document must contain a non-empty notebookId.',
  );
};

const persistedStatus = (status: NoteDocument['status']): string =>
  status === NOTE_STATUS_NONE ? 'active' : status;

const readNoteStatus = (value: unknown, isNone = 0): NoteDocument['status'] => {
  if (isNone === 1) {
    return NOTE_STATUS_NONE;
  }

  if (isNone !== 0) {
    throw createInvalidMutationError(
      'A note projection must contain a valid status marker.',
    );
  }

  if (value === undefined) {
    return 'active';
  }

  if (value === NOTE_STATUS_NONE) {
    return NOTE_STATUS_NONE;
  }

  if (
    value === 'active' ||
    value === 'on-hold' ||
    value === 'completed' ||
    value === 'dropped'
  ) {
    return value;
  }

  throw createInvalidMutationError(
    'A CRDT document must contain a supported status.',
  );
};

const toSafeUpdateId = (value: number | bigint): number => {
  const updateId = Number(value);

  if (!Number.isSafeInteger(updateId) || updateId <= 0) {
    throw createInvalidMutationError('SQLite returned an invalid update ID.');
  }

  return updateId;
};
