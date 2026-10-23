/** @jest-environment node */

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { RestoreDatabaseService } from '../../../main/data/RestoreDatabaseService';

describe('RestoreDatabaseService', () => {
  let temporaryDirectory: string;
  let dataDirectory: string;
  let databasePath: string;
  let backupFile: string;

  beforeEach(async () => {
    temporaryDirectory = await mkdtemp(
      path.join(os.tmpdir(), 'inknote-restore-'),
    );
    dataDirectory = path.join(temporaryDirectory, 'user-data');
    databasePath = path.join(dataDirectory, 'inknote.sqlite');
    backupFile = path.join(
      temporaryDirectory,
      'backup',
      'data',
      'inknote.sqlite',
    );
    await mkdir(path.dirname(backupFile), { recursive: true });
    await mkdir(dataDirectory, { recursive: true });
    await writeFile(databasePath, 'live data', 'utf8');
    await writeFile(backupFile, 'backup data', 'utf8');
  });

  afterEach(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  it('makes a safety backup before atomically replacing the local database', async () => {
    const closeDatabase = jest.fn();
    const service = new RestoreDatabaseService({
      dataDirectory,
      databasePath,
      snapshotDatabase: async (destination) => {
        await writeFile(destination, 'consistent live data', 'utf8');
      },
      closeDatabase,
      now: () => '2026-10-23T16:30:00.000Z',
    });

    const result = await service.restoreFrom(backupFile);

    expect(closeDatabase).toHaveBeenCalledTimes(1);
    await expect(readFile(databasePath, 'utf8')).resolves.toBe('backup data');
    await expect(readFile(result.safetyBackupFile, 'utf8')).resolves.toBe(
      'consistent live data',
    );
    expect(result).toEqual({
      restoredFrom: backupFile,
      safetyBackupFile: path.join(
        dataDirectory,
        'restore-safety',
        '2026-10-23T16-30-00-000Z',
        'before-restore.sqlite',
      ),
    });
  });

  it('does not close or replace the live database when the safety snapshot fails', async () => {
    const closeDatabase = jest.fn();
    const service = new RestoreDatabaseService({
      dataDirectory,
      databasePath,
      snapshotDatabase: async () => {
        throw new Error('disk is full');
      },
      closeDatabase,
    });

    await expect(service.restoreFrom(backupFile)).rejects.toThrow(
      'disk is full',
    );

    expect(closeDatabase).not.toHaveBeenCalled();
    await expect(readFile(databasePath, 'utf8')).resolves.toBe('live data');
  });
});
