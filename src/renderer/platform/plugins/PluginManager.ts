import type { CommandRegistry } from '../commands/CommandRegistry';
import type { ConfigService } from '../config/ConfigService';
import type { ConfigSchema } from '../config/config.types';
import {
  createPluginEnvironment,
  type PluginContributionScope,
} from '../environment/createEnvironment';
import type { KeymapRegistry } from '../keymaps/KeymapRegistry';
import { createPluginKernelError } from './plugin.errors';
import {
  createPluginId,
  type InkNotePlugin,
  type PluginId,
  type Registration,
} from './plugin.types';

export type PluginManagerOptions = Readonly<{
  appVersion: string;
  devMode: boolean;
  configService: ConfigService;
  commandRegistry: CommandRegistry;
  keymapRegistry: KeymapRegistry;
}>;

type ActivePlugin = Readonly<{
  scope: PluginScope;
  deactivate?: () => void | Promise<void>;
}>;

/**
 * Activates built-in, pre-imported modules. It deliberately has no discovery or
 * package-loading capability: external extension execution needs a separate
 * trust and sandbox design.
 */
export class PluginManager {
  private readonly activePlugins = new Map<PluginId, ActivePlugin>();

  private readonly lifecycleInProgress = new Set<PluginId>();

  constructor(private readonly options: PluginManagerOptions) {}

  async activate<S extends ConfigSchema>(
    plugin: InkNotePlugin<S>,
  ): Promise<void> {
    const pluginId = createPluginId(plugin.id);

    this.assertCanActivate(pluginId);
    this.lifecycleInProgress.add(pluginId);

    let scope: PluginScope | null = null;

    try {
      await this.options.configService.hydrate();

      scope = new PluginScope();

      if (plugin.config !== undefined) {
        scope.track(
          this.options.configService.registerSchema(pluginId, plugin.config),
        );
      }

      const environment = createPluginEnvironment<S>({
        pluginId,
        appVersion: this.options.appVersion,
        devMode: this.options.devMode,
        scope,
        configService: this.options.configService,
        commandRegistry: this.options.commandRegistry,
        keymapRegistry: this.options.keymapRegistry,
      });

      await plugin.activate(environment);

      this.activePlugins.set(
        pluginId,
        Object.freeze({
          scope,
          deactivate:
            plugin.deactivate === undefined
              ? undefined
              : () => plugin.deactivate?.(environment),
        }),
      );
    } catch (error) {
      if (scope !== null) {
        scope.revoke();

        try {
          scope.disposeAll();
        } catch {
          // Preserve the activation failure after best-effort rollback.
        }
      }

      throw error;
    } finally {
      this.lifecycleInProgress.delete(pluginId);
    }
  }

  async deactivate(pluginId: PluginId): Promise<boolean> {
    const canonicalPluginId = createPluginId(pluginId);

    if (this.lifecycleInProgress.has(canonicalPluginId)) {
      throw createPluginKernelError(
        'PLUGIN_LIFECYCLE_IN_PROGRESS',
        `Plugin "${canonicalPluginId}" has a lifecycle operation in progress.`,
      );
    }

    const activePlugin = this.activePlugins.get(canonicalPluginId);

    if (activePlugin === undefined) {
      return false;
    }

    this.lifecycleInProgress.add(canonicalPluginId);
    activePlugin.scope.revoke();

    let hasError = false;
    let lifecycleError: unknown;

    try {
      await activePlugin.deactivate?.();
    } catch (error) {
      hasError = true;
      lifecycleError = error;
    }

    try {
      activePlugin.scope.disposeAll();
    } catch (error) {
      if (!hasError) {
        hasError = true;
        lifecycleError = error;
      }
    } finally {
      this.activePlugins.delete(canonicalPluginId);
      this.lifecycleInProgress.delete(canonicalPluginId);
    }

    if (hasError) {
      throw lifecycleError;
    }

    return true;
  }

  isActive(pluginId: PluginId): boolean {
    return this.activePlugins.has(pluginId);
  }

  private assertCanActivate(pluginId: PluginId): void {
    if (this.activePlugins.has(pluginId)) {
      throw createPluginKernelError(
        'PLUGIN_ALREADY_ACTIVE',
        `Plugin "${pluginId}" is already active.`,
      );
    }

    if (this.lifecycleInProgress.has(pluginId)) {
      throw createPluginKernelError(
        'PLUGIN_LIFECYCLE_IN_PROGRESS',
        `Plugin "${pluginId}" has a lifecycle operation in progress.`,
      );
    }
  }
  async deactivateAll(): Promise<void> {
    const pluginIds = [...this.activePlugins.keys()].reverse();
    let firstError: unknown;

    for (const pluginId of pluginIds) {
      try {
        await this.deactivate(pluginId);
      } catch (error) {
        firstError ??= error;
      }
    }
    if (firstError !== undefined) {
      throw firstError;
    }
  }
}

class PluginScope implements PluginContributionScope {
  private readonly registrations: Registration[] = [];

  private isOpen = true;

  assertOpen(): void {
    if (!this.isOpen) {
      throw createPluginKernelError(
        'PLUGIN_SCOPE_CLOSED',
        'Plugin contributions cannot be registered after the plugin scope closes.',
      );
    }
  }

  track(registration: Registration): Registration {
    this.assertOpen();
    this.registrations.push(registration);

    return registration;
  }

  revoke(): void {
    this.isOpen = false;
  }

  disposeAll(): void {
    this.revoke();

    let hasError = false;
    let cleanupError: unknown;

    for (const registration of [...this.registrations].reverse()) {
      try {
        registration.dispose();
      } catch (error) {
        if (!hasError) {
          hasError = true;
          cleanupError = error;
        }
      }
    }

    this.registrations.length = 0;

    if (hasError) {
      throw cleanupError;
    }
  }
}
