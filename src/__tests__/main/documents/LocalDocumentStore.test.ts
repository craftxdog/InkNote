/** @jest-environment node */

import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';

import { LocalDocumentStore } from '../../../main/documents/LocalDocumentStore';
import {
  INITIAL_DOCUMENT_REVISION,
  createArchiveMutation,
  createNotebook,
  createCreateDocumentMutation,
  createMutationId,
  createNoteId,
  createReplaceBodyMutation,
  createRestoreMutation,
  createUpdateOrganizationMutation,
  createUpdateTagsMutation,
  type CreateDocumentMutation,
} from '../../../shared/documents/document.types';

const noteId = createNoteId('note-1');

const createNoteMutation = (
  overrides: Partial<CreateDocumentMutation> = {},
): CreateDocumentMutation =>
  createCreateDocumentMutation({
    id: createMutationId('mutation-create'),
    documentId: noteId,
    baseRevision: INITIAL_DOCUMENT_REVISION,
    source: 'editor',
    title: 'First note',
    body: 'first line\r\nsecond line',
    occurredAt: '2026-10-21T12:00:00.000Z',
    ...overrides,
  });

type RowCount = Readonly<{ count: number }>;

const countRows = (database: Database.Database, table: string): number => {
  const row = database
    .prepare(`SELECT COUNT(*) AS count FROM ${table}`)
    .get() as RowCount;

  return row.count;
};

describe('LocalDocumentStore', () => {
  let databaseDirectory: string;
  let databasePath: string;
  let database: Database.Database;
  let store: LocalDocumentStore;

  const createStore = (filePath: string): LocalDocumentStore => {
    database = new Database(filePath);

    return new LocalDocumentStore(database);
  };

  beforeEach(() => {
    databaseDirectory = mkdtempSync(path.join(tmpdir(), 'inknote-store-'));
    databasePath = path.join(databaseDirectory, 'inknote.sqlite');
    store = createStore(databasePath);
  });

  afterEach(() => {
    store.close();
    rmSync(databaseDirectory, { recursive: true, force: true });
  });

  it('persists a Yjs-backed projection across a database reopen', async () => {
    const created = await store.apply(createNoteMutation());

    expect(created).toEqual({
      id: noteId,
      title: 'First note',
      body: 'first line\nsecond line',
      notebookId: 'inbox',
      status: 'none',
      tags: [],
      createdAt: '2026-10-21T12:00:00.000Z',
      updatedAt: '2026-10-21T12:00:00.000Z',
      revision: 'local-1',
      deletedAt: null,
    });
    expect(await store.get(noteId)).toEqual(created);

    store.close();
    store = createStore(databasePath);

    await expect(store.get(noteId)).resolves.toEqual(created);
  });

  it('creates a consistent SQLite backup without closing the active store', async () => {
    const created = await store.apply(createNoteMutation());
    const backupPath = path.join(databaseDirectory, 'backup.sqlite');

    await store.backupTo(backupPath);

    expect(existsSync(backupPath)).toBe(true);
    const backupDatabase = new Database(backupPath, { readonly: true });
    const backupStore = new LocalDocumentStore(backupDatabase);

    try {
      await expect(backupStore.get(noteId)).resolves.toEqual(created);
      await expect(store.get(noteId)).resolves.toEqual(created);
    } finally {
      backupStore.close();
    }
  });

  it('records one local update and one outbox envelope for an idempotent retry', async () => {
    const mutation = createNoteMutation();

    const first = await store.apply(mutation);
    const retried = await store.apply(mutation);

    expect(retried).toEqual(first);
    expect(countRows(database, 'notes')).toBe(1);
    expect(countRows(database, 'note_crdt_updates')).toBe(1);
    expect(countRows(database, 'sync_outbox')).toBe(1);
    expect(
      database.prepare('SELECT envelope_id FROM sync_outbox').get(),
    ).toEqual({ envelope_id: 'mutation-create' });
  });

  it('scopes a projection revision to its own note instead of all notes', async () => {
    const otherNoteId = createNoteId('note-2');

    const first = await store.apply(createNoteMutation());
    const second = await store.apply(
      createNoteMutation({
        id: createMutationId('mutation-create-second'),
        documentId: otherNoteId,
        title: 'Second note',
      }),
    );

    expect(first.revision).toBe('local-1');
    expect(second.revision).toBe('local-1');
    expect(second.id).toBe(otherNoteId);
    expect(countRows(database, 'notes')).toBe(2);
  });

  it('lists active projections in descending update order and excludes archived notes', async () => {
    const otherNoteId = createNoteId('note-2');
    const first = await store.apply(createNoteMutation());
    const second = await store.apply(
      createNoteMutation({
        id: createMutationId('mutation-create-second'),
        documentId: otherNoteId,
        title: 'Second note',
        occurredAt: '2026-10-21T12:01:00.000Z',
      }),
    );

    await store.apply(
      createArchiveMutation({
        id: createMutationId('mutation-archive-second'),
        documentId: otherNoteId,
        baseRevision: second.revision,
        source: 'command',
        occurredAt: '2026-10-21T12:02:00.000Z',
      }),
    );

    await expect(store.listActive()).resolves.toEqual([first]);
    await expect(store.listArchived()).resolves.toEqual([
      expect.objectContaining({
        id: otherNoteId,
        deletedAt: '2026-10-21T12:02:00.000Z',
      }),
    ]);
  });

  it('restores an archived note into the selected notebook and permanently removes only archived notes', async () => {
    const created = await store.apply(
      createNoteMutation({ tags: ['work', 'reference'] }),
    );
    const archived = await store.apply(
      createArchiveMutation({
        id: createMutationId('mutation-archive'),
        documentId: created.id,
        baseRevision: created.revision,
        source: 'command',
        occurredAt: '2026-10-21T12:01:00.000Z',
      }),
    );

    const restored = await store.apply(
      createRestoreMutation({
        id: createMutationId('mutation-restore-to-work'),
        documentId: archived.id,
        baseRevision: archived.revision,
        source: 'command',
        notebookId: 'work',
        occurredAt: '2026-10-21T12:02:00.000Z',
      }),
    );

    expect(restored).toMatchObject({
      notebookId: 'work',
      deletedAt: null,
      tags: ['reference', 'work'],
    });

    const rearchived = await store.apply(
      createArchiveMutation({
        id: createMutationId('mutation-rearchive'),
        documentId: restored.id,
        baseRevision: restored.revision,
        source: 'command',
        occurredAt: '2026-10-21T12:03:00.000Z',
      }),
    );

    const active = await store.apply(
      createNoteMutation({
        id: createMutationId('mutation-create-active'),
        documentId: createNoteId('active-note'),
      }),
    );
    await expect(
      store.deletePermanently({ noteIds: [rearchived.id, active.id] }),
    ).rejects.toMatchObject({ code: 'INVALID_MUTATION' });
    await expect(store.get(rearchived.id)).resolves.toEqual(rearchived);
    await expect(store.get(active.id)).resolves.toEqual(active);

    await expect(
      store.deletePermanently({ noteIds: [rearchived.id] }),
    ).resolves.toEqual({ deletedNoteIds: [rearchived.id] });
    await expect(store.get(rearchived.id)).resolves.toBeNull();
    expect(countRows(database, 'notes')).toBe(1);
    expect(countRows(database, 'note_crdt_snapshots')).toBe(1);
    expect(countRows(database, 'note_crdt_updates')).toBe(1);
    expect(countRows(database, 'sync_outbox')).toBe(1);
    expect(countRows(database, 'note_tags')).toBe(0);
  });

  it('projects normalized tags from a Yjs mutation through SQLite and a reopen', async () => {
    const created = await store.apply(createNoteMutation());
    const tagged = await store.apply(
      createUpdateTagsMutation({
        id: createMutationId('mutation-tags'),
        documentId: noteId,
        baseRevision: created.revision,
        source: 'editor',
        tags: [' Work ', 'research', 'work'],
        occurredAt: '2026-10-21T12:01:00.000Z',
      }),
    );

    expect(tagged.tags).toEqual(['research', 'work']);
    expect(
      database
        .prepare('SELECT tag_name FROM note_tags ORDER BY tag_name')
        .all(),
    ).toEqual([{ tag_name: 'research' }, { tag_name: 'work' }]);

    store.close();
    store = createStore(databasePath);

    await expect(store.get(noteId)).resolves.toEqual(tagged);
  });

  it('persists None without polluting the task-status sidebar values', async () => {
    const created = await store.apply(createNoteMutation({ status: 'active' }));
    const unset = await store.apply(
      createUpdateOrganizationMutation({
        id: createMutationId('mutation-status-none'),
        documentId: created.id,
        baseRevision: created.revision,
        source: 'editor',
        notebookId: created.notebookId,
        status: 'none',
        occurredAt: '2026-10-21T12:01:00.000Z',
      }),
    );

    expect(unset.status).toBe('none');
    expect(
      database
        .prepare('SELECT status, status_is_none FROM notes WHERE id = ?')
        .get(created.id),
    ).toEqual({ status: 'active', status_is_none: 1 });

    store.close();
    store = createStore(databasePath);

    await expect(store.get(created.id)).resolves.toEqual(unset);
  });

  it('repairs a pre-None-status database whose historical migration is already recorded', async () => {
    store.close();
    rmSync(databasePath, { force: true });

    const legacyDatabase = new Database(databasePath);
    legacyDatabase.exec(`
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
      INSERT INTO schema_migrations(version, applied_at)
      VALUES
        (1, '2026-10-21T12:00:00.000Z'),
        (2, '2026-10-21T12:00:00.000Z'),
        (3, '2026-10-21T12:00:00.000Z'),
        (4, '2026-10-21T12:00:00.000Z'),
        (5, '2026-10-21T12:00:00.000Z'),
        (6, '2026-10-21T12:00:00.000Z');

      CREATE TABLE notes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        notebook_id TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        projection_generation INTEGER NOT NULL,
        revision TEXT NOT NULL
      );
      CREATE TABLE notebooks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL COLLATE NOCASE UNIQUE,
        parent_id TEXT,
        icon TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE tags (
        name TEXT PRIMARY KEY COLLATE NOCASE,
        created_at TEXT NOT NULL
      );
      CREATE TABLE note_tags (
        note_id TEXT NOT NULL,
        tag_name TEXT NOT NULL,
        PRIMARY KEY (note_id, tag_name)
      );
      CREATE TABLE note_crdt_snapshots (
        note_id TEXT PRIMARY KEY,
        snapshot_update BLOB NOT NULL,
        state_vector BLOB NOT NULL,
        snapshot_generation INTEGER NOT NULL,
        compacted_at TEXT NOT NULL
      );
      CREATE TABLE note_crdt_updates (
        update_id INTEGER PRIMARY KEY,
        operation_id TEXT NOT NULL UNIQUE,
        note_id TEXT NOT NULL,
        origin TEXT NOT NULL,
        yjs_update BLOB NOT NULL,
        occurred_at TEXT NOT NULL
      );
      CREATE TABLE sync_outbox (
        envelope_id TEXT PRIMARY KEY,
        update_id INTEGER NOT NULL UNIQUE,
        note_id TEXT NOT NULL,
        status TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        acknowledged_at TEXT
      );
    `);
    legacyDatabase.close();

    store = createStore(databasePath);

    await expect(store.apply(createNoteMutation())).resolves.toMatchObject({
      id: noteId,
      status: 'none',
    });
    expect(
      database
        .prepare('SELECT status, status_is_none FROM notes WHERE id = ?')
        .get(noteId),
    ).toEqual({ status: 'active', status_is_none: 1 });
    expect(
      database
        .prepare('SELECT version FROM schema_migrations WHERE version = 7')
        .get(),
    ).toEqual({ version: 7 });
  });

  it('persists empty notebooks independently from notes', async () => {
    const notebookInput = {
      id: 'research',
      name: 'Research',
      occurredAt: '2026-10-21T12:00:00.000Z',
    };
    const notebook = createNotebook(notebookInput);

    await expect(store.createNotebook(notebookInput)).resolves.toEqual(
      notebook,
    );
    await expect(store.listNotebooks()).resolves.toEqual([
      {
        id: 'inbox',
        name: 'Inbox',
        parentId: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
      notebook,
    ]);

    store.close();
    store = createStore(databasePath);

    await expect(store.listNotebooks()).resolves.toEqual([
      {
        id: 'inbox',
        name: 'Inbox',
        parentId: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
      notebook,
    ]);
  });

  it('persists a child notebook only when its parent exists', async () => {
    await store.createNotebook({
      id: 'work',
      name: 'Work',
      occurredAt: '2026-10-21T12:00:00.000Z',
    });

    await expect(
      store.createNotebook({
        id: 'projects',
        name: 'Projects',
        parentId: 'work',
        occurredAt: '2026-10-21T12:01:00.000Z',
      }),
    ).resolves.toMatchObject({
      id: 'projects',
      parentId: 'work',
    });

    await expect(
      store.createNotebook({
        id: 'orphan',
        name: 'Orphan',
        parentId: 'missing',
        occurredAt: '2026-10-21T12:02:00.000Z',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_MUTATION' });

    await expect(store.listNotebooks()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'work', parentId: null }),
        expect.objectContaining({ id: 'projects', parentId: 'work' }),
      ]),
    );

    store.close();
    store = createStore(databasePath);

    await expect(store.listNotebooks()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'work', parentId: null }),
        expect.objectContaining({ id: 'projects', parentId: 'work' }),
      ]),
    );
  });

  it("trashes a deleted notebook's direct notes and promotes its subnotebooks", async () => {
    await store.createNotebook({
      id: 'work',
      name: 'Work',
      occurredAt: '2026-10-21T12:00:00.000Z',
    });
    await store.createNotebook({
      id: 'projects',
      name: 'Projects',
      parentId: 'work',
      occurredAt: '2026-10-21T12:01:00.000Z',
    });
    const workNote = await store.apply(
      createNoteMutation({
        notebookId: 'work',
        title: 'Work note',
      }),
    );
    const projectNote = await store.apply(
      createNoteMutation({
        id: createMutationId('mutation-create-project'),
        documentId: createNoteId('project-note'),
        notebookId: 'projects',
        title: 'Project note',
      }),
    );

    await expect(
      store.deleteNotebook({
        id: 'work',
        occurredAt: '2026-10-21T12:02:00.000Z',
      }),
    ).resolves.toEqual({
      deletedNotebookId: 'work',
      archivedNoteIds: [workNote.id],
      reparentedNotebookIds: ['projects'],
    });

    await expect(store.listActive()).resolves.toEqual([projectNote]);
    await expect(store.listArchived()).resolves.toEqual([
      expect.objectContaining({
        id: workNote.id,
        deletedAt: '2026-10-21T12:02:00.000Z',
      }),
    ]);
    await expect(store.listNotebooks()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'projects', parentId: null }),
      ]),
    );
    await expect(store.listNotebooks()).resolves.not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'work' })]),
    );
  });

  it('does not allow the Inbox notebook to be deleted', async () => {
    await expect(
      store.deleteNotebook({
        id: 'inbox',
        occurredAt: '2026-10-21T12:00:00.000Z',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_MUTATION' });
  });

  it('rolls back a rejected mutation without appending an update or outbox envelope', async () => {
    const created = await store.apply(createNoteMutation());

    await expect(
      store.apply(
        createReplaceBodyMutation({
          id: createMutationId('mutation-stale'),
          documentId: noteId,
          baseRevision: INITIAL_DOCUMENT_REVISION,
          source: 'editor',
          body: 'must not persist',
          occurredAt: '2026-10-21T12:01:00.000Z',
        }),
      ),
    ).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });

    await expect(store.get(noteId)).resolves.toEqual(created);
    expect(countRows(database, 'note_crdt_updates')).toBe(1);
    expect(countRows(database, 'sync_outbox')).toBe(1);
  });

  it('rolls back every local record when the outbox insert cannot commit', async () => {
    database.exec(`
      CREATE TRIGGER reject_outbox_insert
      BEFORE INSERT ON sync_outbox
      BEGIN
        SELECT RAISE(ABORT, 'simulated outbox failure');
      END;
    `);

    await expect(store.apply(createNoteMutation())).rejects.toThrow(
      'simulated outbox failure',
    );

    expect(countRows(database, 'notes')).toBe(0);
    expect(countRows(database, 'note_crdt_snapshots')).toBe(0);
    expect(countRows(database, 'note_crdt_updates')).toBe(0);
    expect(countRows(database, 'sync_outbox')).toBe(0);
  });

  it('converges two local replicas and never echoes a remote update into the outbox', async () => {
    const firstReplica = store;
    const secondDirectory = mkdtempSync(
      path.join(tmpdir(), 'inknote-store-second-'),
    );
    const secondDatabase = new Database(
      path.join(secondDirectory, 'inknote.sqlite'),
    );
    const secondReplica = new LocalDocumentStore(secondDatabase);

    try {
      await firstReplica.apply(
        createNoteMutation({
          id: createMutationId('mutation-first-replica'),
          title: 'First title',
          body: 'First body',
        }),
      );
      await secondReplica.apply(
        createNoteMutation({
          id: createMutationId('mutation-second-replica'),
          title: 'Second title',
          body: 'Second body',
        }),
      );

      const [firstUpdate] = firstReplica.getPendingLocalUpdates(noteId);
      const [secondUpdate] = secondReplica.getPendingLocalUpdates(noteId);

      await secondReplica.applyRemoteUpdate(firstUpdate);
      await firstReplica.applyRemoteUpdate(secondUpdate);
      await secondReplica.applyRemoteUpdate(firstUpdate);

      await expect(firstReplica.get(noteId)).resolves.toEqual(
        await secondReplica.get(noteId),
      );
      expect(countRows(database, 'sync_outbox')).toBe(1);
      expect(countRows(secondDatabase, 'sync_outbox')).toBe(1);
      expect(countRows(secondDatabase, 'note_crdt_updates')).toBe(2);
    } finally {
      secondReplica.close();
      rmSync(secondDirectory, { recursive: true, force: true });
    }
  });
});
