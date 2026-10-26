import {
  createUpdateNotebookCommandRequest,
  readNotebookCommandRequest,
} from '../../../renderer/features/organization/model/notebookCommandRequest';

describe('notebook command request', () => {
  it('creates an immutable normalized request for a complete notebook edit', () => {
    const request = createUpdateNotebookCommandRequest({
      notebookId: 'work',
      name: '  Client work  ',
      parentId: null,
      icon: null,
    });

    expect(request).toEqual({
      kind: 'update',
      notebookId: 'work',
      name: 'Client work',
      parentId: null,
      icon: null,
    });
    expect(Object.isFrozen(request)).toBe(true);
  });

  it('reads valid create, delete, and open requests from untrusted command detail', () => {
    expect(
      readNotebookCommandRequest({
        kind: 'create',
        name: 'Research',
        parentId: 'work',
        icon: 'flask',
      }),
    ).toEqual({
      kind: 'create',
      name: 'Research',
      parentId: 'work',
      icon: 'flask',
    });
    expect(
      readNotebookCommandRequest({ kind: 'delete', notebookId: 'work' }),
    ).toEqual({ kind: 'delete', notebookId: 'work' });
    expect(
      readNotebookCommandRequest({ kind: 'open', notebookId: 'work' }),
    ).toEqual({ kind: 'open', notebookId: 'work' });
  });

  it('rejects incomplete or unsafe command detail', () => {
    expect(readNotebookCommandRequest(undefined)).toBeNull();
    expect(
      readNotebookCommandRequest({
        kind: 'update',
        notebookId: 'work',
        name: '',
        parentId: null,
        icon: null,
      }),
    ).toBeNull();
    expect(
      readNotebookCommandRequest({
        kind: 'update',
        notebookId: 'work',
        name: 'Work',
        parentId: undefined,
        icon: null,
      }),
    ).toBeNull();
    expect(
      readNotebookCommandRequest({
        kind: 'create',
        name: 'Work',
        parentId: null,
        icon: 'sparkle',
      }),
    ).toBeNull();
  });
});
