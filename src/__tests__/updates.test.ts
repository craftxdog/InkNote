/** @jest-environment node */
jest.mock('electron', () => ({ app: { isPackaged: false } }));
jest.mock('electron-updater', () => ({
  autoUpdater: { on: jest.fn(), checkForUpdatesAndNotify: jest.fn() },
}));
jest.mock('electron-log', () => ({
  transports: { file: { level: '' } },
  error: jest.fn(),
}));

beforeEach(() => {
  jest.resetModules();
  delete process.env.INKNOTE_ENABLE_AUTO_UPDATES;
});

test('development startup does not contact the update service', () => {
  const { autoUpdater } = require('electron-updater');
  require('../main/updates').default();
  expect(autoUpdater.checkForUpdatesAndNotify).not.toHaveBeenCalled();
});

test('unsigned packaged releases do not contact the automatic update service', () => {
  const { app } = require('electron');
  const { autoUpdater } = require('electron-updater');
  app.isPackaged = true;

  require('../main/updates').default();

  expect(autoUpdater.checkForUpdatesAndNotify).not.toHaveBeenCalled();
});

test('an explicitly enabled update channel initializes once and handles rejection', async () => {
  const { app } = require('electron');
  const { autoUpdater } = require('electron-updater');
  const log = require('electron-log');
  const failure = new Error('offline');
  app.isPackaged = true;
  process.env.INKNOTE_ENABLE_AUTO_UPDATES = 'true';
  autoUpdater.checkForUpdatesAndNotify.mockRejectedValue(failure);
  const start = require('../main/updates').default;
  start();
  start();
  await Promise.resolve();
  expect(autoUpdater.checkForUpdatesAndNotify).toHaveBeenCalledTimes(1);
  expect(autoUpdater.on).toHaveBeenCalledWith('error', expect.any(Function));
  expect(log.error).toHaveBeenCalledWith(
    'Failed to check for updates',
    failure,
  );
});
