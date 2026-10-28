import {
  runNoteOrganizationIpcOperation,
  unwrapNoteOrganizationIpcResult,
} from '../../../shared/note-organization/noteOrganizationPreferences.ipc';
import { validateDefaultNotebookPreference } from '../../../shared/note-organization/noteOrganizationPreferences.types';

describe('note organization IPC contract', () => {
  it('serializes valid preferences and rejects invalid response values', async () => {
    await expect(
      runNoteOrganizationIpcOperation(() => ({ notebookId: 'work' })),
    ).resolves.toEqual({ ok: true, value: { notebookId: 'work' } });

    expect(
      unwrapNoteOrganizationIpcResult(
        { ok: true, value: { notebookId: 'work' } },
        validateDefaultNotebookPreference,
      ),
    ).toEqual({ notebookId: 'work' });
    expect(() =>
      unwrapNoteOrganizationIpcResult(
        { ok: true, value: { notebookId: '' } },
        validateDefaultNotebookPreference,
      ),
    ).toThrow('invalid response');
  });

  it('keeps an operation error serializable', async () => {
    const result = await runNoteOrganizationIpcOperation(() => {
      throw new Error('Notebook does not exist.');
    });

    expect(result).toEqual({
      ok: false,
      error: { message: 'Notebook does not exist.' },
    });
  });
});
