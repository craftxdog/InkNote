import {
  isConfigValue,
  type ConfigChange,
  type ConfigSnapshot,
  type ConfigValue,
} from './config.types';

/**
 * Persistence boundary for renderer configuration. Production adapters can use
 * a validated IPC bridge, but the renderer never receives a filesystem path or
 * database handle.
 */
export interface ConfigStorage {
  load(): Promise<ConfigSnapshot>;
  apply(change: ConfigChange): Promise<void>;
}

/**
 * Explicitly volatile storage used by the first plugin-kernel slice and tests.
 */
export class InMemoryConfigStorage implements ConfigStorage {
  private readonly values = new Map<string, ConfigValue>();

  constructor(initialValues: ConfigSnapshot = {}) {
    for (const [key, value] of Object.entries(initialValues)) {
      if (!isConfigValue(value)) {
        throw new TypeError(`Config value for "${key}" must be scalar.`);
      }

      this.values.set(key, value);
    }
  }

  async load(): Promise<ConfigSnapshot> {
    return createSnapshot(this.values);
  }

  async apply(change: ConfigChange): Promise<void> {
    this.values.set(change.key, change.value);
  }
}

const createSnapshot = (
  values: ReadonlyMap<string, ConfigValue>,
): ConfigSnapshot => Object.freeze(Object.fromEntries(values));
