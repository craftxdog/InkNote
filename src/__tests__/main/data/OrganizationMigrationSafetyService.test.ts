/** @jest-environment node */

import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';

import { OrganizationMigrationSafetyService } from '../../../main/data/OrganizationMigrationSafetyService';

const createVersion7Database = (databasePath: string): void => {
  const database = new Database(databasePath);

  database.exec(`
    CREATE TABLE schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
    INSERT INTO schema_migrations(version, applied_at)
    VALUES (7, '2026-10-25T12:00:00.000Z');
  `);
  database.close();
};

describe('OrganizationMigrationSafetyService', () => {
  let temporaryDirectory: string;
  let dataDirectory: string;
  let databasePath: string;

  beforeEach(async () => {
    temporaryDirectory = await mkdtemp(
      path.join(os.tmpdir(), 'inknote-migration-safety-'),
    );
    dataDirectory = path.join(temporaryDirectory, 'user-data');
    databasePath = path.join(dataDirectory, 'inknote.sqlite');
  });

  afterEach(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  const createService = (
    snapshotDatabase?: (
      database: Database.Database,
      destination: string,
    ) => Promise<void>,
  ) =>
    new OrganizationMigrationSafetyService({
      dataDirectory,
      databasePath,
      now: () => '2026-10-25T12:00:00.000Z',
      ...(snapshotDatabase === undefined ? {} : { snapshotDatabase }),
    });

  const createPendingDatabase = async (): Promise<void> => {
    await mkdir(dataDirectory, { recursive: true });
    createVersion7Database(databasePath);
  };

  it('creates one online snapshot before an existing database reaches the organization migration', async () => {
    await createPendingDatabase();
    const service = createService();

    const safetyCopy = await service.ensureSnapshotBeforeMigration();

    expect(safetyCopy).toEqual({
      snapshotFile: expect.stringMatching(
        /before-organization-migration\.sqlite$/,
      ),
      manifestFile: expect.stringMatching(/manifest\.json$/),
      sourceSchemaVersion: 7,
      targetSchemaVersion: 9,
    });
    expect(existsSync(safetyCopy?.snapshotFile ?? '')).toBe(true);
    await expect(
      readFile(safetyCopy?.manifestFile ?? '', 'utf8'),
    ).resolves.toContain('inknote-organization-migration-safety');

    const snapshotDatabase = new Database(safetyCopy?.snapshotFile ?? '', {
      readonly: true,
    });

    try {
      expect(
        snapshotDatabase
          .prepare('SELECT MAX(version) AS version FROM schema_migrations')
          .get(),
      ).toEqual({ version: 7 });
    } finally {
      snapshotDatabase.close();
    }

    await expect(service.getRetainedSnapshotFile()).resolves.toBe(
      safetyCopy?.snapshotFile,
    );
  });

  it('does not create a needless safety copy for a fresh profile', async () => {
    const service = createService();

    await expect(service.ensureSnapshotBeforeMigration()).resolves.toBeNull();
    await expect(service.getRetainedSnapshotFile()).resolves.toBeNull();
    expect(
      existsSync(path.join(dataDirectory, 'organization-migration-safety')),
    ).toBe(false);
  });

  it('reuses only a valid snapshot for the same pending source version', async () => {
    await createPendingDatabase();
    const snapshotDatabase = jest.fn(
      async (database: Database.Database, destination: string) => {
        await database.backup(destination);
      },
    );
    const service = createService(snapshotDatabase);

    const first = await service.ensureSnapshotBeforeMigration();
    const second = await service.ensureSnapshotBeforeMigration();

    expect(second).toEqual(first);
    expect(snapshotDatabase).toHaveBeenCalledTimes(1);
  });

  it('rejects an incomplete or invalid retained snapshot instead of replacing it', async () => {
    await createPendingDatabase();
    const safetyDirectory = path.join(
      dataDirectory,
      'organization-migration-safety',
      'v9-from-v7',
    );
    await mkdir(safetyDirectory, { recursive: true });
    await writeFile(path.join(safetyDirectory, 'manifest.json'), '{}', {
      flag: 'a',
    });
    const service = createService();

    await expect(service.ensureSnapshotBeforeMigration()).rejects.toThrow(
      'retained migration safety snapshot is invalid',
    );
    await expect(service.getRetainedSnapshotFile()).resolves.toBeNull();
  });

  it('fails closed when the online snapshot cannot be written', async () => {
    await createPendingDatabase();
    const service = createService(async () => {
      throw new Error('disk is full');
    });

    await expect(service.ensureSnapshotBeforeMigration()).rejects.toThrow(
      'Could not create the organization migration safety snapshot',
    );

    const sourceDatabase = new Database(databasePath, { readonly: true });

    try {
      expect(
        sourceDatabase
          .prepare('SELECT MAX(version) AS version FROM schema_migrations')
          .get(),
      ).toEqual({ version: 7 });
    } finally {
      sourceDatabase.close();
    }
  });
});
