import type {
  Notebook,
  NotebookIconName,
} from '../../../../shared/documents/document.types';

import {
  readNotebookCommandRequest,
  type NotebookCommandRequest,
} from './notebookCommandRequest';
import {
  organizationCommandIds,
  type OrganizationCommand,
} from './organizationCommands';

type NotebookCommandWorkspace = Readonly<{
  notebooks: readonly Notebook[];
  createNotebook: (
    name: string,
    parentId?: string | null,
    icon?: NotebookIconName,
  ) => Promise<Notebook>;
  updateNotebook: (input: {
    id: string;
    name: string;
    parentId: string | null;
    icon: NotebookIconName | null;
  }) => Promise<Notebook>;
  deleteNotebook: (notebookId: string) => Promise<void>;
}>;

const notebookCommandIds = Object.freeze([
  organizationCommandIds.createNotebook,
  organizationCommandIds.updateNotebook,
  organizationCommandIds.deleteNotebook,
  organizationCommandIds.openNotebook,
] as const);

export const isNotebookOrganizationCommand = (
  command: OrganizationCommand,
): boolean =>
  notebookCommandIds.includes(command as (typeof notebookCommandIds)[number]);

/** Routes typed notebook commands to workspace actions without UI shortcuts. */
export const executeNotebookCommand = async (
  command: OrganizationCommand,
  detail: unknown,
  workspace: NotebookCommandWorkspace,
): Promise<Notebook | undefined> => {
  const request = readNotebookCommandRequest(detail);

  if (request === null) {
    return undefined;
  }

  switch (command) {
    case organizationCommandIds.createNotebook:
      return request.kind === 'create'
        ? workspace.createNotebook(
            request.name,
            request.parentId,
            request.icon ?? undefined,
          )
        : undefined;
    case organizationCommandIds.updateNotebook:
      return request.kind === 'update'
        ? workspace.updateNotebook({
            id: request.notebookId,
            name: request.name,
            parentId: request.parentId,
            icon: request.icon,
          })
        : undefined;
    case organizationCommandIds.deleteNotebook:
      return request.kind === 'delete'
        ? deleteNotebook(workspace, request)
        : undefined;
    case organizationCommandIds.openNotebook:
      return request.kind === 'open'
        ? (workspace.notebooks.find(
            (notebook) => notebook.id === request.notebookId,
          ) ?? undefined)
        : undefined;
    default:
      return undefined;
  }
};

const deleteNotebook = async (
  workspace: NotebookCommandWorkspace,
  request: Extract<NotebookCommandRequest, { kind: 'delete' }>,
): Promise<undefined> => {
  await workspace.deleteNotebook(request.notebookId);
  return undefined;
};
