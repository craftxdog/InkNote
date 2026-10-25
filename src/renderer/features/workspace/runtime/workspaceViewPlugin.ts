import type { InkNotePlugin } from '../../../platform/plugins/plugin.types';
import { createPluginId } from '../../../platform/plugins/plugin.types';

import {
  workspaceViewCommandIds,
  type WorkspaceViewCommand,
} from '../model/viewCommands';

export {
  isWorkspaceViewCommand,
  nextWorkspaceViewMode,
  workspaceViewCommandIds,
  type WorkspaceViewCommand,
} from '../model/viewCommands';

type WorkspaceViewPluginOptions = Readonly<{
  onViewCommand(command: WorkspaceViewCommand): void;
}>;

const workspaceViewPluginId = createPluginId('workspace-view');

const workspaceViewCommands = Object.freeze([
  workspaceViewCommandIds.showEditor,
  workspaceViewCommandIds.showPreview,
  workspaceViewCommandIds.showSideBySide,
  workspaceViewCommandIds.togglePreview,
  workspaceViewCommandIds.toggleSideBySide,
] as const satisfies readonly WorkspaceViewCommand[]);

export const createWorkspaceViewPlugin = (
  options: WorkspaceViewPluginOptions,
): InkNotePlugin => ({
  id: workspaceViewPluginId,
  activate: (environment) => {
    for (const command of workspaceViewCommands) {
      environment.commands.add(command, () => {
        options.onViewCommand(command);
      });
    }

    environment.keymaps.add([
      {
        context: 'workspace.global',
        keystrokes: ['mod-e'],
        command: workspaceViewCommandIds.togglePreview,
      },
      {
        context: 'workspace.global',
        keystrokes: ['mod-p'],
        command: workspaceViewCommandIds.showSideBySide,
      },
    ]);
  },
});
