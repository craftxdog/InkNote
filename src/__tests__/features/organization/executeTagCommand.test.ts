import { executeTagCommand } from '../../../renderer/features/organization/model/executeTagCommand';
import { organizationCommandIds } from '../../../renderer/features/organization/model/organizationCommands';
import {
  createTagId,
  type TagSummary,
} from '../../../shared/documents/document.types';

const catalogue: TagSummary = {
  id: createTagId('tag:catalogue'),
  name: 'catalogue',
  color: 'teal',
  count: 1,
  createdAt: '2026-10-26T12:00:00.000Z',
  updatedAt: '2026-10-26T12:00:00.000Z',
};

const createWorkspace = () => ({
  tags: [catalogue],
  createTag: jest.fn().mockResolvedValue(catalogue),
  updateTag: jest.fn().mockResolvedValue({
    ...catalogue,
    name: 'team catalogue',
    color: 'purple',
  }),
  deleteTag: jest.fn().mockResolvedValue({
    deletedTagId: catalogue.id,
    affectedNoteIds: [],
  }),
});

describe('executeTagCommand', () => {
  it('routes create, update, and delete only through workspace actions', async () => {
    const workspace = createWorkspace();

    await expect(
      executeTagCommand(
        organizationCommandIds.createTag,
        { kind: 'create', name: 'Roadmap', color: 'blue' },
        workspace,
      ),
    ).resolves.toEqual(catalogue);
    await expect(
      executeTagCommand(
        organizationCommandIds.updateTag,
        {
          kind: 'update',
          tagId: catalogue.id,
          name: 'Team catalogue',
          color: 'purple',
        },
        workspace,
      ),
    ).resolves.toMatchObject({ name: 'team catalogue', color: 'purple' });
    await expect(
      executeTagCommand(
        organizationCommandIds.deleteTag,
        { kind: 'delete', tagId: catalogue.id },
        workspace,
      ),
    ).resolves.toBeUndefined();

    expect(workspace.createTag).toHaveBeenCalledWith({
      name: 'Roadmap',
      color: 'blue',
    });
    expect(workspace.updateTag).toHaveBeenCalledWith({
      id: catalogue.id,
      name: 'Team catalogue',
      color: 'purple',
    });
    expect(workspace.deleteTag).toHaveBeenCalledWith(catalogue.id);
  });

  it('opens only the current summary and safely ignores invalid targets', async () => {
    const workspace = createWorkspace();

    await expect(
      executeTagCommand(
        organizationCommandIds.openTag,
        { kind: 'open', tagId: catalogue.id },
        workspace,
      ),
    ).resolves.toEqual(catalogue);
    await expect(
      executeTagCommand(
        organizationCommandIds.updateTag,
        {
          kind: 'update',
          tagId: createTagId('tag:missing'),
          name: 'Missing',
          color: 'red',
        },
        workspace,
      ),
    ).resolves.toBeUndefined();
    await expect(
      executeTagCommand(
        organizationCommandIds.deleteTag,
        { kind: 'open', tagId: catalogue.id },
        workspace,
      ),
    ).resolves.toBeUndefined();

    expect(workspace.updateTag).not.toHaveBeenCalled();
    expect(workspace.deleteTag).not.toHaveBeenCalled();
  });
});
