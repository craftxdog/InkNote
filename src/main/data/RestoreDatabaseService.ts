import { copyFile, mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';

import { validateAbsolutePath } from '../../shared/data/data.types';

type RestoreDatabaseServiceOptions = Readonly<{
  dataDirectory: string;
  databasePath: string;
  snapshotDatabase: (destination: string) => Promise<void>;
  closeDatabase: () => void;
  now?: () => string;
}>;

type MovedDatabaseFile = Readonly<{
  source: string;
  destination: string;
}>;

/**
 * Replaces the local SQLite database only after preserving an online backup.
 * The former database and sidecars are kept beside that snapshot until a
 * caller explicitly manages the resulting safety copy.
 */
export class RestoreDatabaseService {
  private readonly dataDirectory: string;

  private readonly databasePath: string;

  private readonly snapshotDatabase: (destination: string) => Promise<void>;

  private readonly closeDatabase: () => void;

  private readonly now: () => string;

  constructor(options: RestoreDatabaseServiceOptions) {
    this.dataDirectory = validateAbsolutePath(
      options.dataDirectory,
      'Data directory',
    );
    this.databasePath = validateAbsolutePath(
      options.databasePath,
      'Database file',
    );
    this.snapshotDatabase = options.snapshotDatabase;
    this.closeDatabase = options.closeDatabase;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async restoreFrom(backupFile: string): Promise<{
    restoredFrom: string;
    safetyBackupFile: string;
  }> {
    const source = validateAbsolutePath(backupFile, 'Backup file');
    const restoreDirectory = path.join(
      this.dataDirectory,
      'restore-safety',
      this.restoreDirectoryName(),
    );
    const safetyBackupFile = path.join(
      restoreDirectory,
      'before-restore.sqlite',
    );
    const replacedFilesDirectory = path.join(
      restoreDirectory,
      'previous-files',
    );
    const stagingFile = path.join(
      path.dirname(this.databasePath),
      `.${path.basename(this.databasePath)}.${process.pid}.restore.tmp`,
    );

    await mkdir(restoreDirectory, { recursive: true });
    await copyFile(source, stagingFile);

    try {
      await this.snapshotDatabase(safetyBackupFile);
      this.closeDatabase();

      const movedFiles = await this.moveExistingDatabaseFiles(
        replacedFilesDirectory,
      );

      try {
        await rename(stagingFile, this.databasePath);
      } catch (error) {
        await this.restoreMovedDatabaseFiles(movedFiles);
        throw error;
      }
    } finally {
      await rm(stagingFile, { force: true });
    }

    return Object.freeze({
      restoredFrom: source,
      safetyBackupFile,
    });
  }

  private restoreDirectoryName(): string {
    return this.now().replace(/[:.]/g, '-');
  }

  private async moveExistingDatabaseFiles(
    replacedFilesDirectory: string,
  ): Promise<readonly MovedDatabaseFile[]> {
    await mkdir(replacedFilesDirectory, { recursive: true });
    const moved: MovedDatabaseFile[] = [];

    for (const suffix of ['', '-wal', '-shm']) {
      const source = `${this.databasePath}${suffix}`;
      const destination = path.join(
        replacedFilesDirectory,
        `${path.basename(this.databasePath)}${suffix}`,
      );

      if (await moveFileIfPresent(source, destination)) {
        moved.push(Object.freeze({ source, destination }));
      }
    }

    return moved;
  }

  private async restoreMovedDatabaseFiles(
    movedFiles: readonly MovedDatabaseFile[],
  ): Promise<void> {
    await rm(this.databasePath, { force: true });
    await Promise.all(
      [...movedFiles]
        .reverse()
        .map(({ source, destination }) => rename(destination, source)),
    );
  }
}

const moveFileIfPresent = async (
  source: string,
  destination: string,
): Promise<boolean> => {
  try {
    await rename(source, destination);
    return true;
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return false;
    }

    throw error;
  }
};

const isFileNotFoundError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === 'ENOENT';
