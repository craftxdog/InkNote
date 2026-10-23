import { createInvalidDataPathError } from './data.errors';

export type DataManagementInfo = Readonly<{
  dataDirectory: string;
  backupDirectory: string | null;
}>;

export type DirectorySelectionPurpose = 'backup' | 'restore' | 'export';

export type BackupResult = Readonly<{
  backupDirectory: string;
  backupFile: string;
}>;

export type ExportResult = Readonly<{
  directory: string;
  exportedNotes: number;
}>;

export type RestoreResult = Readonly<{
  restoredFrom: string;
  safetyBackupFile: string;
}>;

export const validateBackupResult = (value: unknown): BackupResult => {
  if (!isRecord(value)) {
    throw new Error('The backup response has an invalid response.');
  }

  return Object.freeze({
    backupDirectory: validateAbsolutePath(
      value.backupDirectory,
      'Backup directory',
    ),
    backupFile: validateAbsolutePath(value.backupFile, 'Backup file'),
  });
};

export const validateExportResult = (value: unknown): ExportResult => {
  if (
    !isRecord(value) ||
    typeof value.exportedNotes !== 'number' ||
    !Number.isSafeInteger(value.exportedNotes) ||
    value.exportedNotes < 0
  ) {
    throw new Error('The export response has an invalid response.');
  }

  return Object.freeze({
    directory: validateAbsolutePath(value.directory, 'Export directory'),
    exportedNotes: value.exportedNotes,
  });
};

export const validateRestoreResult = (value: unknown): RestoreResult => {
  if (!isRecord(value)) {
    throw new Error('The restore response has an invalid response.');
  }

  return Object.freeze({
    restoredFrom: validateAbsolutePath(value.restoredFrom, 'Backup file'),
    safetyBackupFile: validateAbsolutePath(
      value.safetyBackupFile,
      'Safety backup file',
    ),
  });
};

export const validateDataManagementInfo = (
  value: unknown,
): DataManagementInfo => {
  if (!isRecord(value)) {
    throw new Error('The data management response has an invalid response.');
  }

  const dataDirectory = validateAbsolutePath(
    value.dataDirectory,
    'Data directory',
  );
  const backupDirectory =
    value.backupDirectory === null
      ? null
      : validateAbsolutePath(value.backupDirectory, 'Backup directory');

  return Object.freeze({ dataDirectory, backupDirectory });
};

export const validateDirectorySelectionPurpose = (
  value: unknown,
): DirectorySelectionPurpose => {
  if (value === 'backup' || value === 'restore' || value === 'export') {
    return value;
  }

  throw createInvalidDataPathError('Directory selection purpose is invalid.');
};

export const validateAbsolutePath = (
  value: unknown,
  label = 'Directory',
): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw createInvalidDataPathError(`${label} must be a non-empty path.`);
  }

  if (!isAbsolutePath(value)) {
    throw createInvalidDataPathError(`${label} must be absolute.`);
  }

  return value;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isAbsolutePath = (value: string): boolean =>
  value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value);
