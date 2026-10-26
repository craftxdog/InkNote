/** @jest-environment node */

import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';
import * as Y from 'yjs';

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
  createUpdatePinnedMutation,
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

const createVersion7TagFixture = (databasePath: string): void => {
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
      (7, '2026-10-21T12:00:00.000Z');

    CREATE TABLE notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      notebook_id TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      status_is_none INTEGER NOT NULL DEFAULT 0,
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
  `);
  legacyDatabase
    .prepare(
      `INSERT INTO notes(
        id, title, body, notebook_id, status, status_is_none, created_at,
        updated_at, deleted_at, projection_generation, revision
      ) VALUES (?, ?, ?, 'inbox', 'active', 0, ?, ?, ?, 1, 'local-1')`,
    )
    .run(
      'active-note',
      'Active note',
      '- [x] Migrated task',
      '2026-10-21T12:00:00.000Z',
      '2026-10-21T12:00:00.000Z',
      null,
    );
  legacyDatabase
    .prepare(
      `INSERT INTO notes(
        id, title, body, notebook_id, status, status_is_none, created_at,
        updated_at, deleted_at, projection_generation, revision
      ) VALUES (?, ?, ?, 'inbox', 'active', 0, ?, ?, ?, 1, 'local-1')`,
    )
    .run(
      'archived-note',
      'Archived note',
      '- [ ] Archived migrated task',
      '2026-10-21T12:00:00.000Z',
      '2026-10-21T12:00:00.000Z',
      '2026-10-21T12:01:00.000Z',
    );
  legacyDatabase
    .prepare('INSERT INTO tags(name, created_at) VALUES (?, ?)')
    .run('active', '2026-10-21T12:00:00.000Z');
  legacyDatabase
    .prepare('INSERT INTO tags(name, created_at) VALUES (?, ?)')
    .run('archived', '2026-10-21T12:00:00.000Z');
  legacyDatabase
    .prepare('INSERT INTO tags(name, created_at) VALUES (?, ?)')
    .run('unused', '2026-10-21T12:00:00.000Z');
  legacyDatabase
    .prepare('INSERT INTO note_tags(note_id, tag_name) VALUES (?, ?)')
    .run('active-note', 'active');
  legacyDatabase
    .prepare('INSERT INTO note_tags(note_id, tag_name) VALUES (?, ?)')
    .run('archived-note', 'archived');
  legacyDatabase.close();
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
      doctype: 'markdown',
      pinned: false,
      numOfTasks: 0,
      numOfCheckedTasks: 0,
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
        .prepare(
          `SELECT tags.name
           FROM note_tags
           INNER JOIN tags ON tags.id = note_tags.tag_id
           ORDER BY tags.name`,
        )
        .all(),
    ).toEqual([{ name: 'research' }, { name: 'work' }]);

    store.close();
    store = createStore(databasePath);

    await expect(store.get(noteId)).resolves.toEqual(tagged);
  });

  it('projects Markdown task metadata and pins with one local update and outbox record', async () => {
    const created = await store.apply(createNoteMutation());
    const withTasks = await store.apply(
      createReplaceBodyMutation({
        id: createMutationId('mutation-tasks'),
        documentId: created.id,
        baseRevision: created.revision,
        source: 'editor',
        body: '- [x] Complete the migration\n- [ ] Verify the snapshot',
        occurredAt: '2026-10-21T12:01:00.000Z',
      }),
    );
    const updatesBeforePin = countRows(database, 'note_crdt_updates');
    const outboxBeforePin = countRows(database, 'sync_outbox');
    const pinned = await store.apply(
      createUpdatePinnedMutation({
        id: createMutationId('mutation-pin'),
        documentId: withTasks.id,
        baseRevision: withTasks.revision,
        source: 'command',
        pinned: true,
        occurredAt: '2026-10-21T12:02:00.000Z',
      }),
    );

    expect(withTasks).toMatchObject({
      doctype: 'markdown',
      pinned: false,
      numOfTasks: 2,
      numOfCheckedTasks: 1,
    });
    expect(pinned).toMatchObject({
      pinned: true,
      numOfTasks: 2,
      numOfCheckedTasks: 1,
    });
    expect(countRows(database, 'note_crdt_updates')).toBe(updatesBeforePin + 1);
    expect(countRows(database, 'sync_outbox')).toBe(outboxBeforePin + 1);
  });

  it('projects legacy Yjs metadata with Markdown and unpinned defaults', async () => {
    const legacyDocument = new Y.Doc();

    try {
      legacyDocument.getText('title').insert(0, 'Legacy remote note');
      legacyDocument.getText('body').insert(0, '- [ ] Preserve defaults');
      const metadata = legacyDocument.getMap<unknown>('metadata');

      metadata.set('createdAt', '2026-10-21T12:00:00.000Z');
      metadata.set('updatedAt', '2026-10-21T12:00:00.000Z');
      metadata.set('deletedAt', null);
      metadata.set('notebookId', 'inbox');
      metadata.set('status', 'active');

      const document = await store.applyRemoteUpdate({
        id: 'legacy-remote-update',
        documentId: createNoteId('legacy-remote-note'),
        update: Y.encodeStateAsUpdate(legacyDocument),
        occurredAt: '2026-10-21T12:00:00.000Z',
      });

      expect(document).toMatchObject({
        doctype: 'markdown',
        pinned: false,
        numOfTasks: 1,
        numOfCheckedTasks: 0,
      });
    } finally {
      legacyDocument.destroy();
    }
  });

  it('resolves create and update tag names to IDs atomically', async () => {
    const created = await store.apply(createNoteMutation({ tags: ['draft'] }));

    expect(
      database
        .prepare(
          `SELECT tags.name
           FROM note_tags
           INNER JOIN tags ON tags.id = note_tags.tag_id
           WHERE note_tags.note_id = ?`,
        )
        .all(created.id),
    ).toEqual([{ name: 'draft' }]);

    database.exec(`
      CREATE TRIGGER reject_tag_replacement
      BEFORE INSERT ON note_tags
      BEGIN
        SELECT RAISE(ABORT, 'simulated tag attach failure');
      END;
    `);

    await expect(
      store.apply(
        createUpdateTagsMutation({
          id: createMutationId('mutation-replace-tags'),
          documentId: created.id,
          baseRevision: created.revision,
          source: 'editor',
          tags: ['published'],
          occurredAt: '2026-10-21T12:01:00.000Z',
        }),
      ),
    ).rejects.toThrow('simulated tag attach failure');

    await expect(store.get(created.id)).resolves.toMatchObject({
      tags: ['draft'],
    });
    expect(
      database
        .prepare('SELECT name FROM tags ORDER BY name COLLATE NOCASE')
        .all(),
    ).toEqual([{ name: 'draft' }]);
  });

  it('lists immutable tag summaries with counts derived from active notes only', async () => {
    const active = await store.apply(
      createNoteMutation({ tags: ['active', 'shared'] }),
    );
    const archivedSource = await store.apply(
      createNoteMutation({
        id: createMutationId('mutation-create-archived-tag'),
        documentId: createNoteId('archived-tag-note'),
        tags: ['archived', 'shared'],
      }),
    );
    await store.apply(
      createArchiveMutation({
        id: createMutationId('mutation-archive-tagged-note'),
        documentId: archivedSource.id,
        baseRevision: archivedSource.revision,
        source: 'command',
        occurredAt: '2026-10-21T12:01:00.000Z',
      }),
    );
    const unusedSource = await store.apply(
      createNoteMutation({
        id: createMutationId('mutation-create-unused-tag'),
        documentId: createNoteId('unused-tag-note'),
        tags: ['unused'],
      }),
    );
    await store.apply(
      createUpdateTagsMutation({
        id: createMutationId('mutation-remove-unused-tag'),
        documentId: unusedSource.id,
        baseRevision: unusedSource.revision,
        source: 'editor',
        tags: ['active'],
        occurredAt: '2026-10-21T12:01:00.000Z',
      }),
    );

    const tags = await store.listTags();

    expect(tags).toEqual([
      expect.objectContaining({
        id: expect.stringMatching(/^tag:/),
        name: 'active',
        color: 'default',
        count: 2,
      }),
      expect.objectContaining({ name: 'archived', count: 0 }),
      expect.objectContaining({ name: 'shared', count: 1 }),
      expect.objectContaining({ name: 'unused', count: 0 }),
    ]);
    expect(Object.isFrozen(tags)).toBe(true);
    expect(Object.isFrozen(tags[0])).toBe(true);
    expect(active.tags).toEqual(['active', 'shared']);
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

  it('migrates version-7 tags to durable IDs without losing archived or unused tags', async () => {
    store.close();
    rmSync(databasePath, { force: true });
    createVersion7TagFixture(databasePath);

    store = createStore(databasePath);

    await expect(store.listActive()).resolves.toEqual([
      expect.objectContaining({
        id: 'active-note',
        tags: ['active'],
        numOfTasks: 1,
        numOfCheckedTasks: 1,
      }),
    ]);
    await expect(store.listArchived()).resolves.toEqual([
      expect.objectContaining({
        id: 'archived-note',
        tags: ['archived'],
        numOfTasks: 1,
        numOfCheckedTasks: 0,
      }),
    ]);
    expect(
      database
        .prepare<[], { name: string }>('PRAGMA table_info(note_tags)')
        .all()
        .map((column: { name: string }) => column.name),
    ).toEqual(['note_id', 'tag_id']);
    expect(
      database
        .prepare(
          'SELECT id, name, color FROM tags ORDER BY name COLLATE NOCASE',
        )
        .all(),
    ).toEqual([
      { id: expect.stringMatching(/^tag:/), name: 'active', color: 'default' },
      {
        id: expect.stringMatching(/^tag:/),
        name: 'archived',
        color: 'default',
      },
      { id: expect.stringMatching(/^tag:/), name: 'unused', color: 'default' },
    ]);
    expect(
      database
        .prepare(
          `SELECT note_tags.note_id, tags.name
           FROM note_tags
           INNER JOIN tags ON tags.id = note_tags.tag_id
           ORDER BY note_tags.note_id`,
        )
        .all(),
    ).toEqual([
      { note_id: 'active-note', name: 'active' },
      { note_id: 'archived-note', name: 'archived' },
    ]);
    expect(
      database
        .prepare('SELECT version FROM schema_migrations WHERE version = 8')
        .get(),
    ).toEqual({ version: 8 });

    store.close();
    store = createStore(databasePath);

    await expect(store.listArchived()).resolves.toEqual([
      expect.objectContaining({ id: 'archived-note', tags: ['archived'] }),
    ]);
  });

  it('rolls back the tag-ID migration when its final migration record cannot be written', () => {
    store.close();
    rmSync(databasePath, { force: true });
    createVersion7TagFixture(databasePath);

    const legacyDatabase = new Database(databasePath);
    legacyDatabase.exec(`
      CREATE TRIGGER reject_tag_id_migration
      BEFORE INSERT ON schema_migrations
      WHEN NEW.version = 8
      BEGIN
        SELECT RAISE(ABORT, 'simulated tag migration failure');
      END;
    `);
    legacyDatabase.close();

    expect(() => createStore(databasePath)).toThrow(
      'simulated tag migration failure',
    );
    database.close();

    const verificationDatabase = new Database(databasePath, { readonly: true });

    try {
      expect(
        verificationDatabase
          .prepare<[], { name: string }>('PRAGMA table_info(note_tags)')
          .all()
          .map((column: { name: string }) => column.name),
      ).toEqual(['note_id', 'tag_name']);
      expect(
        verificationDatabase
          .prepare('SELECT version FROM schema_migrations WHERE version = 8')
          .get(),
      ).toBeUndefined();
    } finally {
      verificationDatabase.close();
    }
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
