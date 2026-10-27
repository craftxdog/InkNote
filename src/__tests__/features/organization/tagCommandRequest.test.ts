import {
  createUpdateTagCommandRequest,
  readTagCommandRequest,
} from '../../../renderer/features/organization/model/tagCommandRequest';
import { createTagId } from '../../../shared/documents/document.types';

describe('tag command requests', () => {
  it('creates immutable, complete tag update requests', () => {
    const request = createUpdateTagCommandRequest({
      tagId: createTagId('tag:catalogue'),
      name: ' Team catalogue ',
      color: 'purple',
    });

    expect(request).toEqual({
      kind: 'update',
      tagId: 'tag:catalogue',
      name: 'Team catalogue',
      color: 'purple',
    });
    expect(Object.isFrozen(request)).toBe(true);
  });

  it('rejects incomplete or unsupported tag command details', () => {
    expect(readTagCommandRequest(undefined)).toBeNull();
    expect(
      readTagCommandRequest({ kind: 'create', name: '', color: 'teal' }),
    ).toBeNull();
    expect(
      readTagCommandRequest({
        kind: 'update',
        tagId: ' ',
        name: 'Team',
        color: 'teal',
      }),
    ).toBeNull();
    expect(
      readTagCommandRequest({ kind: 'delete', tagId: ['tag:catalogue'] }),
    ).toBeNull();
    expect(
      readTagCommandRequest({ kind: 'open', tagId: 'tag:catalogue' }),
    ).toEqual({ kind: 'open', tagId: 'tag:catalogue' });
  });
});
