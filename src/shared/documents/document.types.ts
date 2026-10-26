import { createInvalidMutationError } from './document.errors';

declare const noteIdBrand: unique symbol;
declare const tagIdBrand: unique symbol;
declare const revisionBrand: unique symbol;
declare const mutationIdBrand: unique symbol;

export type NoteId = string & {
  readonly [noteIdBrand]: 'NoteId';
};

export type TagId = string & {
  readonly [tagIdBrand]: 'TagId';
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

/**
 * Inkdrop represents an unassigned status separately from the four task
 * statuses shown in the sidebar. Keeping it explicit lets the editor expose
 * the documented "None" command without inventing a sidebar destination.
 */
export const NOTE_STATUS_NONE = 'none' as const;

export type NoteStatusValue = NoteStatus | typeof NOTE_STATUS_NONE;

export const TAG_COLORS = [
  'default',
  'red',
  'orange',
  'yellow',
  'olive',
  'green',
  'teal',
  'blue',
  'violet',
  'purple',
  'pink',
  'brown',
  'grey',
  'black',
] as const;

export type TagColor = (typeof TAG_COLORS)[number];

export type TagSummary = Readonly<{
  id: TagId;
  name: string;
  color: TagColor;
  count: number;
  createdAt: string;
  updatedAt: string;
}>;

export const TAG_NAME_MAX_LENGTH = 64;

export type CreateTagInput = Readonly<{
  id: TagId;
  name: string;
  color: TagColor;
  occurredAt: string;
}>;

export type UpdateTagInput = Readonly<{
  id: TagId;
  name: string;
  color: TagColor;
  occurredAt: string;
}>;

export type DeleteTagInput = Readonly<{
  id: TagId;
  occurredAt: string;
}>;

export type DeleteTagResult = Readonly<{
  deletedTagId: TagId;
  affectedNoteIds: readonly NoteId[];
}>;

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
 * Full replacement of the editable notebook fields. Explicit nulls avoid an
 * ambiguous update where an omitted icon or parent could retain stale state.
 */
export type UpdateNotebookInput = Readonly<{
  id: string;
  name: string;
  parentId: string | null;
  icon: NotebookIconName | null;
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

/**
 * Destructive lifecycle operation reserved for documents already in Trash.
 * A separate contract prevents an active note from being removed accidentally.
 */
export type PermanentlyDeleteNotesInput = Readonly<{
  noteIds: readonly NoteId[];
}>;

export type PermanentlyDeleteNotesResult = Readonly<{
  deletedNoteIds: readonly NoteId[];
}>;

export type NoteDocument = Readonly<{
  id: NoteId;
  title: string;
  body: string;
  notebookId: string;
  status: NoteStatusValue;
  tags: readonly string[];
  /** Always supplied by persistence; optional for legacy in-memory DTOs. */
  doctype?: 'markdown';
  /** Always supplied by persistence; optional for legacy in-memory DTOs. */
  pinned?: boolean;
  /** Always supplied by persistence; optional for legacy in-memory DTOs. */
  numOfTasks?: number;
  /** Always supplied by persistence; optional for legacy in-memory DTOs. */
  numOfCheckedTasks?: number;
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
    status: NoteStatusValue;
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

export type UpdatePinnedMutation = DocumentMutationBase &
  Readonly<{
    kind: 'update-pinned';
    pinned: boolean;
  }>;

export type UpdateOrganizationMutation = DocumentMutationBase &
  Readonly<{
    kind: 'update-organization';
    notebookId: string;
    status: NoteStatusValue;
  }>;

export type ArchiveDocumentMutation = DocumentMutationBase &
  Readonly<{
    kind: 'archive';
  }>;

export type RestoreDocumentMutation = DocumentMutationBase &
  Readonly<{
    kind: 'restore';
    /** Optional target used when restoring a Trash selection. */
    notebookId?: string;
  }>;

export type DocumentMutation =
  | CreateDocumentMutation
  | UpdateTitleMutation
  | ReplaceBodyMutation
  | UpdateTagsMutation
  | UpdatePinnedMutation
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
    status?: NoteStatusValue;
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

export type UpdatePinnedMutationInput = DocumentMutationInputBase &
  Readonly<{
    pinned: boolean;
  }>;

export type UpdateOrganizationMutationInput = DocumentMutationInputBase &
  Readonly<{
    notebookId: string;
    status: NoteStatusValue;
  }>;

export type ArchiveDocumentMutationInput = DocumentMutationInputBase;
export type RestoreDocumentMutationInput = DocumentMutationInputBase &
  Readonly<{
    notebookId?: string;
  }>;

export const createNoteId = (value: string): NoteId =>
  createOpaqueIdentifier<NoteId>(value, 'Note ID');

export const createTagId = (value: string): TagId =>
  createOpaqueIdentifier<TagId>(value, 'Tag ID');

export const createGeneratedNoteId = (entropy: string): NoteId =>
  createNoteId(createPrefixedIdentifier('note:', entropy, 'Generated note ID'));

export const createGeneratedNotebookId = (entropy: string): string =>
  createPrefixedIdentifier('book:', entropy, 'Generated notebook ID');

export const createGeneratedTagId = (entropy: string): TagId =>
  createTagId(createPrefixedIdentifier('tag:', entropy, 'Generated tag ID'));

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

export const validateUpdateNotebookInput = (
  value: unknown,
): UpdateNotebookInput => {
  if (typeof value !== 'object' || value === null) {
    throw createInvalidMutationError('A notebook update must be an object.');
  }

  const candidate = value as Record<string, unknown>;
  const id = normalizeNotebookId(candidate.id);

  if (id === INBOX_NOTEBOOK_ID) {
    throw createInvalidMutationError('The Inbox notebook cannot be updated.');
  }

  const name = validateText(candidate.name, 'Notebook name').trim();

  if (name.length === 0) {
    throw createInvalidMutationError('Notebook name must not be empty.');
  }

  if (candidate.parentId === undefined) {
    throw createInvalidMutationError(
      'Notebook update parentId must be explicit.',
    );
  }

  const parentId =
    candidate.parentId === null
      ? null
      : normalizeNotebookParentId(candidate.parentId, id);

  if (candidate.icon === undefined) {
    throw createInvalidMutationError('Notebook update icon must be explicit.');
  }

  const icon =
    candidate.icon === null ? null : normalizeNotebookIcon(candidate.icon);

  if (icon === undefined) {
    throw createInvalidMutationError('Notebook icon must be explicit.');
  }

  return Object.freeze({
    id,
    name,
    parentId,
    icon,
    occurredAt: readNonEmptyString(
      candidate.occurredAt,
      'Notebook update timestamp',
    ),
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

export const validatePermanentlyDeleteNotesInput = (
  value: unknown,
): PermanentlyDeleteNotesInput => {
  if (typeof value !== 'object' || value === null) {
    throw createInvalidMutationError(
      'A permanent note deletion must be an object.',
    );
  }

  const candidate = value as Record<string, unknown>;

  if (!Array.isArray(candidate.noteIds) || candidate.noteIds.length === 0) {
    throw createInvalidMutationError(
      'Permanent note deletion requires at least one note ID.',
    );
  }

  if (candidate.noteIds.some((id) => typeof id !== 'string')) {
    throw createInvalidMutationError(
      'Every permanently deleted note requires a valid note ID.',
    );
  }

  return Object.freeze({
    noteIds: Object.freeze([
      ...new Set(candidate.noteIds.map((id) => createNoteId(id))),
    ]),
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
    status: normalizeNoteStatus(input.status ?? NOTE_STATUS_NONE),
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

export const createUpdatePinnedMutation = (
  input: UpdatePinnedMutationInput,
): UpdatePinnedMutation => {
  if (typeof input.pinned !== 'boolean') {
    throw createInvalidMutationError('Document pin state must be boolean.');
  }

  return freezeMutation({
    ...createMutationBase(input),
    kind: 'update-pinned',
    pinned: input.pinned,
  });
};

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
    ...(input.notebookId === undefined
      ? {}
      : { notebookId: normalizeNotebookId(input.notebookId) }),
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
    case 'update-pinned':
      return createUpdatePinnedMutation(
        candidate as unknown as UpdatePinnedMutationInput,
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
    status: normalizeNoteStatus(candidate.status ?? NOTE_STATUS_NONE),
    tags: normalizeTags(candidate.tags ?? []),
    doctype: normalizeDocumentDoctype(candidate.doctype),
    pinned: normalizeDocumentPinned(candidate.pinned),
    numOfTasks: normalizeTaskCount(candidate.numOfTasks, 'Document task count'),
    numOfCheckedTasks: normalizeTaskCount(
      candidate.numOfCheckedTasks,
      'Document checked task count',
    ),
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

export const validateTagSummary = (value: unknown): TagSummary => {
  if (typeof value !== 'object' || value === null) {
    throw createInvalidMutationError('A tag summary must be an object.');
  }

  const candidate = value as Record<string, unknown>;
  const name = readNonEmptyString(candidate.name, 'Tag name').trim();

  if (name.length === 0) {
    throw createInvalidMutationError('Tag name must not be empty.');
  }

  return Object.freeze({
    id: createTagId(readNonEmptyString(candidate.id, 'Tag ID')),
    name,
    color: normalizeTagColor(candidate.color),
    count: normalizeTagCount(candidate.count),
    createdAt: readNonEmptyString(candidate.createdAt, 'Tag createdAt'),
    updatedAt: readNonEmptyString(candidate.updatedAt, 'Tag updatedAt'),
  });
};

export const validateCreateTagInput = (value: unknown): CreateTagInput => {
  const input = validateTagLifecycleInput(value, 'Tag creation');

  if (!input.id.startsWith('tag:')) {
    throw createInvalidMutationError(
      'A new tag ID must use the generated tag: prefix.',
    );
  }

  return input;
};

export const validateUpdateTagInput = (value: unknown): UpdateTagInput =>
  validateTagLifecycleInput(value, 'Tag update');

export const validateDeleteTagInput = (value: unknown): DeleteTagInput => {
  if (typeof value !== 'object' || value === null) {
    throw createInvalidMutationError('A tag deletion must be an object.');
  }

  const candidate = value as Record<string, unknown>;

  return Object.freeze({
    id: createTagId(readNonEmptyString(candidate.id, 'Tag ID')),
    occurredAt: readNonEmptyString(candidate.occurredAt, 'Tag timestamp'),
  });
};

export const validateDeleteTagResult = (value: unknown): DeleteTagResult => {
  if (typeof value !== 'object' || value === null) {
    throw createInvalidMutationError(
      'A tag deletion result must be an object.',
    );
  }

  const candidate = value as Record<string, unknown>;
  const affectedNoteIds = candidate.affectedNoteIds;

  if (!Array.isArray(affectedNoteIds)) {
    throw createInvalidMutationError(
      'Tag deletion affected note IDs must be an array.',
    );
  }

  const normalizedNoteIds = affectedNoteIds.map((noteId) =>
    createNoteId(noteId as string),
  );

  if (new Set(normalizedNoteIds).size !== normalizedNoteIds.length) {
    throw createInvalidMutationError(
      'Tag deletion affected note IDs must be unique.',
    );
  }

  return Object.freeze({
    deletedTagId: createTagId(
      readNonEmptyString(candidate.deletedTagId, 'Deleted tag ID'),
    ),
    affectedNoteIds: Object.freeze(normalizedNoteIds),
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

const createPrefixedIdentifier = (
  prefix: string,
  entropy: string,
  label: string,
): string => {
  const normalizedEntropy = readNonEmptyString(entropy, label).trim();

  if (normalizedEntropy.length === 0) {
    throw createInvalidMutationError(`${label} must be a non-empty string.`);
  }

  return `${prefix}${normalizedEntropy}`;
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

const normalizeNoteStatus = (value: unknown): NoteStatusValue => {
  if (
    value !== NOTE_STATUS_NONE &&
    !(NOTE_STATUSES as readonly unknown[]).includes(value)
  ) {
    throw createInvalidMutationError('Note status is not supported.');
  }

  return value as NoteStatusValue;
};

const normalizeDocumentDoctype = (value: unknown): 'markdown' => {
  if (value === undefined) {
    return 'markdown';
  }

  if (value !== 'markdown') {
    throw createInvalidMutationError('Document doctype is not supported.');
  }

  return value;
};

const normalizeDocumentPinned = (value: unknown): boolean => {
  if (value === undefined) {
    return false;
  }

  if (typeof value !== 'boolean') {
    throw createInvalidMutationError('Document pin state must be boolean.');
  }

  return value;
};

const normalizeTaskCount = (value: unknown, label: string): number => {
  if (value === undefined) {
    return 0;
  }

  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw createInvalidMutationError(
      `${label} must be a non-negative integer.`,
    );
  }

  return value;
};

const normalizeTagColor = (value: unknown): TagColor => {
  if (!(TAG_COLORS as readonly unknown[]).includes(value)) {
    throw createInvalidMutationError('Tag color is not supported.');
  }

  return value as TagColor;
};

const validateTagLifecycleInput = (
  value: unknown,
  label: string,
): CreateTagInput => {
  if (typeof value !== 'object' || value === null) {
    throw createInvalidMutationError(`${label} must be an object.`);
  }

  const candidate = value as Record<string, unknown>;

  return Object.freeze({
    id: createTagId(readNonEmptyString(candidate.id, 'Tag ID')),
    name: normalizeTagLifecycleName(candidate.name),
    color: normalizeTagColor(candidate.color),
    occurredAt: readNonEmptyString(candidate.occurredAt, 'Tag timestamp'),
  });
};

const normalizeTagLifecycleName = (value: unknown): string => {
  const name = validateText(value, 'Tag name').trim().toLocaleLowerCase();

  if (name.length === 0) {
    throw createInvalidMutationError('Tag name must not be empty.');
  }

  if (name.length > TAG_NAME_MAX_LENGTH) {
    throw createInvalidMutationError(
      `Tag name must not exceed ${TAG_NAME_MAX_LENGTH} characters.`,
    );
  }

  return name;
};

const normalizeTagCount = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw createInvalidMutationError(
      'Tag count must be a non-negative integer.',
    );
  }

  return value;
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
