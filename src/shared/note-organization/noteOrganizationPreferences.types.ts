import { INBOX_NOTEBOOK_ID } from '../documents/document.types';

export type DefaultNotebookPreference = Readonly<{
  notebookId: string;
}>;

export const createDefaultNotebookPreference = (
  notebookId: unknown,
): DefaultNotebookPreference =>
  Object.freeze({ notebookId: validateDefaultNotebookId(notebookId) });

export const validateDefaultNotebookPreference = (
  value: unknown,
): DefaultNotebookPreference => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Default notebook preference must be an object.');
  }

  return createDefaultNotebookPreference(
    (value as Readonly<Record<string, unknown>>).notebookId,
  );
};

export const defaultNotebookPreference = (): DefaultNotebookPreference =>
  createDefaultNotebookPreference(INBOX_NOTEBOOK_ID);

export const validateDefaultNotebookId = (value: unknown): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('Default notebook ID must be a non-empty string.');
  }

  return value.trim();
};
