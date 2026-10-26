import { createNoteId } from '../../../shared/documents/document.types';
import { runNoteBatchOperation } from '../../../renderer/platform/documents/noteBatchOperation';

describe('runNoteBatchOperation', () => {
  it('normalizes duplicate IDs and reports the remaining notes after a failure', async () => {
    const first = createNoteId('note-1');
    const second = createNoteId('note-2');
    const third = createNoteId('note-3');
    const failure = new Error('Revision conflict');
    const operation = jest
      .fn<Promise<void>, [typeof first]>()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(failure);

    await expect(
      runNoteBatchOperation([first, first, second, third], operation),
    ).resolves.toEqual({
      completedNoteIds: [first],
      remainingNoteIds: [second, third],
      error: failure,
    });
    expect(operation).toHaveBeenCalledTimes(2);
    expect(operation).toHaveBeenNthCalledWith(1, first);
    expect(operation).toHaveBeenNthCalledWith(2, second);
  });

  it('reports complete success without an error', async () => {
    const first = createNoteId('note-1');
    const second = createNoteId('note-2');

    await expect(
      runNoteBatchOperation([first, second], async () => undefined),
    ).resolves.toEqual({
      completedNoteIds: [first, second],
      remainingNoteIds: [],
      error: null,
    });
  });
});
