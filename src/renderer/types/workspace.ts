import type {
  ExternalThemeId,
  ThemeDescriptor,
} from '../../shared/themes/theme.types';

export type WorkspaceViewMode = 'editor' | 'split' | 'preview';

/**
 * A deliberately small, durable appearance preference. Keeping the value in
 * the workspace domain makes it available to every panel through CSS tokens
 * without coupling editor or preview state to a specific theme implementation.
 */
export type WorkspaceTheme = 'light' | 'dark';

export type NativeWorkspaceThemeId = 'native-light' | 'native-dark';

export type WorkspaceThemeId = NativeWorkspaceThemeId | ExternalThemeId;

export type NativeWorkspaceTheme = Readonly<{
  id: NativeWorkspaceThemeId;
  kind: 'native';
  name: string;
  themeAppearance: WorkspaceTheme;
}>;

export type AvailableWorkspaceTheme = NativeWorkspaceTheme | ThemeDescriptor;

export const nativeWorkspaceThemes: readonly NativeWorkspaceTheme[] =
  Object.freeze([
    Object.freeze({
      id: 'native-light',
      kind: 'native',
      name: 'InkNote Light',
      themeAppearance: 'light',
    }),
    Object.freeze({
      id: 'native-dark',
      kind: 'native',
      name: 'InkNote Dark',
      themeAppearance: 'dark',
    }),
  ]);

export const isExternalWorkspaceThemeId = (
  id: WorkspaceThemeId,
): id is ExternalThemeId => id.startsWith('external:');

export const themeAppearanceFor = (
  id: WorkspaceThemeId,
  themes: readonly AvailableWorkspaceTheme[],
): WorkspaceTheme =>
  themes.find((theme) => theme.id === id)?.themeAppearance ?? 'light';
