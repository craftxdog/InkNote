/** @jest-environment node */

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';

import { DataManagementService } from '../../../main/data/DataManagementService';
import {
  LocalDocumentStore,
  ORGANIZATION_DATA_MODEL_SCHEMA_VERSION,
} from '../../../main/documents/LocalDocumentStore';

describe('DataManagementService', () => {
  let temporaryDirectory: string;

  beforeEach(async () => {
    temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'inknote-data-'));
  });

  afterEach(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  const createService = (
    onSnapshot = async (destination: string) => {
      await writeFile(destination, 'sqlite snapshot', 'utf8');
    },
    migrationSafetySnapshotFile = async (): Promise<string | null> => null,
  ) =>
    new DataManagementService({
      dataDirectory: path.join(temporaryDirectory, 'user-data'),
      snapshotDatabase: onSnapshot,
      migrationSafetySnapshotFile,
      now: () => '2026-10-23T15:00:00.000Z',
    });

  it('configures an absolute backup directory and writes a managed snapshot', async () => {
    const service = createService();
    const backupDirectory = path.join(temporaryDirectory, 'backup');

    await expect(service.configureBackup(backupDirectory)).resolves.toEqual({
      backupDirectory,
      backupFile: path.join(backupDirectory, 'data', 'inknote.sqlite'),
    });

    await expect(
      readFile(path.join(backupDirectory, 'data', 'inknote.sqlite'), 'utf8'),
    ).resolves.toBe('sqlite snapshot');
    await expect(
      readFile(path.join(backupDirectory, 'manifest.json'), 'utf8'),
    ).resolves.toContain('inknote-backup');
    await expect(service.getInfo()).resolves.toEqual({
      dataDirectory: path.join(temporaryDirectory, 'user-data'),
      backupDirectory,
      migrationSafetySnapshotFile: null,
    });
  });

  it('refreshes the configured backup without changing its directory', async () => {
    const snapshotDatabase = jest.fn(async (destination: string) => {
      await writeFile(destination, 'sqlite snapshot', 'utf8');
    });
    const service = createService(snapshotDatabase);
    const backupDirectory = path.join(temporaryDirectory, 'backup');

    await service.configureBackup(backupDirectory);
    snapshotDatabase.mockClear();

    await expect(service.refreshConfiguredBackup()).resolves.toEqual({
      backupDirectory,
      backupFile: path.join(backupDirectory, 'data', 'inknote.sqlite'),
    });
    expect(snapshotDatabase).toHaveBeenCalledTimes(1);
    expect(snapshotDatabase.mock.calls[0]?.[0]).toMatch(
      /inknote\.sqlite\.\d+\.tmp$/,
    );
  });

  it('returns null when no backup directory has been configured', async () => {
    const service = createService();

    await expect(service.refreshConfiguredBackup()).resolves.toBeNull();
  });

  it('does not persist a backup directory when its initial snapshot fails', async () => {
    const service = createService(async () => {
      throw new Error('disk is full');
    });
    const backupDirectory = path.join(temporaryDirectory, 'backup');

    await expect(service.configureBackup(backupDirectory)).rejects.toThrow(
      'disk is full',
    );
    await expect(service.getInfo()).resolves.toEqual({
      dataDirectory: path.join(temporaryDirectory, 'user-data'),
      backupDirectory: null,
      migrationSafetySnapshotFile: null,
    });
  });

  it('reports a retained organization-migration safety snapshot when one is available', async () => {
    const safetySnapshotFile = path.join(
      temporaryDirectory,
      'user-data',
      'organization-migration-safety',
      'v9-from-v7',
      'before-organization-migration.sqlite',
    );
    const service = createService(undefined, async () => safetySnapshotFile);

    await expect(service.getInfo()).resolves.toEqual({
      dataDirectory: path.join(temporaryDirectory, 'user-data'),
      backupDirectory: null,
      migrationSafetySnapshotFile: safetySnapshotFile,
    });
  });

  it('backs up the current organization schema in a restore-accepted managed backup', async () => {
    const dataDirectory = path.join(temporaryDirectory, 'upgraded-user-data');
    const databasePath = path.join(dataDirectory, 'inknote.sqlite');
    const backupDirectory = path.join(temporaryDirectory, 'backup');
    await mkdir(dataDirectory, { recursive: true });
    const store = new LocalDocumentStore(new Database(databasePath));
    const service = new DataManagementService({
      dataDirectory,
      snapshotDatabase: (destination) => store.backupTo(destination),
    });

    try {
      const backup = await service.configureBackup(backupDirectory);
      const backupDatabase = new Database(backup.backupFile, {
        readonly: true,
      });

      try {
        expect(
          backupDatabase
            .prepare('SELECT MAX(version) AS version FROM schema_migrations')
            .get(),
        ).toEqual({ version: ORGANIZATION_DATA_MODEL_SCHEMA_VERSION });
      } finally {
        backupDatabase.close();
      }

      await expect(service.backupFileForRestore(backupDirectory)).resolves.toBe(
        backup.backupFile,
      );
    } finally {
      store.close();
    }
  });

  it('rejects a relative backup path before accessing the filesystem', async () => {
    const service = createService();

    await expect(
      service.configureBackup('relative/backup'),
    ).rejects.toMatchObject({ code: 'INVALID_DATA_PATH' });
  });

  it('accepts only backup folders produced by InkNote', async () => {
    const service = createService();
    const backupDirectory = path.join(temporaryDirectory, 'backup');

    await service.configureBackup(backupDirectory);

    await expect(service.backupFileForRestore(backupDirectory)).resolves.toBe(
      path.join(backupDirectory, 'data', 'inknote.sqlite'),
    );
    await expect(
      service.backupFileForRestore(path.join(temporaryDirectory, 'unknown')),
    ).rejects.toMatchObject({ code: 'BACKUP_NOT_FOUND' });
  });
});
