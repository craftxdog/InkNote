import {
  DATA_MANAGEMENT_ERROR_CODES,
  DataManagementError,
  DataManagementTransportError,
  type DataManagementErrorCode,
} from './data.errors';

export type DataIpcErrorCode = DataManagementErrorCode | 'INTERNAL_ERROR';

export type DataIpcResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{
      ok: false;
      error: Readonly<{ code: DataIpcErrorCode; message: string }>;
    }>;

export const createDataIpcSuccess = <T>(value: T): DataIpcResult<T> =>
  Object.freeze({ ok: true, value });

export const createDataIpcFailure = (error: unknown): DataIpcResult<never> => {
  if (error instanceof DataManagementError) {
    return Object.freeze({
      ok: false,
      error: Object.freeze({ code: error.code, message: error.message }),
    });
  }

  return Object.freeze({
    ok: false,
    error: Object.freeze({
      code: 'INTERNAL_ERROR',
      message: 'The data operation could not be completed.',
    }),
  });
};

export const runDataIpcOperation = async <T>(
  operation: () => T | Promise<T>,
): Promise<DataIpcResult<T>> => {
  try {
    return createDataIpcSuccess(await operation());
  } catch (error) {
    return createDataIpcFailure(error);
  }
};

export const unwrapDataIpcResult = <T>(
  candidate: unknown,
  decodeValue: (value: unknown) => T,
): T => {
  if (!isRecord(candidate)) {
    throw createInvalidResponseError();
  }

  if (candidate.ok === true && Object.hasOwn(candidate, 'value')) {
    try {
      return decodeValue(candidate.value);
    } catch {
      throw createInvalidResponseError();
    }
  }

  if (candidate.ok === false && isRecord(candidate.error)) {
    const { code, message } = candidate.error;

    if (typeof message !== 'string' || message.length === 0) {
      throw createInvalidResponseError();
    }

    if (isDataManagementErrorCode(code)) {
      throw new DataManagementError(code, message);
    }

    if (code === 'INTERNAL_ERROR') {
      throw new DataManagementTransportError(code, message);
    }
  }

  throw createInvalidResponseError();
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isDataManagementErrorCode = (
  value: unknown,
): value is DataManagementErrorCode =>
  typeof value === 'string' &&
  (DATA_MANAGEMENT_ERROR_CODES as readonly string[]).includes(value);

const createInvalidResponseError = (): DataManagementTransportError =>
  new DataManagementTransportError(
    'INVALID_IPC_RESPONSE',
    'The data operation returned an invalid response.',
  );
