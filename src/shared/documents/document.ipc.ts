import {
  DOCUMENT_DOMAIN_ERROR_CODES,
  DocumentDomainError,
  DocumentTransportError,
  type DocumentDomainErrorCode,
} from './document.errors';

export const DOCUMENT_IPC_INTERNAL_ERROR_CODE = 'INTERNAL_ERROR' as const;

export type DocumentIpcErrorCode =
  DocumentDomainErrorCode | typeof DOCUMENT_IPC_INTERNAL_ERROR_CODE;

export type DocumentIpcError = Readonly<{
  code: DocumentIpcErrorCode;
  message: string;
}>;

export type DocumentIpcSuccess<T> = Readonly<{
  ok: true;
  value: T;
}>;

export type DocumentIpcFailure = Readonly<{
  ok: false;
  error: DocumentIpcError;
}>;

/**
 * The only response shape that crosses the Electron IPC boundary for a
 * document operation. Error objects do not preserve their prototypes over
 * IPC, so callers must use this data contract instead of `instanceof`.
 */
export type DocumentIpcResult<T> = DocumentIpcSuccess<T> | DocumentIpcFailure;

const INTERNAL_ERROR_MESSAGE = 'The document operation could not be completed.';

export const createDocumentIpcSuccess = <T>(value: T): DocumentIpcSuccess<T> =>
  Object.freeze({ ok: true, value });

export const createDocumentIpcFailure = (
  error: unknown,
): DocumentIpcFailure => {
  if (error instanceof DocumentDomainError) {
    return createDocumentIpcFailureFromData(error.code, error.message);
  }

  return createDocumentIpcFailureFromData(
    DOCUMENT_IPC_INTERNAL_ERROR_CODE,
    INTERNAL_ERROR_MESSAGE,
  );
};

export const runDocumentIpcOperation = async <T>(
  operation: () => T | Promise<T>,
): Promise<DocumentIpcResult<T>> => {
  try {
    return createDocumentIpcSuccess(await operation());
  } catch (error) {
    return createDocumentIpcFailure(error);
  }
};

/**
 * Validates an IPC response and either returns a decoded value or reconstructs
 * a typed local error. `decodeValue` is intentionally supplied by the caller
 * so each channel can validate its own data payload.
 */
export const unwrapDocumentIpcResult = <T>(
  candidate: unknown,
  decodeValue: (value: unknown) => T,
): T => {
  if (!isRecord(candidate)) {
    throw createInvalidIpcResponseError();
  }

  if (candidate.ok === true) {
    if (!Object.hasOwn(candidate, 'value')) {
      throw createInvalidIpcResponseError();
    }

    try {
      return decodeValue(candidate.value);
    } catch (error) {
      if (error instanceof DocumentTransportError) {
        throw error;
      }

      throw createInvalidIpcResponseError();
    }
  }

  if (candidate.ok === false) {
    const error = parseDocumentIpcError(candidate.error);

    if (isDocumentDomainErrorCode(error.code)) {
      throw new DocumentDomainError(error.code, error.message);
    }

    throw new DocumentTransportError(error.code, error.message);
  }

  throw createInvalidIpcResponseError();
};

const createDocumentIpcFailureFromData = (
  code: DocumentIpcErrorCode,
  message: string,
): DocumentIpcFailure =>
  Object.freeze({
    ok: false,
    error: Object.freeze({ code, message }),
  });

const parseDocumentIpcError = (candidate: unknown): DocumentIpcError => {
  if (
    !isRecord(candidate) ||
    !isDocumentIpcErrorCode(candidate.code) ||
    typeof candidate.message !== 'string' ||
    candidate.message.length === 0
  ) {
    throw createInvalidIpcResponseError();
  }

  return Object.freeze({
    code: candidate.code,
    message: candidate.message,
  });
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isDocumentDomainErrorCode = (
  value: unknown,
): value is DocumentDomainErrorCode =>
  typeof value === 'string' &&
  (DOCUMENT_DOMAIN_ERROR_CODES as readonly string[]).includes(value);

const isDocumentIpcErrorCode = (
  value: unknown,
): value is DocumentIpcErrorCode =>
  value === DOCUMENT_IPC_INTERNAL_ERROR_CODE ||
  isDocumentDomainErrorCode(value);

const createInvalidIpcResponseError = (): DocumentTransportError =>
  new DocumentTransportError(
    'INVALID_IPC_RESPONSE',
    'The document operation returned an invalid response.',
  );
