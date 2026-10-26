import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  CommandInvocation,
  CommandInvocationSource,
} from '../../../platform/commands/command.types';
import {
  createPluginRuntime,
  type PluginRuntime,
} from '../../../platform/environment/runtime';

import {
  isOrganizationCommand,
  type OrganizationCommand,
} from '../model/organizationCommands';
import { createOrganizationCommandsPlugin } from '../runtime/organizationCommandsPlugin';

type UseOrganizationCommandsOptions = Readonly<{
  onCreateNote(invocation: CommandInvocation): void | Promise<void>;
}>;

export type OrganizationCommands = Readonly<{
  dispatchOrganizationCommand(
    command: OrganizationCommand,
    source?: CommandInvocationSource,
  ): Promise<boolean>;
}>;

const organizationKeymapTarget = Object.freeze({
  matches: (context: string) => (context === 'workspace.global' ? 1 : null),
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
    private onCreateNote: UseOrganizationCommandsOptions['onCreateNote'],
  ) {}

  setOnCreateNote(
    onCreateNote: UseOrganizationCommandsOptions['onCreateNote'],
  ): void {
    this.onCreateNote = onCreateNote;
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
  ): Promise<boolean> {
    if (!this.isAvailable || this.activation === null) {
      return false;
    }

    await this.activation;

    if (!this.isAvailable) {
      return false;
    }

    return runtime.commands.dispatch(command, { source });
  }

  readonly createNote = (invocation: CommandInvocation): void | Promise<void> =>
    this.onCreateNote(invocation);
}

export const useOrganizationCommands = ({
  onCreateNote,
}: UseOrganizationCommandsOptions): OrganizationCommands => {
  const [runtime] = useState(createOrganizationRuntime);
  const [controller] = useState(
    () => new OrganizationCommandController(onCreateNote),
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
    ): Promise<boolean> => controller.dispatch(runtime, command, source),
    [controller, runtime],
  );

  useEffect(() => {
    controller.setOnCreateNote(onCreateNote);
  }, [controller, onCreateNote]);

  useEffect(() => {
    const plugin = createOrganizationCommandsPlugin({
      onCreateNote: controller.createNote,
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
      if (!(event.metaKey || event.ctrlKey) || event.altKey) {
        return;
      }

      const resolution = runtime.keymaps.resolve(
        [`${event.shiftKey ? 'mod-shift' : 'mod'}-${event.key.toLowerCase()}`],
        [organizationKeymapTarget],
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
  }, [dispatchOrganizationCommand, runtime]);

  return Object.freeze({ dispatchOrganizationCommand });
};
