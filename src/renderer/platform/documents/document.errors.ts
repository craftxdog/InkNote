export const DOCUMENT_DOMAIN_ERROR_CODES = [
  'DOCUMENT_NOT_FOUND',
  'INVALID_MUTATION',
  'REVISION_CONFLICT',
] as const;

export type DocumentDomainErrorCode =
  (typeof DOCUMENT_DOMAIN_ERROR_CODES)[number];

export class DocumentDomainError extends Error {
  readonly code: DocumentDomainErrorCode;

  constructor(code: DocumentDomainErrorCode, message: string) {
    super(message);

    this.name = 'DocumentDomainError';
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
