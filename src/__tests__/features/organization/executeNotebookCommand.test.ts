import { executeNotebookCommand } from '../../../renderer/features/organization/model/executeNotebookCommand';
import { organizationCommandIds } from '../../../renderer/features/organization/model/organizationCommands';
import type { Notebook } from '../../../shared/documents/document.types';

const work: Notebook = {
  id: 'work',
  name: 'Work',
  parentId: null,
  createdAt: '2026-10-26T12:00:00.000Z',
  updatedAt: '2026-10-26T12:00:00.000Z',
};

describe('executeNotebookCommand', () => {
  it('creates a notebook through the workspace action after validating the command request', async () => {
    const createNotebook = jest.fn().mockResolvedValue(work);

    await expect(
      executeNotebookCommand(
        organizationCommandIds.createNotebook,
        { kind: 'create', name: ' Work ', parentId: null, icon: null },
        {
          notebooks: [work],
          createNotebook,
          updateNotebook: jest.fn(),
          deleteNotebook: jest.fn(),
        },
      ),
    ).resolves.toEqual(work);

    expect(createNotebook).toHaveBeenCalledWith('Work', null, undefined);
  });

  it('updates and opens only notebooks addressed by typed requests', async () => {
    const updated = {
      ...work,
      name: 'Focused work',
      icon: 'briefcase',
    } as const;
    const updateNotebook = jest.fn().mockResolvedValue(updated);

    await expect(
      executeNotebookCommand(
        organizationCommandIds.updateNotebook,
        {
          kind: 'update',
          notebookId: 'work',
          name: 'Focused work',
          parentId: null,
          icon: 'briefcase',
        },
        {
          notebooks: [updated],
          createNotebook: jest.fn(),
          updateNotebook,
          deleteNotebook: jest.fn(),
        },
      ),
    ).resolves.toEqual(updated);

    expect(updateNotebook).toHaveBeenCalledWith({
      id: 'work',
      name: 'Focused work',
      parentId: null,
      icon: 'briefcase',
    });

    await expect(
      executeNotebookCommand(
        organizationCommandIds.openNotebook,
        { kind: 'open', notebookId: 'work' },
        {
          notebooks: [updated],
          createNotebook: jest.fn(),
          updateNotebook: jest.fn(),
          deleteNotebook: jest.fn(),
        },
      ),
    ).resolves.toEqual(updated);
  });

  it('deletes through the workspace action and returns no stale notebook result', async () => {
    const deleteNotebook = jest.fn().mockResolvedValue(undefined);

    await expect(
      executeNotebookCommand(
        organizationCommandIds.deleteNotebook,
        { kind: 'delete', notebookId: 'work' },
        {
          notebooks: [work],
          createNotebook: jest.fn(),
          updateNotebook: jest.fn(),
          deleteNotebook,
        },
      ),
    ).resolves.toBeUndefined();

    expect(deleteNotebook).toHaveBeenCalledWith('work');
  });

  it('does not mutate when the command and request kinds do not match', async () => {
    const createNotebook = jest.fn();
    const updateNotebook = jest.fn();
    const deleteNotebook = jest.fn();

    await expect(
      executeNotebookCommand(
        organizationCommandIds.deleteNotebook,
        { kind: 'open', notebookId: 'work' },
        { notebooks: [work], createNotebook, updateNotebook, deleteNotebook },
      ),
    ).resolves.toBeUndefined();

    expect(createNotebook).not.toHaveBeenCalled();
    expect(updateNotebook).not.toHaveBeenCalled();
    expect(deleteNotebook).not.toHaveBeenCalled();
  });
});
