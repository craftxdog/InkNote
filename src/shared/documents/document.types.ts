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

export const NOTE_STATUSES = [
  'active',
  'on-hold',
  'completed',
  'dropped',
] as const;

export type NoteStatus = (typeof NOTE_STATUSES)[number];

export const INBOX_NOTEBOOK_ID = 'inbox';

export const NOTEBOOK_ICON_NAMES = [
  'briefcase',
  'rocket',
  'book',
  'note',
  'code',
  'palette',
  'calendar',
  'target',
  'heart',
  'globe',
  'folder',
  'lightbulb',
  'terminal',
  'laptop',
  'flask',
  'wrench',
  'music',
  'camera',
  'leaf',
  'bookmark',
  'star',
] as const;

export type NotebookIconName = (typeof NOTEBOOK_ICON_NAMES)[number];

export type Notebook = Readonly<{
  id: string;
  name: string;
  /** Null places a notebook at the library root. */
  parentId?: string | null;
  icon?: NotebookIconName;
  createdAt: string;
  updatedAt: string;
}>;

export type CreateNotebookInput = Readonly<{
  id: string;
  name: string;
  parentId?: string | null;
  icon?: NotebookIconName;
  occurredAt: string;
}>;

/**
 * A notebook deletion is a durable organization operation. The associated
 * direct notes move to Trash; subnotebooks are preserved by the repository.
 */
export type DeleteNotebookInput = Readonly<{
  id: string;
  occurredAt: string;
}>;

export type DeleteNotebookResult = Readonly<{
  deletedNotebookId: string;
  archivedNoteIds: readonly NoteId[];
  reparentedNotebookIds: readonly string[];
}>;

export type NoteDocument = Readonly<{
  id: NoteId;
  title: string;
  body: string;
  notebookId: string;
  status: NoteStatus;
  tags: readonly string[];
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
    notebookId: string;
    status: NoteStatus;
    tags: readonly string[];
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

export type UpdateTagsMutation = DocumentMutationBase &
  Readonly<{
    kind: 'update-tags';
    tags: readonly string[];
  }>;

export type UpdateOrganizationMutation = DocumentMutationBase &
  Readonly<{
    kind: 'update-organization';
    notebookId: string;
    status: NoteStatus;
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
  | UpdateTagsMutation
  | UpdateOrganizationMutation
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
    notebookId?: string;
    status?: NoteStatus;
    tags?: readonly string[];
  }>;

export type UpdateTitleMutationInput = DocumentMutationInputBase &
  Readonly<{
    title: string;
  }>;

export type ReplaceBodyMutationInput = DocumentMutationInputBase &
  Readonly<{
    body: string;
  }>;

export type UpdateTagsMutationInput = DocumentMutationInputBase &
  Readonly<{
    tags: readonly string[];
  }>;

export type UpdateOrganizationMutationInput = DocumentMutationInputBase &
  Readonly<{
    notebookId: string;
    status: NoteStatus;
  }>;

export type ArchiveDocumentMutationInput = DocumentMutationInputBase;
export type RestoreDocumentMutationInput = DocumentMutationInputBase;

export const createNoteId = (value: string): NoteId =>
  createOpaqueIdentifier<NoteId>(value, 'Note ID');

export const createRevision = (value: string): Revision =>
  createOpaqueIdentifier<Revision>(value, 'Revision');

export const createMutationId = (value: string): MutationId =>
  createOpaqueIdentifier<MutationId>(value, 'Mutation ID');

export const createNotebook = (input: CreateNotebookInput): Notebook => {
  if (typeof input !== 'object' || input === null) {
    throw createInvalidMutationError('A notebook must be an object.');
  }

  const id = normalizeNotebookId(input.id);
  const name = validateText(input.name, 'Notebook name').trim();
  const parentId = normalizeNotebookParentId(input.parentId, id);
  const icon = normalizeNotebookIcon(input.icon);

  if (name.length === 0) {
    throw createInvalidMutationError('Notebook name must not be empty.');
  }

  assertNonEmptyString(input.occurredAt, 'Notebook timestamp');

  return Object.freeze({
    id,
    name,
    parentId,
    ...(icon === undefined ? {} : { icon }),
    createdAt: input.occurredAt,
    updatedAt: input.occurredAt,
  });
};

export const validateDeleteNotebookInput = (
  value: unknown,
): DeleteNotebookInput => {
  if (typeof value !== 'object' || value === null) {
    throw createInvalidMutationError('A notebook deletion must be an object.');
  }

  const candidate = value as Record<string, unknown>;

  return Object.freeze({
    id: normalizeNotebookId(candidate.id),
    occurredAt: readNonEmptyString(
      candidate.occurredAt,
      'Notebook deletion timestamp',
    ),
  });
};

export const validateNotebook = (value: unknown): Notebook => {
  if (typeof value !== 'object' || value === null) {
    throw createInvalidMutationError('A notebook must be an object.');
  }

  const candidate = value as Record<string, unknown>;
  const id = normalizeNotebookId(candidate.id);
  const name = validateText(candidate.name, 'Notebook name').trim();
  const parentId = normalizeNotebookParentId(candidate.parentId, id);
  const icon = normalizeNotebookIcon(candidate.icon);

  if (name.length === 0) {
    throw createInvalidMutationError('Notebook name must not be empty.');
  }

  return Object.freeze({
    id,
    name,
    parentId,
    ...(icon === undefined ? {} : { icon }),
    createdAt: readNonEmptyString(candidate.createdAt, 'Notebook createdAt'),
    updatedAt: readNonEmptyString(candidate.updatedAt, 'Notebook updatedAt'),
  });
};

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
    notebookId: normalizeNotebookId(input.notebookId ?? INBOX_NOTEBOOK_ID),
    status: normalizeNoteStatus(input.status ?? 'active'),
    tags: normalizeTags(input.tags ?? []),
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

export const createUpdateTagsMutation = (
  input: UpdateTagsMutationInput,
): UpdateTagsMutation =>
  freezeMutation({
    ...createMutationBase(input),
    kind: 'update-tags',
    tags: normalizeTags(input.tags),
  });

export const createUpdateOrganizationMutation = (
  input: UpdateOrganizationMutationInput,
): UpdateOrganizationMutation =>
  freezeMutation({
    ...createMutationBase(input),
    kind: 'update-organization',
    notebookId: normalizeNotebookId(input.notebookId),
    status: normalizeNoteStatus(input.status),
  });

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
    case 'update-tags':
      return createUpdateTagsMutation(
        candidate as unknown as UpdateTagsMutationInput,
      );
    case 'update-organization':
      return createUpdateOrganizationMutation(
        candidate as unknown as UpdateOrganizationMutationInput,
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

/**
 * Rebuilds an immutable note projection received from persistence or IPC.
 *
 * Static TypeScript types do not survive the process boundary, so the renderer
 * must not trust a plain object just because it is shaped like NoteDocument.
 */
export const validateNoteDocument = (value: unknown): NoteDocument => {
  if (typeof value !== 'object' || value === null) {
    throw createInvalidMutationError('A document must be an object.');
  }

  const candidate = value as Record<string, unknown>;
  const id = createNoteId(readNonEmptyString(candidate.id, 'Note ID'));

  return Object.freeze({
    id,
    title: validateText(candidate.title, 'Document title'),
    body: normalizeMarkdownBody(candidate.body),
    notebookId: normalizeNotebookId(candidate.notebookId ?? INBOX_NOTEBOOK_ID),
    status: normalizeNoteStatus(candidate.status ?? 'active'),
    tags: normalizeTags(candidate.tags ?? []),
    createdAt: readNonEmptyString(candidate.createdAt, 'Document createdAt'),
    updatedAt: readNonEmptyString(candidate.updatedAt, 'Document updatedAt'),
    revision: createRevision(
      readNonEmptyString(candidate.revision, 'Document revision'),
    ),
    deletedAt:
      candidate.deletedAt === null
        ? null
        : readNonEmptyString(candidate.deletedAt, 'Document deletedAt'),
  });
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

const normalizeNotebookId = (value: unknown): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw createInvalidMutationError('Notebook ID must be a non-empty string.');
  }

  return value.trim();
};

const normalizeNotebookParentId = (
  value: unknown,
  notebookId: string,
): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  const parentId = normalizeNotebookId(value);

  if (parentId === notebookId) {
    throw createInvalidMutationError('A notebook cannot be its own parent.');
  }

  return parentId;
};

const normalizeNotebookIcon = (
  value: unknown,
): NotebookIconName | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!(NOTEBOOK_ICON_NAMES as readonly unknown[]).includes(value)) {
    throw createInvalidMutationError('Notebook icon is not supported.');
  }

  return value as NotebookIconName;
};

const normalizeNoteStatus = (value: unknown): NoteStatus => {
  if (!(NOTE_STATUSES as readonly unknown[]).includes(value)) {
    throw createInvalidMutationError('Note status is not supported.');
  }

  return value as NoteStatus;
};

const normalizeTags = (value: unknown): readonly string[] => {
  if (!Array.isArray(value) || value.some((tag) => typeof tag !== 'string')) {
    throw createInvalidMutationError('Tags must be an array of strings.');
  }

  return Object.freeze([
    ...new Set(
      value.map((tag) => tag.trim().toLocaleLowerCase()).filter(Boolean),
    ),
  ]);
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

const readNonEmptyString = (value: unknown, label: string): string => {
  assertNonEmptyString(value, label);

  return value;
};
