export const DATA_MANAGEMENT_ERROR_CODES = [
  'INVALID_DATA_PATH',
  'BACKUP_NOT_FOUND',
  'INVALID_BACKUP',
] as const;

export type DataManagementErrorCode =
  (typeof DATA_MANAGEMENT_ERROR_CODES)[number];

export class DataManagementError extends Error {
  constructor(
    readonly code: DataManagementErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DataManagementError';
  }
}

export class DataManagementTransportError extends Error {
  constructor(
    readonly code: 'INTERNAL_ERROR' | 'INVALID_IPC_RESPONSE',
    message: string,
  ) {
    super(message);
    this.name = 'DataManagementTransportError';
  }
}

export const createInvalidDataPathError = (
  message: string,
): DataManagementError => new DataManagementError('INVALID_DATA_PATH', message);

export const createBackupNotFoundError = (): DataManagementError =>
  new DataManagementError(
    'BACKUP_NOT_FOUND',
    'The selected backup does not contain InkNote data.',
  );

export const createInvalidBackupError = (): DataManagementError =>
  new DataManagementError('INVALID_BACKUP', 'The selected backup is invalid.');
