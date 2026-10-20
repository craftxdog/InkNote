import { createPluginKernelError } from './plugin.errors';
import type { ConfigSchema } from '../config/config.types';
import type { PluginEnvironment } from '../environment/environment.types';

declare const pluginIdBrand: unique symbol;

export type PluginId = string & {
  readonly [pluginIdBrand]: 'PluginId';
};

export type Registration = Readonly<{
  dispose(): void;
}>;

export type InkNotePlugin<S extends ConfigSchema = ConfigSchema> = Readonly<{
  id: PluginId;
  config?: S;
  activate(environment: PluginEnvironment<S>): void | Promise<void>;
  deactivate?(environment: PluginEnvironment<S>): void | Promise<void>;
}>;

const PLUGIN_ID_PATTERN =
  /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

export const createPluginId = (value: string): PluginId => {
  if (typeof value !== 'string' || !PLUGIN_ID_PATTERN.test(value)) {
    throw createPluginKernelError(
      'INVALID_PLUGIN_ID',
      'A plugin ID must use lowercase kebab-case segments separated by dots.',
    );
  }

  return value as PluginId;
};
