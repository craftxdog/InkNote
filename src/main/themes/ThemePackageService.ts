import { createHash } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';

import {
  externalThemeIdFor,
  validateExternalThemeId,
  validateThemeInstallDirectory,
  validateThemeManifest,
  type ExternalThemeId,
  type ThemeAppearanceSettings,
  type ThemeDescriptor,
  type ThemeManifest,
  type ThemeStyles,
} from '../../shared/themes/theme.types';

const THEME_DIRECTORY_NAME = 'themes';
const SETTINGS_FILE_NAME = 'inknote-theme-settings.json';
const PACKAGE_FILE_NAME = 'package.json';
const OWNERSHIP_FILE_NAME = '.inknote-theme-package.json';
const MAX_STYLESHEET_BYTES = 512 * 1024;
const MAX_THEME_BYTES = 2 * 1024 * 1024;

type ThemePackageServiceOptions = Readonly<{
  dataDirectory: string;
  platform?: NodeJS.Platform;
}>;

type InstalledThemeMarker = Readonly<{
  format: 'inknote-theme-package';
  id: ExternalThemeId;
  name: string;
}>;

type StoredThemeSettings = Readonly<{
  acrylicEnabled: boolean;
}>;

/**
 * Main-process boundary for third-party themes. Theme packages are data: only
 * the documented manifest and its declared CSS files cross into the renderer.
 * Package scripts, JavaScript, dependencies, and arbitrary asset URLs are not
 * executed or copied.
 */
export class ThemePackageService {
  private readonly dataDirectory: string;

  private readonly platform: NodeJS.Platform;

  constructor({
    dataDirectory,
    platform = process.platform,
  }: ThemePackageServiceOptions) {
    this.dataDirectory = dataDirectory;
    this.platform = platform;
  }

  async list(): Promise<readonly ThemeDescriptor[]> {
    const themesDirectory = this.themesDirectory();

    try {
      const entries = await readdir(themesDirectory, { withFileTypes: true });
      const themes = await Promise.all(
        entries
          .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
          .map(async (entry) => {
            try {
              return await this.readInstalledTheme(
                path.join(themesDirectory, entry.name),
              );
            } catch {
              return null;
            }
          }),
      );

      return Object.freeze(
        themes
          .filter((theme): theme is InstalledTheme => theme !== null)
          .map((theme) => theme.descriptor)
          .sort((left, right) => left.name.localeCompare(right.name)),
      );
    } catch (error) {
      if (isMissingPathError(error)) {
        return Object.freeze([]);
      }

      throw error;
    }
  }

  async install(directory: string): Promise<ThemeDescriptor> {
    const sourceDirectory = await realpath(
      validateThemeInstallDirectory(directory),
    );
    const sourceStats = await stat(sourceDirectory);

    if (!sourceStats.isDirectory()) {
      throw new Error('Selected theme package must be a directory.');
    }

    const manifest = await this.readManifest(sourceDirectory);
    const styleSheets = await this.readStyleSheets(sourceDirectory, manifest);
    const descriptor = descriptorFor(manifest);
    const themesDirectory = this.themesDirectory();
    await mkdir(themesDirectory, { recursive: true });
    const stagedDirectory = await mkdtemp(
      path.join(themesDirectory, '.install-'),
    );

    try {
      await writeFile(
        path.join(stagedDirectory, PACKAGE_FILE_NAME),
        `${JSON.stringify(manifest, null, 2)}\n`,
        'utf8',
      );
      await writeFile(
        path.join(stagedDirectory, OWNERSHIP_FILE_NAME),
        `${JSON.stringify(markerFor(descriptor), null, 2)}\n`,
        'utf8',
      );

      for (const [relativePath, css] of styleSheets) {
        const destination = path.join(stagedDirectory, relativePath);
        await mkdir(path.dirname(destination), { recursive: true });
        await writeFile(destination, css, 'utf8');
      }

      const destination = this.directoryForTheme(descriptor);
      await this.removeInstalledDirectoryIfOwned(
        destination,
        descriptor.id,
        true,
      );
      await rename(stagedDirectory, destination);

      return descriptor;
    } finally {
      await rm(stagedDirectory, { recursive: true, force: true });
    }
  }

  async load(id: string): Promise<ThemeStyles> {
    const themeId = validateExternalThemeId(id);
    const installedTheme = await this.readInstalledTheme(
      this.directoryForThemeId(themeId),
    );

    if (installedTheme.descriptor.id !== themeId) {
      throw new Error('Theme package ownership is invalid.');
    }

    const styleSheets = await this.readStyleSheets(
      installedTheme.directory,
      installedTheme.manifest,
    );

    return Object.freeze({
      theme: installedTheme.descriptor,
      css: [...styleSheets.values()].join('\n\n'),
    });
  }

  async remove(id: string): Promise<void> {
    const themeId = validateExternalThemeId(id);
    const directory = this.directoryForThemeId(themeId);
    await this.removeInstalledDirectoryIfOwned(directory, themeId, false);
  }

  async getAppearance(): Promise<ThemeAppearanceSettings> {
    const settings = await this.readSettings();

    return Object.freeze({
      acrylicEnabled: settings.acrylicEnabled,
      acrylicSupported: supportsAcrylic(this.platform),
      platform: this.platform,
    });
  }

  async setAcrylicEnabled(enabled: boolean): Promise<ThemeAppearanceSettings> {
    if (typeof enabled !== 'boolean') {
      throw new Error('Acrylic preference must be a boolean.');
    }

    await mkdir(this.dataDirectory, { recursive: true });
    const settings: StoredThemeSettings = Object.freeze({
      acrylicEnabled: enabled && supportsAcrylic(this.platform),
    });
    const settingsPath = this.settingsPath();
    const temporaryPath = `${settingsPath}.tmp`;
    await writeFile(
      temporaryPath,
      `${JSON.stringify(settings, null, 2)}\n`,
      'utf8',
    );
    await rename(temporaryPath, settingsPath);

    return this.getAppearance();
  }

  private themesDirectory(): string {
    return path.join(this.dataDirectory, THEME_DIRECTORY_NAME);
  }

  private settingsPath(): string {
    return path.join(this.dataDirectory, SETTINGS_FILE_NAME);
  }

  private directoryForTheme(descriptor: ThemeDescriptor): string {
    return this.directoryForThemeId(descriptor.id);
  }

  private directoryForThemeId(id: ExternalThemeId): string {
    return path.join(this.themesDirectory(), directoryNameFor(id));
  }

  private async readManifest(directory: string): Promise<ThemeManifest> {
    const packagePath = await resolveContainedFile(
      directory,
      PACKAGE_FILE_NAME,
    );
    const contents = await readFile(packagePath, 'utf8');

    try {
      return validateThemeManifest(JSON.parse(contents) as unknown);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('Theme package.json must contain valid JSON.', {
          cause: error,
        });
      }

      throw error;
    }
  }

  private async readStyleSheets(
    directory: string,
    manifest: ThemeManifest,
  ): Promise<ReadonlyMap<string, string>> {
    const styleSheets = new Map<string, string>();
    let totalBytes = 0;

    for (const styleSheet of manifest.styleSheets) {
      const stylePath = await resolveThemeStyleSheet(directory, styleSheet);
      const details = await stat(stylePath);

      if (!details.isFile()) {
        throw new Error(
          `Theme stylesheet ${styleSheet} must be a regular file.`,
        );
      }
      if (details.size > MAX_STYLESHEET_BYTES) {
        throw new Error(`Theme stylesheet ${styleSheet} is too large.`);
      }

      totalBytes += details.size;
      if (totalBytes > MAX_THEME_BYTES) {
        throw new Error('Theme package stylesheets are too large.');
      }

      const css = await readFile(stylePath, 'utf8');
      assertSafeThemeCss(css, styleSheet);
      styleSheets.set(styleSheet, css);
    }

    return styleSheets;
  }

  private async readInstalledTheme(directory: string): Promise<InstalledTheme> {
    const [manifest, marker] = await Promise.all([
      this.readManifest(directory),
      this.readMarker(directory),
    ]);
    const descriptor = descriptorFor(manifest);

    if (marker.id !== descriptor.id || marker.name !== descriptor.name) {
      throw new Error('Theme package ownership is invalid.');
    }

    return Object.freeze({ directory, manifest, descriptor });
  }

  private async readMarker(directory: string): Promise<InstalledThemeMarker> {
    const markerPath = await resolveContainedFile(
      directory,
      OWNERSHIP_FILE_NAME,
    );
    const contents = await readFile(markerPath, 'utf8');

    try {
      const parsed = JSON.parse(contents) as unknown;
      if (
        !isRecord(parsed) ||
        parsed.format !== 'inknote-theme-package' ||
        typeof parsed.name !== 'string'
      ) {
        throw new Error('Invalid marker.');
      }

      return Object.freeze({
        format: 'inknote-theme-package',
        id: validateExternalThemeId(parsed.id, parsed.name),
        name: parsed.name,
      });
    } catch {
      throw new Error('Theme package was not installed by InkNote.');
    }
  }

  private async removeInstalledDirectoryIfOwned(
    directory: string,
    expectedId: ExternalThemeId,
    allowMissing: boolean,
  ): Promise<void> {
    try {
      const marker = await this.readMarker(directory);

      if (marker.id !== expectedId) {
        throw new Error('Theme package ownership is invalid.');
      }

      await rm(directory, { recursive: true, force: false });
    } catch (error) {
      if (isMissingPathError(error)) {
        if (allowMissing) return;
        throw new Error('Theme package was not installed by InkNote.', {
          cause: error,
        });
      }

      throw error;
    }
  }

  private async readSettings(): Promise<StoredThemeSettings> {
    try {
      const contents = await readFile(this.settingsPath(), 'utf8');
      const value = JSON.parse(contents) as unknown;

      if (!isRecord(value) || typeof value.acrylicEnabled !== 'boolean') {
        return Object.freeze({ acrylicEnabled: false });
      }

      return Object.freeze({ acrylicEnabled: value.acrylicEnabled });
    } catch (error) {
      if (isMissingPathError(error) || error instanceof SyntaxError) {
        return Object.freeze({ acrylicEnabled: false });
      }

      throw error;
    }
  }
}

type InstalledTheme = Readonly<{
  directory: string;
  manifest: ThemeManifest;
  descriptor: ThemeDescriptor;
}>;

const descriptorFor = (manifest: ThemeManifest): ThemeDescriptor =>
  Object.freeze({
    id: externalThemeIdFor(manifest.name),
    kind: 'external',
    name: manifest.name,
    version: manifest.version,
    themeAppearance: manifest.themeAppearance,
    styleSheets: manifest.styleSheets,
  });

const markerFor = (descriptor: ThemeDescriptor): InstalledThemeMarker =>
  Object.freeze({
    format: 'inknote-theme-package',
    id: descriptor.id,
    name: descriptor.name,
  });

const directoryNameFor = (id: ExternalThemeId): string =>
  `theme-${createHash('sha256').update(id).digest('hex').slice(0, 32)}`;

/**
 * Inkdrop theme packages conventionally keep their declared stylesheet names
 * in styles/. Keep explicit manifest paths authoritative, but accept that
 * documented shorthand without allowing a fallback outside the package.
 */
const resolveThemeStyleSheet = async (
  directory: string,
  styleSheet: string,
): Promise<string> => {
  try {
    return await resolveContainedFile(directory, styleSheet);
  } catch (error) {
    if (!isMissingPathError(error) || path.dirname(styleSheet) !== '.') {
      throw error;
    }

    return resolveContainedFile(directory, path.join('styles', styleSheet));
  }
};

const resolveContainedFile = async (
  directory: string,
  relativePath: string,
): Promise<string> => {
  const realDirectory = await realpath(directory);
  const candidate = path.resolve(realDirectory, relativePath);
  const realCandidate = await realpath(candidate);
  const relativeCandidate = path.relative(realDirectory, realCandidate);

  if (
    relativeCandidate.length === 0 ||
    relativeCandidate.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeCandidate)
  ) {
    throw new Error(
      'Theme files must stay inside the selected theme directory.',
    );
  }

  return realCandidate;
};

const assertSafeThemeCss = (css: string, styleSheet: string): void => {
  if (hasUnsafeThemeResourceReference(css)) {
    throw new Error(
      `Theme stylesheet ${styleSheet} may not load additional resources.`,
    );
  }

  if (!/@layer\s+theme(?:[\s.{,]|$)/.test(css)) {
    throw new Error(
      `Theme stylesheet ${styleSheet} must use an @layer theme block.`,
    );
  }
};

/**
 * CSS data images are self-contained theme data, unlike @import or a URL that
 * can read from the network or local filesystem. Inkdrop's own syntax themes
 * use them for editor decorations, so allow only that narrow form.
 */
const hasUnsafeThemeResourceReference = (css: string): boolean =>
  /\b@import\b|\burl\s*\(\s*(?!(?:['"]\s*)?data:image\/)/i.test(css);

const supportsAcrylic = (platform: NodeJS.Platform): boolean =>
  platform === 'darwin' || platform === 'win32';

const isMissingPathError = (error: unknown): boolean =>
  isRecord(error) && error.code === 'ENOENT';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
