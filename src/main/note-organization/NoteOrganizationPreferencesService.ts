import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  defaultNotebookPreference,
  validateDefaultNotebookId,
  validateDefaultNotebookPreference,
  type DefaultNotebookPreference,
} from '../../shared/note-organization/noteOrganizationPreferences.types';

const SETTINGS_FILE_NAME = 'inknote-note-organization.json';

type NoteOrganizationPreferencesServiceOptions = Readonly<{
  dataDirectory: string;
  listNotebookIds: () => Promise<readonly string[]>;
}>;

/**
 * Persists application-local note organization choices. It deliberately keeps
 * preferences outside note rows and Yjs documents, while still checking a
 * selected notebook against the durable notebook catalogue.
 */
export class NoteOrganizationPreferencesService {
  private readonly dataDirectory: string;

  private readonly listNotebookIds: () => Promise<readonly string[]>;

  private writeQueue: Promise<void> = Promise.resolve();

  constructor({
    dataDirectory,
    listNotebookIds,
  }: NoteOrganizationPreferencesServiceOptions) {
    if (
      typeof dataDirectory !== 'string' ||
      dataDirectory.trim().length === 0
    ) {
      throw new Error('Data directory must be a non-empty path.');
    }
    if (typeof listNotebookIds !== 'function') {
      throw new Error('Notebook catalogue reader must be a function.');
    }

    this.dataDirectory = dataDirectory;
    this.listNotebookIds = listNotebookIds;
  }

  async getDefaultNotebook(): Promise<DefaultNotebookPreference> {
    const stored = await this.readPreference();

    return (await this.hasNotebook(stored.notebookId))
      ? stored
      : defaultNotebookPreference();
  }

  async setDefaultNotebook(
    notebookId: unknown,
  ): Promise<DefaultNotebookPreference> {
    const preference = Object.freeze({
      notebookId: validateDefaultNotebookId(notebookId),
    });

    return this.enqueueWrite(async () => {
      if (!(await this.hasNotebook(preference.notebookId))) {
        throw new Error(
          'Default notebook must exist before it can be selected.',
        );
      }

      await mkdir(this.dataDirectory, { recursive: true });
      const settingsPath = this.settingsPath();
      const temporaryPath = `${settingsPath}.${process.pid}.tmp`;

      await writeFile(
        temporaryPath,
        `${JSON.stringify(preference, null, 2)}\n`,
        'utf8',
      );
      await rename(temporaryPath, settingsPath);

      return preference;
    });
  }

  private async hasNotebook(notebookId: string): Promise<boolean> {
    const notebookIds = await this.listNotebookIds();

    return notebookIds.includes(notebookId);
  }

  private async readPreference(): Promise<DefaultNotebookPreference> {
    try {
      const source = await readFile(this.settingsPath(), 'utf8');

      return validateDefaultNotebookPreference(JSON.parse(source) as unknown);
    } catch (error) {
      if (isMissingFileError(error) || error instanceof SyntaxError) {
        return defaultNotebookPreference();
      }

      if (
        error instanceof Error &&
        error.message.startsWith('Default notebook')
      ) {
        return defaultNotebookPreference();
      }

      throw error;
    }
  }

  private settingsPath(): string {
    return path.join(this.dataDirectory, SETTINGS_FILE_NAME);
  }

  private enqueueWrite<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.writeQueue.then(operation, operation);

    this.writeQueue = next.then(
      () => undefined,
      () => undefined,
    );

    return next;
  }
}

const isMissingFileError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as NodeJS.ErrnoException).code === 'ENOENT';
