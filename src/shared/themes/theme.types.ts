export type ThemeAppearance = 'light' | 'dark';

export type ExternalThemeId = `external:${string}`;

export type ThemeManifest = Readonly<{
  name: string;
  version: string | null;
  theme: true;
  themeAppearance: ThemeAppearance;
  styleSheets: readonly string[];
}>;

export type ThemeDescriptor = Readonly<{
  id: ExternalThemeId;
  kind: 'external';
  name: string;
  version: string | null;
  themeAppearance: ThemeAppearance;
  styleSheets: readonly string[];
}>;

export type ThemeStyles = Readonly<{
  theme: ThemeDescriptor;
  css: string;
}>;

export type ThemeAppearanceSettings = Readonly<{
  acrylicEnabled: boolean;
  acrylicSupported: boolean;
  platform: string;
}>;

const MAX_THEME_NAME_LENGTH = 214;
const MAX_STYLESHEETS = 12;

export const externalThemeIdFor = (name: string): ExternalThemeId =>
  `external:${name}`;

export const validateThemeManifest = (value: unknown): ThemeManifest => {
  if (!isRecord(value)) {
    throw new Error('Theme package.json must be an object.');
  }

  const name = validateThemeName(value.name);

  if (value.theme !== true) {
    throw new Error('package.json must declare "theme": true.');
  }

  const themeAppearance = validateThemeAppearance(value.themeAppearance);
  const styleSheets = validateStyleSheets(value.styleSheets);
  const version =
    value.version === undefined || value.version === null
      ? null
      : validateVersion(value.version);

  return Object.freeze({
    name,
    version,
    theme: true,
    themeAppearance,
    styleSheets,
  });
};

export const validateThemeDescriptor = (value: unknown): ThemeDescriptor => {
  if (!isRecord(value)) {
    throw new Error('The theme response has an invalid descriptor.');
  }

  const name = validateThemeName(value.name);
  const id = validateExternalThemeId(value.id, name);

  if (value.kind !== 'external') {
    throw new Error('The theme response has an invalid kind.');
  }

  const version =
    value.version === null ? null : validateVersion(value.version);

  return Object.freeze({
    id,
    kind: 'external',
    name,
    version,
    themeAppearance: validateThemeAppearance(value.themeAppearance),
    styleSheets: validateStyleSheets(value.styleSheets),
  });
};

export const validateThemeStyles = (value: unknown): ThemeStyles => {
  if (!isRecord(value) || typeof value.css !== 'string') {
    throw new Error('The theme response has invalid styles.');
  }

  return Object.freeze({
    theme: validateThemeDescriptor(value.theme),
    css: value.css,
  });
};

export const validateThemeAppearanceSettings = (
  value: unknown,
): ThemeAppearanceSettings => {
  if (
    !isRecord(value) ||
    typeof value.acrylicEnabled !== 'boolean' ||
    typeof value.acrylicSupported !== 'boolean' ||
    typeof value.platform !== 'string'
  ) {
    throw new Error('The appearance response is invalid.');
  }

  return Object.freeze({
    acrylicEnabled: value.acrylicEnabled,
    acrylicSupported: value.acrylicSupported,
    platform: value.platform,
  });
};

export const validateThemeInstallDirectory = (value: unknown): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('Theme directory must be a non-empty path.');
  }

  if (!isAbsolutePath(value)) {
    throw new Error('Theme directory must be absolute.');
  }

  return value;
};

export const validateExternalThemeId = (
  value: unknown,
  expectedName?: string,
): ExternalThemeId => {
  if (typeof value !== 'string' || !value.startsWith('external:')) {
    throw new Error('Theme ID must identify an external theme.');
  }

  const name = validateThemeName(value.slice('external:'.length));

  if (expectedName !== undefined && name !== expectedName) {
    throw new Error('Theme ID does not match its package name.');
  }

  return externalThemeIdFor(name);
};

const validateThemeName = (value: unknown): string => {
  if (
    typeof value !== 'string' ||
    value.trim() !== value ||
    value.length === 0 ||
    value.length > MAX_THEME_NAME_LENGTH ||
    !/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i.test(value)
  ) {
    throw new Error('Theme package name is invalid.');
  }

  return value;
};

const validateThemeAppearance = (value: unknown): ThemeAppearance => {
  if (value === 'light' || value === 'dark') {
    return value;
  }

  throw new Error('Theme appearance must be "light" or "dark".');
};

const validateVersion = (value: unknown): string => {
  if (
    typeof value !== 'string' ||
    value.trim() !== value ||
    value.length === 0 ||
    value.length > 128
  ) {
    throw new Error('Theme version is invalid.');
  }

  return value;
};

const validateStyleSheets = (value: unknown): readonly string[] => {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > MAX_STYLESHEETS
  ) {
    throw new Error('Theme styleSheets must contain one or more CSS files.');
  }

  const styles = value.map((styleSheet) => {
    if (
      typeof styleSheet !== 'string' ||
      styleSheet.length === 0 ||
      styleSheet.length > 256 ||
      !styleSheet.endsWith('.css') ||
      !isSafeRelativePath(styleSheet)
    ) {
      throw new Error('Theme stylesheets must be safe relative CSS paths.');
    }

    return styleSheet;
  });

  if (new Set(styles).size !== styles.length) {
    throw new Error('Theme stylesheets must not contain duplicates.');
  }

  return Object.freeze(styles);
};

const isSafeRelativePath = (value: string): boolean => {
  if (
    value.startsWith('/') ||
    value.startsWith('\\') ||
    value.includes('\\') ||
    value.includes('\0')
  ) {
    return false;
  }

  return value
    .split('/')
    .every((segment) => segment !== '' && segment !== '.' && segment !== '..');
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isAbsolutePath = (value: string): boolean =>
  value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value);
