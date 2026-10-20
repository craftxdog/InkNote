import type { ConfigSchema, ScopedConfig } from '../config/config.types';
import type { ScopedCommandRegistry } from '../commands/command.types';
import type { ScopedKeymapRegistry } from '../keymaps/keymap.types';

export const PLUGIN_API_VERSION = '1' as const;

export type PluginEnvironment<S extends ConfigSchema = ConfigSchema> =
  Readonly<{
    apiVersion: typeof PLUGIN_API_VERSION;
    appVersion: string;
    devMode: boolean;
    config: ScopedConfig<S>;
    commands: ScopedCommandRegistry;
    keymaps: ScopedKeymapRegistry;
  }>;
