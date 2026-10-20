import { ConfigService } from '../../../renderer/platform/config/ConfigService';
import {
  InMemoryConfigStorage,
  type ConfigStorage,
} from '../../../renderer/platform/config/config.storage';
import type {
  ConfigChange,
  ConfigSchema,
  ConfigSnapshot,
} from '../../../renderer/platform/config/config.types';
import { PluginKernelError } from '../../../renderer/platform/plugins/plugin.errors';
import { createPluginId } from '../../../renderer/platform/plugins/plugin.types';

const editorId = createPluginId('editor');
const previewId = createPluginId('preview');

const editorSchema = {
  vimEnabled: { type: 'boolean', default: true },
  fontSize: { type: 'integer', default: 14, minimum: 10, maximum: 24 },
  zoom: { type: 'number', default: 1, minimum: 0.5, maximum: 3 },
  theme: { type: 'string', default: 'system' },
} as const satisfies ConfigSchema;

const previewSchema = {
  rendered: { type: 'boolean', default: true },
} as const satisfies ConfigSchema;

const expectKernelError = (action: () => unknown, code: string): void => {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(PluginKernelError);
    expect(error).toMatchObject({ code });
    return;
  }

  throw new Error(`Expected plugin-kernel error ${code}.`);
};

const createHydratedService = async (
  storage: ConfigStorage = new InMemoryConfigStorage(),
  onListenerError?: (error: unknown) => void,
) => {
  const service = new ConfigService({ storage, onListenerError });

  await service.hydrate();

  return service;
};

describe('ConfigService', () => {
  it('requires hydration and returns defaults or a hydrated override afterward', async () => {
    const service = new ConfigService({
      storage: new InMemoryConfigStorage({ 'editor.vimEnabled': false }),
    });

    service.registerSchema(editorId, editorSchema);

    expectKernelError(
      () => service.get(editorId, 'vimEnabled'),
      'CONFIG_NOT_HYDRATED',
    );

    await service.hydrate();

    expect(service.get(editorId, 'vimEnabled')).toBe(false);
    expect(service.get(editorId, 'fontSize')).toBe(14);
  });

  it('keeps scoped plugin configuration inside its own namespace', async () => {
    const service = await createHydratedService();

    service.registerSchema(editorId, editorSchema);
    service.registerSchema(previewId, previewSchema);

    const editor = service.createScopedConfig<typeof editorSchema>(editorId);
    const preview = service.createScopedConfig<typeof previewSchema>(previewId);

    expect(editor.get('vimEnabled')).toBe(true);
    expect(preview.get('rendered')).toBe(true);
    expectKernelError(
      () => editor.get('rendered' as 'vimEnabled'),
      'CONFIG_UNKNOWN_KEY',
    );
  });

  it('coerces bounded numeric values before persisting a committed value', async () => {
    const service = await createHydratedService();

    service.registerSchema(editorId, editorSchema);

    const editor = service.createScopedConfig<typeof editorSchema>(editorId);

    await expect(editor.set('fontSize', '100')).resolves.toBe(24);
    await expect(editor.set('zoom', '0.1')).resolves.toBe(0.5);
    await expect(editor.set('fontSize', '14.5')).rejects.toMatchObject({
      code: 'INVALID_CONFIG_VALUE',
    });

    expect(editor.get('fontSize')).toBe(24);
    expect(editor.get('zoom')).toBe(0.5);
  });

  it('observes immediately, reports only committed changes, and disposes safely', async () => {
    const service = await createHydratedService();

    service.registerSchema(editorId, editorSchema);

    const editor = service.createScopedConfig<typeof editorSchema>(editorId);
    const observed = jest.fn();
    const changed = jest.fn();
    const observer = editor.observe('vimEnabled', observed);
    const changeObserver = editor.onDidChange('vimEnabled', changed);

    expect(observed).toHaveBeenCalledWith(true);
    expect(changed).not.toHaveBeenCalled();

    await editor.set('vimEnabled', false);
    await editor.set('vimEnabled', false);

    expect(observed).toHaveBeenLastCalledWith(false);
    expect(observed).toHaveBeenCalledTimes(2);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenCalledWith({ oldValue: true, newValue: false });
    expect(Object.isFrozen(changed.mock.calls[0][0])).toBe(true);

    observer.dispose();
    observer.dispose();
    changeObserver.dispose();
    await editor.set('vimEnabled', true);

    expect(observed).toHaveBeenCalledTimes(2);
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('isolates observer failures after a successful commit', async () => {
    const errors: unknown[] = [];
    const service = await createHydratedService(
      new InMemoryConfigStorage(),
      (error) => errors.push(error),
    );

    service.registerSchema(editorId, editorSchema);

    const editor = service.createScopedConfig<typeof editorSchema>(editorId);
    const expected = new Error('observer failed');
    const healthyObserver = jest.fn();

    editor.observe('vimEnabled', () => {
      throw expected;
    });
    editor.observe('vimEnabled', healthyObserver);

    errors.length = 0;
    healthyObserver.mockClear();

    await expect(editor.set('vimEnabled', false)).resolves.toBe(false);

    expect(editor.get('vimEnabled')).toBe(false);
    expect(healthyObserver).toHaveBeenCalledWith(false);
    expect(errors).toEqual([expected]);
  });

  it('does not mutate memory or notify observers when persistence fails', async () => {
    const expected = new Error('storage unavailable');
    const storage = new FailingConfigStorage(expected);
    const service = await createHydratedService(storage);

    service.registerSchema(editorId, editorSchema);

    const editor = service.createScopedConfig<typeof editorSchema>(editorId);
    const observed = jest.fn();

    editor.observe('vimEnabled', observed);
    observed.mockClear();

    await expect(editor.set('vimEnabled', false)).rejects.toBe(expected);

    expect(editor.get('vimEnabled')).toBe(true);
    expect(observed).not.toHaveBeenCalled();
  });

  it('serializes concurrent writes before it updates the effective value', async () => {
    const storage = new DelayedFirstWriteStorage();
    const service = await createHydratedService(storage);

    service.registerSchema(editorId, editorSchema);

    const editor = service.createScopedConfig<typeof editorSchema>(editorId);
    const first = editor.set('fontSize', 15);

    await storage.waitForFirstWrite();

    const second = editor.set('fontSize', 16);

    await Promise.resolve();
    expect(storage.changes).toEqual([{ key: 'editor.fontSize', value: 15 }]);

    storage.releaseFirstWrite();

    await expect(Promise.all([first, second])).resolves.toEqual([15, 16]);
    expect(storage.changes).toEqual([
      { key: 'editor.fontSize', value: 15 },
      { key: 'editor.fontSize', value: 16 },
    ]);
    expect(editor.get('fontSize')).toBe(16);
  });

  it('preserves a stored override when a schema is deactivated and reactivated', async () => {
    const service = await createHydratedService();
    const schemaRegistration = service.registerSchema(editorId, editorSchema);
    const editor = service.createScopedConfig<typeof editorSchema>(editorId);

    await editor.set('vimEnabled', false);
    schemaRegistration.dispose();

    service.registerSchema(editorId, editorSchema);

    expect(editor.get('vimEnabled')).toBe(false);
  });
});

class FailingConfigStorage implements ConfigStorage {
  constructor(private readonly error: Error) {}

  async load(): Promise<ConfigSnapshot> {
    return {};
  }

  async apply(): Promise<void> {
    throw this.error;
  }
}

class DelayedFirstWriteStorage implements ConfigStorage {
  readonly changes: ConfigChange[] = [];

  private firstWriteStarted: (() => void) | null = null;

  private readonly firstWrite = new Promise<void>((resolve) => {
    this.firstWriteStarted = resolve;
  });

  private releaseFirst: (() => void) | null = null;

  private readonly firstWriteRelease = new Promise<void>((resolve) => {
    this.releaseFirst = resolve;
  });

  async load(): Promise<ConfigSnapshot> {
    return {};
  }

  async apply(change: ConfigChange): Promise<void> {
    this.changes.push(change);

    if (this.changes.length === 1) {
      this.firstWriteStarted?.();
      await this.firstWriteRelease;
    }
  }

  waitForFirstWrite(): Promise<void> {
    return this.firstWrite;
  }

  releaseFirstWrite(): void {
    this.releaseFirst?.();
  }
}
