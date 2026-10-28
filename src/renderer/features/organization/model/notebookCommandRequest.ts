import {
  NOTEBOOK_ICON_NAMES,
  type NotebookIconName,
} from '../../../../shared/documents/document.types';

export type CreateNotebookCommandRequest = Readonly<{
  kind: 'create';
  name: string;
  parentId: string | null;
  icon: NotebookIconName | null;
}>;

export type UpdateNotebookCommandRequest = Readonly<{
  kind: 'update';
  notebookId: string;
  name: string;
  parentId: string | null;
  icon: NotebookIconName | null;
}>;

export type DeleteNotebookCommandRequest = Readonly<{
  kind: 'delete';
  notebookId: string;
}>;

export type OpenNotebookCommandRequest = Readonly<{
  kind: 'open';
  notebookId: string;
}>;

export type NotebookCommandRequest =
  | CreateNotebookCommandRequest
  | UpdateNotebookCommandRequest
  | DeleteNotebookCommandRequest
  | OpenNotebookCommandRequest;

export const createCreateNotebookCommandRequest = (
  input: Omit<CreateNotebookCommandRequest, 'kind'>,
): CreateNotebookCommandRequest => {
  const request = readNotebookCommandRequest({ kind: 'create', ...input });

  if (request?.kind !== 'create') {
    throw new TypeError('Invalid notebook create command request.');
  }

  return request;
};

export const createUpdateNotebookCommandRequest = (
  input: Omit<UpdateNotebookCommandRequest, 'kind'>,
): UpdateNotebookCommandRequest => {
  const request = readNotebookCommandRequest({ kind: 'update', ...input });

  if (request?.kind !== 'update') {
    throw new TypeError('Invalid notebook update command request.');
  }

  return request;
};

export const createDeleteNotebookCommandRequest = (
  notebookId: string,
): DeleteNotebookCommandRequest => {
  const request = readNotebookCommandRequest({ kind: 'delete', notebookId });

  if (request?.kind !== 'delete') {
    throw new TypeError('Invalid notebook delete command request.');
  }

  return request;
};

export const createOpenNotebookCommandRequest = (
  notebookId: string,
): OpenNotebookCommandRequest => {
  const request = readNotebookCommandRequest({ kind: 'open', notebookId });

  if (request?.kind !== 'open') {
    throw new TypeError('Invalid notebook open command request.');
  }

  return request;
};

export const readNotebookCommandRequest = (
  value: unknown,
): NotebookCommandRequest | null => {
  if (!isRecord(value) || typeof value.kind !== 'string') {
    return null;
  }

  switch (value.kind) {
    case 'create': {
      const name = readName(value.name);
      const parentId = readNullableNotebookId(value.parentId);
      const icon = readNullableNotebookIcon(value.icon);

      return name === null || parentId === undefined || icon === undefined
        ? null
        : Object.freeze({ kind: 'create', name, parentId, icon });
    }
    case 'update': {
      const notebookId = readNotebookId(value.notebookId);
      const name = readName(value.name);
      const parentId = readNullableNotebookId(value.parentId);
      const icon = readNullableNotebookIcon(value.icon);

      return notebookId === null ||
        name === null ||
        parentId === undefined ||
        icon === undefined
        ? null
        : Object.freeze({ kind: 'update', notebookId, name, parentId, icon });
    }
    case 'delete': {
      const notebookId = readNotebookId(value.notebookId);

      return notebookId === null
        ? null
        : Object.freeze({ kind: 'delete', notebookId });
    }
    case 'open': {
      const notebookId = readNotebookId(value.notebookId);

      return notebookId === null
        ? null
        : Object.freeze({ kind: 'open', notebookId });
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

const readNotebookId = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const notebookId = value.trim();

  return notebookId.length === 0 ? null : notebookId;
};

const readNullableNotebookId = (value: unknown): string | null | undefined => {
  if (value === null) {
    return null;
  }

  return readNotebookId(value) ?? undefined;
};

const readNullableNotebookIcon = (
  value: unknown,
): NotebookIconName | null | undefined => {
  if (value === null) {
    return null;
  }

  return (NOTEBOOK_ICON_NAMES as readonly unknown[]).includes(value)
    ? (value as NotebookIconName)
    : undefined;
};
