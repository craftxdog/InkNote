import type {
  DeleteTagResult,
  TagColor,
  TagId,
  TagSummary,
} from '../../../../shared/documents/document.types';

import {
  readTagCommandRequest,
  type TagCommandRequest,
} from './tagCommandRequest';
import {
  organizationCommandIds,
  type OrganizationCommand,
} from './organizationCommands';

type TagCommandWorkspace = Readonly<{
  tags: readonly TagSummary[];
  createTag: (input: { name: string; color: TagColor }) => Promise<TagSummary>;
  updateTag: (input: {
    id: TagId;
    name: string;
    color: TagColor;
  }) => Promise<TagSummary>;
  deleteTag: (tagId: TagId) => Promise<DeleteTagResult>;
}>;

const tagCommandIds = Object.freeze([
  organizationCommandIds.createTag,
  organizationCommandIds.updateTag,
  organizationCommandIds.deleteTag,
  organizationCommandIds.openTag,
] as const);

export const isTagOrganizationCommand = (
  command: OrganizationCommand,
): boolean => tagCommandIds.includes(command as (typeof tagCommandIds)[number]);

/** Routes valid tag requests through the current workspace callbacks only. */
export const executeTagCommand = async (
  command: OrganizationCommand,
  detail: unknown,
  workspace: TagCommandWorkspace,
): Promise<TagSummary | undefined> => {
  const request = readTagCommandRequest(detail);

  if (request === null) {
    return undefined;
  }

  switch (command) {
    case organizationCommandIds.createTag:
      return request.kind === 'create'
        ? workspace.createTag({ name: request.name, color: request.color })
        : undefined;
    case organizationCommandIds.updateTag:
      return request.kind === 'update' && hasTag(workspace.tags, request.tagId)
        ? workspace.updateTag({
            id: request.tagId,
            name: request.name,
            color: request.color,
          })
        : undefined;
    case organizationCommandIds.deleteTag:
      return request.kind === 'delete' && hasTag(workspace.tags, request.tagId)
        ? deleteTag(workspace, request)
        : undefined;
    case organizationCommandIds.openTag:
      return request.kind === 'open'
        ? (workspace.tags.find((tag) => tag.id === request.tagId) ?? undefined)
        : undefined;
    default:
      return undefined;
  }
};

const hasTag = (tags: readonly TagSummary[], tagId: TagId): boolean =>
  tags.some((tag) => tag.id === tagId);

const deleteTag = async (
  workspace: TagCommandWorkspace,
  request: Extract<TagCommandRequest, { kind: 'delete' }>,
): Promise<undefined> => {
  await workspace.deleteTag(request.tagId);
  return undefined;
};
