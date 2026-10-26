/** @jest-environment node */

import { DocumentStoreStartup } from '../../../main/data/DocumentStoreStartup';

describe('DocumentStoreStartup', () => {
  it('does not create a store when migration safety preflight fails', async () => {
    const createStore = jest.fn(() => ({ close: jest.fn() }));
    const startup = new DocumentStoreStartup({
      ensureMigrationSafety: async () => {
        throw new Error('snapshot unavailable');
      },
      createStore,
    });

    await expect(startup.initialize()).rejects.toThrow('snapshot unavailable');
    expect(createStore).not.toHaveBeenCalled();
    expect(() => startup.getInitialized()).toThrow('not initialized');
  });

  it('runs the safety preflight once before serving the singleton store', async () => {
    const store = { close: jest.fn() };
    const ensureMigrationSafety = jest.fn(async () => undefined);
    const createStore = jest.fn(() => store);
    const startup = new DocumentStoreStartup({
      ensureMigrationSafety,
      createStore,
    });

    await expect(startup.initialize()).resolves.toBe(store);
    await expect(startup.initialize()).resolves.toBe(store);
    expect(startup.getInitialized()).toBe(store);
    expect(ensureMigrationSafety).toHaveBeenCalledTimes(1);
    expect(createStore).toHaveBeenCalledTimes(1);
  });

  it('closes the active store and initializes a fresh one after restore', async () => {
    const firstStore = { close: jest.fn() };
    const secondStore = { close: jest.fn() };
    const createStore = jest
      .fn()
      .mockReturnValueOnce(firstStore)
      .mockReturnValueOnce(secondStore);
    const startup = new DocumentStoreStartup({
      ensureMigrationSafety: async () => undefined,
      createStore,
    });

    await startup.initialize();
    startup.close();

    await expect(startup.initialize()).resolves.toBe(secondStore);
    expect(firstStore.close).toHaveBeenCalledTimes(1);
    expect(createStore).toHaveBeenCalledTimes(2);
  });
});
