import { createPluginKernelError } from '../plugins/plugin.errors';
import type { Registration } from '../plugins/plugin.types';

declare const commandIdBrand: unique symbol;

export type CommandId = string & {
  readonly [commandIdBrand]: 'CommandId';
};

export type CommandInvocationSource =
  'api' | 'keymap' | 'menu' | 'context-menu';

export type CommandInvocation = Readonly<{
  source: CommandInvocationSource;
  detail?: unknown;
}>;

export type CommandHandler = (
  invocation: CommandInvocation,
) => void | Promise<void>;

export type ScopedCommandRegistry = Readonly<{
  add(command: string, handler: CommandHandler): Registration;
  dispatch(command: string, invocation?: CommandInvocation): Promise<boolean>;
}>;

const COMMAND_ID_PATTERN =
  /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createCommandId = (value: string): CommandId => {
  if (!isCommandId(value)) {
    throw createPluginKernelError(
      'INVALID_COMMAND_ID',
      'A command ID must use lowercase namespace:action kebab-case.',
    );
  }

  return value;
};

export const isCommandId = (value: unknown): value is CommandId =>
  typeof value === 'string' && COMMAND_ID_PATTERN.test(value);

export function assertCommandHandler(
  value: unknown,
): asserts value is CommandHandler {
  if (typeof value !== 'function') {
    throw createPluginKernelError(
      'INVALID_COMMAND_HANDLER',
      'A command handler must be a function.',
    );
  }
}

export const createCommandInvocation = (
  value: CommandInvocation,
): CommandInvocation => {
  if (typeof value !== 'object' || value === null) {
    throw createPluginKernelError(
      'INVALID_COMMAND_INVOCATION',
      'A command invocation must be an object.',
    );
  }

  const candidate = value as unknown as Record<string, unknown>;

  if (!isCommandInvocationSource(candidate.source)) {
    throw createPluginKernelError(
      'INVALID_COMMAND_INVOCATION',
      'A command invocation source is not supported.',
    );
  }

  return Object.freeze(
    Object.prototype.hasOwnProperty.call(candidate, 'detail')
      ? { source: candidate.source, detail: candidate.detail }
      : { source: candidate.source },
  );
};

const isCommandInvocationSource = (
  value: unknown,
): value is CommandInvocationSource =>
  value === 'api' ||
  value === 'keymap' ||
  value === 'menu' ||
  value === 'context-menu';
