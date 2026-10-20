import {
  isConfigValue,
  type BooleanConfigSetting,
  type ConfigChange,
  type ConfigSchema,
  type ConfigSetting,
  type ConfigSnapshot,
  type ConfigValue,
  type ConfigValueChange,
  type IntegerConfigSetting,
  type NumberConfigSetting,
  type ScopedConfig,
  type StringConfigSetting,
} from './config.types';
import { InMemoryConfigStorage, type ConfigStorage } from './config.storage';
import { createPluginKernelError } from '../plugins/plugin.errors';
import {
  createPluginId,
  type PluginId,
  type Registration,
} from '../plugins/plugin.types';

export type ConfigServiceOptions = Readonly<{
  storage?: ConfigStorage;
  onListenerError?: (error: unknown) => void;
}>;

type ConfigValueListener = (value: ConfigValue) => void;
type ConfigChangeListener = (change: ConfigValueChange) => void;

type RegisteredSetting = Readonly<{
  fullKey: string;
  setting: ConfigSetting;
}>;

const CONFIG_KEY_PATTERN = /^[a-z][A-Za-z0-9]*$/;

/**
 * Owns a hydrated renderer-side configuration cache. Disk access remains an
 * asynchronous injected port so plugins cannot obtain filesystem privileges.
 */
export class ConfigService {
  private readonly storage: ConfigStorage;

  private readonly values = new Map<string, ConfigValue>();

  private readonly schemas = new Map<
    PluginId,
    ReadonlyMap<string, ConfigSetting>
  >();

  private readonly valueListeners = new Map<string, Set<ConfigValueListener>>();

  private readonly changeListeners = new Map<
    string,
    Set<ConfigChangeListener>
  >();

  private hydration: Promise<void> | null = null;

  private isHydrated = false;

  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly options: ConfigServiceOptions = {}) {
    this.storage = options.storage ?? new InMemoryConfigStorage();
  }

  async hydrate(): Promise<void> {
    if (this.isHydrated) {
      return;
    }

    if (this.hydration !== null) {
      return this.hydration;
    }

    const hydration = this.storage.load().then((snapshot) => {
      this.replaceValues(snapshot);
      this.isHydrated = true;

      return undefined;
    });

    this.hydration = hydration;

    try {
      await hydration;
    } finally {
      this.hydration = null;
    }
  }

  registerSchema(pluginId: PluginId, schema: ConfigSchema): Registration {
    const canonicalPluginId = createPluginId(pluginId);

    if (this.schemas.has(canonicalPluginId)) {
      throw createPluginKernelError(
        'CONFIG_SCHEMA_CONFLICT',
        `Configuration schema for "${canonicalPluginId}" is already registered.`,
      );
    }

    const normalizedSchema = normalizeSchema(schema);

    this.schemas.set(canonicalPluginId, normalizedSchema);

    let isDisposed = false;

    return Object.freeze({
      dispose: () => {
        if (isDisposed) {
          return;
        }

        isDisposed = true;

        if (this.schemas.get(canonicalPluginId) === normalizedSchema) {
          this.schemas.delete(canonicalPluginId);
          this.removeListenersForPlugin(canonicalPluginId);
        }
      },
    });
  }

  get(pluginId: PluginId, key: string): ConfigValue {
    this.assertHydrated();

    const { fullKey, setting } = this.getRegisteredSetting(pluginId, key);

    return this.getEffectiveValue(fullKey, setting);
  }

  async set(
    pluginId: PluginId,
    key: string,
    value: unknown,
  ): Promise<ConfigValue> {
    this.assertHydrated();

    const { fullKey, setting } = this.getRegisteredSetting(pluginId, key);
    const normalizedValue = normalizeConfigValue(setting, value);

    return this.enqueueWrite(async () => {
      const oldValue = this.getEffectiveValue(fullKey, setting);

      if (Object.is(oldValue, normalizedValue)) {
        return oldValue;
      }

      const change: ConfigChange = Object.freeze({
        key: fullKey,
        value: normalizedValue,
      });

      await this.storage.apply(change);

      this.values.set(fullKey, normalizedValue);
      this.notifyValueListeners(fullKey, normalizedValue);
      this.notifyChangeListeners(
        fullKey,
        Object.freeze({ oldValue, newValue: normalizedValue }),
      );

      return normalizedValue;
    });
  }

  observe(
    pluginId: PluginId,
    key: string,
    listener: ConfigValueListener,
  ): Registration {
    this.assertHydrated();

    const { fullKey, setting } = this.getRegisteredSetting(pluginId, key);
    assertListener(listener);

    const registration = this.addListener(
      this.valueListeners,
      fullKey,
      listener,
    );

    this.notifyListener(listener, this.getEffectiveValue(fullKey, setting));

    return registration;
  }

  onDidChange(
    pluginId: PluginId,
    key: string,
    listener: ConfigChangeListener,
  ): Registration {
    this.assertHydrated();

    const { fullKey } = this.getRegisteredSetting(pluginId, key);
    assertListener(listener);

    return this.addListener(this.changeListeners, fullKey, listener);
  }

  createScopedConfig<S extends ConfigSchema>(
    pluginId: PluginId,
  ): ScopedConfig<S> {
    const canonicalPluginId = createPluginId(pluginId);

    return Object.freeze({
      get: (key: string) => this.get(canonicalPluginId, key),
      set: (key: string, value: unknown) =>
        this.set(canonicalPluginId, key, value),
      observe: (key: string, listener: ConfigValueListener) =>
        this.observe(canonicalPluginId, key, listener),
      onDidChange: (key: string, listener: ConfigChangeListener) =>
        this.onDidChange(canonicalPluginId, key, listener),
    }) as ScopedConfig<S>;
  }

  private assertHydrated(): void {
    if (!this.isHydrated) {
      throw createPluginKernelError(
        'CONFIG_NOT_HYDRATED',
        'Configuration must hydrate before it can be read or changed.',
      );
    }
  }

  private getRegisteredSetting(
    pluginId: PluginId,
    key: string,
  ): RegisteredSetting {
    const canonicalPluginId = createPluginId(pluginId);

    assertConfigKey(key);

    const schema = this.schemas.get(canonicalPluginId);
    const setting = schema?.get(key);

    if (setting === undefined) {
      throw createPluginKernelError(
        'CONFIG_UNKNOWN_KEY',
        `Configuration key "${canonicalPluginId}.${key}" is not registered.`,
      );
    }

    return Object.freeze({
      fullKey: `${canonicalPluginId}.${key}`,
      setting,
    });
  }

  private getEffectiveValue(
    fullKey: string,
    setting: ConfigSetting,
  ): ConfigValue {
    const storedValue = this.values.get(fullKey);

    if (storedValue === undefined) {
      return setting.default;
    }

    try {
      return normalizeConfigValue(setting, storedValue);
    } catch {
      return setting.default;
    }
  }

  private enqueueWrite<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.writeQueue.then(operation, operation);

    this.writeQueue = next.then(
      () => undefined,
      () => undefined,
    );

    return next;
  }

  private replaceValues(snapshot: ConfigSnapshot): void {
    if (
      typeof snapshot !== 'object' ||
      snapshot === null ||
      Array.isArray(snapshot)
    ) {
      throw createPluginKernelError(
        'INVALID_CONFIG_VALUE',
        'Configuration storage must return a scalar key-value snapshot.',
      );
    }

    const nextValues = new Map<string, ConfigValue>();

    for (const [key, value] of Object.entries(snapshot)) {
      if (!isConfigValue(value)) {
        throw createPluginKernelError(
          'INVALID_CONFIG_VALUE',
          `Configuration value for "${key}" must be scalar.`,
        );
      }

      nextValues.set(key, value);
    }

    this.values.clear();

    for (const [key, value] of nextValues) {
      this.values.set(key, value);
    }
  }

  private addListener<Listener>(
    listenersByKey: Map<string, Set<Listener>>,
    fullKey: string,
    listener: Listener,
  ): Registration {
    let listeners = listenersByKey.get(fullKey);

    if (listeners === undefined) {
      listeners = new Set();
      listenersByKey.set(fullKey, listeners);
    }

    listeners.add(listener);

    let isDisposed = false;

    return Object.freeze({
      dispose: () => {
        if (isDisposed) {
          return;
        }

        isDisposed = true;
        listeners?.delete(listener);

        if (listeners?.size === 0) {
          listenersByKey.delete(fullKey);
        }
      },
    });
  }

  private notifyValueListeners(fullKey: string, value: ConfigValue): void {
    this.notifyListeners(this.valueListeners.get(fullKey), value);
  }

  private notifyChangeListeners(
    fullKey: string,
    change: ConfigValueChange,
  ): void {
    this.notifyListeners(this.changeListeners.get(fullKey), change);
  }

  private notifyListeners<Argument>(
    listeners: ReadonlySet<(argument: Argument) => void> | undefined,
    argument: Argument,
  ): void {
    if (listeners === undefined) {
      return;
    }

    for (const listener of [...listeners]) {
      if (!listeners.has(listener)) {
        continue;
      }

      this.notifyListener(listener, argument);
    }
  }

  private notifyListener<Argument>(
    listener: (argument: Argument) => void,
    argument: Argument,
  ): void {
    try {
      listener(argument);
    } catch (error) {
      this.reportListenerError(error);
    }
  }

  private removeListenersForPlugin(pluginId: PluginId): void {
    const prefix = `${pluginId}.`;

    this.removeListenersWithPrefix(this.valueListeners, prefix);
    this.removeListenersWithPrefix(this.changeListeners, prefix);
  }

  private removeListenersWithPrefix<Listener>(
    listenersByKey: Map<string, Set<Listener>>,
    prefix: string,
  ): void {
    for (const fullKey of listenersByKey.keys()) {
      if (fullKey.startsWith(prefix)) {
        listenersByKey.delete(fullKey);
      }
    }
  }

  private reportListenerError(error: unknown): void {
    try {
      this.options.onListenerError?.(error);
    } catch {
      // Diagnostics must not turn a committed configuration change into a failure.
    }
  }
}

const normalizeSchema = (
  schema: ConfigSchema,
): ReadonlyMap<string, ConfigSetting> => {
  if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) {
    throw createPluginKernelError(
      'INVALID_CONFIG_VALUE',
      'A configuration schema must be an object.',
    );
  }

  const normalizedSchema = new Map<string, ConfigSetting>();

  for (const [key, setting] of Object.entries(schema)) {
    assertConfigKey(key);
    normalizedSchema.set(key, normalizeSetting(setting));
  }

  return normalizedSchema;
};

const normalizeSetting = (value: unknown): ConfigSetting => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw createPluginKernelError(
      'INVALID_CONFIG_VALUE',
      'A configuration setting must be an object.',
    );
  }

  const candidate = value as Record<string, unknown>;
  const title = normalizeTitle(candidate.title);

  switch (candidate.type) {
    case 'boolean':
      return Object.freeze({
        type: 'boolean',
        default: assertBoolean(candidate.default),
        ...(title === undefined ? {} : { title }),
      } satisfies BooleanConfigSetting);
    case 'string':
      return Object.freeze({
        type: 'string',
        default: assertString(candidate.default),
        ...(title === undefined ? {} : { title }),
      } satisfies StringConfigSetting);
    case 'integer':
      return normalizeNumericSetting('integer', candidate, title);
    case 'number':
      return normalizeNumericSetting('number', candidate, title);
    default:
      throw createPluginKernelError(
        'INVALID_CONFIG_VALUE',
        'A configuration setting type is not supported.',
      );
  }
};

const normalizeNumericSetting = (
  type: 'integer' | 'number',
  candidate: Record<string, unknown>,
  title: string | undefined,
): IntegerConfigSetting | NumberConfigSetting => {
  const defaultValue = assertFiniteNumber(candidate.default);
  const minimum = normalizeLimit(candidate.minimum, type);
  const maximum = normalizeLimit(candidate.maximum, type);

  if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
    throw createPluginKernelError(
      'INVALID_CONFIG_VALUE',
      'A configuration minimum cannot exceed its maximum.',
    );
  }

  if (type === 'integer' && !Number.isInteger(defaultValue)) {
    throw createPluginKernelError(
      'INVALID_CONFIG_VALUE',
      'An integer configuration default must be an integer.',
    );
  }

  if (
    (minimum !== undefined && defaultValue < minimum) ||
    (maximum !== undefined && defaultValue > maximum)
  ) {
    throw createPluginKernelError(
      'INVALID_CONFIG_VALUE',
      'A configuration default must be within its declared limits.',
    );
  }

  return Object.freeze({
    type,
    default: defaultValue,
    ...(minimum === undefined ? {} : { minimum }),
    ...(maximum === undefined ? {} : { maximum }),
    ...(title === undefined ? {} : { title }),
  });
};

const normalizeConfigValue = (
  setting: ConfigSetting,
  value: unknown,
): ConfigValue => {
  switch (setting.type) {
    case 'boolean':
      return assertBoolean(value);
    case 'string':
      return assertString(value);
    case 'integer':
      return normalizeNumberValue(setting, value, true);
    case 'number':
      return normalizeNumberValue(setting, value, false);
  }
};

const normalizeNumberValue = (
  setting: IntegerConfigSetting | NumberConfigSetting,
  value: unknown,
  requiresInteger: boolean,
): number => {
  const parsed = parseFiniteNumber(value);
  const clamped = Math.min(
    setting.maximum ?? Number.POSITIVE_INFINITY,
    Math.max(setting.minimum ?? Number.NEGATIVE_INFINITY, parsed),
  );

  if (requiresInteger && !Number.isInteger(clamped)) {
    throw createPluginKernelError(
      'INVALID_CONFIG_VALUE',
      'An integer configuration value must be an integer.',
    );
  }

  return clamped;
};

function assertConfigKey(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !CONFIG_KEY_PATTERN.test(value)) {
    throw createPluginKernelError(
      'INVALID_CONFIG_KEY',
      'A config key must use lower camel-case without a namespace.',
    );
  }
}

function assertListener(
  value: unknown,
): asserts value is (argument: never) => void {
  if (typeof value !== 'function') {
    throw createPluginKernelError(
      'INVALID_CONFIG_VALUE',
      'A configuration listener must be a function.',
    );
  }
}

const assertBoolean = (value: unknown): boolean => {
  if (typeof value !== 'boolean') {
    throw createPluginKernelError(
      'INVALID_CONFIG_VALUE',
      'A boolean configuration value must be boolean.',
    );
  }

  return value;
};

const assertString = (value: unknown): string => {
  if (typeof value !== 'string') {
    throw createPluginKernelError(
      'INVALID_CONFIG_VALUE',
      'A string configuration value must be a string.',
    );
  }

  return value;
};

const assertFiniteNumber = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw createPluginKernelError(
      'INVALID_CONFIG_VALUE',
      'A numeric configuration value must be finite.',
    );
  }

  return value;
};

const normalizeLimit = (
  value: unknown,
  type: 'integer' | 'number',
): number | undefined => {
  if (value === undefined) {
    return undefined;
  }

  const limit = assertFiniteNumber(value);

  if (type === 'integer' && !Number.isInteger(limit)) {
    throw createPluginKernelError(
      'INVALID_CONFIG_VALUE',
      'An integer configuration limit must be an integer.',
    );
  }

  return limit;
};

const parseFiniteNumber = (value: unknown): number => {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim().length > 0
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    throw createPluginKernelError(
      'INVALID_CONFIG_VALUE',
      'A numeric configuration value must be finite.',
    );
  }

  return parsed;
};

const normalizeTitle = (value: unknown): string | undefined => {
  if (value === undefined) {
    return undefined;
  }

  return assertString(value);
};
