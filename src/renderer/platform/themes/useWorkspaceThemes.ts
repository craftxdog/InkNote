import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  unwrapThemeIpcResult,
  validateThemeAppearanceResponse,
  validateThemeList,
  validateThemeStylesResponse,
} from '../../../shared/themes/theme.ipc';
import type {
  ThemeAppearanceSettings,
  ThemeDescriptor,
} from '../../../shared/themes/theme.types';
import { validateThemeDescriptor } from '../../../shared/themes/theme.types';
import {
  isExternalWorkspaceThemeId,
  nativeWorkspaceThemes,
  themeAppearanceFor,
  type AvailableWorkspaceTheme,
  type WorkspaceTheme,
  type WorkspaceThemeId,
} from '../../types/workspace';

const workspaceThemeStorageKey = 'inknote.workspace-theme';

const unsupportedAcrylic: ThemeAppearanceSettings = Object.freeze({
  acrylicEnabled: false,
  acrylicSupported: false,
  platform: 'unknown',
});

const initialThemeId = (): WorkspaceThemeId => {
  try {
    const storedTheme = window.localStorage.getItem(workspaceThemeStorageKey);

    if (storedTheme === 'dark' || storedTheme === 'native-dark') {
      return 'native-dark';
    }
    if (storedTheme === 'light' || storedTheme === 'native-light') {
      return 'native-light';
    }
    if (storedTheme?.startsWith('external:')) {
      return storedTheme as WorkspaceThemeId;
    }
  } catch {
    // Appearance is optional local state. A blocked storage API must not
    // prevent the writing workspace from opening.
  }

  return 'native-light';
};

export type WorkspaceThemeRuntime = Readonly<{
  themes: readonly AvailableWorkspaceTheme[];
  themeId: WorkspaceThemeId;
  themeAppearance: WorkspaceTheme;
  externalCss: string | null;
  acrylic: ThemeAppearanceSettings;
  isCatalogLoading: boolean;
  error: string | null;
  selectTheme: (id: WorkspaceThemeId) => void;
  installTheme: () => Promise<void>;
  removeTheme: (theme: ThemeDescriptor) => Promise<void>;
  setAcrylicEnabled: (enabled: boolean) => Promise<void>;
}>;

export function useWorkspaceThemes(): WorkspaceThemeRuntime {
  const [themeId, setThemeId] = useState<WorkspaceThemeId>(initialThemeId);
  const [externalThemes, setExternalThemes] = useState<
    readonly ThemeDescriptor[]
  >([]);
  const [externalStyles, setExternalStyles] = useState<Readonly<{
    themeId: WorkspaceThemeId;
    css: string;
  }> | null>(null);
  const [acrylic, setAcrylic] =
    useState<ThemeAppearanceSettings>(unsupportedAcrylic);
  const [isCatalogLoading, setIsCatalogLoading] = useState(
    () => window.inknote.themes !== undefined,
  );
  const [error, setError] = useState<string | null>(null);

  const themes = useMemo<readonly AvailableWorkspaceTheme[]>(
    () => Object.freeze([...nativeWorkspaceThemes, ...externalThemes]),
    [externalThemes],
  );
  const themeAppearance = themeAppearanceFor(themeId, themes);

  const readThemeCatalog = useCallback(async (): Promise<
    readonly ThemeDescriptor[]
  > => {
    const themeApi = window.inknote.themes;

    if (themeApi === undefined) {
      return [];
    }

    const nextThemes = unwrapThemeIpcResult(
      await themeApi.list(),
      validateThemeList,
    );
    return nextThemes;
  }, []);

  useEffect(() => {
    let isCurrent = true;
    const themeApi = window.inknote.themes;

    if (themeApi === undefined) {
      return undefined;
    }

    const loadCatalog = async (): Promise<void> => {
      try {
        const [nextThemes, appearance] = await Promise.all([
          readThemeCatalog(),
          themeApi
            .getAppearance()
            .then((result) =>
              unwrapThemeIpcResult(result, validateThemeAppearanceResponse),
            ),
        ]);

        if (!isCurrent) return;
        setExternalThemes(nextThemes);
        setThemeId((current) =>
          isExternalWorkspaceThemeId(current) &&
          !nextThemes.some((theme) => theme.id === current)
            ? 'native-light'
            : current,
        );
        setAcrylic(appearance);
        setError(null);
      } catch (nextError) {
        if (isCurrent) setError(messageForThemeError(nextError));
      } finally {
        if (isCurrent) setIsCatalogLoading(false);
      }
    };

    void loadCatalog();

    return () => {
      isCurrent = false;
    };
  }, [readThemeCatalog]);

  useEffect(() => {
    try {
      window.localStorage.setItem(workspaceThemeStorageKey, themeId);
    } catch {
      // See initialThemeId: this preference is intentionally best-effort.
    }
  }, [themeId]);

  useEffect(() => {
    let isCurrent = true;
    const themeApi = window.inknote.themes;

    if (!isExternalWorkspaceThemeId(themeId) || themeApi === undefined) {
      return undefined;
    }

    const loadStyles = async (): Promise<void> => {
      try {
        const styles = unwrapThemeIpcResult(
          await themeApi.load(themeId),
          validateThemeStylesResponse,
        );

        if (!isCurrent || styles.theme.id !== themeId) return;
        setExternalStyles(Object.freeze({ themeId, css: styles.css }));
        setError(null);
      } catch (nextError) {
        if (isCurrent) setError(messageForThemeError(nextError));
      }
    };

    void loadStyles();

    return () => {
      isCurrent = false;
    };
  }, [themeId]);

  useEffect(() => {
    const body = document.body;
    const platformClass = `platform-${acrylic.platform}`;
    const isEnabled = acrylic.acrylicEnabled && acrylic.acrylicSupported;

    body.classList.toggle('acrylic-window', isEnabled);
    body.classList.toggle(platformClass, isEnabled);

    return () => {
      body.classList.remove('acrylic-window', platformClass);
    };
  }, [acrylic]);

  const installTheme = useCallback(async (): Promise<void> => {
    const themeApi = requiredThemeApi();
    const directory = unwrapThemeIpcResult(
      await themeApi.choosePackageDirectory(),
      (value) =>
        value === null || typeof value === 'string'
          ? value
          : invalidThemeResponse(),
    );

    if (directory === null) return;

    const installedTheme = unwrapThemeIpcResult(
      await themeApi.install(directory),
      validateThemeDescriptor,
    );
    const nextThemes = await readThemeCatalog();
    setExternalThemes(nextThemes);
    setThemeId(installedTheme.id);
    setError(null);
  }, [readThemeCatalog]);

  const removeTheme = useCallback(
    async (theme: ThemeDescriptor): Promise<void> => {
      const themeApi = requiredThemeApi();
      await unwrapThemeIpcResult(await themeApi.remove(theme.id), (value) => {
        if (value !== undefined) invalidThemeResponse();
        return undefined;
      });
      const nextThemes = await readThemeCatalog();
      setExternalThemes(nextThemes);
      setThemeId((current) =>
        current === theme.id
          ? theme.themeAppearance === 'dark'
            ? 'native-dark'
            : 'native-light'
          : current,
      );
      setError(null);
    },
    [readThemeCatalog],
  );

  const setAcrylicEnabled = useCallback(
    async (enabled: boolean): Promise<void> => {
      const themeApi = requiredThemeApi();
      const nextAppearance = unwrapThemeIpcResult(
        await themeApi.setAcrylicEnabled(enabled),
        validateThemeAppearanceResponse,
      );
      setAcrylic(nextAppearance);
      setError(null);
    },
    [],
  );

  return Object.freeze({
    themes,
    themeId,
    themeAppearance,
    externalCss:
      externalStyles?.themeId === themeId ? externalStyles.css : null,
    acrylic,
    isCatalogLoading,
    error,
    selectTheme: setThemeId,
    installTheme,
    removeTheme,
    setAcrylicEnabled,
  });
}

const requiredThemeApi = () => {
  const themeApi = window.inknote.themes;

  if (themeApi === undefined) {
    throw new Error('Theme packages are unavailable in this build.');
  }

  return themeApi;
};

const invalidThemeResponse = (): never => {
  throw new Error('The theme operation returned an invalid response.');
};

const messageForThemeError = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : 'The theme operation could not be completed.';
