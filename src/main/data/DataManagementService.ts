import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  createBackupNotFoundError,
  createInvalidBackupError,
} from '../../shared/data/data.errors';
import {
  validateAbsolutePath,
  type BackupResult,
  type DataManagementInfo,
} from '../../shared/data/data.types';

const SETTINGS_FILE_NAME = 'inknote-data-management.json';
const BACKUP_MANIFEST_FILE_NAME = 'manifest.json';
const BACKUP_DATA_DIRECTORY_NAME = 'data';
const BACKUP_DATABASE_FILE_NAME = 'inknote.sqlite';
const BACKUP_FORMAT = 'inknote-backup';
const BACKUP_FORMAT_VERSION = 1;

type BackupManifest = Readonly<{
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_FORMAT_VERSION;
  createdAt: string;
}>;

type DataManagementSettings = Readonly<{
  backupDirectory: string | null;
}>;

type DataManagementServiceOptions = Readonly<{
  dataDirectory: string;
  snapshotDatabase: (destination: string) => Promise<void>;
  migrationSafetySnapshotFile?: () => Promise<string | null>;
  now?: () => string;
}>;

/**
 * Owns local backup configuration and validation. The snapshot function is
 * injected by the SQLite store so this class never exposes database handles or
 * filesystem capabilities to renderer code.
 */
export class DataManagementService {
  private readonly dataDirectory: string;

  private readonly snapshotDatabase: (destination: string) => Promise<void>;

  private readonly migrationSafetySnapshotFile: () => Promise<string | null>;

  private readonly now: () => string;

  constructor(options: DataManagementServiceOptions) {
    this.dataDirectory = validateAbsolutePath(
      options.dataDirectory,
      'Data directory',
    );
    this.snapshotDatabase = options.snapshotDatabase;
    this.migrationSafetySnapshotFile =
      options.migrationSafetySnapshotFile ?? (async () => null);
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async getInfo(): Promise<DataManagementInfo> {
    const [settings, retainedSnapshotFile] = await Promise.all([
      this.readSettings(),
      this.migrationSafetySnapshotFile(),
    ]);
    const migrationSafetySnapshotFile =
      retainedSnapshotFile === null
        ? null
        : validateAbsolutePath(
            retainedSnapshotFile,
            'Organization migration safety snapshot',
          );

    return Object.freeze({
      dataDirectory: this.dataDirectory,
      backupDirectory: settings.backupDirectory,
      migrationSafetySnapshotFile,
    });
  }

  async configureBackup(directory: string): Promise<BackupResult> {
    const backupDirectory = validateAbsolutePath(directory, 'Backup directory');

    await this.ensureBackupDirectory(backupDirectory);
    const backup = await this.createBackup(backupDirectory);

    await this.writeSettings({ backupDirectory });

    return backup;
  }

  async refreshConfiguredBackup(): Promise<BackupResult | null> {
    const { backupDirectory } = await this.readSettings();

    return backupDirectory === null ? null : this.createBackup(backupDirectory);
  }

  async backupFileForRestore(directory: string): Promise<string> {
    const backupDirectory = validateAbsolutePath(directory, 'Backup directory');
    const manifest = await this.readBackupManifest(backupDirectory);

    if (manifest === null) {
      throw createBackupNotFoundError();
    }

    if (
      manifest.format !== BACKUP_FORMAT ||
      manifest.version !== BACKUP_FORMAT_VERSION ||
      !isIsoDate(manifest.createdAt)
    ) {
      throw createInvalidBackupError();
    }

    const backupFile = this.backupFileFor(backupDirectory);

    try {
      const details = await stat(backupFile);

      if (!details.isFile()) {
        throw createBackupNotFoundError();
      }
    } catch {
      throw createBackupNotFoundError();
    }

    return backupFile;
  }

  private async createBackup(backupDirectory: string): Promise<BackupResult> {
    await this.ensureBackupDirectory(backupDirectory);

    const backupFile = this.backupFileFor(backupDirectory);
    const stagingFile = `${backupFile}.${process.pid}.tmp`;

    try {
      await this.snapshotDatabase(stagingFile);
      await rename(stagingFile, backupFile);
      await this.writeBackupManifest(backupDirectory);
    } finally {
      await rm(stagingFile, { force: true });
    }

    return Object.freeze({ backupDirectory, backupFile });
  }

  private async ensureBackupDirectory(backupDirectory: string): Promise<void> {
    await mkdir(path.join(backupDirectory, BACKUP_DATA_DIRECTORY_NAME), {
      recursive: true,
    });
  }

  private backupFileFor(backupDirectory: string): string {
    return path.join(
      backupDirectory,
      BACKUP_DATA_DIRECTORY_NAME,
      BACKUP_DATABASE_FILE_NAME,
    );
  }

  private async readSettings(): Promise<DataManagementSettings> {
    const settingsFile = path.join(this.dataDirectory, SETTINGS_FILE_NAME);

    try {
      const source = await readFile(settingsFile, 'utf8');
      const parsed = JSON.parse(source) as unknown;

      if (!isRecord(parsed)) {
        return Object.freeze({ backupDirectory: null });
      }

      const backupDirectory = parsed.backupDirectory;

      return Object.freeze({
        backupDirectory:
          backupDirectory === null || backupDirectory === undefined
            ? null
            : validateAbsolutePath(backupDirectory, 'Backup directory'),
      });
    } catch (error) {
      if (isFileNotFoundError(error)) {
        return Object.freeze({ backupDirectory: null });
      }

      throw error;
    }
  }

  private async writeSettings(settings: DataManagementSettings): Promise<void> {
    await mkdir(this.dataDirectory, { recursive: true });
    await writeJsonAtomically(
      path.join(this.dataDirectory, SETTINGS_FILE_NAME),
      settings,
    );
  }

  private async readBackupManifest(
    backupDirectory: string,
  ): Promise<BackupManifest | null> {
    try {
      const source = await readFile(
        path.join(backupDirectory, BACKUP_MANIFEST_FILE_NAME),
        'utf8',
      );
      const parsed = JSON.parse(source) as unknown;

      if (!isRecord(parsed)) {
        return null;
      }

      return {
        format: parsed.format as BackupManifest['format'],
        version: parsed.version as BackupManifest['version'],
        createdAt: parsed.createdAt as string,
      };
    } catch (error) {
      if (isFileNotFoundError(error)) {
        return null;
      }

      throw error;
    }
  }

  private async writeBackupManifest(backupDirectory: string): Promise<void> {
    const manifest: BackupManifest = {
      format: BACKUP_FORMAT,
      version: BACKUP_FORMAT_VERSION,
      createdAt: this.now(),
    };

    await writeJsonAtomically(
      path.join(backupDirectory, BACKUP_MANIFEST_FILE_NAME),
      manifest,
    );
  }
}

const writeJsonAtomically = async (
  destination: string,
  value: unknown,
): Promise<void> => {
  const temporaryFile = `${destination}.${process.pid}.tmp`;

  await writeFile(temporaryFile, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporaryFile, destination);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isFileNotFoundError = (error: unknown): boolean =>
  isRecord(error) && error.code === 'ENOENT';

const isIsoDate = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value));
