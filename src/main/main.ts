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
import { app, BrowserWindow, ipcMain, shell } from 'electron';

import log from 'electron-log';

import { IPC_CHANNELS } from '../shared/ipc/channels';

import MenuBuilder from './menu';
import startAutoUpdates from './updates';
import { resolveHtmlPath } from './util';

/* =========================================================
   Window state
========================================================= */

let mainWindow: BrowserWindow | null = null;

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

    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
    },
  });

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
    void shell.openExternal(url);

    return {
      action: 'deny',
    };
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

app
  .whenReady()
  .then(async () => {
    /**
     * IMPORTANT:
     *
     * IPC handlers are registered once per Electron
     * main process, before the renderer starts using them.
     */
    registerWindowIpcHandlers();

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
