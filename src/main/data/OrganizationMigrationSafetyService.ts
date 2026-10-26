import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import Database from 'better-sqlite3';

import { ORGANIZATION_DATA_MODEL_SCHEMA_VERSION } from '../documents/LocalDocumentStore';
import { validateAbsolutePath } from '../../shared/data/data.types';

const SAFETY_DIRECTORY_NAME = 'organization-migration-safety';
const SAFETY_FORMAT = 'inknote-organization-migration-safety';
const SAFETY_FORMAT_VERSION = 1;
const SNAPSHOT_FILE_NAME = 'before-organization-migration.sqlite';
const MANIFEST_FILE_NAME = 'manifest.json';

type MigrationSafetyManifest = Readonly<{
  format: typeof SAFETY_FORMAT;
  version: typeof SAFETY_FORMAT_VERSION;
  sourceSchemaVersion: number;
  targetSchemaVersion: number;
  createdAt: string;
}>;

export type OrganizationMigrationSafetySnapshot = Readonly<{
  snapshotFile: string;
  manifestFile: string;
  sourceSchemaVersion: number;
  targetSchemaVersion: number;
}>;

type OrganizationMigrationSafetyServiceOptions = Readonly<{
  dataDirectory: string;
  databasePath: string;
  now?: () => string;
  snapshotDatabase?: (
    database: Database.Database,
    destination: string,
  ) => Promise<void>;
}>;

/**
 * Creates one retained online SQLite snapshot before an existing profile is
 * upgraded to the organization data model. It is deliberately independent
 * from LocalDocumentStore: callers must run this preflight before constructing
 * a store, otherwise its synchronous migrations could already mutate data.
 */
export class OrganizationMigrationSafetyService {
  private readonly dataDirectory: string;

  private readonly databasePath: string;

  private readonly now: () => string;

  private readonly snapshotDatabase: (
    database: Database.Database,
    destination: string,
  ) => Promise<void>;

  constructor(options: OrganizationMigrationSafetyServiceOptions) {
    this.dataDirectory = validateAbsolutePath(
      options.dataDirectory,
      'Data directory',
    );
    this.databasePath = validateAbsolutePath(
      options.databasePath,
      'Database file',
    );
    this.now = options.now ?? (() => new Date().toISOString());
    this.snapshotDatabase =
      options.snapshotDatabase ??
      (async (database, destination): Promise<void> => {
        await database.backup(destination);
      });
  }

  async ensureSnapshotBeforeMigration(): Promise<OrganizationMigrationSafetySnapshot | null> {
    const sourceSchemaVersion = await this.readSourceSchemaVersion();

    if (
      sourceSchemaVersion === null ||
      sourceSchemaVersion >= ORGANIZATION_DATA_MODEL_SCHEMA_VERSION
    ) {
      return null;
    }

    const locations = this.locationsFor(sourceSchemaVersion);
    const retainedSnapshot = await this.readRetainedSnapshot(
      locations,
      sourceSchemaVersion,
    );

    if (retainedSnapshot !== null) {
      return retainedSnapshot;
    }

    await mkdir(locations.directory, { recursive: true });
    const source = new Database(this.databasePath, { readonly: true });

    try {
      await this.createSnapshot(source, locations, sourceSchemaVersion);
    } finally {
      source.close();
    }

    return this.snapshotResult(locations, sourceSchemaVersion);
  }

  private async readSourceSchemaVersion(): Promise<number | null> {
    if (!(await pathExists(this.databasePath))) {
      return null;
    }

    const source = new Database(this.databasePath, { readonly: true });

    try {
      return readSchemaVersion(source);
    } finally {
      source.close();
    }
  }

  private locationsFor(sourceSchemaVersion: number): Readonly<{
    directory: string;
    snapshotFile: string;
    manifestFile: string;
  }> {
    const directory = path.join(
      this.dataDirectory,
      SAFETY_DIRECTORY_NAME,
      `v${ORGANIZATION_DATA_MODEL_SCHEMA_VERSION}-from-v${sourceSchemaVersion}`,
    );

    return Object.freeze({
      directory,
      snapshotFile: path.join(directory, SNAPSHOT_FILE_NAME),
      manifestFile: path.join(directory, MANIFEST_FILE_NAME),
    });
  }

  private async readRetainedSnapshot(
    locations: Readonly<{
      directory: string;
      snapshotFile: string;
      manifestFile: string;
    }>,
    sourceSchemaVersion: number,
  ): Promise<OrganizationMigrationSafetySnapshot | null> {
    const [hasManifest, hasSnapshot] = await Promise.all([
      pathExists(locations.manifestFile),
      pathExists(locations.snapshotFile),
    ]);

    if (!hasManifest && !hasSnapshot) {
      return null;
    }

    const manifest = await readManifest(locations.manifestFile);

    if (
      manifest === null ||
      !isValidManifest(manifest, sourceSchemaVersion) ||
      !(await isRegularFile(locations.snapshotFile))
    ) {
      throw new Error(
        'The retained migration safety snapshot is invalid. Restore or remove it manually before retrying the organization migration.',
      );
    }

    const snapshot = new Database(locations.snapshotFile, { readonly: true });

    try {
      if (readSchemaVersion(snapshot) !== sourceSchemaVersion) {
        throw new Error(
          'The retained migration safety snapshot is invalid. Restore or remove it manually before retrying the organization migration.',
        );
      }
    } finally {
      snapshot.close();
    }

    return this.snapshotResult(locations, sourceSchemaVersion);
  }

  private async createSnapshot(
    source: Database.Database,
    locations: Readonly<{
      directory: string;
      snapshotFile: string;
      manifestFile: string;
    }>,
    sourceSchemaVersion: number,
  ): Promise<void> {
    const stagingFile = path.join(
      locations.directory,
      `.${SNAPSHOT_FILE_NAME}.${process.pid}.tmp`,
    );

    try {
      try {
        await this.snapshotDatabase(source, stagingFile);
      } catch (error) {
        throw new Error(
          `Could not create the organization migration safety snapshot: ${errorMessage(error)}`,
        );
      }

      const stagingSnapshot = new Database(stagingFile, { readonly: true });

      try {
        if (readSchemaVersion(stagingSnapshot) !== sourceSchemaVersion) {
          throw new Error(
            'Could not create the organization migration safety snapshot: the copied schema version does not match the source.',
          );
        }
      } finally {
        stagingSnapshot.close();
      }

      await rename(stagingFile, locations.snapshotFile);
      await writeManifest(locations.manifestFile, {
        format: SAFETY_FORMAT,
        version: SAFETY_FORMAT_VERSION,
        sourceSchemaVersion,
        targetSchemaVersion: ORGANIZATION_DATA_MODEL_SCHEMA_VERSION,
        createdAt: this.now(),
      });
    } finally {
      await rm(stagingFile, { force: true });
    }
  }

  private snapshotResult(
    locations: Readonly<{
      directory: string;
      snapshotFile: string;
      manifestFile: string;
    }>,
    sourceSchemaVersion: number,
  ): OrganizationMigrationSafetySnapshot {
    return Object.freeze({
      snapshotFile: locations.snapshotFile,
      manifestFile: locations.manifestFile,
      sourceSchemaVersion,
      targetSchemaVersion: ORGANIZATION_DATA_MODEL_SCHEMA_VERSION,
    });
  }
}

const readSchemaVersion = (database: Database.Database): number | null => {
  const migrationsTable = database
    .prepare<[], Readonly<{ name: string }>>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'",
    )
    .get();

  if (migrationsTable === undefined) {
    return null;
  }

  const row = database
    .prepare<[], Readonly<{ version: number | null }>>(
      'SELECT MAX(version) AS version FROM schema_migrations',
    )
    .get();
  const version = row?.version ?? null;

  if (version === null) {
    return null;
  }

  if (!Number.isSafeInteger(version) || version < 1) {
    throw new Error('The database schema migration history is invalid.');
  }

  return version;
};

const readManifest = async (
  manifestFile: string,
): Promise<MigrationSafetyManifest | null> => {
  try {
    const source = await readFile(manifestFile, 'utf8');
    const parsed = JSON.parse(source) as unknown;

    if (!isRecord(parsed)) {
      return null;
    }

    return {
      format: parsed.format as MigrationSafetyManifest['format'],
      version: parsed.version as MigrationSafetyManifest['version'],
      sourceSchemaVersion: parsed.sourceSchemaVersion as number,
      targetSchemaVersion: parsed.targetSchemaVersion as number,
      createdAt: parsed.createdAt as string,
    };
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return null;
    }

    throw error;
  }
};

const isValidManifest = (
  manifest: MigrationSafetyManifest,
  sourceSchemaVersion: number,
): boolean =>
  manifest.format === SAFETY_FORMAT &&
  manifest.version === SAFETY_FORMAT_VERSION &&
  manifest.sourceSchemaVersion === sourceSchemaVersion &&
  manifest.targetSchemaVersion === ORGANIZATION_DATA_MODEL_SCHEMA_VERSION &&
  typeof manifest.createdAt === 'string' &&
  !Number.isNaN(Date.parse(manifest.createdAt));

const writeManifest = async (
  manifestFile: string,
  manifest: MigrationSafetyManifest,
): Promise<void> => {
  const stagingFile = `${manifestFile}.${process.pid}.tmp`;

  try {
    await writeFile(stagingFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    await rename(stagingFile, manifestFile);
  } finally {
    await rm(stagingFile, { force: true });
  }
};

const pathExists = async (candidate: string): Promise<boolean> => {
  try {
    await stat(candidate);
    return true;
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return false;
    }

    throw error;
  }
};

const isRegularFile = async (candidate: string): Promise<boolean> => {
  try {
    return (await stat(candidate)).isFile();
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return false;
    }

    throw error;
  }
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isFileNotFoundError = (error: unknown): boolean =>
  isRecord(error) && error.code === 'ENOENT';
