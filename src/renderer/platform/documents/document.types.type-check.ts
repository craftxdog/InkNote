import {
  createMutationId,
  createNoteId,
  createRevision,
  type MutationId,
  type NoteId,
  type Revision,
} from './document.types';

const noteId: NoteId = createNoteId('note-1');
const mutationId: MutationId = createMutationId('mutation-1');
const revision: Revision = createRevision('revision-1');

// @ts-expect-error Mutation IDs must not be used as note IDs.
const invalidNoteId: NoteId = mutationId;
// @ts-expect-error Revisions must not be used as mutation IDs.
const invalidMutationId: MutationId = revision;
// @ts-expect-error Plain strings must not be used as branded note IDs.
const invalidPlainString: NoteId = 'note-1';

void noteId;
void invalidNoteId;
void invalidMutationId;
void invalidPlainString;
