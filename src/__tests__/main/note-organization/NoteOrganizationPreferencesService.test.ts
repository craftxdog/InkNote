import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { INBOX_NOTEBOOK_ID } from '../../../shared/documents/document.types';
import { NoteOrganizationPreferencesService } from '../../../main/note-organization/NoteOrganizationPreferencesService';

describe('NoteOrganizationPreferencesService', () => {
  let dataDirectory: string;
  let notebookIds: readonly string[];

  beforeEach(async () => {
    dataDirectory = await mkdtemp(
      path.join(os.tmpdir(), 'inknote-note-organization-'),
    );
    notebookIds = [INBOX_NOTEBOOK_ID, 'work'];
  });

  afterEach(async () => {
    await rm(dataDirectory, { recursive: true, force: true });
  });

  const createService = () =>
    new NoteOrganizationPreferencesService({
      dataDirectory,
      listNotebookIds: async () => notebookIds,
    });

  it('defaults to Inbox until a valid notebook preference is stored', async () => {
    const service = createService();

    await expect(service.getDefaultNotebook()).resolves.toEqual({
      notebookId: INBOX_NOTEBOOK_ID,
    });
    await expect(service.setDefaultNotebook('work')).resolves.toEqual({
      notebookId: 'work',
    });
    await expect(createService().getDefaultNotebook()).resolves.toEqual({
      notebookId: 'work',
    });
    await expect(
      readFile(
        path.join(dataDirectory, 'inknote-note-organization.json'),
        'utf8',
      ),
    ).resolves.toContain('"notebookId": "work"');
  });

  it('rejects a notebook that does not exist in the durable catalogue', async () => {
    await expect(createService().setDefaultNotebook('missing')).rejects.toThrow(
      'Default notebook must exist',
    );
  });

  it('falls back to Inbox when a previously stored notebook was deleted', async () => {
    await writeFile(
      path.join(dataDirectory, 'inknote-note-organization.json'),
      JSON.stringify({ notebookId: 'work' }),
      'utf8',
    );
    notebookIds = [INBOX_NOTEBOOK_ID];

    await expect(createService().getDefaultNotebook()).resolves.toEqual({
      notebookId: INBOX_NOTEBOOK_ID,
    });
  });
});
