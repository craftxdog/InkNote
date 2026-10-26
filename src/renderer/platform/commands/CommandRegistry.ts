import {
  assertCommandHandler,
  createCommandId,
  createCommandInvocation,
  isCommandId,
  type CommandHandler,
  type CommandDispatchResult,
  type CommandId,
  type CommandInvocation,
} from './command.types';
import { createPluginKernelError } from '../plugins/plugin.errors';
import {
  createPluginId,
  type PluginId,
  type Registration,
} from '../plugins/plugin.types';

type RegisteredCommand = Readonly<{
  handler: CommandHandler;
}>;

/**
 * Owns one handler per namespaced command. DOM event propagation and command
 * target lookup intentionally live in a future renderer adapter.
 */
export class CommandRegistry {
  private readonly commands = new Map<CommandId, RegisteredCommand>();

  register(
    owner: PluginId,
    command: string,
    handler: CommandHandler,
  ): Registration {
    createPluginId(owner);

    const commandId = createCommandId(command);

    assertCommandHandler(handler);

    if (this.commands.has(commandId)) {
      throw createPluginKernelError(
        'COMMAND_CONFLICT',
        `The command "${commandId}" is already registered.`,
      );
    }

    const registration: RegisteredCommand = Object.freeze({ handler });

    this.commands.set(commandId, registration);

    let isDisposed = false;

    return Object.freeze({
      dispose: () => {
        if (isDisposed) {
          return;
        }

        isDisposed = true;

        if (this.commands.get(commandId) === registration) {
          this.commands.delete(commandId);
        }
      },
    });
  }

  async dispatch(
    command: string,
    invocation: CommandInvocation = { source: 'api' },
  ): Promise<boolean> {
    const result = await this.dispatchWithResult(command, invocation);

    return result.dispatched;
  }

  async dispatchWithResult(
    command: string,
    invocation: CommandInvocation = { source: 'api' },
  ): Promise<CommandDispatchResult> {
    const commandId = createCommandId(command);
    const registration = this.commands.get(commandId);

    if (registration === undefined) {
      return Object.freeze({ dispatched: false, value: undefined });
    }

    const value = await registration.handler(
      createCommandInvocation(invocation),
    );

    return Object.freeze({ dispatched: true, value });
  }

  has(command: string): boolean {
    return isCommandId(command) && this.commands.has(command);
  }
}
