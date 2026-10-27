import {
  TAG_COLORS,
  createTagId,
  type TagColor,
  type TagId,
} from '../../../../shared/documents/document.types';

export type CreateTagCommandRequest = Readonly<{
  kind: 'create';
  name: string;
  color: TagColor;
}>;

export type UpdateTagCommandRequest = Readonly<{
  kind: 'update';
  tagId: TagId;
  name: string;
  color: TagColor;
}>;

export type DeleteTagCommandRequest = Readonly<{
  kind: 'delete';
  tagId: TagId;
}>;

export type OpenTagCommandRequest = Readonly<{
  kind: 'open';
  tagId: TagId;
}>;

export type TagCommandRequest =
  | CreateTagCommandRequest
  | UpdateTagCommandRequest
  | DeleteTagCommandRequest
  | OpenTagCommandRequest;

export const createCreateTagCommandRequest = (
  input: Omit<CreateTagCommandRequest, 'kind'>,
): CreateTagCommandRequest => {
  const request = readTagCommandRequest({ kind: 'create', ...input });

  if (request?.kind !== 'create') {
    throw new TypeError('Invalid tag create command request.');
  }

  return request;
};

export const createUpdateTagCommandRequest = (
  input: Omit<UpdateTagCommandRequest, 'kind'>,
): UpdateTagCommandRequest => {
  const request = readTagCommandRequest({ kind: 'update', ...input });

  if (request?.kind !== 'update') {
    throw new TypeError('Invalid tag update command request.');
  }

  return request;
};

export const createDeleteTagCommandRequest = (
  tagId: TagId,
): DeleteTagCommandRequest => {
  const request = readTagCommandRequest({ kind: 'delete', tagId });

  if (request?.kind !== 'delete') {
    throw new TypeError('Invalid tag delete command request.');
  }

  return request;
};

export const createOpenTagCommandRequest = (
  tagId: TagId,
): OpenTagCommandRequest => {
  const request = readTagCommandRequest({ kind: 'open', tagId });

  if (request?.kind !== 'open') {
    throw new TypeError('Invalid tag open command request.');
  }

  return request;
};

export const readTagCommandRequest = (
  value: unknown,
): TagCommandRequest | null => {
  if (!isRecord(value) || typeof value.kind !== 'string') {
    return null;
  }

  switch (value.kind) {
    case 'create': {
      const name = readName(value.name);
      const color = readTagColor(value.color);

      return name === null || color === null
        ? null
        : Object.freeze({ kind: 'create', name, color });
    }
    case 'update': {
      const tagId = readTagId(value.tagId);
      const name = readName(value.name);
      const color = readTagColor(value.color);

      return tagId === null || name === null || color === null
        ? null
        : Object.freeze({ kind: 'update', tagId, name, color });
    }
    case 'delete': {
      const tagId = readTagId(value.tagId);

      return tagId === null ? null : Object.freeze({ kind: 'delete', tagId });
    }
    case 'open': {
      const tagId = readTagId(value.tagId);

      return tagId === null ? null : Object.freeze({ kind: 'open', tagId });
    }
    default:
      return null;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readName = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const name = value.trim();

  return name.length === 0 ? null : name;
};

const readTagId = (value: unknown): TagId | null => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  return createTagId(value.trim());
};

const readTagColor = (value: unknown): TagColor | null =>
  (TAG_COLORS as readonly unknown[]).includes(value)
    ? (value as TagColor)
    : null;
