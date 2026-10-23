import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { validateAbsolutePath } from '../../shared/data/data.types';
import {
  INBOX_NOTEBOOK_ID,
  type NoteDocument,
  type Notebook,
} from '../../shared/documents/document.types';

type MarkdownExportServiceOptions = Readonly<{
  listActive: () => Promise<readonly NoteDocument[]>;
  listNotebooks: () => Promise<readonly Notebook[]>;
}>;

type ExportedNote = Readonly<{
  document: NoteDocument;
  relativeDirectory: string;
}>;

/**
 * Exports the active workspace as plain Markdown. The renderer only chooses
 * an already-authorized directory; all path construction remains in main.
 */
export class MarkdownExportService {
  private readonly listActive: () => Promise<readonly NoteDocument[]>;

  private readonly listNotebooks: () => Promise<readonly Notebook[]>;

  constructor(options: MarkdownExportServiceOptions) {
    this.listActive = options.listActive;
    this.listNotebooks = options.listNotebooks;
  }

  async exportMarkdown(directory: string): Promise<{
    directory: string;
    exportedNotes: number;
  }> {
    const exportDirectory = validateAbsolutePath(directory, 'Export directory');
    const [documents, notebooks] = await Promise.all([
      this.listActive(),
      this.listNotebooks(),
    ]);
    const relativeDirectories = createNotebookDirectories(notebooks);
    const exported = documents.map((document) =>
      Object.freeze({
        document,
        relativeDirectory:
          relativeDirectories.get(document.notebookId) ?? 'Unfiled',
      }),
    );

    await mkdir(exportDirectory, { recursive: true });

    for (const item of exported) {
      await this.writeDocument(exportDirectory, item);
    }

    return Object.freeze({
      directory: exportDirectory,
      exportedNotes: exported.length,
    });
  }

  private async writeDocument(
    exportDirectory: string,
    item: ExportedNote,
  ): Promise<void> {
    const targetDirectory = resolveExportPath(
      exportDirectory,
      item.relativeDirectory,
    );
    await mkdir(targetDirectory, { recursive: true });

    const filename = await createAvailableFilename(
      targetDirectory,
      item.document.title,
    );
    const destination = resolveExportPath(targetDirectory, filename);

    await writeFile(destination, item.document.body, 'utf8');
  }
}

const createNotebookDirectories = (
  notebooks: readonly Notebook[],
): ReadonlyMap<string, string> => {
  const byId = new Map(notebooks.map((notebook) => [notebook.id, notebook]));
  const namesById = createSiblingSafeNames(notebooks);
  const directories = new Map<string, string>();

  const directoryFor = (id: string, visiting = new Set<string>()): string => {
    const cached = directories.get(id);
    if (cached !== undefined) {
      return cached;
    }

    const notebook = byId.get(id);
    if (notebook === undefined || visiting.has(id)) {
      return 'Unfiled';
    }

    const nextVisiting = new Set(visiting);
    nextVisiting.add(id);
    const name = namesById.get(id) ?? 'Untitled notebook';
    const parentId = notebook.parentId;
    const directory =
      parentId === null ||
      parentId === undefined ||
      parentId === INBOX_NOTEBOOK_ID
        ? name
        : path.join(directoryFor(parentId, nextVisiting), name);

    directories.set(id, directory);
    return directory;
  };

  for (const notebook of notebooks) {
    directoryFor(notebook.id);
  }

  if (!directories.has(INBOX_NOTEBOOK_ID)) {
    directories.set(INBOX_NOTEBOOK_ID, 'Inbox');
  }

  return directories;
};

const createSiblingSafeNames = (
  notebooks: readonly Notebook[],
): ReadonlyMap<string, string> => {
  const countsByParent = new Map<string, Map<string, number>>();
  const names = new Map<string, string>();

  for (const notebook of notebooks) {
    const parentKey = notebook.parentId ?? '__root__';
    const safeName = sanitizePathSegment(notebook.name, 'Untitled notebook');
    const counts = countsByParent.get(parentKey) ?? new Map<string, number>();
    const count = (counts.get(safeName) ?? 0) + 1;
    counts.set(safeName, count);
    countsByParent.set(parentKey, counts);
    names.set(notebook.id, count === 1 ? safeName : `${safeName} (${count})`);
  }

  return names;
};

const createAvailableFilename = async (
  directory: string,
  title: string,
): Promise<string> => {
  const baseName = sanitizePathSegment(title, 'Untitled note').replace(
    /\.md$/i,
    '',
  );
  const safeBaseName = baseName.length === 0 ? 'Untitled note' : baseName;

  for (let index = 1; ; index += 1) {
    const suffix = index === 1 ? '' : ` (${index})`;
    const filename = `${safeBaseName}${suffix}.md`;

    if (!(await pathExists(path.join(directory, filename)))) {
      return filename;
    }
  }
};

const sanitizePathSegment = (value: string, fallback: string): string => {
  const sanitized = value
    .replace(/[\\/]/g, ' ')
    .split('')
    .map((character) => (character.charCodeAt(0) <= 31 ? ' ' : character))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+\s*/, '');

  return sanitized.length > 0 ? sanitized : fallback;
};

const resolveExportPath = (
  baseDirectory: string,
  relativePath: string,
): string => {
  const destination = path.resolve(baseDirectory, relativePath);
  const relative = path.relative(baseDirectory, destination);

  if (
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error('Export path escaped the selected directory.');
  }

  return destination;
};

const pathExists = async (candidate: string): Promise<boolean> => {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
};
