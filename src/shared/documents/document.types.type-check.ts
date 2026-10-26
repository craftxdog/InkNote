import {
  createGeneratedTagId,
  createMutationId,
  createNoteId,
  createRevision,
  type MutationId,
  type NoteId,
  type Revision,
  type TagId,
} from './document.types';

const noteId: NoteId = createNoteId('note-1');
const mutationId: MutationId = createMutationId('mutation-1');
const revision: Revision = createRevision('revision-1');
const tagId: TagId = createGeneratedTagId('tag-1');

// @ts-expect-error Mutation IDs must not be used as note IDs.
const invalidNoteId: NoteId = mutationId;
// @ts-expect-error Revisions must not be used as mutation IDs.
const invalidMutationId: MutationId = revision;
// @ts-expect-error Plain strings must not be used as branded note IDs.
const invalidPlainString: NoteId = 'note-1';
// @ts-expect-error Tag IDs must not be used as note IDs.
const invalidTagAsNoteId: NoteId = tagId;

void noteId;
void invalidNoteId;
void invalidMutationId;
void invalidPlainString;
void invalidTagAsNoteId;
