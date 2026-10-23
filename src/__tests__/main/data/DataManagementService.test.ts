/** @jest-environment node */

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { DataManagementService } from '../../../main/data/DataManagementService';

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
  ) =>
    new DataManagementService({
      dataDirectory: path.join(temporaryDirectory, 'user-data'),
      snapshotDatabase: onSnapshot,
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
    });
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
