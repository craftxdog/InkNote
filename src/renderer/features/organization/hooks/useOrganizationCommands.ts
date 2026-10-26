import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  CommandInvocation,
  CommandInvocationSource,
} from '../../../platform/commands/command.types';
import {
  createPluginRuntime,
  type PluginRuntime,
} from '../../../platform/environment/runtime';
import type { KeymapTarget } from '../../../platform/keymaps/keymap.types';

import {
  organizationCommandContexts,
  isOrganizationCommand,
  type OrganizationCommand,
} from '../model/organizationCommands';
import { createOrganizationCommandsPlugin } from '../runtime/organizationCommandsPlugin';

type UseOrganizationCommandsOptions = Readonly<{
  onCommand(
    command: OrganizationCommand,
    invocation: CommandInvocation,
  ): void | Promise<void>;
  getKeymapTargets?(event: KeyboardEvent): readonly KeymapTarget[];
}>;

export type OrganizationCommands = Readonly<{
  dispatchOrganizationCommand(
    command: OrganizationCommand,
    source?: CommandInvocationSource,
    detail?: unknown,
  ): Promise<boolean>;
}>;

const organizationKeymapTarget = Object.freeze({
  matches: (context: string) =>
    context === organizationCommandContexts.global ? 1 : null,
});

const createOrganizationRuntime = (): PluginRuntime =>
  createPluginRuntime({
    appVersion: '0.1.0',
    devMode: false,
  });

class OrganizationCommandController {
  private activation: Promise<void> | null = null;

  private isAvailable = false;

  constructor(
    private onCommand: UseOrganizationCommandsOptions['onCommand'],
  ) {}

  setOnCommand(
    onCommand: UseOrganizationCommandsOptions['onCommand'],
  ): void {
    this.onCommand = onCommand;
  }

  activate(activation: Promise<void>): void {
    this.isAvailable = true;
    this.activation = activation;
  }

  deactivate(): void {
    this.isAvailable = false;
  }

  async dispatch(
    runtime: PluginRuntime,
    command: OrganizationCommand,
    source: CommandInvocationSource,
    detail?: unknown,
  ): Promise<boolean> {
    if (!this.isAvailable || this.activation === null) {
      return false;
    }

    await this.activation;

    if (!this.isAvailable) {
      return false;
    }

    return runtime.commands.dispatch(
      command,
      detail === undefined ? { source } : { source, detail },
    );
  }

  readonly handleCommand = (
    command: OrganizationCommand,
    invocation: CommandInvocation,
  ): void | Promise<void> => this.onCommand(command, invocation);
}

export const useOrganizationCommands = ({
  onCommand,
  getKeymapTargets,
}: UseOrganizationCommandsOptions): OrganizationCommands => {
  const [runtime] = useState(createOrganizationRuntime);
  const [controller] = useState(
    () => new OrganizationCommandController(onCommand),
  );
  const lifecycleQueue = useRef<Promise<void>>(Promise.resolve());

  const enqueueLifecycleOperation = useCallback(
    (operation: () => Promise<void>): Promise<void> => {
      const scheduled = lifecycleQueue.current.then(operation, operation);

      lifecycleQueue.current = scheduled.catch(() => undefined);

      return scheduled;
    },
    [],
  );

  const dispatchOrganizationCommand = useCallback(
    (
      command: OrganizationCommand,
      source: CommandInvocationSource = 'api',
      detail?: unknown,
    ): Promise<boolean> =>
      controller.dispatch(runtime, command, source, detail),
    [controller, runtime],
  );

  useEffect(() => {
    controller.setOnCommand(onCommand);
  }, [controller, onCommand]);

  useEffect(() => {
    const plugin = createOrganizationCommandsPlugin({
      onCommand: controller.handleCommand,
    });
    const activation = enqueueLifecycleOperation(() =>
      runtime.plugins.activate(plugin),
    );
    controller.activate(activation);

    void activation.catch((error: unknown) => {
      console.error('Failed to activate organization commands', error);
    });

    return () => {
      controller.deactivate();

      void enqueueLifecycleOperation(async () => {
        try {
          await activation;
        } catch {
          return;
        }

        await runtime.plugins.deactivate(plugin.id);
      }).catch((error: unknown) => {
        console.error('Failed to deactivate organization commands', error);
      });
    };
  }, [controller, enqueueLifecycleOperation, runtime]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const keyStroke = keyStrokeForEvent(event);

      if (keyStroke === null) {
        return;
      }

      const resolution = runtime.keymaps.resolve(
        [keyStroke],
        getKeymapTargets?.(event) ?? [organizationKeymapTarget],
      );

      if (
        resolution.kind !== 'matched' ||
        !isOrganizationCommand(resolution.binding.command)
      ) {
        return;
      }

      event.preventDefault();
      void dispatchOrganizationCommand(
        resolution.binding.command,
        'keymap',
      ).catch((error: unknown) => {
        console.error('Failed to dispatch organization command', error);
      });
    };

    window.addEventListener('keydown', handleKeyDown, true);

    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [dispatchOrganizationCommand, getKeymapTargets, runtime]);

  return Object.freeze({ dispatchOrganizationCommand });
};

const keyStrokeForEvent = (event: KeyboardEvent): string | null => {
  if (event.isComposing || (event.altKey && (event.metaKey || event.ctrlKey))) {
    return null;
  }

  const key = normalizedKey(event.key);

  if (key === null) {
    return null;
  }

  const modifiers: string[] = [];

  if (event.metaKey || event.ctrlKey) {
    modifiers.push('mod');
  } else if (event.altKey) {
    modifiers.push('alt');
  }

  if (event.shiftKey) {
    modifiers.push('shift');
  }

  return [...modifiers, key].join('-');
};

const normalizedKey = (key: string): string | null => {
  switch (key) {
    case 'ArrowLeft':
      return 'left';
    case 'ArrowRight':
      return 'right';
    case 'Backspace':
      return 'backspace';
    case 'Delete':
      return 'delete';
    case 'Shift':
    case 'Control':
    case 'Meta':
    case 'Alt':
      return null;
    default:
      return key.length === 1 ? key.toLowerCase() : null;
  }
};
