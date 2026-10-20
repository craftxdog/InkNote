import { CommandRegistry } from '../commands/CommandRegistry';
import { ConfigService } from '../config/ConfigService';
import type { ConfigStorage } from '../config/config.storage';
import { KeymapRegistry } from '../keymaps/KeymapRegistry';
import { PluginManager } from '../plugins/PluginManager';

export type PluginRuntimeOptions = Readonly<{
  appVersion: string;
  devMode: boolean;
  configStorage?: ConfigStorage;
  onConfigListenerError?: (error: unknown) => void;
}>;

/**
 * One renderer/window-local plugin runtime. Nothing in this class is a module
 * singleton, so separate windows cannot leak registrations into each other.
 */
export class PluginRuntime {
  readonly config: ConfigService;

  readonly commands = new CommandRegistry();

  readonly keymaps = new KeymapRegistry();

  readonly plugins: PluginManager;

  constructor(options: PluginRuntimeOptions) {
    this.config = new ConfigService({
      storage: options.configStorage,
      onListenerError: options.onConfigListenerError,
    });
    this.plugins = new PluginManager({
      appVersion: options.appVersion,
      devMode: options.devMode,
      configService: this.config,
      commandRegistry: this.commands,
      keymapRegistry: this.keymaps,
    });
  }

  async initialize(): Promise<void> {
    await this.config.hydrate();
  }
  async dispose(): Promise<void> {
    await this.plugins.deactivateAll();
  }
}

export const createPluginRuntime = (
  options: PluginRuntimeOptions,
): PluginRuntime => new PluginRuntime(options);
