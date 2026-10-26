import {
  createNoteCommandRequest,
  readNoteCommandRequest,
} from '../../../renderer/features/organization/model/noteCommandRequest';
import { createNoteId } from '../../../shared/documents/document.types';

describe('note command request', () => {
  it('normalizes duplicate note IDs and preserves an explicit destination', () => {
    const noteId = createNoteId('duplicate');

    expect(createNoteCommandRequest([noteId, noteId], 'work')).toEqual({
      noteIds: [noteId],
      destinationNotebookId: 'work',
    });
  });

  it('rejects malformed, empty, or untrusted command detail', () => {
    expect(readNoteCommandRequest(undefined)).toBeNull();
    expect(readNoteCommandRequest({ noteIds: [] })).toBeNull();
    expect(readNoteCommandRequest({ noteIds: [''] })).toBeNull();
    expect(
      readNoteCommandRequest({
        noteIds: ['note-1'],
        destinationNotebookId: '',
      }),
    ).toBeNull();
  });

  it('accepts the serializable request shape from UI sources', () => {
    expect(
      readNoteCommandRequest({
        noteIds: ['note-1'],
        destinationNotebookId: 'work',
      }),
    ).toEqual({
      noteIds: ['note-1'],
      destinationNotebookId: 'work',
    });
  });
});
