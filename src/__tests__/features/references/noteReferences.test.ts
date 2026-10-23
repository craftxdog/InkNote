import {
  formatNoteReference,
  parseNoteReference,
} from '../../../renderer/features/references/model/noteReferences';
import {
  createNoteId,
  createRevision,
  type NoteDocument,
} from '../../../shared/documents/document.types';

const referencedDocument: NoteDocument = {
  id: createNoteId('linux-commands'),
  title: 'Linux [Commands]',
  body: '',
  notebookId: 'commands',
  status: 'active',
  tags: [],
  createdAt: '2026-10-23T15:00:00.000Z',
  updatedAt: '2026-10-23T15:00:00.000Z',
  revision: createRevision('local-1'),
  deletedAt: null,
};

describe('note references', () => {
  it('formats Markdown links without letting a title change the link syntax', () => {
    expect(formatNoteReference(referencedDocument)).toBe(
      '[Linux \\[Commands\\]](inknote://note/linux-commands)',
    );
  });

  it('accepts only exact internal note URLs', () => {
    expect(parseNoteReference('inknote://note/linux-commands')).toBe(
      referencedDocument.id,
    );
    expect(parseNoteReference('https://note/linux-commands')).toBeNull();
    expect(
      parseNoteReference('inknote://note/linux-commands?draft=1'),
    ).toBeNull();
    expect(parseNoteReference('inknote://note/')).toBeNull();
  });
});
