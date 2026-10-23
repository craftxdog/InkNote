export const DOCUMENT_DOMAIN_ERROR_CODES = [
  'DOCUMENT_NOT_FOUND',
  'INVALID_MUTATION',
  'REVISION_CONFLICT',
] as const;

export type DocumentDomainErrorCode =
  (typeof DOCUMENT_DOMAIN_ERROR_CODES)[number];

export const DOCUMENT_TRANSPORT_ERROR_CODES = [
  'INTERNAL_ERROR',
  'INVALID_IPC_RESPONSE',
] as const;

export type DocumentTransportErrorCode =
  (typeof DOCUMENT_TRANSPORT_ERROR_CODES)[number];

export class DocumentDomainError extends Error {
  readonly code: DocumentDomainErrorCode;

  constructor(code: DocumentDomainErrorCode, message: string) {
    super(message);

    this.name = 'DocumentDomainError';
    this.code = code;

    Object.freeze(this);
  }
}

/**
 * Represents an expected failure at the renderer/main-process boundary.
 *
 * It deliberately differs from DocumentDomainError: a transport failure does
 * not describe a user-editable document state and must never be treated as a
 * revision conflict or a missing note.
 */
export class DocumentTransportError extends Error {
  readonly code: DocumentTransportErrorCode;

  constructor(code: DocumentTransportErrorCode, message: string) {
    super(message);

    this.name = 'DocumentTransportError';
    this.code = code;

    Object.freeze(this);
  }
}

export const createDocumentNotFoundError = (
  documentId: string,
): DocumentDomainError =>
  new DocumentDomainError(
    'DOCUMENT_NOT_FOUND',
    `Document "${documentId}" was not found.`,
  );

export const createInvalidMutationError = (
  message: string,
): DocumentDomainError => new DocumentDomainError('INVALID_MUTATION', message);

export const createRevisionConflictError = (
  message: string,
): DocumentDomainError => new DocumentDomainError('REVISION_CONFLICT', message);
