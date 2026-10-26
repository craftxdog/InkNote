/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * Electron main process.
 *
 * Responsibilities:
 * - Create and manage native application windows.
 * - Register IPC handlers exposed through preload.
 * - Configure application menus.
 * - Handle external URLs.
 * - Start application updates.
 */

import path from 'path';
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
  type WebContents,
} from 'electron';

import Database from 'better-sqlite3';

import log from 'electron-log';

import { IPC_CHANNELS } from '../shared/ipc/channels';
import {
  createDataIpcFailure,
  runDataIpcOperation,
} from '../shared/data/data.ipc';
import {
  validateAbsolutePath,
  validateDirectorySelectionPurpose,
} from '../shared/data/data.types';
import { createDocumentIpcFailure } from '../shared/documents/document.ipc';
import { runThemeIpcOperation } from '../shared/themes/theme.ipc';
import { validateExternalThemeId } from '../shared/themes/theme.types';

import { DataManagementService } from './data/DataManagementService';
import { DocumentStoreStartup } from './data/DocumentStoreStartup';
import { MarkdownExportService } from './data/MarkdownExportService';
import { OrganizationMigrationSafetyService } from './data/OrganizationMigrationSafetyService';
import { RestoreDatabaseService } from './data/RestoreDatabaseService';
import { DocumentIpcService } from './documents/DocumentIpcService';
import { LocalDocumentStore } from './documents/LocalDocumentStore';
import { ThemePackageService } from './themes/ThemePackageService';
import MenuBuilder from './menu';
import { isAllowedExternalUrl, secureRendererPreferences } from './security';
import startAutoUpdates from './updates';
import { resolveHtmlPath } from './util';

/* =========================================================
   Window state
========================================================= */

let mainWindow: BrowserWindow | null = null;

let documentStoreStartup: DocumentStoreStartup<LocalDocumentStore> | null =
  null;

let dataManagementService: DataManagementService | null = null;

let themePackageService: ThemePackageService | null = null;

/* =========================================================
   Legacy IPC example
   TODO: remove once the ERB example IPC is no longer used.
========================================================= */

/* =========================================================
   Environment
========================================================= */

if (process.env.NODE_ENV === 'production') {
  process.setSourceMapsEnabled(true);
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

/* =========================================================
   Development tools
========================================================= */

if (isDebug) {
  void import('electron-debug')
    .then(({ default: debug }) => debug())
    .catch(console.error);
}

const installExtensions = async () => {
  const { installExtension, REACT_DEVELOPER_TOOLS } =
    await import('electron-devtools-installer');

  return installExtension(REACT_DEVELOPER_TOOLS, {
    forceDownload: !!process.env.UPGRADE_EXTENSIONS,
  }).catch(console.log);
};

/* =========================================================
   IPC handlers
========================================================= */

/**
 * Registers IPC operations related to native windows.
 *
 * This must be executed once during application startup,
 * not every time a BrowserWindow is created.
 */
const TRAFFIC_LIGHT_POSITION = {
  x: 15,
  y: 15,
} as const;

function registerWindowIpcHandlers() {
  ipcMain.handle(
    IPC_CHANNELS.window.setTrafficLightsVisibility,

    (event, visible: unknown) => {
      if (!isMainWindowSender(event.sender)) {
        return false;
      }

      if (typeof visible !== 'boolean') {
        throw new TypeError('Traffic light visibility must be a boolean');
      }

      /**
       * macOS-only functionality.
       *
       * Sidebar still works on Windows/Linux,
       * but native traffic-light controls do not exist.
       */
      if (process.platform !== 'darwin') {
        return false;
      }

      /**
       * Resolve the BrowserWindow that originated
       * the IPC request instead of depending on the
       * global mainWindow reference.
       */
      const targetWindow = BrowserWindow.fromWebContents(event.sender);

      if (!targetWindow || targetWindow.isDestroyed()) {
        return false;
      }

      targetWindow.setWindowButtonVisibility(visible);

      if (visible) {
        targetWindow.setWindowButtonPosition(TRAFFIC_LIGHT_POSITION);
      }

      return true;
    },
  );
}

function registerDocumentIpcHandlers(getService: () => DocumentIpcService) {
  ipcMain.handle(IPC_CHANNELS.documents.listActive, (event) => {
    if (!isMainWindowSender(event.sender)) {
      return createDocumentIpcFailure(new Error('Untrusted IPC sender.'));
    }

    return getService().listActive();
  });

  ipcMain.handle(IPC_CHANNELS.documents.listArchived, (event) => {
    if (!isMainWindowSender(event.sender)) {
      return createDocumentIpcFailure(new Error('Untrusted IPC sender.'));
    }

    return getService().listArchived();
  });

  ipcMain.handle(IPC_CHANNELS.documents.listNotebooks, (event) => {
    if (!isMainWindowSender(event.sender)) {
      return createDocumentIpcFailure(new Error('Untrusted IPC sender.'));
    }

    return getService().listNotebooks();
  });

  ipcMain.handle(IPC_CHANNELS.documents.listTags, (event) => {
    if (!isMainWindowSender(event.sender)) {
      return createDocumentIpcFailure(new Error('Untrusted IPC sender.'));
    }

    return getService().listTags();
  });

  ipcMain.handle(
    IPC_CHANNELS.documents.createNotebook,
    async (event, input) => {
      if (!isMainWindowSender(event.sender)) {
        return createDocumentIpcFailure(new Error('Untrusted IPC sender.'));
      }

      const result = await getService().createNotebook(input);
      await refreshConfiguredBackupAfterDocumentChange(result.ok);

      return result;
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.documents.deleteNotebook,
    async (event, input) => {
      if (!isMainWindowSender(event.sender)) {
        return createDocumentIpcFailure(new Error('Untrusted IPC sender.'));
      }

      const result = await getService().deleteNotebook(input);
      await refreshConfiguredBackupAfterDocumentChange(result.ok);

      return result;
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.documents.deletePermanently,
    async (event, input) => {
      if (!isMainWindowSender(event.sender)) {
        return createDocumentIpcFailure(new Error('Untrusted IPC sender.'));
      }

      const result = await getService().deletePermanently(input);
      await refreshConfiguredBackupAfterDocumentChange(result.ok);

      return result;
    },
  );

  ipcMain.handle(IPC_CHANNELS.documents.get, (event, id: unknown) => {
    if (!isMainWindowSender(event.sender)) {
      return createDocumentIpcFailure(new Error('Untrusted IPC sender.'));
    }

    return getService().get(id);
  });

  ipcMain.handle(
    IPC_CHANNELS.documents.apply,
    async (event, mutation: unknown) => {
      if (!isMainWindowSender(event.sender)) {
        return createDocumentIpcFailure(new Error('Untrusted IPC sender.'));
      }

      const result = await getService().apply(mutation);
      await refreshConfiguredBackupAfterDocumentChange(result.ok);

      return result;
    },
  );
}

function registerDataIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.data.getInfo, (event) => {
    if (!isMainWindowSender(event.sender)) {
      return createDataIpcFailure(new Error('Untrusted IPC sender.'));
    }

    return runDataIpcOperation(() => getDataManagementService().getInfo());
  });

  ipcMain.handle(IPC_CHANNELS.data.chooseDirectory, async (event, purpose) => {
    if (!isMainWindowSender(event.sender)) {
      return createDataIpcFailure(new Error('Untrusted IPC sender.'));
    }

    return runDataIpcOperation(async () => {
      const selectionPurpose = validateDirectorySelectionPurpose(purpose);
      const targetWindow = BrowserWindow.fromWebContents(event.sender);

      if (targetWindow === null || targetWindow.isDestroyed()) {
        throw new Error('The calling window is unavailable.');
      }

      const result = await dialog.showOpenDialog(targetWindow, {
        title: directoryDialogTitleFor(selectionPurpose),
        properties: ['openDirectory', 'createDirectory'],
      });

      return result.canceled ? null : (result.filePaths[0] ?? null);
    });
  });

  ipcMain.handle(IPC_CHANNELS.data.configureBackup, (event, directory) => {
    if (!isMainWindowSender(event.sender)) {
      return createDataIpcFailure(new Error('Untrusted IPC sender.'));
    }

    return runDataIpcOperation(() =>
      getDataManagementService().configureBackup(
        validateAbsolutePath(directory, 'Backup directory'),
      ),
    );
  });

  ipcMain.handle(IPC_CHANNELS.data.restoreBackup, (event, directory) => {
    if (!isMainWindowSender(event.sender)) {
      return createDataIpcFailure(new Error('Untrusted IPC sender.'));
    }

    return runDataIpcOperation(async () => {
      const backupFile = await getDataManagementService().backupFileForRestore(
        validateAbsolutePath(directory, 'Backup directory'),
      );
      const activeStore = getLocalDocumentStore();
      const restoreService = new RestoreDatabaseService({
        dataDirectory: app.getPath('userData'),
        databasePath: getDatabasePath(),
        snapshotDatabase: (destination) => activeStore.backupTo(destination),
        closeDatabase: () => {
          getDocumentStoreStartup().close();
        },
      });

      const result = await restoreService.restoreFrom(backupFile);

      await initializeLocalDocumentStore();

      return result;
    });
  });

  ipcMain.handle(IPC_CHANNELS.data.exportMarkdown, (event, directory) => {
    if (!isMainWindowSender(event.sender)) {
      return createDataIpcFailure(new Error('Untrusted IPC sender.'));
    }

    return runDataIpcOperation(() =>
      new MarkdownExportService({
        listActive: () => getLocalDocumentStore().listActive(),
        listNotebooks: () => getLocalDocumentStore().listNotebooks(),
      }).exportMarkdown(validateAbsolutePath(directory, 'Export directory')),
    );
  });
}

function registerThemeIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.themes.list, (event) => {
    if (!isMainWindowSender(event.sender)) {
      return runThemeIpcOperation(() => {
        throw new Error('Untrusted IPC sender.');
      });
    }

    return runThemeIpcOperation(() => getThemePackageService().list());
  });

  ipcMain.handle(IPC_CHANNELS.themes.choosePackageDirectory, async (event) => {
    if (!isMainWindowSender(event.sender)) {
      return runThemeIpcOperation(() => {
        throw new Error('Untrusted IPC sender.');
      });
    }

    return runThemeIpcOperation(async () => {
      const targetWindow = BrowserWindow.fromWebContents(event.sender);

      if (targetWindow === null || targetWindow.isDestroyed()) {
        throw new Error('The calling window is unavailable.');
      }

      const result = await dialog.showOpenDialog(targetWindow, {
        title: 'Choose Inkdrop theme package',
        properties: ['openDirectory'],
      });

      return result.canceled ? null : (result.filePaths[0] ?? null);
    });
  });

  ipcMain.handle(IPC_CHANNELS.themes.install, (event, directory) => {
    if (!isMainWindowSender(event.sender)) {
      return runThemeIpcOperation(() => {
        throw new Error('Untrusted IPC sender.');
      });
    }

    return runThemeIpcOperation(() =>
      getThemePackageService().install(directory),
    );
  });

  ipcMain.handle(IPC_CHANNELS.themes.load, (event, id) => {
    if (!isMainWindowSender(event.sender)) {
      return runThemeIpcOperation(() => {
        throw new Error('Untrusted IPC sender.');
      });
    }

    return runThemeIpcOperation(() =>
      getThemePackageService().load(validateExternalThemeId(id)),
    );
  });

  ipcMain.handle(IPC_CHANNELS.themes.remove, (event, id) => {
    if (!isMainWindowSender(event.sender)) {
      return runThemeIpcOperation(() => {
        throw new Error('Untrusted IPC sender.');
      });
    }

    return runThemeIpcOperation(() =>
      getThemePackageService().remove(validateExternalThemeId(id)),
    );
  });

  ipcMain.handle(IPC_CHANNELS.themes.getAppearance, (event) => {
    if (!isMainWindowSender(event.sender)) {
      return runThemeIpcOperation(() => {
        throw new Error('Untrusted IPC sender.');
      });
    }

    return runThemeIpcOperation(() => getThemePackageService().getAppearance());
  });

  ipcMain.handle(
    IPC_CHANNELS.themes.setAcrylicEnabled,
    async (event, enabled: unknown) => {
      if (!isMainWindowSender(event.sender)) {
        return runThemeIpcOperation(() => {
          throw new Error('Untrusted IPC sender.');
        });
      }

      return runThemeIpcOperation(async () => {
        if (typeof enabled !== 'boolean') {
          throw new Error('Acrylic preference must be a boolean.');
        }

        const appearance =
          await getThemePackageService().setAcrylicEnabled(enabled);
        const targetWindow = BrowserWindow.fromWebContents(event.sender);

        if (targetWindow === null || targetWindow.isDestroyed()) {
          throw new Error('The calling window is unavailable.');
        }

        applyAcrylicMaterial(targetWindow, appearance.acrylicEnabled);

        return appearance;
      });
    },
  );
}

function getLocalDocumentStore(): LocalDocumentStore {
  return getDocumentStoreStartup().getInitialized();
}

function getDocumentStoreStartup(): DocumentStoreStartup<LocalDocumentStore> {
  if (documentStoreStartup === null) {
    const migrationSafety = new OrganizationMigrationSafetyService({
      dataDirectory: app.getPath('userData'),
      databasePath: getDatabasePath(),
    });

    documentStoreStartup = new DocumentStoreStartup({
      ensureMigrationSafety: () =>
        migrationSafety.ensureSnapshotBeforeMigration(),
      createStore: () => new LocalDocumentStore(new Database(getDatabasePath())),
    });
  }

  return documentStoreStartup;
}

const initializeLocalDocumentStore = async (): Promise<LocalDocumentStore> =>
  getDocumentStoreStartup().initialize();

function getDataManagementService(): DataManagementService {
  if (dataManagementService === null) {
    dataManagementService = new DataManagementService({
      dataDirectory: app.getPath('userData'),
      snapshotDatabase: (destination) =>
        getLocalDocumentStore().backupTo(destination),
    });
  }

  return dataManagementService;
}

function getThemePackageService(): ThemePackageService {
  if (themePackageService === null) {
    themePackageService = new ThemePackageService({
      dataDirectory: app.getPath('userData'),
    });
  }

  return themePackageService;
}

const getDatabasePath = (): string =>
  path.join(app.getPath('userData'), 'inknote.sqlite');

const directoryDialogTitleFor = (
  purpose: 'backup' | 'restore' | 'export',
): string => {
  switch (purpose) {
    case 'backup':
      return 'Choose backup folder';
    case 'restore':
      return 'Choose InkNote backup folder';
    case 'export':
      return 'Choose Markdown export folder';
  }
};

const refreshConfiguredBackupAfterDocumentChange = async (
  didChange: boolean,
): Promise<void> => {
  if (!didChange) {
    return;
  }

  try {
    await getDataManagementService().refreshConfiguredBackup();
  } catch (error) {
    log.warn('Failed to refresh the configured local backup', error);
  }
};

const isMainWindowSender = (sender: WebContents): boolean =>
  mainWindow !== null &&
  !mainWindow.isDestroyed() &&
  mainWindow.webContents.id === sender.id;

const applyAcrylicMaterial = (
  targetWindow: BrowserWindow,
  enabled: boolean,
): void => {
  if (process.platform === 'darwin') {
    targetWindow.setVibrancy(enabled ? 'under-window' : null);
  } else if (process.platform === 'win32') {
    targetWindow.setBackgroundMaterial(enabled ? 'acrylic' : 'none');
  }
};

/* =========================================================
   Window creation
========================================================= */

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(app.getAppPath(), 'assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  const appearance = await getThemePackageService().getAppearance();

  mainWindow = new BrowserWindow({
    title: 'InkNote',

    show: false,

    width: 1430,
    height: 960,

    minWidth: 900,
    minHeight: 600,

    icon: getAssetPath('icon.png'),

    /**
     * We draw our own title/navigation bar.
     *
     * On macOS the native traffic lights remain available
     * and can be shown/hidden through IPC.
     */
    titleBarStyle: 'hidden',

    /**
     * macOS traffic-light position when visible.
     */
    trafficLightPosition: TRAFFIC_LIGHT_POSITION,

    /**
     * Native backdrop APIs can be toggled after construction, but Chromium
     * needs a transparent guest page from the start for theme acrylic CSS.
     * The renderer keeps the app opaque until the user enables the setting.
     */
    transparent: appearance.acrylicSupported,
    backgroundColor: appearance.acrylicSupported ? '#00000000' : '#f8f7f5',

    webPreferences: {
      ...secureRendererPreferences,
      preload: path.join(__dirname, '../preload/preload.js'),
    },
  });

  applyAcrylicMaterial(mainWindow, appearance.acrylicEnabled);

  /* -------------------------------------------------------
     Window lifecycle
  ------------------------------------------------------- */

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }

    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  /* -------------------------------------------------------
     Application menu
  ------------------------------------------------------- */

  const menuBuilder = new MenuBuilder(mainWindow);

  menuBuilder.buildMenu();

  /* -------------------------------------------------------
     External URLs
  ------------------------------------------------------- */

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      void shell.openExternal(url).catch((error: unknown) => {
        log.warn('Failed to open an approved external URL', error);
      });
    }

    return {
      action: 'deny',
    };
  });

  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });

  /* -------------------------------------------------------
     Renderer
  ------------------------------------------------------- */

  await mainWindow.loadURL(resolveHtmlPath('index.html'));
};

/* =========================================================
   Error handling
========================================================= */

function reportWindowError(error: unknown) {
  log.error('Failed to create the application window', error);

  mainWindow?.destroy();

  mainWindow = null;
}

/* =========================================================
   macOS activation
========================================================= */

function onActivate() {
  /**
   * macOS keeps the application alive when all windows
   * are closed.
   *
   * Create a new window without restarting the updater
   * or registering IPC handlers again.
   */
  if (mainWindow === null) {
    void createWindow().catch(reportWindowError);
  }
}

/* =========================================================
   Application lifecycle
========================================================= */

app.on('window-all-closed', () => {
  /**
   * Standard macOS behavior:
   * closing all windows does not quit the application.
   */
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  documentStoreStartup?.close();
  documentStoreStartup = null;
  dataManagementService = null;
  themePackageService = null;
});

app
  .whenReady()
  .then(async () => {
    await initializeLocalDocumentStore();

    /**
     * IMPORTANT:
     *
     * IPC handlers are registered once per Electron
     * main process, before the renderer starts using them.
     */
    registerWindowIpcHandlers();
    registerDocumentIpcHandlers(
      () => new DocumentIpcService(getLocalDocumentStore()),
    );
    registerDataIpcHandlers();
    registerThemeIpcHandlers();

    await createWindow();

    /**
     * Auto updater is also initialized once.
     */
    startAutoUpdates();

    app.on('activate', onActivate);
  })
  .catch((error: unknown) => {
    reportWindowError(error);

    app.quit();
  });
