import { useCallback, useEffect, useRef, useState } from 'react';

import { unwrapDataIpcResult } from '../../../shared/data/data.ipc';
import {
  validateAbsolutePath,
  validateBackupResult,
  validateDataManagementInfo,
  validateExportResult,
  validateRestoreResult,
  type DirectorySelectionPurpose,
  type DataManagementInfo,
} from '../../../shared/data/data.types';
import type {
  ThemeAppearanceSettings,
  ThemeDescriptor,
} from '../../../shared/themes/theme.types';
import type {
  AvailableWorkspaceTheme,
  WorkspaceThemeId,
} from '../../types/workspace';

type WorkspacePreferencesProps = {
  isOpen: boolean;
  themeId: WorkspaceThemeId;
  themes: readonly AvailableWorkspaceTheme[];
  acrylic: ThemeAppearanceSettings;
  isThemeCatalogLoading: boolean;
  themeError: string | null;
  onThemeChange: (theme: WorkspaceThemeId) => void;
  onInstallTheme: () => Promise<void>;
  onRemoveTheme: (theme: ThemeDescriptor) => Promise<void>;
  onAcrylicChange: (enabled: boolean) => Promise<void>;
  onClose: () => void;
};

const shortcuts = [
  ['⌘/Ctrl N', 'Create a new note'],
  ['⌘/Ctrl E', 'Switch between editor and preview'],
  ['⌘/Ctrl P', 'Open split view'],
  ['⌘/Ctrl /', 'Show or hide the sidebar'],
  ['⌘/Ctrl ⇧ D', 'Focus the document workspace'],
  ['m · j/k · Enter', 'Move a selected note'],
] as const;

type DataNotice = Readonly<{
  tone: 'success' | 'error';
  message: string;
}>;

type ThemeNotice = Readonly<{
  tone: 'success' | 'error';
  message: string;
}>;

/** A compact app-native preference surface, intentionally not a cloned UI. */
export function WorkspacePreferences({
  isOpen,
  themeId,
  themes,
  acrylic,
  isThemeCatalogLoading,
  themeError,
  onThemeChange,
  onInstallTheme,
  onRemoveTheme,
  onAcrylicChange,
  onClose,
}: WorkspacePreferencesProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [dataInfo, setDataInfo] = useState<DataManagementInfo | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [dataNotice, setDataNotice] = useState<DataNotice | null>(null);
  const [isThemeBusy, setIsThemeBusy] = useState(false);
  const [themeNotice, setThemeNotice] = useState<ThemeNotice | null>(null);

  const refreshDataInfo = useCallback(async (): Promise<void> => {
    const data = window.inknote.data;

    if (data === undefined) {
      setDataNotice({
        tone: 'error',
        message: 'Local data management is unavailable in this build.',
      });
      return;
    }

    setIsDataLoading(true);

    try {
      const nextInfo = unwrapDataIpcResult(
        await data.getInfo(),
        validateDataManagementInfo,
      );

      setDataInfo(nextInfo);
      setDataNotice(null);
    } catch (error) {
      setDataNotice({ tone: 'error', message: messageForDataError(error) });
    } finally {
      setIsDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    closeButtonRef.current?.focus();

    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', closeOnEscape);

    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timer = window.setTimeout(() => {
      void refreshDataInfo();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isOpen, refreshDataInfo]);

  const chooseDirectory = useCallback(
    async (purpose: DirectorySelectionPurpose): Promise<string | null> => {
      const data = getDataApi();
      const result = await data.chooseDirectory(purpose);

      return unwrapDataIpcResult(result, (value) =>
        value === null ? null : validateAbsolutePath(value, 'Directory'),
      );
    },
    [],
  );

  const configureBackup = useCallback(async (): Promise<void> => {
    try {
      const directory = await chooseDirectory('backup');

      if (directory === null) {
        return;
      }

      const backup = unwrapDataIpcResult(
        await getDataApi().configureBackup(directory),
        validateBackupResult,
      );

      await refreshDataInfo();
      setDataNotice({
        tone: 'success',
        message: `Backup saved to ${backup.backupDirectory}.`,
      });
    } catch (error) {
      setDataNotice({ tone: 'error', message: messageForDataError(error) });
    }
  }, [chooseDirectory, refreshDataInfo]);

  const exportMarkdown = useCallback(async (): Promise<void> => {
    try {
      const directory = await chooseDirectory('export');

      if (directory === null) {
        return;
      }

      const result = unwrapDataIpcResult(
        await getDataApi().exportMarkdown(directory),
        validateExportResult,
      );

      setDataNotice({
        tone: 'success',
        message: `Finished exporting ${result.exportedNotes} ${
          result.exportedNotes === 1 ? 'note' : 'notes'
        }. Directory: ${result.directory}`,
      });
    } catch (error) {
      setDataNotice({ tone: 'error', message: messageForDataError(error) });
    }
  }, [chooseDirectory]);

  const restoreBackup = useCallback(async (): Promise<void> => {
    try {
      const directory = await chooseDirectory('restore');

      if (directory === null) {
        return;
      }

      const confirmed = window.confirm(
        'Restore this backup? InkNote will replace the current local data after creating a safety backup. Unsaved edits will be lost.',
      );

      if (!confirmed) {
        return;
      }

      const result = unwrapDataIpcResult(
        await getDataApi().restoreBackup(directory),
        validateRestoreResult,
      );

      window.sessionStorage.setItem(
        'inknote.data-management-notice',
        `Restored local data. Safety backup: ${result.safetyBackupFile}`,
      );
      window.location.reload();
    } catch (error) {
      setDataNotice({ tone: 'error', message: messageForDataError(error) });
    }
  }, [chooseDirectory]);

  const installTheme = useCallback(async (): Promise<void> => {
    setIsThemeBusy(true);

    try {
      await onInstallTheme();
      setThemeNotice({
        tone: 'success',
        message: 'Theme package installed and selected.',
      });
    } catch (error) {
      setThemeNotice({ tone: 'error', message: messageForDataError(error) });
    } finally {
      setIsThemeBusy(false);
    }
  }, [onInstallTheme]);

  const removeTheme = useCallback(
    async (theme: ThemeDescriptor): Promise<void> => {
      setIsThemeBusy(true);

      try {
        await onRemoveTheme(theme);
        setThemeNotice({
          tone: 'success',
          message: `${theme.name} was removed from InkNote.`,
        });
      } catch (error) {
        setThemeNotice({ tone: 'error', message: messageForDataError(error) });
      } finally {
        setIsThemeBusy(false);
      }
    },
    [onRemoveTheme],
  );

  const toggleAcrylic = useCallback(
    async (enabled: boolean): Promise<void> => {
      setIsThemeBusy(true);

      try {
        await onAcrylicChange(enabled);
        setThemeNotice({
          tone: 'success',
          message: enabled
            ? 'Acrylic background enabled.'
            : 'Acrylic background disabled.',
        });
      } catch (error) {
        setThemeNotice({ tone: 'error', message: messageForDataError(error) });
      } finally {
        setIsThemeBusy(false);
      }
    },
    [onAcrylicChange],
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div className="workspace-preferences__backdrop">
      <button
        type="button"
        className="workspace-preferences__dismiss"
        tabIndex={-1}
        aria-label="Close preferences"
        onClick={onClose}
      />
      <section
        className="workspace-preferences"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-preferences-title"
      >
        <header className="workspace-preferences__header">
          <div>
            <p className="workspace-preferences__eyebrow">InkNote</p>
            <h2 id="workspace-preferences-title">Preferences</h2>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            className="workspace-preferences__close"
            aria-label="Close preferences"
            onClick={onClose}
          >
            Done
          </button>
        </header>

        <div className="workspace-preferences__body">
          <section aria-labelledby="appearance-heading">
            <h3 id="appearance-heading">Appearance</h3>
            <p>Choose the contrast that suits the way you write.</p>

            <div
              className="workspace-preferences__theme-options"
              role="group"
              aria-label="Theme"
            >
              {themes.map((availableTheme) => (
                <div
                  className="workspace-preferences__theme-choice"
                  key={availableTheme.id}
                >
                  <button
                    type="button"
                    className="workspace-preferences__theme-option"
                    aria-pressed={themeId === availableTheme.id}
                    aria-label={themeLabelFor(availableTheme)}
                    onClick={() => onThemeChange(availableTheme.id)}
                  >
                    <span
                      className={`workspace-preferences__theme-swatch workspace-preferences__theme-swatch--${availableTheme.themeAppearance}`}
                    />
                    <span>
                      {availableTheme.name}
                      {availableTheme.kind === 'external' ? ' · package' : ''}
                    </span>
                  </button>
                  {availableTheme.kind !== 'external' ? null : (
                    <button
                      type="button"
                      className="workspace-preferences__theme-remove"
                      disabled={isThemeBusy}
                      aria-label={`Remove ${availableTheme.name} theme package`}
                      onClick={() => void removeTheme(availableTheme)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="workspace-preferences__theme-actions">
              <button
                type="button"
                disabled={isThemeBusy || isThemeCatalogLoading}
                onClick={() => void installTheme()}
              >
                Install theme package…
              </button>
            </div>
            <p className="workspace-preferences__theme-help">
              Install a local Inkdrop theme package with <code>theme</code>,{' '}
              <code>themeAppearance</code>, and <code>styleSheets</code> in its
              package.json. InkNote imports only its declared CSS; package
              scripts and dependencies are never run.
            </p>

            <div className="workspace-preferences__acrylic-option">
              <input
                type="checkbox"
                aria-label="Enable acrylic window background"
                checked={acrylic.acrylicEnabled}
                disabled={!acrylic.acrylicSupported || isThemeBusy}
                onChange={(event) => void toggleAcrylic(event.target.checked)}
              />
              <span>
                <strong>Acrylic window background</strong>
                <small>
                  {acrylic.acrylicSupported
                    ? 'Uses the native frosted-glass window material. Themes can react through body.acrylic-window.'
                    : 'Available on macOS and Windows 11 or newer.'}
                </small>
              </span>
            </div>

            {themeError === null && themeNotice === null ? null : (
              <p
                className={`workspace-preferences__theme-notice workspace-preferences__theme-notice--${themeNotice?.tone ?? 'error'}`}
                role={
                  themeNotice?.tone === 'error' || themeError !== null
                    ? 'alert'
                    : 'status'
                }
              >
                {themeNotice?.message ?? themeError}
              </p>
            )}
          </section>

          <section aria-labelledby="shortcuts-heading">
            <h3 id="shortcuts-heading">Keyboard shortcuts</h3>
            <p>Global shortcuts are available while writing Markdown.</p>

            <dl className="workspace-preferences__shortcut-list">
              {shortcuts.map(([keys, description]) => (
                <div key={keys}>
                  <dt>
                    <kbd>{keys}</kbd>
                  </dt>
                  <dd>{description}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="data-management-heading">
            <h3 id="data-management-heading">Local data</h3>
            <p>
              InkNote keeps notes locally. Choose where it writes managed
              backups, restores, and Markdown exports.
            </p>

            <dl className="workspace-preferences__data-summary">
              <div>
                <dt>Data directory</dt>
                <dd>{dataInfo?.dataDirectory ?? 'Loading…'}</dd>
              </div>
              <div>
                <dt>Backup directory</dt>
                <dd>{dataInfo?.backupDirectory ?? 'Not configured'}</dd>
              </div>
            </dl>

            <div className="workspace-preferences__data-actions">
              <button
                type="button"
                disabled={isDataLoading || dataInfo === null}
                onClick={() => void configureBackup()}
              >
                Configure backup…
              </button>
              <button
                type="button"
                disabled={isDataLoading || dataInfo === null}
                onClick={() => void restoreBackup()}
              >
                Restore from backup…
              </button>
              <button
                type="button"
                disabled={isDataLoading || dataInfo === null}
                onClick={() => void exportMarkdown()}
              >
                Export Markdown…
              </button>
            </div>

            {dataNotice === null ? null : (
              <p
                className={`workspace-preferences__data-notice workspace-preferences__data-notice--${dataNotice.tone}`}
                role={dataNotice.tone === 'error' ? 'alert' : 'status'}
              >
                {dataNotice.message}
              </p>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}

const getDataApi = () => {
  const { data } = window.inknote;

  if (data === undefined) {
    throw new Error('Local data management is unavailable in this build.');
  }

  return data;
};

const messageForDataError = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : 'The data operation could not be completed.';

const themeLabelFor = (theme: AvailableWorkspaceTheme): string => {
  if (theme.kind === 'external') {
    return `Use ${theme.name} theme`;
  }

  return theme.themeAppearance === 'dark' ? 'Dark theme' : 'Light theme';
};
