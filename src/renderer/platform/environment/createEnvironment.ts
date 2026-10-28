import type { CommandRegistry } from '../commands/CommandRegistry';
import type {
  CommandHandler,
  CommandInvocation,
  ScopedCommandRegistry,
} from '../commands/command.types';
import type { ConfigService } from '../config/ConfigService';
import type { ConfigSchema, ScopedConfig } from '../config/config.types';
import type { KeymapRegistry } from '../keymaps/KeymapRegistry';
import type {
  KeyBindingInput,
  ScopedKeymapRegistry,
} from '../keymaps/keymap.types';
import type { PluginId, Registration } from '../plugins/plugin.types';
import {
  PLUGIN_API_VERSION,
  type PluginEnvironment,
} from './environment.types';

export type PluginContributionScope = Readonly<{
  assertOpen(): void;
  track(registration: Registration): Registration;
}>;

type CreatePluginEnvironmentOptions = Readonly<{
  pluginId: PluginId;
  appVersion: string;
  devMode: boolean;
  scope: PluginContributionScope;
  configService: ConfigService;
  commandRegistry: CommandRegistry;
  keymapRegistry: KeymapRegistry;
}>;

/**
 * Creates a capability-limited environment for one plugin activation. Registry
 * ownership is captured here instead of trusting a caller-provided owner ID.
 */
export const createPluginEnvironment = <S extends ConfigSchema>(
  options: CreatePluginEnvironmentOptions,
): PluginEnvironment<S> => {
  const config = createScopedConfig<S>(options);
  const commands = createScopedCommands(options);
  const keymaps = createScopedKeymaps(options);

  return Object.freeze({
    apiVersion: PLUGIN_API_VERSION,
    appVersion: options.appVersion,
    devMode: options.devMode,
    config,
    commands,
    keymaps,
  }) as PluginEnvironment<S>;
};

const createScopedConfig = <S extends ConfigSchema>(
  options: CreatePluginEnvironmentOptions,
): ScopedConfig<S> =>
  Object.freeze({
    get: (key: string) => options.configService.get(options.pluginId, key),
    set: async (key: string, value: unknown) => {
      options.scope.assertOpen();

      return options.configService.set(options.pluginId, key, value);
    },
    observe: (key: string, listener: (value: unknown) => void) => {
      options.scope.assertOpen();

      return options.scope.track(
        options.configService.observe(options.pluginId, key, listener),
      );
    },
    onDidChange: (key: string, listener: (change: unknown) => void) => {
      options.scope.assertOpen();

      return options.scope.track(
        options.configService.onDidChange(options.pluginId, key, listener),
      );
    },
  }) as ScopedConfig<S>;

const createScopedCommands = (
  options: CreatePluginEnvironmentOptions,
): ScopedCommandRegistry =>
  Object.freeze({
    add: (command: string, handler: CommandHandler) => {
      options.scope.assertOpen();

      return options.scope.track(
        options.commandRegistry.register(options.pluginId, command, handler),
      );
    },
    dispatch: async (command: string, invocation?: CommandInvocation) => {
      options.scope.assertOpen();

      return options.commandRegistry.dispatch(command, invocation);
    },
    dispatchWithResult: async (
      command: string,
      invocation?: CommandInvocation,
    ) => {
      options.scope.assertOpen();

      return options.commandRegistry.dispatchWithResult(command, invocation);
    },
  });

const createScopedKeymaps = (
  options: CreatePluginEnvironmentOptions,
): ScopedKeymapRegistry =>
  Object.freeze({
    add: (bindings: readonly KeyBindingInput[]) => {
      options.scope.assertOpen();

      return options.scope.track(
        options.keymapRegistry.add(options.pluginId, bindings),
      );
    },
  });
