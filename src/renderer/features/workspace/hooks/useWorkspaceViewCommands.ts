import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

import type { CommandInvocationSource } from '../../../platform/commands/command.types';
import {
  createPluginRuntime,
  type PluginRuntime,
} from '../../../platform/environment/runtime';
import type { WorkspaceViewMode } from '../../../types/workspace';

import {
  isWorkspaceViewCommand,
  nextWorkspaceViewMode,
  type WorkspaceViewCommand,
} from '../model/viewCommands';
import { createWorkspaceViewPlugin } from '../runtime/workspaceViewPlugin';

type UseWorkspaceViewCommandsOptions = Readonly<{
  setViewMode: Dispatch<SetStateAction<WorkspaceViewMode>>;
}>;

type WorkspaceViewCommands = Readonly<{
  dispatchViewCommand(
    command: WorkspaceViewCommand,
    source?: CommandInvocationSource,
  ): Promise<boolean>;
}>;

const workspaceKeymapTarget = Object.freeze({
  matches: (context: string) => (context === 'workspace.global' ? 1 : null),
});

const createWorkspaceRuntime = (): PluginRuntime =>
  createPluginRuntime({
    appVersion: '0.1.0',
    devMode: false,
  });

export const useWorkspaceViewCommands = ({
  setViewMode,
}: UseWorkspaceViewCommandsOptions): WorkspaceViewCommands => {
  const [runtime] = useState(createWorkspaceRuntime);

  const applyViewCommand = useCallback(
    (command: WorkspaceViewCommand): void => {
      setViewMode((currentMode) => nextWorkspaceViewMode(currentMode, command));
    },
    [setViewMode],
  );

  const dispatchViewCommand = useCallback(
    (command: WorkspaceViewCommand, source: CommandInvocationSource = 'api') =>
      runtime.commands.dispatch(command, { source }),
    [runtime],
  );

  useEffect(() => {
    const plugin = createWorkspaceViewPlugin({
      onViewCommand: applyViewCommand,
    });
    const activation = runtime.plugins.activate(plugin);

    void activation.catch((error: unknown) => {
      console.error('Failed to activate workspace view commands', error);
    });

    return () => {
      void activation
        .then(() => runtime.plugins.deactivate(plugin.id))
        .catch((error: unknown) => {
          console.error('Failed to deactivate workspace view commands', error);
        });
    };
  }, [applyViewCommand, runtime]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) {
        return;
      }

      const resolution = runtime.keymaps.resolve(
        [`mod-${event.key.toLowerCase()}`],
        [workspaceKeymapTarget],
      );

      if (resolution.kind !== 'matched') {
        return;
      }

      if (!isWorkspaceViewCommand(resolution.binding.command)) {
        return;
      }

      event.preventDefault();
      void dispatchViewCommand(resolution.binding.command, 'keymap').catch(
        (error: unknown) => {
          console.error('Failed to dispatch workspace view command', error);
        },
      );
    };

    window.addEventListener('keydown', handleKeyDown, true);

    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [dispatchViewCommand, runtime]);

  return Object.freeze({ dispatchViewCommand });
};
