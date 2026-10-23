/** @jest-environment node */

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { MarkdownExportService } from '../../../main/data/MarkdownExportService';
import {
  createNoteId,
  createRevision,
  type NoteDocument,
  type Notebook,
} from '../../../shared/documents/document.types';

const notebook = (
  id: string,
  name: string,
  parentId: string | null = null,
): Notebook => ({
  id,
  name,
  parentId,
  createdAt: '2026-10-23T15:00:00.000Z',
  updatedAt: '2026-10-23T15:00:00.000Z',
});

const note = (
  id: string,
  title: string,
  body: string,
  notebookId: string,
): NoteDocument => ({
  id: createNoteId(id),
  title,
  body,
  notebookId,
  status: 'active',
  tags: [],
  createdAt: '2026-10-23T15:00:00.000Z',
  updatedAt: '2026-10-23T15:00:00.000Z',
  revision: createRevision('local-1'),
  deletedAt: null,
});

describe('MarkdownExportService', () => {
  let temporaryDirectory: string;

  beforeEach(async () => {
    temporaryDirectory = await mkdtemp(
      path.join(os.tmpdir(), 'inknote-export-'),
    );
  });

  afterEach(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  it('exports active notes as Markdown within their full notebook hierarchy', async () => {
    const service = new MarkdownExportService({
      listActive: async () => [
        note(
          'linux-commands',
          'Commands',
          '# Commands\n\n`ls -la`',
          'commands',
        ),
        note('inbox-note', 'Inbox note', 'Unfiled body', 'inbox'),
      ],
      listNotebooks: async () => [
        notebook('inbox', 'Inbox'),
        notebook('linux', 'Linux'),
        notebook('commands', 'Commands', 'linux'),
      ],
    });
    const exportDirectory = path.join(temporaryDirectory, 'markdown');

    await expect(service.exportMarkdown(exportDirectory)).resolves.toEqual({
      directory: exportDirectory,
      exportedNotes: 2,
    });

    await expect(
      readFile(
        path.join(exportDirectory, 'Linux', 'Commands', 'Commands.md'),
        'utf8',
      ),
    ).resolves.toBe('# Commands\n\n`ls -la`');
    await expect(
      readFile(path.join(exportDirectory, 'Inbox', 'Inbox note.md'), 'utf8'),
    ).resolves.toBe('Unfiled body');
  });

  it('keeps export paths inside the selected folder and does not overwrite same-title notes', async () => {
    const service = new MarkdownExportService({
      listActive: async () => [
        note('one', '../Escaped', 'first', 'inbox'),
        note('two', '../Escaped', 'second', 'inbox'),
      ],
      listNotebooks: async () => [notebook('inbox', 'Inbox')],
    });
    const exportDirectory = path.join(temporaryDirectory, 'markdown');

    await service.exportMarkdown(exportDirectory);

    await expect(
      readFile(path.join(exportDirectory, 'Inbox', 'Escaped.md'), 'utf8'),
    ).resolves.toBe('first');
    await expect(
      readFile(path.join(exportDirectory, 'Inbox', 'Escaped (2).md'), 'utf8'),
    ).resolves.toBe('second');
  });
});
