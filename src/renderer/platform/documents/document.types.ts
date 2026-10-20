import { createInvalidMutationError } from './document.errors';

declare const noteIdBrand: unique symbol;
declare const revisionBrand: unique symbol;
declare const mutationIdBrand: unique symbol;

export type NoteId = string & {
  readonly [noteIdBrand]: 'NoteId';
};

export type Revision = string & {
  readonly [revisionBrand]: 'Revision';
};

export type MutationId = string & {
  readonly [mutationIdBrand]: 'MutationId';
};

export type NoteDocument = Readonly<{
  id: NoteId;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  revision: Revision;
  deletedAt: string | null;
}>;

export type DocumentMutationSource =
  'editor' | 'command' | 'preview' | 'system';

type DocumentMutationBase = Readonly<{
  id: MutationId;
  documentId: NoteId;
  baseRevision: Revision;
  source: DocumentMutationSource;
  occurredAt: string;
}>;

export type CreateDocumentMutation = DocumentMutationBase &
  Readonly<{
    kind: 'create';
    title: string;
    body: string;
  }>;

export type UpdateTitleMutation = DocumentMutationBase &
  Readonly<{
    kind: 'update-title';
    title: string;
  }>;

export type ReplaceBodyMutation = DocumentMutationBase &
  Readonly<{
    kind: 'replace-body';
    body: string;
  }>;

export type ArchiveDocumentMutation = DocumentMutationBase &
  Readonly<{
    kind: 'archive';
  }>;

export type RestoreDocumentMutation = DocumentMutationBase &
  Readonly<{
    kind: 'restore';
  }>;

export type DocumentMutation =
  | CreateDocumentMutation
  | UpdateTitleMutation
  | ReplaceBodyMutation
  | ArchiveDocumentMutation
  | RestoreDocumentMutation;

type DocumentMutationInputBase = Readonly<{
  id: MutationId;
  documentId: NoteId;
  baseRevision: Revision;
  source: DocumentMutationSource;
  occurredAt: string;
}>;

export type CreateDocumentMutationInput = DocumentMutationInputBase &
  Readonly<{
    title: string;
    body: string;
  }>;

export type UpdateTitleMutationInput = DocumentMutationInputBase &
  Readonly<{
    title: string;
  }>;

export type ReplaceBodyMutationInput = DocumentMutationInputBase &
  Readonly<{
    body: string;
  }>;

export type ArchiveDocumentMutationInput = DocumentMutationInputBase;
export type RestoreDocumentMutationInput = DocumentMutationInputBase;

export const createNoteId = (value: string): NoteId =>
  createOpaqueIdentifier<NoteId>(value, 'Note ID');

export const createRevision = (value: string): Revision =>
  createOpaqueIdentifier<Revision>(value, 'Revision');

export const createMutationId = (value: string): MutationId =>
  createOpaqueIdentifier<MutationId>(value, 'Mutation ID');

export const createCreateDocumentMutation = (
  input: CreateDocumentMutationInput,
): CreateDocumentMutation => {
  const base = createMutationBase(input);

  if (base.baseRevision !== INITIAL_DOCUMENT_REVISION) {
    throw createInvalidMutationError(
      'A new document must use the initial revision.',
    );
  }

  return freezeMutation({
    ...base,
    kind: 'create',
    title: validateText(input.title, 'Document title'),
    body: normalizeMarkdownBody(input.body),
  });
};

export const createUpdateTitleMutation = (
  input: UpdateTitleMutationInput,
): UpdateTitleMutation => {
  const base = createMutationBase(input);

  return freezeMutation({
    ...base,
    kind: 'update-title',
    title: validateText(input.title, 'Document title'),
  });
};

export const createReplaceBodyMutation = (
  input: ReplaceBodyMutationInput,
): ReplaceBodyMutation => {
  const base = createMutationBase(input);

  return freezeMutation({
    ...base,
    kind: 'replace-body',
    body: normalizeMarkdownBody(input.body),
  });
};

export const createArchiveMutation = (
  input: ArchiveDocumentMutationInput,
): ArchiveDocumentMutation =>
  freezeMutation({
    ...createMutationBase(input),
    kind: 'archive',
  });

export const createRestoreMutation = (
  input: RestoreDocumentMutationInput,
): RestoreDocumentMutation =>
  freezeMutation({
    ...createMutationBase(input),
    kind: 'restore',
  });

export const validateDocumentMutation = (
  mutation: DocumentMutation,
): DocumentMutation => {
  if (typeof mutation !== 'object' || mutation === null) {
    throw createInvalidMutationError('A mutation must be an object.');
  }

  const candidate = mutation as unknown as Record<string, unknown>;

  switch (candidate.kind) {
    case 'create':
      return createCreateDocumentMutation(
        candidate as unknown as CreateDocumentMutationInput,
      );
    case 'update-title':
      return createUpdateTitleMutation(
        candidate as unknown as UpdateTitleMutationInput,
      );
    case 'replace-body':
      return createReplaceBodyMutation(
        candidate as unknown as ReplaceBodyMutationInput,
      );
    case 'archive':
      return createArchiveMutation(
        candidate as unknown as ArchiveDocumentMutationInput,
      );
    case 'restore':
      return createRestoreMutation(
        candidate as unknown as RestoreDocumentMutationInput,
      );
    default:
      throw createInvalidMutationError('Mutation kind is not supported.');
  }
};

const createOpaqueIdentifier = <T extends string>(
  value: string,
  label: string,
): T => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw createInvalidMutationError(`${label} must be a non-empty string.`);
  }

  return value as T;
};

export const INITIAL_DOCUMENT_REVISION = createRevision('initial');

const createMutationBase = (
  input: DocumentMutationInputBase,
): DocumentMutationInputBase => {
  if (typeof input !== 'object' || input === null) {
    throw createInvalidMutationError('A mutation must be an object.');
  }

  assertOpaqueIdentifier(input.id, 'Mutation ID');
  assertOpaqueIdentifier(input.documentId, 'Document ID');
  assertOpaqueIdentifier(input.baseRevision, 'Base revision');
  assertMutationSource(input.source);
  assertNonEmptyString(input.occurredAt, 'Mutation timestamp');

  return {
    id: input.id,
    documentId: input.documentId,
    baseRevision: input.baseRevision,
    source: input.source,
    occurredAt: input.occurredAt,
  };
};

const freezeMutation = <T extends DocumentMutation>(mutation: T): T =>
  Object.freeze(mutation);

const normalizeMarkdownBody = (value: unknown): string =>
  validateText(value, 'Markdown body').replace(/\r\n?/g, '\n');

const validateText = (value: unknown, label: string): string => {
  if (typeof value !== 'string') {
    throw createInvalidMutationError(`${label} must be a string.`);
  }

  return value;
};

const assertOpaqueIdentifier = (value: unknown, label: string): void => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw createInvalidMutationError(`${label} must be a non-empty string.`);
  }
};

function assertMutationSource(
  value: unknown,
): asserts value is DocumentMutationSource {
  if (
    value !== 'editor' &&
    value !== 'command' &&
    value !== 'preview' &&
    value !== 'system'
  ) {
    throw createInvalidMutationError('Mutation source is not supported.');
  }
}

function assertNonEmptyString(
  value: unknown,
  label: string,
): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw createInvalidMutationError(`${label} must be a non-empty string.`);
  }
}
